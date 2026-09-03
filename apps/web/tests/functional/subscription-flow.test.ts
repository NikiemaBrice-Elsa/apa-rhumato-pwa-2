import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: () => ({ get: () => undefined, set: () => {} }),
}));

const { GET: getSubscription } = await import("@/app/api/subscription/route");
const { POST: postSubscriptionRequest } = await import("@/app/api/subscription/request/route");
const { GET: getPayments, POST: postPayment } = await import("@/app/api/payments/route");

/**
 * Tests fonctionnels (§55), Sprint 14. Même principe que tous les sprints
 * précédents : sans session, aucune route ne doit exposer ou modifier de
 * donnée avant vérification de l'authentification (§46).
 */
describe("GET /api/subscription", () => {
  it("rejette une requête non authentifiée", async () => {
    const response = await getSubscription();
    expect(response.status).toBe(401);
  });
});

describe("POST /api/subscription/request", () => {
  it("rejette une requête non authentifiée", async () => {
    const response = await postSubscriptionRequest(
      new Request("http://localhost/api/subscription/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode: "premium_monthly" }),
      })
    );
    expect(response.status).toBe(401);
  });
});

describe("GET /api/payments", () => {
  it("rejette une requête non authentifiée", async () => {
    const response = await getPayments();
    expect(response.status).toBe(401);
  });
});

describe("POST /api/payments", () => {
  it("rejette une requête non authentifiée", async () => {
    const response = await postPayment(
      new Request("http://localhost/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId: "fixture-id",
          provider: "orange_money",
          amount: 2000,
          currency: "XOF",
          externalReference: "TX123",
        }),
      })
    );
    expect(response.status).toBe(401);
  });
});
