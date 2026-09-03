import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: () => ({ get: () => undefined, set: () => {} }),
}));

const { GET: getProgression } = await import("@/app/api/statistics/progression/route");
const { POST: postProgress } = await import("@/app/api/programs/progress/route");

/**
 * Tests fonctionnels (§55), Sprint 18 (31/08/2026). Sans session, ni la
 * lecture de la recommandation de progression ni la bascule de niveau ne
 * doivent exposer ou modifier quoi que ce soit avant vérification de
 * l'authentification (§46).
 */
describe("GET /api/statistics/progression", () => {
  it("rejette une requête non authentifiée", async () => {
    const response = await getProgression();
    expect(response.status).toBe(401);
  });
});

describe("POST /api/programs/progress", () => {
  it("rejette une requête non authentifiée avant même de lire le corps de la requête", async () => {
    const response = await postProgress(
      new Request("http://localhost/api/programs/progress", {
        method: "POST",
        body: JSON.stringify({ pathology: "LOMBALGIE_COMMUNE" }),
      })
    );
    expect(response.status).toBe(401);
  });
});
