import { describe, expect, it } from "vitest";
import {
  getWeekBounds,
  sessionDurationMinutes,
  computeAdherencePercent,
  computeGlobalAdherenceStats,
  computeAdherenceIndicators,
  computeMultiWeekAdherencePercent,
} from "../statistics";

describe("getWeekBounds (§33 — semaine ISO, lundi -> dimanche)", () => {
  it("calcule les bornes pour un mercredi", () => {
    // Mercredi 19 août 2026.
    const { weekStart, weekEnd } = getWeekBounds(new Date(2026, 7, 19, 15, 30));
    expect(weekStart.getDay()).toBe(1); // lundi
    expect(weekStart.getDate()).toBe(17);
    expect(weekStart.getHours()).toBe(0);
    expect(weekEnd.getDay()).toBe(0); // dimanche
    expect(weekEnd.getDate()).toBe(23);
    expect(weekEnd.getHours()).toBe(23);
  });

  it("gère correctement un dimanche (fin de semaine ISO, pas début)", () => {
    // Dimanche 23 août 2026.
    const { weekStart, weekEnd } = getWeekBounds(new Date(2026, 7, 23, 10, 0));
    expect(weekStart.getDate()).toBe(17);
    expect(weekEnd.getDate()).toBe(23);
  });
});

describe("sessionDurationMinutes (§28, §69)", () => {
  it("calcule la durée d'une séance clôturée", () => {
    expect(sessionDurationMinutes("2026-08-19T10:00:00Z", "2026-08-19T10:25:00Z")).toBe(25);
  });

  it("retourne null pour une séance encore in_progress (pas de completed_at)", () => {
    expect(sessionDurationMinutes("2026-08-19T10:00:00Z", null)).toBeNull();
  });

  it("retourne null pour des dates incohérentes (fin avant début)", () => {
    expect(sessionDurationMinutes("2026-08-19T10:25:00Z", "2026-08-19T10:00:00Z")).toBeNull();
  });
});

describe("computeAdherencePercent (§29, §33, §70 — jamais de taux inventé)", () => {
  it("retourne null sans fréquence cible (aucun programme validé)", () => {
    expect(computeAdherencePercent(3, null)).toBeNull();
    expect(computeAdherencePercent(3, undefined)).toBeNull();
    expect(computeAdherencePercent(3, 0)).toBeNull();
  });

  it("calcule un pourcentage à partir d'une fréquence cible réelle", () => {
    expect(computeAdherencePercent(2, 4)).toBe(50);
  });

  it("plafonne à 100 même si plus de séances que la cible ont été réalisées", () => {
    expect(computeAdherencePercent(6, 3)).toBe(100);
  });

  it("gère zéro séance réalisée", () => {
    expect(computeAdherencePercent(0, 3)).toBe(0);
  });
});

describe("computeGlobalAdherenceStats (§64, Sprint 13 — tableau de bord admin)", () => {
  it("retourne null sans aucune donnée", () => {
    expect(computeGlobalAdherenceStats([])).toEqual({ averagePercent: null, usersWithData: 0 });
    expect(computeGlobalAdherenceStats([null, null])).toEqual({ averagePercent: null, usersWithData: 0 });
  });

  it("exclut les null du calcul plutôt que de les compter comme 0", () => {
    expect(computeGlobalAdherenceStats([100, null, 50])).toEqual({ averagePercent: 75, usersWithData: 2 });
  });

  it("arrondit la moyenne", () => {
    expect(computeGlobalAdherenceStats([100, 50, 50])).toEqual({ averagePercent: 67, usersWithData: 3 });
  });
});

/**
 * §29, §33 ; réf. B13 (31/08/2026) — nouvelle formule d'adhésion à 2
 * indicateurs, distincte de `computeAdherencePercent` (conservée pour la
 * progression, voir sessions.ts/progression.ts).
 */
describe("computeAdherenceIndicators (réf. B13, 31/08/2026)", () => {
  it("sessionsCompletionPercent null sans fréquence cible", () => {
    const result = computeAdherenceIndicators({
      completeSessionsThisWeek: 2,
      targetFrequencyPerWeek: null,
      completedExercisesThisWeek: 5,
      prescribedExercisesThisWeek: 10,
    });
    expect(result.sessionsCompletionPercent).toBeNull();
  });

  it("sessionsCompletionPercent calculé à partir des séances complètes uniquement", () => {
    const result = computeAdherenceIndicators({
      completeSessionsThisWeek: 2,
      targetFrequencyPerWeek: 4,
      completedExercisesThisWeek: 0,
      prescribedExercisesThisWeek: 0,
    });
    expect(result.sessionsCompletionPercent).toBe(50);
  });

  it("doseCompletionPercent null sans exercice prescrit cette semaine", () => {
    const result = computeAdherenceIndicators({
      completeSessionsThisWeek: 0,
      targetFrequencyPerWeek: 4,
      completedExercisesThisWeek: 0,
      prescribedExercisesThisWeek: 0,
    });
    expect(result.doseCompletionPercent).toBeNull();
  });

  it("doseCompletionPercent calculé et plafonné à 100", () => {
    expect(
      computeAdherenceIndicators({
        completeSessionsThisWeek: 0,
        targetFrequencyPerWeek: null,
        completedExercisesThisWeek: 8,
        prescribedExercisesThisWeek: 10,
      }).doseCompletionPercent
    ).toBe(80);

    expect(
      computeAdherenceIndicators({
        completeSessionsThisWeek: 0,
        targetFrequencyPerWeek: null,
        completedExercisesThisWeek: 12,
        prescribedExercisesThisWeek: 10,
      }).doseCompletionPercent
    ).toBe(100);
  });
});

/**
 * §29, §58, §70 — document « système de progression » (21/09/2026, section
 * B) : « ≥ 80% des séances prévues réalisées sur les 4/6 dernières
 * semaines ». Même arithmétique que `computeAdherencePercent`, sur une
 * fenêtre plus large.
 */
describe("computeMultiWeekAdherencePercent (document « système de progression », 21/09/2026)", () => {
  it("retourne null sans fréquence cible", () => {
    expect(computeMultiWeekAdherencePercent(6, null, 4)).toBeNull();
    expect(computeMultiWeekAdherencePercent(6, undefined, 4)).toBeNull();
    expect(computeMultiWeekAdherencePercent(6, 0, 4)).toBeNull();
  });

  it("retourne null pour une fenêtre invalide", () => {
    expect(computeMultiWeekAdherencePercent(6, 2, 0)).toBeNull();
    expect(computeMultiWeekAdherencePercent(6, 2, -1)).toBeNull();
  });

  it("calcule le pourcentage sur 4 semaines (débutant -> intermédiaire)", () => {
    // Cible 2 séances/semaine x 4 semaines = 8 séances prévues ; 6 réalisées.
    expect(computeMultiWeekAdherencePercent(6, 2, 4)).toBe(75);
  });

  it("atteint 80% quand le critère de passage de niveau est rempli", () => {
    // Cible 3 séances/semaine x 4 semaines = 12 séances prévues ; 80% = 9,6 -> 10 réalisées.
    expect(computeMultiWeekAdherencePercent(10, 3, 4)).toBeGreaterThanOrEqual(80);
  });

  it("plafonne à 100 même avec plus de séances que prévu", () => {
    expect(computeMultiWeekAdherencePercent(50, 2, 4)).toBe(100);
  });

  it("calcule le pourcentage sur 6 semaines (intermédiaire -> supérieur)", () => {
    // Cible 3 séances/semaine x 6 semaines = 18 séances prévues ; 15 réalisées.
    expect(computeMultiWeekAdherencePercent(15, 3, 6)).toBe(83);
  });
});
