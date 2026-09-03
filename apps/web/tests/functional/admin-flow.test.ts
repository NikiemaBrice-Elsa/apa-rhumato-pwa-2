import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: () => ({ get: () => undefined, set: () => {} }),
}));

const { GET: getDashboard } = await import("@/app/api/admin/dashboard/route");
const { GET: getUsers } = await import("@/app/api/admin/users/route");
const { PATCH: patchUser } = await import("@/app/api/admin/users/[id]/route");
const { GET: getPathologies } = await import("@/app/api/admin/pathologies/route");
const { PATCH: patchPathology } = await import("@/app/api/admin/pathologies/[id]/route");
const { GET: getReferences, POST: postReference } = await import("@/app/api/admin/references/route");
const { PATCH: patchReference } = await import("@/app/api/admin/references/[id]/route");
const { GET: getExercises, POST: postExercise } = await import("@/app/api/admin/exercises/route");
const { PATCH: patchExercise } = await import("@/app/api/admin/exercises/[id]/route");
const { GET: getPrograms, POST: postProgram } = await import("@/app/api/admin/programs/route");
const { PATCH: patchProgram } = await import("@/app/api/admin/programs/[id]/route");
const { GET: getClinicalRules, POST: postClinicalRule } = await import("@/app/api/admin/clinical-rules/route");
const { PATCH: patchClinicalRule } = await import("@/app/api/admin/clinical-rules/[id]/route");
const { GET: getScientificReport } = await import("@/app/api/admin/scientific-report/route");
const { GET: getAuditLogs } = await import("@/app/api/admin/audit-logs/route");
const { GET: getAdminNotifications } = await import("@/app/api/admin/notifications/route");
const { GET: getSubscriptions } = await import("@/app/api/admin/subscriptions/route");
const { PATCH: patchSubscription } = await import("@/app/api/admin/subscriptions/[id]/route");
const { GET: getSubscriptionPlans } = await import("@/app/api/admin/subscription-plans/route");
const { PATCH: patchSubscriptionPlan } = await import("@/app/api/admin/subscription-plans/[planCode]/route");
const { GET: getAdminPayments } = await import("@/app/api/admin/payments/route");
const { PATCH: patchAdminPayment } = await import("@/app/api/admin/payments/[id]/route");

/**
 * Tests fonctionnels (§55), Sprint 13. Même principe que tous les sprints
 * précédents : sans session, AUCUNE route admin ne doit répondre autre
 * chose que 401 — c'est `requireAdmin` (voir tests/security/
 * admin-requires-role.test.ts pour sa logique fine de rôle/statut) qui doit
 * intercepter la requête avant toute lecture/écriture via service_role.
 */
function req(url: string, init?: RequestInit) {
  return new Request(url, init);
}

describe("Routes /api/admin/* — accès non authentifié", () => {
  it("GET /api/admin/dashboard -> 401", async () => {
    expect((await getDashboard()).status).toBe(401);
  });

  it("GET /api/admin/users -> 401", async () => {
    expect((await getUsers(req("http://localhost/api/admin/users"))).status).toBe(401);
  });

  it("PATCH /api/admin/users/[id] -> 401", async () => {
    const response = await patchUser(req("http://localhost/api/admin/users/u1", { method: "PATCH", body: "{}" }), {
      params: { id: "u1" },
    });
    expect(response.status).toBe(401);
  });

  it("GET /api/admin/pathologies -> 401", async () => {
    expect((await getPathologies()).status).toBe(401);
  });

  it("PATCH /api/admin/pathologies/[id] -> 401", async () => {
    const response = await patchPathology(req("http://localhost/api/admin/pathologies/p1", { method: "PATCH", body: "{}" }), {
      params: { id: "p1" },
    });
    expect(response.status).toBe(401);
  });

  it("GET /api/admin/references -> 401", async () => {
    expect((await getReferences()).status).toBe(401);
  });

  it("POST /api/admin/references -> 401", async () => {
    const response = await postReference(req("http://localhost/api/admin/references", { method: "POST", body: "{}" }));
    expect(response.status).toBe(401);
  });

  it("PATCH /api/admin/references/[id] -> 401", async () => {
    const response = await patchReference(req("http://localhost/api/admin/references/r1", { method: "PATCH", body: "{}" }), {
      params: { id: "r1" },
    });
    expect(response.status).toBe(401);
  });

  it("GET /api/admin/exercises -> 401", async () => {
    expect((await getExercises()).status).toBe(401);
  });

  it("POST /api/admin/exercises -> 401", async () => {
    const response = await postExercise(req("http://localhost/api/admin/exercises", { method: "POST", body: "{}" }));
    expect(response.status).toBe(401);
  });

  it("PATCH /api/admin/exercises/[id] -> 401", async () => {
    const response = await patchExercise(req("http://localhost/api/admin/exercises/e1", { method: "PATCH", body: "{}" }), {
      params: { id: "e1" },
    });
    expect(response.status).toBe(401);
  });

  it("GET /api/admin/programs -> 401", async () => {
    expect((await getPrograms()).status).toBe(401);
  });

  it("POST /api/admin/programs -> 401", async () => {
    const response = await postProgram(req("http://localhost/api/admin/programs", { method: "POST", body: "{}" }));
    expect(response.status).toBe(401);
  });

  it("PATCH /api/admin/programs/[id] -> 401", async () => {
    const response = await patchProgram(req("http://localhost/api/admin/programs/pr1", { method: "PATCH", body: "{}" }), {
      params: { id: "pr1" },
    });
    expect(response.status).toBe(401);
  });

  it("GET /api/admin/clinical-rules -> 401", async () => {
    expect((await getClinicalRules()).status).toBe(401);
  });

  it("POST /api/admin/clinical-rules -> 401", async () => {
    const response = await postClinicalRule(req("http://localhost/api/admin/clinical-rules", { method: "POST", body: "{}" }));
    expect(response.status).toBe(401);
  });

  it("PATCH /api/admin/clinical-rules/[id] -> 401", async () => {
    const response = await patchClinicalRule(req("http://localhost/api/admin/clinical-rules/RULE_1", { method: "PATCH", body: "{}" }), {
      params: { id: "RULE_1" },
    });
    expect(response.status).toBe(401);
  });

  it("GET /api/admin/scientific-report -> 401", async () => {
    expect((await getScientificReport()).status).toBe(401);
  });

  it("GET /api/admin/audit-logs -> 401", async () => {
    expect((await getAuditLogs(req("http://localhost/api/admin/audit-logs"))).status).toBe(401);
  });

  it("GET /api/admin/notifications -> 401", async () => {
    expect((await getAdminNotifications()).status).toBe(401);
  });

  it("GET /api/admin/subscriptions -> 401", async () => {
    expect((await getSubscriptions(req("http://localhost/api/admin/subscriptions"))).status).toBe(401);
  });

  it("PATCH /api/admin/subscriptions/[id] -> 401", async () => {
    const response = await patchSubscription(req("http://localhost/api/admin/subscriptions/s1", { method: "PATCH", body: "{}" }), {
      params: { id: "s1" },
    });
    expect(response.status).toBe(401);
  });

  it("GET /api/admin/subscription-plans -> 401", async () => {
    expect((await getSubscriptionPlans()).status).toBe(401);
  });

  it("PATCH /api/admin/subscription-plans/[planCode] -> 401", async () => {
    const response = await patchSubscriptionPlan(
      req("http://localhost/api/admin/subscription-plans/premium_monthly", { method: "PATCH", body: "{}" }),
      { params: { planCode: "premium_monthly" } }
    );
    expect(response.status).toBe(401);
  });

  it("GET /api/admin/payments -> 401", async () => {
    expect((await getAdminPayments(req("http://localhost/api/admin/payments"))).status).toBe(401);
  });

  it("PATCH /api/admin/payments/[id] -> 401", async () => {
    const response = await patchAdminPayment(req("http://localhost/api/admin/payments/p1", { method: "PATCH", body: "{}" }), {
      params: { id: "p1" },
    });
    expect(response.status).toBe(401);
  });
});
