import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: () => ({ get: () => undefined, set: () => {} }),
}));

const { POST: postAssessment } = await import("@/app/api/assessments/route");

/**
 * Test fonctionnel (§55). Sans session, la création d'évaluation doit être
 * rejetée (401) avant même d'atteindre le moteur de règles ou la base.
 */
describe("POST /api/assessments", () => {
  it("rejette une requête non authentifiée", async () => {
    const request = new Request("http://localhost/api/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pathology: "LOMBALGIE_COMMUNE", responses: {} }),
    });

    const response = await postAssessment(request);
    expect(response.status).toBe(401);
  });
});

// La validation du schéma (pathologie hors des six modules V1, réponses mal
// formées…) est couverte indépendamment de l'authentification dans
// packages/domain/src/__tests__/screening.test.ts (initialAssessmentSchema).
