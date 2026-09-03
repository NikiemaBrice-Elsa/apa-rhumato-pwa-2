import { describe, expect, it } from "vitest";
import {
  createQueuedOperation,
  dependencyToken,
  resolveOperation,
  syncQueue,
  type ExecuteOperation,
  type QueuedOperation,
} from "@/lib/offlineQueue";

function op(overrides: Partial<QueuedOperation> & Pick<QueuedOperation, "id">): QueuedOperation {
  return createQueuedOperation({
    entityType: "session",
    method: "POST",
    url: "/api/sessions",
    createdAt: "2026-08-19T10:00:00Z",
    ...overrides,
  });
}

describe("resolveOperation (§54 — substitution d'identifiants entre opérations dépendantes)", () => {
  it("remplace le jeton de dépendance dans l'URL et le corps", () => {
    const dependent = op({
      id: "op-2",
      method: "PATCH",
      url: `/api/sessions/${dependencyToken("op-1")}`,
      body: { realisee: true, sessionRef: dependencyToken("op-1") },
      dependsOnOperationId: "op-1",
    });
    const resolvedIds = new Map([["op-1", "server-session-42"]]);
    const { url, body } = resolveOperation(dependent, resolvedIds);
    expect(url).toBe("/api/sessions/server-session-42");
    expect(body).toEqual({ realisee: true, sessionRef: "server-session-42" });
  });

  it("laisse l'URL/le corps inchangés si aucune dépendance n'est résolue", () => {
    const independent = op({ id: "op-1" });
    const { url } = resolveOperation(independent, new Map());
    expect(url).toBe("/api/sessions");
  });
});

describe("syncQueue — succès simple", () => {
  it("synchronise une opération isolée et la retire de la file", async () => {
    const queue = [op({ id: "op-1" })];
    const execute: ExecuteOperation = async () => ({ ok: true, serverId: "server-1" });
    const { updatedQueue, summary } = await syncQueue(queue, execute);
    expect(updatedQueue).toHaveLength(0);
    expect(summary.synced).toEqual(["op-1"]);
    expect(summary.stoppedEarly).toBe(false);
  });
});

describe("syncQueue — ordre et dépendances", () => {
  it("synchronise une opération dépendante avec l'identifiant serveur de sa dépendance déjà résolue", async () => {
    const start = op({ id: "start", method: "POST", url: "/api/sessions" });
    const feedback = op({
      id: "feedback",
      method: "PATCH",
      url: `/api/sessions/${dependencyToken("start")}`,
      body: { realisee: true },
      dependsOnOperationId: "start",
    });

    const seenUrls: string[] = [];
    const execute: ExecuteOperation = async (resolved) => {
      seenUrls.push(resolved.url);
      if (resolved.url === "/api/sessions") return { ok: true, serverId: "real-session-id" };
      return { ok: true };
    };

    const { updatedQueue, summary } = await syncQueue([start, feedback], execute);
    expect(seenUrls).toEqual(["/api/sessions", "/api/sessions/real-session-id"]);
    expect(updatedQueue).toHaveLength(0);
    expect(summary.synced).toEqual(["start", "feedback"]);
  });
});

describe("syncQueue — échec réseau (hors connexion)", () => {
  it("arrête le traitement et conserve tout, sans rien perdre", async () => {
    const queue = [op({ id: "op-1" }), op({ id: "op-2" })];
    const execute: ExecuteOperation = async () => ({ ok: false, kind: "network", error: "Failed to fetch" });
    const { updatedQueue, summary } = await syncQueue(queue, execute);
    expect(updatedQueue).toHaveLength(2);
    expect(updatedQueue.every((o) => o.status === "pending")).toBe(true);
    expect(summary.synced).toEqual([]);
    expect(summary.stoppedEarly).toBe(true);
  });

  it("un échec réseau sur la première opération n'empêche pas de retenter plus tard (idempotence de l'appel)", async () => {
    let attempt = 0;
    const queue = [op({ id: "op-1" })];
    const execute: ExecuteOperation = async () => {
      attempt += 1;
      if (attempt === 1) return { ok: false, kind: "network", error: "offline" };
      return { ok: true, serverId: "server-1" };
    };

    const first = await syncQueue(queue, execute);
    expect(first.updatedQueue).toHaveLength(1);

    const second = await syncQueue(first.updatedQueue, execute);
    expect(second.updatedQueue).toHaveLength(0);
    expect(second.summary.synced).toEqual(["op-1"]);
  });
});

describe("syncQueue — gestion des conflits (§54)", () => {
  it("marque une opération en conflit plutôt que de la perdre ou de bloquer indéfiniment", async () => {
    const queue = [op({ id: "op-1" })];
    const execute: ExecuteOperation = async () => ({ ok: false, kind: "conflict", error: "409" });
    const { updatedQueue, summary } = await syncQueue(queue, execute);
    expect(updatedQueue).toHaveLength(1);
    expect(updatedQueue[0].status).toBe("conflict");
    expect(summary.conflicted).toEqual(["op-1"]);
  });

  it("répercute le conflit sur les opérations dépendantes (cascade), sans les exécuter", async () => {
    const start = op({ id: "start" });
    const feedback = op({
      id: "feedback",
      method: "PATCH",
      url: `/api/sessions/${dependencyToken("start")}`,
      dependsOnOperationId: "start",
    });

    const executed: string[] = [];
    const execute: ExecuteOperation = async (_resolved, opArg) => {
      executed.push(opArg.id);
      return { ok: false, kind: "conflict", error: "409" };
    };

    const { updatedQueue, summary } = await syncQueue([start, feedback], execute);
    expect(executed).toEqual(["start"]); // feedback jamais exécuté : la dépendance est déjà en conflit
    expect(updatedQueue.map((o) => o.status)).toEqual(["conflict", "conflict"]);
    expect(summary.conflicted).toEqual(["start", "feedback"]);
  });

  it("continue de traiter les opérations indépendantes après un conflit sur une autre", async () => {
    const conflicting = op({ id: "conflicting" });
    const independent = op({ id: "independent", url: "/api/measurements" });

    const execute: ExecuteOperation = async (resolved) => {
      if (resolved.url === "/api/sessions") return { ok: false, kind: "conflict", error: "409" };
      return { ok: true, serverId: "measurement-1" };
    };

    const { updatedQueue, summary } = await syncQueue([conflicting, independent], execute);
    expect(summary.conflicted).toEqual(["conflicting"]);
    expect(summary.synced).toEqual(["independent"]);
    expect(updatedQueue).toHaveLength(1);
    expect(updatedQueue[0].id).toBe("conflicting");
  });
});
