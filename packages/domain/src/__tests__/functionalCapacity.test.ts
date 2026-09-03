import { describe, expect, it } from "vitest";
import {
  FUNCTIONAL_CAPACITY_INSTRUMENTS,
  computePsfsAverageScore,
  isFunctionalCapacityReassessmentDue,
  FUNCTIONAL_CAPACITY_REASSESSMENT_DAYS,
} from "../functionalCapacity";

describe("FUNCTIONAL_CAPACITY_INSTRUMENTS (§33, réf. B10)", () => {
  it("couvre PSFS et PROMIS Physical Function", () => {
    expect(FUNCTIONAL_CAPACITY_INSTRUMENTS).toEqual(["psfs", "promis_pf_cat"]);
  });
});

describe("computePsfsAverageScore (méthodologie standard PSFS)", () => {
  it("renvoie null en l'absence d'activité (jamais 0 par défaut)", () => {
    expect(computePsfsAverageScore([])).toBeNull();
  });

  it("calcule la moyenne arithmétique des scores", () => {
    expect(computePsfsAverageScore([{ difficultyScore: 4 }, { difficultyScore: 6 }, { difficultyScore: 8 }])).toBe(6);
  });

  it("arrondit à une décimale", () => {
    expect(computePsfsAverageScore([{ difficultyScore: 3 }, { difficultyScore: 4 }, { difficultyScore: 4 }])).toBeCloseTo(3.7, 5);
  });
});

describe("isFunctionalCapacityReassessmentDue (réf. B14, cadence produit)", () => {
  it("est due si aucune évaluation antérieure", () => {
    expect(isFunctionalCapacityReassessmentDue(null, new Date("2026-08-30T00:00:00Z"))).toBe(true);
  });

  it("n'est pas due juste après une évaluation", () => {
    expect(isFunctionalCapacityReassessmentDue("2026-08-30T00:00:00Z", new Date("2026-08-31T00:00:00Z"))).toBe(false);
  });

  it(`est due après ${FUNCTIONAL_CAPACITY_REASSESSMENT_DAYS} jours`, () => {
    const now = new Date("2026-08-30T00:00:00Z");
    const last = new Date(now.getTime() - FUNCTIONAL_CAPACITY_REASSESSMENT_DAYS * 24 * 60 * 60 * 1000).toISOString();
    expect(isFunctionalCapacityReassessmentDue(last, now)).toBe(true);
  });
});
