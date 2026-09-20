import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: () => ({ get: () => undefined, set: () => {} }),
}));

const { POST: postActivity, GET: getActivities } = await import("@/app/api/physical-activities/route");

/**
 * Tests fonctionnels (§55), Sprint 26 (21/09/2026) — historique des
 * activités physiques (chronomètre + suivi de marche/vélo GPS, Sprint 25).
 * Même discipline que measurements-flow.test.ts (Sprint 8) : sans session,
 * aucune route ne doit exposer ou modifier de donnée avant vérification de
 * l'authentification.
 */
describe("POST /api/physical-activities", () => {
  it("rejette une requête non authentifiée", async () => {
    const response = await postActivity(
      new Request("http://localhost/api/physical-activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityType: "marche",
          durationSeconds: 600,
          startedAt: "2026-09-21T08:00:00Z",
          completedAt: "2026-09-21T08:10:00Z",
        }),
      })
    );
    expect(response.status).toBe(401);
  });
});

describe("GET /api/physical-activities", () => {
  it("rejette une requête non authentifiée", async () => {
    const response = await getActivities(new Request("http://localhost/api/physical-activities"));
    expect(response.status).toBe(401);
  });
});
