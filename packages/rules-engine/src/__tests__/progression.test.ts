import { describe, expect, it } from "vitest";
import type { ClinicalRule } from "@apa/domain";
import { evaluateProgressionDecision } from "../progression";
import { MEDICAL_PARAMETER_REQUIRED } from "../constants";

/**
 * §55, Sprint 15 : `evaluateProgressionDecision` n'était jusqu'ici testé
 * que sur son chemin "aucune règle". Complété au Sprint 17 (suite 4,
 * 23/08/2026) : le mécanisme sait désormais porter une VRAIE décision
 * (`progressionDecision`, migration 0013) au lieu de renvoyer "maintain"
 * en dur. Les règles ci-dessous sont des FIXTURES de test, pas du contenu
 * médical réel : aucune règle `adjust_progression` réelle n'existe encore
 * dans infra/db/seed (§58 : critères précis toujours en cours de
 * clarification — voir QUESTIONS_PROGRESSION_REGRESSION_20260823.docx).
 */
describe("evaluateProgressionDecision (§29, §58, §70)", () => {
  it("retourne MEDICAL_PARAMETER_REQUIRED en l'absence de règle adjust_progression", () => {
    const result = evaluateProgressionDecision("LOMBALGIE_COMMUNE", { adherence: 0.9 }, []);
    expect(result.decision).toBe(MEDICAL_PARAMETER_REQUIRED);
  });

  it("retourne MEDICAL_PARAMETER_REQUIRED si une règle adjust_progression existe mais ne se déclenche pas", () => {
    const rules: ClinicalRule[] = [
      {
        ruleId: "FIXTURE_PROGRESSION_ADHERENCE_ELEVEE",
        pathology: "LOMBALGIE_COMMUNE",
        condition: { field: "adherence", operator: "gte", value: 0.8 },
        severity: "info",
        action: "adjust_progression",
        message: "fixture",
        progressionDecision: "progress",
        active: true,
        version: "V1.0",
      },
    ];
    const result = evaluateProgressionDecision("LOMBALGIE_COMMUNE", { adherence: 0.5 }, rules);
    expect(result.decision).toBe(MEDICAL_PARAMETER_REQUIRED);
  });

  it("applique la règle adjust_progression qui se déclenche, avec sa décision et l'identifiant de la règle appariée", () => {
    const rules: ClinicalRule[] = [
      {
        ruleId: "FIXTURE_PROGRESSION_ADHERENCE_ELEVEE",
        pathology: "LOMBALGIE_COMMUNE",
        condition: { field: "adherence", operator: "gte", value: 0.8 },
        severity: "info",
        action: "adjust_progression",
        message: "fixture",
        progressionDecision: "progress",
        active: true,
        version: "V1.0",
      },
    ];
    const result = evaluateProgressionDecision("LOMBALGIE_COMMUNE", { adherence: 0.9 }, rules);
    expect(result.decision).toBe("progress");
    expect(result.matchedRuleId).toBe("FIXTURE_PROGRESSION_ADHERENCE_ELEVEE");
  });

  it("ignore une règle adjust_progression inactive", () => {
    const rules: ClinicalRule[] = [
      {
        ruleId: "FIXTURE_PROGRESSION_INACTIVE",
        pathology: "LOMBALGIE_COMMUNE",
        condition: { field: "adherence", operator: "gte", value: 0.8 },
        severity: "info",
        action: "adjust_progression",
        message: "fixture",
        progressionDecision: "progress",
        active: false,
        version: "V1.0",
      },
    ];
    const result = evaluateProgressionDecision("LOMBALGIE_COMMUNE", { adherence: 0.9 }, rules);
    expect(result.decision).toBe(MEDICAL_PARAMETER_REQUIRED);
  });

  it("ignore une règle adjust_progression d'une autre pathologie", () => {
    const rules: ClinicalRule[] = [
      {
        ruleId: "FIXTURE_PROGRESSION_AUTRE_PATHOLOGIE",
        pathology: "ARTHROSE_GENOU",
        condition: { field: "adherence", operator: "gte", value: 0.8 },
        severity: "info",
        action: "adjust_progression",
        message: "fixture",
        progressionDecision: "progress",
        active: true,
        version: "V1.0",
      },
    ];
    const result = evaluateProgressionDecision("LOMBALGIE_COMMUNE", { adherence: 0.9 }, rules);
    expect(result.decision).toBe(MEDICAL_PARAMETER_REQUIRED);
  });

  it("ignore une règle qui matche mais ne porte AUCUNE décision explicite (jamais de valeur devinée, §57/§59/§78)", () => {
    const rules: ClinicalRule[] = [
      {
        ruleId: "FIXTURE_PROGRESSION_SANS_DECISION",
        pathology: "LOMBALGIE_COMMUNE",
        condition: { field: "adherence", operator: "gte", value: 0.8 },
        severity: "info",
        action: "adjust_progression",
        message: "fixture",
        // Pas de progressionDecision : ne doit jamais retomber sur "maintain" par défaut.
        active: true,
        version: "V1.0",
      },
    ];
    const result = evaluateProgressionDecision("LOMBALGIE_COMMUNE", { adherence: 0.9 }, rules);
    expect(result.decision).toBe(MEDICAL_PARAMETER_REQUIRED);
    expect(result.matchedRuleId).toBeUndefined();
  });

  it("quand plusieurs règles matchent, retient la première PORTEUSE d'une décision selon l'ordre de sévérité (une règle sans décision ne bloque pas les suivantes)", () => {
    const rules: ClinicalRule[] = [
      {
        ruleId: "FIXTURE_PROGRESSION_CRITICAL_SANS_DECISION",
        pathology: "LOMBALGIE_COMMUNE",
        condition: { field: "adherence", operator: "gte", value: 0.8 },
        severity: "critical",
        action: "adjust_progression",
        message: "fixture",
        active: true,
        version: "V1.0",
      },
      {
        ruleId: "FIXTURE_PROGRESSION_INFO_AVEC_DECISION",
        pathology: "LOMBALGIE_COMMUNE",
        condition: { field: "adherence", operator: "gte", value: 0.8 },
        severity: "info",
        action: "adjust_progression",
        message: "fixture",
        progressionDecision: "reduce",
        active: true,
        version: "V1.0",
      },
    ];
    const result = evaluateProgressionDecision("LOMBALGIE_COMMUNE", { adherence: 0.9 }, rules);
    expect(result.decision).toBe("reduce");
    expect(result.matchedRuleId).toBe("FIXTURE_PROGRESSION_INFO_AVEC_DECISION");
  });

  it.each(["progress", "maintain", "reduce", "suspend"] as const)(
    "porte fidèlement la décision '%s' sans la transformer",
    (decision) => {
      const rules: ClinicalRule[] = [
        {
          ruleId: `FIXTURE_PROGRESSION_${decision.toUpperCase()}`,
          pathology: "LOMBALGIE_COMMUNE",
          condition: { field: "adherence", operator: "gte", value: 0.8 },
          severity: "info",
          action: "adjust_progression",
          message: "fixture",
          progressionDecision: decision,
          active: true,
          version: "V1.0",
        },
      ];
      const result = evaluateProgressionDecision("LOMBALGIE_COMMUNE", { adherence: 0.9 }, rules);
      expect(result.decision).toBe(decision);
    }
  );
});
