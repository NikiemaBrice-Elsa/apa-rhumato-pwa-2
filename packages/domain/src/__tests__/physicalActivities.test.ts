import { describe, expect, it } from "vitest";
import {
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
