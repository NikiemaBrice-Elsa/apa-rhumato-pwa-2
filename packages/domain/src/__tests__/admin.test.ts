import { describe, expect, it } from "vitest";
import {
  isAdminRole,
  canAdminSetUserStatus,
  canTransitionValidationStatus,
  bumpMinorVersion,
  bumpMajorVersion,
  buildAuditDiff,
  diffTouchesOnlyFields,
  computeAdminDashboardStats,
} from "../admin";

describe("isAdminRole", () => {
  it("reconnaît uniquement le rôle admin", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("patient")).toBe(false);
    expect(isAdminRole("professional")).toBe(false);
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
  });
});

describe("canAdminSetUserStatus", () => {
  it("autorise active <-> suspended", () => {
    expect(canAdminSetUserStatus("active", "suspended")).toBe(true);
    expect(canAdminSetUserStatus("suspended", "active")).toBe(true);
  });

  it("refuse toute transition vers/depuis deleted par un administrateur", () => {
    expect(canAdminSetUserStatus("active", "deleted")).toBe(false);
    expect(canAdminSetUserStatus("suspended", "deleted")).toBe(false);
    expect(canAdminSetUserStatus("deleted", "active")).toBe(false);
    expect(canAdminSetUserStatus("deleted", "suspended")).toBe(false);
  });
});

describe("canTransitionValidationStatus", () => {
  it("autorise draft -> pending_validation", () => {
    expect(canTransitionValidationStatus("draft", "pending_validation")).toBe(true);
  });

  it("refuse draft -> validated directement (doit passer par une relecture)", () => {
    expect(canTransitionValidationStatus("draft", "validated")).toBe(false);
  });

  it("autorise pending_validation -> validated et pending_validation -> draft", () => {
    expect(canTransitionValidationStatus("pending_validation", "validated")).toBe(true);
    expect(canTransitionValidationStatus("pending_validation", "draft")).toBe(true);
  });

  it("autorise un retrait immédiat depuis validated, dans les deux sens", () => {
    expect(canTransitionValidationStatus("validated", "draft")).toBe(true);
    expect(canTransitionValidationStatus("validated", "pending_validation")).toBe(true);
  });

  it("accepte une transition identique (idempotent)", () => {
    expect(canTransitionValidationStatus("validated", "validated")).toBe(true);
  });
});

describe("bumpMinorVersion / bumpMajorVersion", () => {
  it("incrémente la version mineure", () => {
    expect(bumpMinorVersion("V1.0")).toBe("V1.1");
    expect(bumpMinorVersion("V2.9")).toBe("V2.10");
  });

  it("incrémente la version majeure et remet le mineur à 0", () => {
    expect(bumpMajorVersion("V1.3")).toBe("V2.0");
  });

  it("rejette un format non reconnu plutôt que d'inventer une version", () => {
    expect(() => bumpMinorVersion("1.0")).toThrow();
    expect(() => bumpMinorVersion("version-1")).toThrow();
    expect(() => bumpMajorVersion("")).toThrow();
  });
});

describe("buildAuditDiff", () => {
  it("ne retient que les champs modifiés", () => {
    const diff = buildAuditDiff({ a: 1, b: "x" }, { a: 1, b: "y" });
    expect(diff).toEqual({ b: { from: "x", to: "y" } });
  });

  it("traite l'absence d'état précédent comme une création (from = null partout)", () => {
    const diff = buildAuditDiff(null, { a: 1 });
    expect(diff).toEqual({ a: { from: null, to: 1 } });
  });

  it("ne signale aucun changement si les valeurs sont identiques", () => {
    expect(buildAuditDiff({ a: 1 }, { a: 1 })).toEqual({});
  });
});

describe("diffTouchesOnlyFields", () => {
  it("est vrai pour un diff vide", () => {
    expect(diffTouchesOnlyFields({}, ["active"])).toBe(true);
  });

  it("est vrai si tous les champs modifiés sont dans la liste administrative", () => {
    const diff = { active: { from: true, to: false } };
    expect(diffTouchesOnlyFields(diff, ["active"])).toBe(true);
  });

  it("est faux dès qu'un champ hors liste est modifié", () => {
    const diff = { active: { from: true, to: false }, message: { from: "a", to: "b" } };
    expect(diffTouchesOnlyFields(diff, ["active"])).toBe(false);
  });
});

describe("computeAdminDashboardStats", () => {
  it("trie et tronque les listes, et laisse abonnements/revenus/erreurs à null (§57, §59, §79)", () => {
    const stats = computeAdminDashboardStats({
      totalUsers: 10,
      activeUsers: 4,
      newUsers: 2,
      sessionsCompleted: 20,
      programsPracticed: 3,
      adherence: { averagePercent: 75, usersWithData: 3 },
      pathologyCounts: [
        { pathology: "ARTHROSE_GENOU", count: 5 },
        { pathology: "LOMBALGIE_COMMUNE", count: 8 },
      ],
      exerciseCounts: [
        { exerciseId: "e1", count: 2 },
        { exerciseId: "e2", count: 9 },
      ],
    });

    expect(stats.topPathologies[0]).toEqual({ pathology: "LOMBALGIE_COMMUNE", count: 8 });
    expect(stats.topExercises[0]).toEqual({ exerciseId: "e2", count: 9 });
    expect(stats.subscriptions).toBeNull();
    expect(stats.revenue).toBeNull();
    expect(stats.technicalErrors).toBeNull();
  });
});
