import { describe, expect, it } from "vitest";
import { evaluateProgramAssignment } from "../program-selection";
import { MEDICAL_PARAMETER_REQUIRED } from "../constants";
import { PATHOLOGY_CODES, type ClinicalRule } from "@apa/domain";

/**
 * §30 (exemple 1), §67-68 — Sprint 6.
 * Toutes les règles ci-dessous sont des FIXTURES de test, pas du contenu
 * médical réel (aucune n'est présente dans infra/db/seed).
 */
describe("evaluateProgramAssignment", () => {
  it("retourne MEDICAL_PARAMETER_REQUIRED en l'absence de règle allow_program", () => {
    const result = evaluateProgramAssignment("ARTHROSE_GENOU", { douleur: 3 }, []);
    expect(result.status).toBe(MEDICAL_PARAMETER_REQUIRED);
  });

  it("attribue le programme quand une règle allow_program active correspond et porte un programId", () => {
    const rules: ClinicalRule[] = [
      {
        ruleId: "FIXTURE_ALLOW_OA_GENOU_DEBUTANT",
        pathology: "ARTHROSE_GENOU",
        condition: {
          all: [
            { field: "niveau", operator: "equals", value: "debutant" },
            { field: "screening", operator: "equals", value: "vert" },
          ],
        },
        severity: "info",
        action: "allow_program",
        message: "fixture",
        programId: "11111111-1111-1111-1111-111111111111",
        active: true,
        version: "V1.0",
      },
    ];

    const result = evaluateProgramAssignment(
      "ARTHROSE_GENOU",
      { niveau: "debutant", screening: "vert" },
      rules
    );

    expect(result.status).toBe("assigned");
    expect(result.programId).toBe("11111111-1111-1111-1111-111111111111");
    expect(result.matchedRuleId).toBe("FIXTURE_ALLOW_OA_GENOU_DEBUTANT");
  });

  it("ne déclenche pas la règle si la condition n'est pas satisfaite", () => {
    const rules: ClinicalRule[] = [
      {
        ruleId: "FIXTURE_ALLOW_OA_GENOU_DEBUTANT",
        pathology: "ARTHROSE_GENOU",
        condition: { field: "screening", operator: "equals", value: "vert" },
        severity: "info",
        action: "allow_program",
        message: "fixture",
        programId: "11111111-1111-1111-1111-111111111111",
        active: true,
        version: "V1.0",
      },
    ];

    const result = evaluateProgramAssignment("ARTHROSE_GENOU", { screening: "pending_validation" }, rules);
    expect(result.status).toBe(MEDICAL_PARAMETER_REQUIRED);
  });

  it("ignore une règle allow_program qui correspond mais ne porte aucun programId (jamais de programme deviné)", () => {
    const rules: ClinicalRule[] = [
      {
        ruleId: "FIXTURE_ALLOW_SANS_PROGRAMME",
        pathology: "ARTHROSE_GENOU",
        condition: { field: "screening", operator: "equals", value: "vert" },
        severity: "info",
        action: "allow_program",
        message: "fixture",
        active: true,
        version: "V1.0",
      },
    ];

    const result = evaluateProgramAssignment("ARTHROSE_GENOU", { screening: "vert" }, rules);
    expect(result.status).toBe(MEDICAL_PARAMETER_REQUIRED);
  });

  it("ignore une règle allow_program inactive", () => {
    const rules: ClinicalRule[] = [
      {
        ruleId: "FIXTURE_ALLOW_INACTIVE",
        pathology: "ARTHROSE_GENOU",
        condition: { field: "screening", operator: "equals", value: "vert" },
        severity: "info",
        action: "allow_program",
        message: "fixture",
        programId: "11111111-1111-1111-1111-111111111111",
        active: false,
        version: "V1.0",
      },
    ];

    const result = evaluateProgramAssignment("ARTHROSE_GENOU", { screening: "vert" }, rules);
    expect(result.status).toBe(MEDICAL_PARAMETER_REQUIRED);
  });

  it.each(PATHOLOGY_CODES)(
    "%s : garde-fou — base de règles vide -> jamais de programme assigné",
    (pathology) => {
      const result = evaluateProgramAssignment(pathology, {}, []);
      expect(result.status).toBe(MEDICAL_PARAMETER_REQUIRED);
      expect(result.programId).toBeUndefined();
    }
  );
});
