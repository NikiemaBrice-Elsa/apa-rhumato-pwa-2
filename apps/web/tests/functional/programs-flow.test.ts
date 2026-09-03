import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: () => ({ get: () => undefined, set: () => {} }),
}));

const { GET: getPrograms } = await import("@/app/api/programs/route");

/**
 * Test fonctionnel (§55), Sprint 6. Sans session, la lecture des programmes
 * attribués doit être rejetée (401) avant tout accès à la base.
 */
describe("GET /api/programs", () => {
  it("rejette une requête non authentifiée", async () => {
    const response = await getPrograms();
    expect(response.status).toBe(401);
  });
});
