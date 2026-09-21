import { describe, expect, it } from "vitest";
import {
  FUNCTIONAL_CAPACITY_INSTRUMENTS,
  FUNCTIONAL_CAPACITY_TRENDS,
  computePsfsAverageScore,
  computeFunctionalCapacityTrend,
  isFunctionalCapacityReassessmentDue,
  FUNCTIONAL_CAPACITY_REASSESSMENT_DAYS,
  type FunctionalCapacityAssessment,
} from "../functionalCapacity";

function makeAssessment(overrides: Partial<FunctionalCapacityAssessment> & { instrument: FunctionalCapacityAssessment["instrument"] }): FunctionalCapacityAssessment {
  return {
    id: "assessment-fixture",
    userId: "user-fixture",
    assessedAt: "2026-09-01T00:00:00Z",
    createdAt: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

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

/**
 * §29, §58, §70 — document « système de progression » (21/09/2026, section
 * B) : « capacité fonctionnelle stable ou améliorée » comme critère de
 * passage de niveau. Voir le commentaire de tête de la fonction pour le
 * détail des deux conventions (PROMIS : erreur-type publique de
 * l'instrument ; PSFS : comparaison exacte, aucune tolérance chiffrée
 * inventée).
 */
describe("computeFunctionalCapacityTrend (document « système de progression », 21/09/2026)", () => {
  it("couvre exactement les 3 valeurs attendues", () => {
    expect(FUNCTIONAL_CAPACITY_TRENDS).toEqual(["amelioree", "stable", "degradee"]);
  });

  it("null si moins de 2 évaluations", () => {
    const current = makeAssessment({ instrument: "psfs", activities: [{ id: "a1", assessmentId: "assessment-fixture", activityLabel: "Monter les escaliers", difficultyScore: 4, orderIndex: 0 }] });
    expect(computeFunctionalCapacityTrend(null, current)).toBeNull();
    expect(computeFunctionalCapacityTrend(undefined, current)).toBeNull();
  });

  it("null si les deux évaluations ne portent pas sur le même instrument", () => {
    const previous = makeAssessment({ instrument: "psfs", activities: [{ id: "a1", assessmentId: "assessment-fixture", activityLabel: "Marcher", difficultyScore: 5, orderIndex: 0 }] });
    const current = makeAssessment({ instrument: "promis_pf_cat", promisTScore: 50, promisStandardError: 3 });
    expect(computeFunctionalCapacityTrend(previous, current)).toBeNull();
  });

  describe("PSFS — comparaison exacte de la moyenne (score plus bas = moins de difficulté = amélioration)", () => {
    it("amélioration si la moyenne baisse", () => {
      const previous = makeAssessment({ instrument: "psfs", activities: [{ id: "a1", assessmentId: "assessment-fixture", activityLabel: "Marcher", difficultyScore: 6, orderIndex: 0 }] });
      const current = makeAssessment({ instrument: "psfs", activities: [{ id: "a2", assessmentId: "assessment-fixture", activityLabel: "Marcher", difficultyScore: 3, orderIndex: 0 }] });
      expect(computeFunctionalCapacityTrend(previous, current)).toBe("amelioree");
    });

    it("dégradation si la moyenne augmente", () => {
      const previous = makeAssessment({ instrument: "psfs", activities: [{ id: "a1", assessmentId: "assessment-fixture", activityLabel: "Marcher", difficultyScore: 2, orderIndex: 0 }] });
      const current = makeAssessment({ instrument: "psfs", activities: [{ id: "a2", assessmentId: "assessment-fixture", activityLabel: "Marcher", difficultyScore: 5, orderIndex: 0 }] });
      expect(computeFunctionalCapacityTrend(previous, current)).toBe("degradee");
    });

    it("stable si la moyenne est strictement identique", () => {
      const previous = makeAssessment({ instrument: "psfs", activities: [{ id: "a1", assessmentId: "assessment-fixture", activityLabel: "Marcher", difficultyScore: 4, orderIndex: 0 }] });
      const current = makeAssessment({ instrument: "psfs", activities: [{ id: "a2", assessmentId: "assessment-fixture", activityLabel: "Marcher", difficultyScore: 4, orderIndex: 0 }] });
      expect(computeFunctionalCapacityTrend(previous, current)).toBe("stable");
    });

    it("null si une des deux évaluations n'a aucune activité exploitable", () => {
      const previous = makeAssessment({ instrument: "psfs", activities: [] });
      const current = makeAssessment({ instrument: "psfs", activities: [{ id: "a2", assessmentId: "assessment-fixture", activityLabel: "Marcher", difficultyScore: 4, orderIndex: 0 }] });
      expect(computeFunctionalCapacityTrend(previous, current)).toBeNull();
    });
  });

  describe("PROMIS CAT — erreur-type publique de l'instrument (T-score plus haut = amélioration)", () => {
    it("amélioration si le changement dépasse l'intervalle de confiance à 95%", () => {
      const previous = makeAssessment({ instrument: "promis_pf_cat", promisTScore: 45, promisStandardError: 2 });
      const current = makeAssessment({ instrument: "promis_pf_cat", promisTScore: 52, promisStandardError: 2 });
      expect(computeFunctionalCapacityTrend(previous, current)).toBe("amelioree");
    });

    it("dégradation si le changement négatif dépasse l'intervalle de confiance à 95%", () => {
      const previous = makeAssessment({ instrument: "promis_pf_cat", promisTScore: 52, promisStandardError: 2 });
      const current = makeAssessment({ instrument: "promis_pf_cat", promisTScore: 45, promisStandardError: 2 });
      expect(computeFunctionalCapacityTrend(previous, current)).toBe("degradee");
    });

    it("stable si le changement reste dans la marge d'erreur-type combinée", () => {
      const previous = makeAssessment({ instrument: "promis_pf_cat", promisTScore: 50, promisStandardError: 3 });
      const current = makeAssessment({ instrument: "promis_pf_cat", promisTScore: 51, promisStandardError: 3 });
      expect(computeFunctionalCapacityTrend(previous, current)).toBe("stable");
    });

    it("null si l'erreur-type ou le T-score manque", () => {
      const previous = makeAssessment({ instrument: "promis_pf_cat", promisTScore: 50, promisStandardError: null });
      const current = makeAssessment({ instrument: "promis_pf_cat", promisTScore: 55, promisStandardError: 2 });
      expect(computeFunctionalCapacityTrend(previous, current)).toBeNull();
    });
  });
});
