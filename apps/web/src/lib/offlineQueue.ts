/**
 * Mode hors connexion (§54, §10) — Sprint 12.
 *
 * Logique PURE de la file d'écritures en attente : aucun accès réseau,
 * aucun `localStorage`/IndexedDB ici (voir offlineStorage.ts pour
 * l'adaptateur navigateur). Ce fichier ne fait que décider QUOI faire d'une
 * file d'opérations, ce qui le rend testable de façon déterministe — même
 * discipline que packages/rules-engine (pur + testé, adaptateur mince à
 * côté).
 *
 * §54 : « Les données saisies hors connexion doivent être stockées
 * localement temporairement puis synchronisées. Prévoir la gestion des
 * conflits. » Deux mécanismes répondent à ces deux phrases :
 * - une opération peut dépendre du résultat d'une opération précédente
 *   (ex. clôturer une séance dont le démarrage n'a pas encore été
 *   synchronisé) : `dependsOnOperationId` + un jeton `{{op:<id>}}` dans
 *   l'URL/le corps, substitué par l'identifiant réel renvoyé par le serveur ;
 * - un échec serveur non transitoire (409/404/422) marque l'opération (et
 *   tout ce qui en dépend) comme `conflict` plutôt que de la garder bloquée
 *   indéfiniment ou de l'abandonner silencieusement (§79 : transparence).
 */

export type QueuedOperationStatus = "pending" | "conflict";

export interface QueuedOperation {
  id: string;
  entityType: string;
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  /** Peut contenir le jeton `{{op:<dependsOnOperationId>}}`, résolu à la synchronisation. */
  url: string;
  body?: unknown;
  createdAt: string;
  dependsOnOperationId?: string | null;
  status: QueuedOperationStatus;
  lastError?: string | null;
}

export interface CreateQueuedOperationInput {
  id: string;
  entityType: string;
  method: QueuedOperation["method"];
  url: string;
  body?: unknown;
  createdAt: string;
  dependsOnOperationId?: string | null;
}

export function createQueuedOperation(input: CreateQueuedOperationInput): QueuedOperation {
  return {
    id: input.id,
    entityType: input.entityType,
    method: input.method,
    url: input.url,
    body: input.body,
    createdAt: input.createdAt,
    dependsOnOperationId: input.dependsOnOperationId ?? null,
    status: "pending",
    lastError: null,
  };
}

export function dependencyToken(operationId: string): string {
  return `{{op:${operationId}}}`;
}

function substituteTokensUnknown(value: unknown, resolvedIds: Map<string, string>): unknown {
  if (typeof value === "string") {
    let result: string = value;
    for (const [opId, serverId] of resolvedIds.entries()) {
      result = result.split(dependencyToken(opId)).join(serverId);
    }
    return result;
  }
  if (Array.isArray(value)) {
    return value.map((item) => substituteTokensUnknown(item, resolvedIds));
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(([k, v]) => [
      k,
      substituteTokensUnknown(v, resolvedIds),
    ]);
    return Object.fromEntries(entries);
  }
  return value;
}

function substituteTokens<T>(value: T, resolvedIds: Map<string, string>): T {
  return substituteTokensUnknown(value, resolvedIds) as T;
}

/** Résout l'URL et le corps d'une opération en remplaçant les jetons de
 * dépendance par les identifiants serveur déjà connus. */
export function resolveOperation(
  op: QueuedOperation,
  resolvedIds: Map<string, string>
): { url: string; body: unknown } {
  return {
    url: substituteTokens(op.url, resolvedIds),
    body: op.body === undefined ? undefined : substituteTokens(op.body, resolvedIds),
  };
}

export type ExecuteOutcome =
  | { ok: true; serverId?: string }
  | { ok: false; kind: "network"; error: string }
  | { ok: false; kind: "conflict"; error: string };

export type ExecuteOperation = (
  resolved: { url: string; body: unknown },
  op: QueuedOperation
) => Promise<ExecuteOutcome>;

export interface SyncSummary {
  synced: string[];
  conflicted: string[];
  stoppedEarly: boolean;
}

/**
 * Traite la file dans l'ordre d'arrivée (FIFO) : une opération dépendante
 * est toujours enfilée après sa dépendance, donc traiter dans l'ordre
 * garantit que l'identifiant serveur dont elle a besoin est déjà résolu
 * avant qu'on l'atteigne. Un échec réseau interrompt le traitement (les
 * opérations restantes restent `pending`, rien n'est perdu). Un conflit
 * marque l'opération ET toutes celles qui en dépendent (directement ou en
 * cascade) comme `conflict`, puis le traitement continue avec les
 * opérations indépendantes suivantes plutôt que de tout bloquer.
 */
export async function syncQueue(
  queue: QueuedOperation[],
  execute: ExecuteOperation
): Promise<{ updatedQueue: QueuedOperation[]; summary: SyncSummary }> {
  const resolvedIds = new Map<string, string>();
  const conflictedOperationIds = new Set<string>();
  const remaining: QueuedOperation[] = [];
  const synced: string[] = [];
  const conflicted: string[] = [];
  let stoppedEarly = false;

  for (const op of queue) {
    if (op.status === "conflict") {
      remaining.push(op);
      conflictedOperationIds.add(op.id);
      continue;
    }

    if (op.dependsOnOperationId && conflictedOperationIds.has(op.dependsOnOperationId)) {
      const cascaded: QueuedOperation = { ...op, status: "conflict", lastError: "Dépendance en conflit." };
      remaining.push(cascaded);
      conflictedOperationIds.add(op.id);
      conflicted.push(op.id);
      continue;
    }

    if (stoppedEarly) {
      remaining.push(op);
      continue;
    }

    const resolved = resolveOperation(op, resolvedIds);
    const outcome = await execute(resolved, op);

    if (outcome.ok) {
      if (outcome.serverId) {
        resolvedIds.set(op.id, outcome.serverId);
      }
      synced.push(op.id);
      continue;
    }

    if (outcome.kind === "conflict") {
      const conflictedOp: QueuedOperation = { ...op, status: "conflict", lastError: outcome.error };
      remaining.push(conflictedOp);
      conflictedOperationIds.add(op.id);
      conflicted.push(op.id);
      continue;
    }

    // Échec réseau (hors connexion, timeout…) : on s'arrête là, rien n'est
    // perdu, on retentera au prochain appel (ex. évènement 'online').
    stoppedEarly = true;
    remaining.push({ ...op, lastError: outcome.error });
  }

  return {
    updatedQueue: remaining,
    summary: { synced, conflicted, stoppedEarly },
  };
}
