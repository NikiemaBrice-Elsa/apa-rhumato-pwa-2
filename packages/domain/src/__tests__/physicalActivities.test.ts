import { describe, expect, it } from "vitest";
import {
  computeAveragePhysicalActivityHoursPerWeek,
  formatActivityDurationLabel,
  isGpsTrackedActivityType,
  PHYSICAL_ACTIVITY_TYPE_LABELS_FR,
  PHYSICAL_ACTIVITY_TYPES,
  summarizePhysicalActivitiesByType,
} from "../physicalActivities";

describe("PHYSICAL_ACTIVITY_TYPES (Sprint 26)", () => {
  it("couvre les six types demandés par Dr Nikiema le 21/09/2026", () => {
    expect(PHYSICAL_ACTIVITY_TYPES).toEqual(["marche", "velo", "aerobie", "fitness", "natation", "autre"]);
  });

  it("chaque type a un libellé FR", () => {
    for (const type of PHYSICAL_ACTIVITY_TYPES) {
      expect(PHYSICAL_ACTIVITY_TYPE_LABELS_FR[type]).toBeTruthy();
    }
  });
});

describe("isGpsTrackedActivityType", () => {
  it("marche et vélo utilisent le suivi GPS", () => {
    expect(isGpsTrackedActivityType("marche")).toBe(true);
    expect(isGpsTrackedActivityType("velo")).toBe(true);
  });

  it("aérobie, fitness, natation et autre n'utilisent pas le GPS", () => {
    expect(isGpsTrackedActivityType("aerobie")).toBe(false);
    expect(isGpsTrackedActivityType("fitness")).toBe(false);
    expect(isGpsTrackedActivityType("natation")).toBe(false);
    expect(isGpsTrackedActivityType("autre")).toBe(false);
  });
});

describe("formatActivityDurationLabel", () => {
  it("affiche en minutes sous 1 heure", () => {
    expect(formatActivityDurationLabel(0)).toBe("0 min");
    expect(formatActivityDurationLabel(59)).toBe("1 min");
    expect(formatActivityDurationLabel(600)).toBe("10 min");
  });

  it("affiche en heures/minutes à partir d'1 heure", () => {
    expect(formatActivityDurationLabel(3600)).toBe("1 h");
    expect(formatActivityDurationLabel(3900)).toBe("1 h 05");
    expect(formatActivityDurationLabel(7200)).toBe("2 h");
  });
});

describe("summarizePhysicalActivitiesByType", () => {
  it("retourne un tableau vide sans activité", () => {
    expect(summarizePhysicalActivitiesByType([])).toEqual([]);
  });

  it("additionne durée et nombre de séances par type, dans l'ordre des types", () => {
    const result = summarizePhysicalActivitiesByType([
      { activityType: "natation", durationSeconds: 600 },
      { activityType: "marche", durationSeconds: 1200 },
      { activityType: "marche", durationSeconds: 900 },
    ]);
    expect(result).toEqual([
      { activityType: "marche", totalDurationSeconds: 2100, count: 2 },
      { activityType: "natation", totalDurationSeconds: 600, count: 1 },
    ]);
  });
});

describe("computeAveragePhysicalActivityHoursPerWeek (Sprint 35)", () => {
  it("retourne 0 h/semaine sans aucune activité sur une période valide (fait réel, pas une valeur devinée)", () => {
    expect(
      computeAveragePhysicalActivityHoursPerWeek([], { from: "2026-09-01T00:00:00Z", to: "2026-09-08T00:00:00Z" })
    ).toBe(0);
  });

  it("calcule la moyenne hebdomadaire sur une période d'exactement une semaine", () => {
    const result = computeAveragePhysicalActivityHoursPerWeek(
      [{ durationSeconds: 3600 }, { durationSeconds: 1800 }],
      { from: "2026-09-01T00:00:00Z", to: "2026-09-08T00:00:00Z" }
    );
    // 1h + 0.5h = 1.5h sur 1 semaine exactement.
    expect(result).toBe(1.5);
  });

  it("divise correctement sur une période de deux semaines", () => {
    const result = computeAveragePhysicalActivityHoursPerWeek([{ durationSeconds: 7200 }], {
      from: "2026-09-01T00:00:00Z",
      to: "2026-09-15T00:00:00Z",
    });
    // 2h sur 2 semaines = 1h/semaine.
    expect(result).toBe(1);
  });

  it("retourne null si la période est invalide (durée nulle ou négative)", () => {
    expect(
      computeAveragePhysicalActivityHoursPerWeek([{ durationSeconds: 3600 }], {
        from: "2026-09-08T00:00:00Z",
        to: "2026-09-01T00:00:00Z",
      })
    ).toBeNull();
    expect(
      computeAveragePhysicalActivityHoursPerWeek([{ durationSeconds: 3600 }], {
        from: "2026-09-01T00:00:00Z",
        to: "2026-09-01T00:00:00Z",
      })
    ).toBeNull();
  });

  it("arrondit à deux décimales", () => {
    const result = computeAveragePhysicalActivityHoursPerWeek([{ durationSeconds: 1000 }], {
      from: "2026-09-01T00:00:00Z",
      to: "2026-09-08T00:00:00Z",
    });
    // 1000s = 0.2777...h sur 1 semaine -> arrondi à 0.28.
    expect(result).toBe(0.28);
  });
});
