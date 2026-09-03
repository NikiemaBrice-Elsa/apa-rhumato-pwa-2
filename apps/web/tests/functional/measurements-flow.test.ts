import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: () => ({ get: () => undefined, set: () => {} }),
}));

const { POST: postMeasurement, GET: getMeasurements } = await import("@/app/api/measurements/route");
const { DELETE: deleteMeasurement } = await import("@/app/api/measurements/[id]/route");
const { GET: getPainHistory } = await import("@/app/api/measurements/pain/route");

/**
 * Tests fonctionnels (§55), Sprint 8. Sans session, aucune route de suivi ne
 * doit exposer ou modifier de donnée avant vérification de l'authentification.
 */
describe("POST /api/measurements", () => {
  it("rejette une requête non authentifiée", async () => {
    const response = await postMeasurement(
      new Request("http://localhost/api/measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ measurementType: "poids", weightKg: 70 }),
      })
    );
    expect(response.status).toBe(401);
  });
});

describe("GET /api/measurements", () => {
  it("rejette une requête non authentifiée", async () => {
    const response = await getMeasurements(new Request("http://localhost/api/measurements"));
    expect(response.status).toBe(401);
  });
});

describe("DELETE /api/measurements/[id]", () => {
  it("rejette une requête non authentifiée", async () => {
    const response = await deleteMeasurement(new Request("http://localhost/api/measurements/fixture-id", { method: "DELETE" }), {
      params: { id: "fixture-id" },
    });
    expect(response.status).toBe(401);
  });
});

describe("GET /api/measurements/pain", () => {
  it("rejette une requête non authentifiée", async () => {
    const response = await getPainHistory();
    expect(response.status).toBe(401);
  });
});
