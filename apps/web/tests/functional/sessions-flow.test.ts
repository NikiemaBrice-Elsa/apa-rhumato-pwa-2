import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: () => ({ get: () => undefined, set: () => {} }),
}));

const { POST: postSession, GET: getSessions } = await import("@/app/api/sessions/route");
const { PATCH: patchSession } = await import("@/app/api/sessions/[id]/route");

/**
 * Tests fonctionnels (§55), Sprint 7. Sans session, aucune route séance ne
 * doit exposer ou modifier de donnée avant vérification de l'authentification.
 */
describe("POST /api/sessions", () => {
  it("rejette une requête non authentifiée", async () => {
    const response = await postSession(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathology: "ARTHROSE_GENOU" }),
      })
    );
    expect(response.status).toBe(401);
  });
});

describe("GET /api/sessions", () => {
  it("rejette une requête non authentifiée", async () => {
    const response = await getSessions();
    expect(response.status).toBe(401);
  });
});

describe("PATCH /api/sessions/[id]", () => {
  it("rejette une requête non authentifiée", async () => {
    const response = await patchSession(
      new Request("http://localhost/api/sessions/fixture-id", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ realisee: true }),
      }),
      { params: { id: "fixture-id" } }
    );
    expect(response.status).toBe(401);
  });
});
