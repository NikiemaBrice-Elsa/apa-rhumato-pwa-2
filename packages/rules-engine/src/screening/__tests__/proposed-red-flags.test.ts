import { describe, expect, it } from "vitest";
import { evaluateSafetyScreeningFromRules } from "../index";
import type { ClinicalRule } from "@apa/domain";

/**
 * Sprint 6bis — vérifie le COMPORTEMENT des 4 règles proposées dans
 * infra/db/seed/0004_proposed_red_flags_pending_validation.sql (mêmes
 * conditions JSON, recopiées ici comme fixtures) : (1) une fois activées,
 * elles se déclenchent correctement sur les cas attendus ; (2) inactives
 * (`active: false`), elles ne se déclenchent JAMAIS — conformément au
 * comportement documenté de evaluateRules (filtre `active`).
 *
 * Mise à jour (20/08/2026) : Dr Nikiema a explicitement approuvé les 4
 * règles « telles quelles » (réf. A1, A2 du questionnaire de validation
 * médicale) — voir infra/db/seed/0006_validation_medicale_dr_nikiema_
 * 20260820.sql, qui les active réellement (`active = true`) dans la base.
 * Les fixtures ci-dessous restent volontairement paramétrées par `active`
 * pour continuer à vérifier le mécanisme lui-même (une règle inactive ne
 * se déclenche jamais, quelle que soit sa validation), indépendamment de
 * l'état réel du seed à un instant donné.
 */
const HOT_JOINT_CONDITION = {
  any: [
    { field: "fievre", operator: "equals" as const, value: true },
    {
      all: [
        { field: "gonflement", operator: "equals" as const, value: true },
        { field: "chaleur_locale", operator: "equals" as const, value: true },
      ],
    },
  ],
};

function hotJointRule(pathology: ClinicalRule["pathology"], active: boolean): ClinicalRule {
  return {
    ruleId: `PROPOSED_${pathology}_HOT_JOINT`,
    pathology,
    condition: HOT_JOINT_CONDITION,
    severity: "critical",
    action: "medical_referral",
    message: "proposition",
    active,
    version: "V0.1-proposition",
  };
}

describe("Propositions Sprint 6bis — articulation chaude (Coakley et al. 2006)", () => {
  it("se déclenche sur fièvre seule, une fois activée", () => {
    const result = evaluateSafetyScreeningFromRules("ARTHROSE_GENOU", { fievre: true }, [
      hotJointRule("ARTHROSE_GENOU", true),
    ]);
    expect(result.status).toBe("rouge");
  });

  it("se déclenche sur gonflement + chaleur locale sans fièvre, une fois activée", () => {
    const result = evaluateSafetyScreeningFromRules(
      "ARTHROSE_HANCHE",
      { gonflement: true, chaleur_locale: true, fievre: false },
      [hotJointRule("ARTHROSE_HANCHE", true)]
    );
    expect(result.status).toBe("rouge");
  });

  it("ne se déclenche pas sur un gonflement isolé sans chaleur ni fièvre", () => {
    const result = evaluateSafetyScreeningFromRules("POLYARTHRITE_RHUMATOIDE", { gonflement: true }, [
      hotJointRule("POLYARTHRITE_RHUMATOIDE", true),
    ]);
    expect(result.status).toBe("pending_validation");
  });

  it("garde-fou : telle que réellement seedée (active=false), ne se déclenche jamais", () => {
    const result = evaluateSafetyScreeningFromRules("ARTHROSE_GENOU", { fievre: true }, [
      hotJointRule("ARTHROSE_GENOU", false),
    ]);
    expect(result.status).toBe("pending_validation");
  });
});

describe("Proposition Sprint 6bis — traumatisme récent en spondyloarthrite axiale (Shah et al. 2019)", () => {
  const rule = (active: boolean): ClinicalRule => ({
    ruleId: "PROPOSED_AXSPA_TRAUMA_FRACTURE_RISK",
    pathology: "SPONDYLOARTHRITE_AXIALE",
    condition: { field: "traumatisme_recent", operator: "equals", value: true },
    severity: "critical",
    action: "medical_referral",
    message: "proposition",
    active,
    version: "V0.1-proposition",
  });

  it("se déclenche sur un traumatisme récent, une fois activée", () => {
    const result = evaluateSafetyScreeningFromRules(
      "SPONDYLOARTHRITE_AXIALE",
      { traumatisme_recent: true },
      [rule(true)]
    );
    expect(result.status).toBe("rouge");
  });

  it("garde-fou : telle que réellement seedée (active=false), ne se déclenche jamais", () => {
    const result = evaluateSafetyScreeningFromRules(
      "SPONDYLOARTHRITE_AXIALE",
      { traumatisme_recent: true },
      [rule(false)]
    );
    expect(result.status).toBe("pending_validation");
  });
});
