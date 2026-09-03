import { describe, expect, it } from "vitest";
import { evaluateSafetyScreeningFromRules } from "@apa/rules-engine";
import { PATHOLOGY_CODES, type ClinicalRule } from "@apa/domain";

/**
 * Test sécurité (§55, priorité absolue §78 « Sécurité du patient »).
 * Garde-fou : pour AUCUNE des six pathologies de la V1, le moteur ne doit
 * renvoyer `vert` ou `orange`, y compris si la base de règles est vide ou
 * ne contient que des règles inactives. Casse intentionnellement si
 * quelqu'un ajoute un jour un statut vert/orange sans passer par une règle
 * `clinical_rules` explicitement validée (§57, §59).
 *
 * Mise à jour du 20/08/2026 : depuis l'activation du premier seuil gradué
 * validé (réf. B1 du questionnaire de validation médicale), le dispatcher
 * PEUT légitimement renvoyer `vert`/`orange` — mais UNIQUEMENT lorsqu'au
 * moins une règle `require_precaution`/`medical_referral`/`stop_program`
 * réellement ACTIVE existe pour la pathologie (voir
 * packages/rules-engine/src/screening/index.ts). Les deux blocs ci-dessous
 * (aucune règle / règles inactives) continuent de vérifier que ce n'est
 * JAMAIS le cas sans validation ; le bloc ajouté vérifie le nouveau
 * comportement légitime, pour que les deux garanties restent visibles côte
 * à côte et qu'aucune régression future ne passe inaperçue dans un sens ou
 * dans l'autre.
 */
describe("Garde-fou : pas de feu vert/orange inventé", () => {
  it.each(PATHOLOGY_CODES)("%s : aucune règle en base -> jamais vert ni orange", (pathology) => {
    const result = evaluateSafetyScreeningFromRules(pathology, {}, []);
    expect(["vert", "orange"]).not.toContain(result.status);
  });

  it.each(PATHOLOGY_CODES)("%s : règles inactives uniquement -> jamais vert ni orange", (pathology) => {
    const inactiveRules: ClinicalRule[] = [
      {
        ruleId: "FIXTURE_INACTIVE",
        pathology,
        condition: { field: "x", operator: "exists" },
        severity: "critical",
        action: "medical_referral",
        message: "fixture",
        active: false,
        version: "V1.0",
      },
    ];
    const result = evaluateSafetyScreeningFromRules(pathology, { x: "present" }, inactiveRules);
    expect(["vert", "orange"]).not.toContain(result.status);
  });
});

describe("Vert/orange réels : UNIQUEMENT avec une règle active validée (20/08/2026)", () => {
  function precautionRule(pathology: (typeof PATHOLOGY_CODES)[number]): ClinicalRule {
    return {
      ruleId: "FIXTURE_PRECAUTION",
      pathology,
      condition: { field: "douleur", operator: "gte", value: 4 },
      severity: "warning",
      action: "require_precaution",
      message: "fixture orange",
      active: true,
      version: "V1.0",
    };
  }

  it.each(PATHOLOGY_CODES)("%s : règle orange active et déclenchée -> orange", (pathology) => {
    const result = evaluateSafetyScreeningFromRules(pathology, { douleur: 5 }, [precautionRule(pathology)]);
    expect(result.status).toBe("orange");
  });

  it.each(PATHOLOGY_CODES)("%s : règle orange active mais non déclenchée -> vert (validé, pas inventé)", (pathology) => {
    const result = evaluateSafetyScreeningFromRules(pathology, { douleur: 1 }, [precautionRule(pathology)]);
    expect(result.status).toBe("vert");
  });
});
