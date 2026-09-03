import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: () => ({ get: () => undefined, set: () => {} }),
}));

const { GET: getPlanningToday } = await import("@/app/api/planning/today/route");
const { POST: postPostpone } = await import("@/app/api/planning/[id]/postpone/route");
const { POST: postCancelSafety } = await import("@/app/api/planning/[id]/cancel-safety/route");

/**
 * Tests fonctionnels (§55), Sprint 19 (31/08/2026, réf. B11). Sans session,
 * aucune route de « séance du jour » ne doit exposer ou modifier de donnée
 * avant vérification de l'authentification (§46).
 */
describe("GET /api/planning/today", () => {
  it("rejette une requête non authentifiée", async () => {
    const response = await getPlanningToday();
    expect(response.status).toBe(401);
  });
});

describe("POST /api/planning/[id]/postpone", () => {
  it("rejette une requête non authentifiée", async () => {
    const response = await postPostpone(
      new Request("http://localhost/api/planning/fixture-id/postpone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newDate: "2099-01-01" }),
      }),
      { params: { id: "fixture-id" } }
    );
    expect(response.status).toBe(401);
  });
});

describe("POST /api/planning/[id]/cancel-safety", () => {
  it("rejette une requête non authentifiée", async () => {
    const response = await postCancelSafety(
      new Request("http://localhost/api/planning/fixture-id/cancel-safety", { method: "POST" }),
      { params: { id: "fixture-id" } }
    );
    expect(response.status).toBe(401);
  });
});
