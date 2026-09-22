"use client";

import {
  createQueuedOperation,
  syncQueue,
  type CreateQueuedOperationInput,
  type ExecuteOperation,
  type QueuedOperation,
  type SyncSummary,
} from "./offlineQueue";

/**
 * Adaptateur navigateur (§54, Sprint 12) : branche la logique pure de
 * offlineQueue.ts sur `localStorage` (persistance "temporaire" au sens du
 * §54 — un simple espace texte suffit, la file ne contient jamais de
 * contenu volumineux comme des vidéos, qui sont gérées par le service
 * worker) et sur `fetch` réel. Rien de testable unitairement ici (dépend du
 * DOM/réseau réel) — c'est volontairement mince, toute la logique décisionnelle
 * vit dans offlineQueue.ts et y est testée.
 */

const STORAGE_KEY = "apa_offline_queue_v1";
const QUEUE_CHANGED_EVENT = "apa:offline-queue-changed";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getQueue(): QueuedOperation[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueuedOperation[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedOperation[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT));
}

export function enqueueOperation(input: Omit<CreateQueuedOperationInput, "createdAt">): QueuedOperation {
  const operation = createQueuedOperation({ ...input, createdAt: new Date().toISOString() });
  const queue = getQueue();
  queue.push(operation);
  saveQueue(queue);
  return operation;
}

export function getPendingCount(): number {
  return getQueue().filter((op) => op.status === "pending").length;
}

export function getConflictCount(): number {
  return getQueue().filter((op) => op.status === "conflict").length;
}

/**
 * Efface les opérations en `conflict` de la file (§79, 22/09/2026) : une
 * opération en conflit n'est JAMAIS retentée automatiquement par
 * `syncQueue` (offlineQueue.ts, §54) — sans ce geste explicite, le bandeau
 * rouge restait affiché indéfiniment, y compris après le retour de
 * connexion et une nouvelle saisie réussie de la même information depuis
 * l'écran d'origine, car l'ancienne entrée en conflit n'était jamais
 * retirée de `localStorage`. Ce n'est pas une resynchronisation à valider
 * (rien n'est renvoyé au serveur) : c'est un simple effacement de l'alerte,
 * une fois que le patient a ressaisi l'information concernée.
 */
export function clearConflicts(): void {
  const queue = getQueue().filter((op) => op.status !== "conflict");
  saveQueue(queue);
}

export function onQueueChanged(callback: () => void): () => void {
  if (!isBrowser()) return () => {};
  window.addEventListener(QUEUE_CHANGED_EVENT, callback);
  return () => window.removeEventListener(QUEUE_CHANGED_EVENT, callback);
}

function extractServerId(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const record = data as Record<string, unknown>;
  if (typeof record.sessionId === "string") return record.sessionId;
  if (typeof record.id === "string") return record.id;
  if (record.measurement && typeof (record.measurement as Record<string, unknown>).id === "string") {
    return (record.measurement as Record<string, unknown>).id as string;
  }
  return undefined;
}

const fetchExecutor: ExecuteOperation = async (resolved, op) => {
  try {
    const response = await fetch(resolved.url, {
      method: op.method,
      headers: resolved.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: resolved.body !== undefined ? JSON.stringify(resolved.body) : undefined,
    });

    if (response.ok) {
      const data = await response.json().catch(() => null);
      return { ok: true, serverId: extractServerId(data) };
    }

    if ([404, 409, 422].includes(response.status)) {
      const data = await response.json().catch(() => null);
      const message = data && typeof data === "object" && "message" in data ? String(data.message) : `HTTP ${response.status}`;
      return { ok: false, kind: "conflict", error: message };
    }

    return { ok: false, kind: "network", error: `HTTP ${response.status}` };
  } catch (err) {
    return { ok: false, kind: "network", error: err instanceof Error ? err.message : "Erreur réseau" };
  }
};

/** Rejoue la file en attente. Sans effet si rien n'est en attente ou si le
 * navigateur est hors ligne (les opérations restent dans la file). */
export async function syncNow(): Promise<SyncSummary> {
  if (!isBrowser()) {
    return { synced: [], conflicted: [], stoppedEarly: false };
  }
  const queue = getQueue();
  if (queue.length === 0) {
    return { synced: [], conflicted: [], stoppedEarly: false };
  }
  const { updatedQueue, summary } = await syncQueue(queue, fetchExecutor);
  saveQueue(updatedQueue);
  return summary;
}
