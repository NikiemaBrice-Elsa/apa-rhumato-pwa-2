import { describe, expect, it } from "vitest";
import { evaluateProgramAssignment, MEDICAL_PARAMETER_REQUIRED } from "@apa/rules-engine";
import { PATHOLOGY_CODES, type ClinicalRule } from "@apa/domain";

/**
 * Test sécurité (§55, priorité absolue §78 « Sécurité du patient »), Sprint 6.
 * Garde-fou : pour AUCUNE des six pathologies de la V1, le moteur ne doit
 * jamais attribuer de programme (`status: "assigned"`), y compris si la
 * base de règles est vide, ne contient que des règles inactives, ou contient
 * une règle `allow_program` qui correspond mais ne porte pas de `programId`
 * explicite. Casse intentionnellement si quelqu'un ajoute un jour une
 * attribution automatique sans passer par une règle `clinical_rules`
 * explicitement validée et reliée à un programme (§57, §59).
 */
describe("Garde-fou : jamais de programme attribué sans règle allow_program + programId explicites", () => {
  it.each(PATHOLOGY_CODES)("%s : aucune règle en base -> jamais assigné", (pathology) => {
    const result = evaluateProgramAssignment(pathology, {}, []);
    expect(result.status).toBe(MEDICAL_PARAMETER_REQUIRED);
    expect(result.programId).toBeUndefined();
  });

  it.each(PATHOLOGY_CODES)("%s : règle allow_program sans programId -> jamais assigné", (pathology) => {
    const rules: ClinicalRule[] = [
      {
        ruleId: "FIXTURE_SANS_PROGRAMME",
        pathology,
        condition: { field: "screening", operator: "equals", value: "vert" },
        severity: "info",
        action: "allow_program",
        message: "fixture",
        active: true,
        version: "V1.0",
      },
    ];
    const result = evaluateProgramAssignment(pathology, { screening: "vert" }, rules);
    expect(result.status).toBe(MEDICAL_PARAMETER_REQUIRED);
  });

  it.each(PATHOLOGY_CODES)("%s : règle allow_program inactive avec programId -> jamais assigné", (pathology) => {
    const rules: ClinicalRule[] = [
      {
        ruleId: "FIXTURE_INACTIVE_AVEC_PROGRAMME",
        pathology,
        condition: { field: "screening", operator: "equals", value: "vert" },
        severity: "info",
        action: "allow_program",
        message: "fixture",
        programId: "11111111-1111-1111-1111-111111111111",
        active: false,
        version: "V1.0",
      },
    ];
    const result = evaluateProgramAssignment(pathology, { screening: "vert" }, rules);
    expect(result.status).toBe(MEDICAL_PARAMETER_REQUIRED);
  });
});
