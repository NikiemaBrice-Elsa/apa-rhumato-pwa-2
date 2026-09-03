import { describe, expect, it } from "vitest";
import type { ClinicalRule } from "@apa/domain";
import { LOMBALGIE_URGENT_MESSAGE, OSTEOPOROSE_RECENT_FRACTURE_MESSAGE, PATHOLOGY_CODES } from "@apa/domain";
import { evaluateSafetyScreeningFromRules } from "../index";

// Reproduit les règles seedées (infra/db/seed/0003_clinical_rules.sql) sous
// forme de fixtures, pour tester le dépistage sans dépendance à une base.
const LOMBALGIE_RULES: ClinicalRule[] = [
  {
    ruleId: "LBP_RED_FLAG_QUEUE_DE_CHEVAL",
    pathology: "LOMBALGIE_COMMUNE",
    condition: { field: "suspicion_queue_de_cheval", operator: "equals", value: true },
    severity: "critical",
    action: "medical_referral",
    message: LOMBALGIE_URGENT_MESSAGE,
    active: true,
    version: "V1.0",
  },
  {
    ruleId: "LBP_RED_FLAG_FIEVRE",
    pathology: "LOMBALGIE_COMMUNE",
    condition: { field: "fievre_contexte_infectieux", operator: "equals", value: true },
    severity: "critical",
    action: "medical_referral",
    message: LOMBALGIE_URGENT_MESSAGE,
    active: true,
    version: "V1.0",
  },
];

const OSTEOPOROSE_RULES: ClinicalRule[] = [
  {
    ruleId: "OSTEO_RECENT_FRACTURE",
    pathology: "OSTEOPOROSE",
    condition: { field: "fracture_recente", operator: "equals", value: true },
    severity: "critical",
    action: "stop_program",
    message: OSTEOPOROSE_RECENT_FRACTURE_MESSAGE,
    active: true,
    version: "V1.0",
  },
];

const ALL_RULES = [...LOMBALGIE_RULES, ...OSTEOPOROSE_RULES];

describe("evaluateSafetyScreeningFromRules (§15, piloté par clinical_rules)", () => {
  it("Cas 2 du §56 : red flag lombalgie -> rouge, message §16, aucun programme", () => {
    const result = evaluateSafetyScreeningFromRules(
      "LOMBALGIE_COMMUNE",
      { suspicion_queue_de_cheval: true },
      ALL_RULES
    );
    expect(result.status).toBe("rouge");
    expect(result.message).toBe(LOMBALGIE_URGENT_MESSAGE);
    expect(result.triggeredFlags).toContain("LBP_RED_FLAG_QUEUE_DE_CHEVAL");
  });

  it("Cas 4 du §56 : fracture récente ostéoporose -> pas de programme automatisé", () => {
    const result = evaluateSafetyScreeningFromRules("OSTEOPOROSE", { fracture_recente: true }, ALL_RULES);
    expect(result.status).toBe("rouge");
    expect(result.triggeredFlags).toEqual(["OSTEO_RECENT_FRACTURE"]);
  });

  it("aucune règle déclenchée -> pending_validation, jamais vert/orange", () => {
    const result = evaluateSafetyScreeningFromRules(
      "LOMBALGIE_COMMUNE",
      { suspicion_queue_de_cheval: false, fievre_contexte_infectieux: false },
      ALL_RULES
    );
    expect(result.status).toBe("pending_validation");
    expect(result.ruleImplemented).toBe(false);
  });

  it.each(PATHOLOGY_CODES.filter((p) => p !== "LOMBALGIE_COMMUNE" && p !== "OSTEOPOROSE"))(
    "%s : aucune règle en base -> pending_validation",
    (pathology) => {
      const result = evaluateSafetyScreeningFromRules(pathology, { douleur: 9 }, ALL_RULES);
      expect(result.status).toBe("pending_validation");
      expect(result.ruleImplemented).toBe(false);
    }
  );

  it("une règle inactive n'est jamais déclenchée", () => {
    const inactiveRules: ClinicalRule[] = [{ ...LOMBALGIE_RULES[0], active: false }];
    const result = evaluateSafetyScreeningFromRules(
      "LOMBALGIE_COMMUNE",
      { suspicion_queue_de_cheval: true },
      inactiveRules
    );
    expect(result.status).toBe("pending_validation");
  });
});
