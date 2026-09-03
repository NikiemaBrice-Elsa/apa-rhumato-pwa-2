import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: () => ({ get: () => undefined, set: () => {} }),
}));

const { POST: postAssessment, GET: getAssessments } = await import("@/app/api/functional-capacity/route");
const { DELETE: deleteAssessment } = await import("@/app/api/functional-capacity/[id]/route");

/**
 * Tests fonctionnels (§55), §33 réf. B10, Sprint 18. Même minimum que les
 * autres routes de suivi : aucune donnée exposée ou modifiée sans session.
 */
describe("POST /api/functional-capacity", () => {
  it("rejette une requête non authentifiée", async () => {
    const response = await postAssessment(
      new Request("http://localhost/api/functional-capacity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrument: "psfs",
          activities: [
            { activityLabel: "Monter les escaliers", difficultyScore: 6 },
            { activityLabel: "Porter les courses", difficultyScore: 4 },
            { activityLabel: "Jardiner", difficultyScore: 8 },
          ],
        }),
      })
    );
    expect(response.status).toBe(401);
  });
});

describe("GET /api/functional-capacity", () => {
  it("rejette une requête non authentifiée", async () => {
    const response = await getAssessments();
    expect(response.status).toBe(401);
  });
});

describe("DELETE /api/functional-capacity/[id]", () => {
  it("rejette une requête non authentifiée", async () => {
    const response = await deleteAssessment(
      new Request("http://localhost/api/functional-capacity/fixture-id", { method: "DELETE" }),
      { params: { id: "fixture-id" } }
    );
    expect(response.status).toBe(401);
  });
});
