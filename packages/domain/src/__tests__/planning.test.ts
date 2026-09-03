import { describe, expect, it } from "vitest";
import {
  computeWeeklyScheduleWeekdays,
  isWeekdayScheduled,
  isPlannedSessionOverdueForReminder,
  PLANNED_SESSION_REMINDER_WINDOW_HOURS,
  PLANNED_SESSION_STATUSES,
} from "../planning";

/**
 * §33 « Aujourd'hui » ; réf. B11 (31/08/2026) — répartition des séances
 * planifiées sur la semaine. Convention de planification (pas un seuil
 * clinique), pure et déterministe.
 */
describe("computeWeeklyScheduleWeekdays (réf. B11, 31/08/2026)", () => {
  it("aucun jour pour une fréquence nulle ou négative", () => {
    expect(computeWeeklyScheduleWeekdays(0)).toEqual([]);
    expect(computeWeeklyScheduleWeekdays(-2)).toEqual([]);
  });

  it("un seul jour pour une fréquence de 1 (lundi)", () => {
    expect(computeWeeklyScheduleWeekdays(1)).toEqual([0]);
  });

  it("répartit 3 séances sur la semaine", () => {
    const days = computeWeeklyScheduleWeekdays(3);
    expect(days.length).toBe(3);
    expect(days[0]).toBe(0); // lundi
    expect(days.every((d) => d >= 0 && d <= 6)).toBe(true);
  });

  it("tous les jours pour une fréquence >= 7", () => {
    expect(computeWeeklyScheduleWeekdays(7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(computeWeeklyScheduleWeekdays(10)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("est déterministe (toujours le même résultat pour la même fréquence)", () => {
    expect(computeWeeklyScheduleWeekdays(4)).toEqual(computeWeeklyScheduleWeekdays(4));
  });
});

describe("isWeekdayScheduled", () => {
  it("cohérent avec computeWeeklyScheduleWeekdays", () => {
    const days = computeWeeklyScheduleWeekdays(2);
    for (let d = 0; d <= 6; d++) {
      expect(isWeekdayScheduled(d, 2)).toBe(days.includes(d));
    }
  });
});

/**
 * Réf. B14 (20/08/2026) : « rappel de séance 24-48h si séance planifiée
 * manquée » — milieu de fourchette retenu (36h), même convention que
 * `MISSED_SESSION_GAP_DAYS`.
 */
describe("isPlannedSessionOverdueForReminder (réf. B14)", () => {
  it("milieu de la fourchette 24-48h retenu", () => {
    expect(PLANNED_SESSION_REMINDER_WINDOW_HOURS).toBe(36);
  });

  it("pas encore en retard avant la fenêtre", () => {
    const plannedFor = "2026-08-30";
    const now = new Date("2026-08-31T10:00:00.000Z"); // 34h après minuit UTC
    expect(isPlannedSessionOverdueForReminder(plannedFor, now)).toBe(false);
  });

  it("en retard une fois la fenêtre dépassée", () => {
    const plannedFor = "2026-08-30";
    const now = new Date("2026-08-31T13:00:00.000Z"); // 37h après minuit UTC
    expect(isPlannedSessionOverdueForReminder(plannedFor, now)).toBe(true);
  });

  it("false pour une date invalide (jamais une exception)", () => {
    expect(isPlannedSessionOverdueForReminder("invalide", new Date())).toBe(false);
  });
});

describe("PLANNED_SESSION_STATUSES (réf. B13 — 3 des 5 statuts distingués, les 2 autres portés par sessions.completion_level)", () => {
  it("couvre due / completed / cancelled_safety", () => {
    expect(PLANNED_SESSION_STATUSES).toEqual(["due", "completed", "cancelled_safety"]);
  });
});
