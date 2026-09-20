import { describe, expect, it } from "vitest";
import { startOfDayIso, endOfDayIso } from "../dates";

/**
 * Sprint 27 (20/09/2026) — voir le commentaire de tête de dates.ts pour le
 * contexte complet du bug corrigé (activités/séances/mesures du jour même
 * absentes du rapport PDF).
 */
describe("startOfDayIso", () => {
  it("représente le tout début de la journée locale choisie", () => {
    const iso = startOfDayIso("2026-09-20");
    const d = new Date(iso);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8); // septembre = index 8
    expect(d.getDate()).toBe(20);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
  });
});

describe("endOfDayIso", () => {
  it("représente la toute fin de la journée locale choisie", () => {
    const iso = endOfDayIso("2026-09-20");
    const d = new Date(iso);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(20);
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
    expect(d.getSeconds()).toBe(59);
  });

  it("est bien postérieure à startOfDayIso pour la même date (une activité en fin de journée est incluse)", () => {
    const start = new Date(startOfDayIso("2026-09-20")).getTime();
    const end = new Date(endOfDayIso("2026-09-20")).getTime();
    // Une activité enregistrée à 23h50 locale doit tomber entre les deux bornes.
    const lateActivity = new Date("2026-09-20T23:50:00").getTime();
    expect(end).toBeGreaterThan(start);
    expect(lateActivity).toBeGreaterThanOrEqual(start);
    expect(lateActivity).toBeLessThanOrEqual(end);
  });
});
