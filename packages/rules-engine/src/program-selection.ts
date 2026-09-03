import type { ClinicalRule, Facts, PathologyCode } from "@apa/domain";
import { MEDICAL_PARAMETER_REQUIRED } from "./constants";
import { evaluateRules } from "./engine";

/**
 * Sélection de programme (§30, exemple 1 ; §67-§68) — Sprint 6.
 *
 * Le cahier des charges donne la STRUCTURE de la décision :
 *   SI pathologie = X ET niveau = Y ET screening = vert ET douleur dans la
 *   plage autorisée ALORS programme = <program_id>
 * Ce module évalue les règles d'action `allow_program` de la même façon
 * que le dépistage évalue `medical_referral`/`stop_program` (voir
 * screening/index.ts) : générique, piloté par les données de
 * `clinical_rules`, sans aucun contenu médical codé en dur.
 *
 * Le programme concerné est porté par le champ `programId` de la règle
 * elle-même (packages/domain/src/rules.ts). Une règle `allow_program` dont
 * la condition est satisfaite mais qui ne porte PAS de `programId` est
 * ignorée : on ne devine jamais un programme (§57, §59, §78 — sécurité du
 * patient avant tout). Tant qu'aucune règle `allow_program` n'est validée
 * par le concepteur médical (ce qui est le cas au Sprint 6 : aucun seuil
 * §58 n'a encore été fourni), cette fonction retourne systématiquement
 * `MEDICAL_PARAMETER_REQUIRED`.
 */
export interface ProgramSelectionResult {
  status: "assigned" | typeof MEDICAL_PARAMETER_REQUIRED;
  programId?: string;
  matchedRuleId?: string;
}

/** Version du code de l'interpréteur de sélection de programme (distincte de
 * la version de chaque règle/programme). Traçabilité §43, §65 ; Sprint 6. */
export const PROGRAM_SELECTION_ENGINE_VERSION = "program-selection-engine-V1.0-data-driven";

export function evaluateProgramAssignment(
  pathology: PathologyCode,
  facts: Facts,
  rules: ClinicalRule[]
): ProgramSelectionResult {
  const candidates = evaluateRules(
    rules.filter((rule) => rule.pathology === pathology && rule.action === "allow_program"),
    facts
  );

  const matched = candidates.find((rule) => Boolean(rule.programId));

  if (!matched || !matched.programId) {
    return { status: MEDICAL_PARAMETER_REQUIRED };
  }

  return { status: "assigned", programId: matched.programId, matchedRuleId: matched.ruleId };
}
