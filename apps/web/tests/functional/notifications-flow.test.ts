import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: () => ({ get: () => undefined, set: () => {} }),
}));

const { GET: getNotifications } = await import("@/app/api/notifications/route");
const { PATCH: patchNotification, DELETE: deleteNotification } = await import("@/app/api/notifications/[id]/route");
const { POST: syncNotifications } = await import("@/app/api/notifications/sync/route");

/**
 * Tests fonctionnels (§55), Sprint 11. Sans session, aucune route de
 * notifications ne doit exposer ou modifier de donnée avant vérification de
 * l'authentification.
 */
describe("GET /api/notifications", () => {
  it("rejette une requête non authentifiée", async () => {
    const response = await getNotifications();
    expect(response.status).toBe(401);
  });
});

describe("PATCH /api/notifications/[id]", () => {
  it("rejette une requête non authentifiée", async () => {
    const response = await patchNotification(
      new Request("http://localhost/api/notifications/fixture-id", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      }),
      { params: { id: "fixture-id" } }
    );
    expect(response.status).toBe(401);
  });
});

describe("DELETE /api/notifications/[id]", () => {
  it("rejette une requête non authentifiée", async () => {
    const response = await deleteNotification(
      new Request("http://localhost/api/notifications/fixture-id", { method: "DELETE" }),
      { params: { id: "fixture-id" } }
    );
    expect(response.status).toBe(401);
  });
});

describe("POST /api/notifications/sync", () => {
  it("rejette une requête non authentifiée", async () => {
    const response = await syncNotifications();
    expect(response.status).toBe(401);
  });
});
