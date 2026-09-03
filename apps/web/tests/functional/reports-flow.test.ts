import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: () => ({ get: () => undefined, set: () => {} }),
}));

const { POST: postReport } = await import("@/app/api/reports/pdf/route");

/**
 * Test fonctionnel (§55), Sprint 10. Sans session, la génération de rapport
 * ne doit jamais s'exécuter (pas d'accès aux données, pas de PDF généré).
 */
describe("POST /api/reports/pdf", () => {
  it("rejette une requête non authentifiée", async () => {
    const response = await postReport(
      new Request("http://localhost/api/reports/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathology: "ARTHROSE_GENOU" }),
      })
    );
    expect(response.status).toBe(401);
  });
});
