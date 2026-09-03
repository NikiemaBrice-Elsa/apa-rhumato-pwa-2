import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: () => ({ get: () => undefined, set: () => {} }),
}));

const { GET: getWeekly } = await import("@/app/api/statistics/weekly/route");
const { GET: getHistory } = await import("@/app/api/statistics/history/route");

/**
 * Tests fonctionnels (§55), Sprint 9. Sans session, aucune route de
 * statistiques ne doit exposer de donnée avant vérification de l'authentification.
 */
describe("GET /api/statistics/weekly", () => {
  it("rejette une requête non authentifiée", async () => {
    const response = await getWeekly();
    expect(response.status).toBe(401);
  });
});

describe("GET /api/statistics/history", () => {
  it("rejette une requête non authentifiée", async () => {
    const response = await getHistory(new Request("http://localhost/api/statistics/history"));
    expect(response.status).toBe(401);
  });
});
