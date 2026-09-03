import type { ClinicalRule, Facts, PathologyCode } from "@apa/domain";
import { MEDICAL_PARAMETER_REQUIRED } from "./constants";
import { evaluateRules } from "./engine";

/**
 * Décision de progression (§29, §58, §70) — Sprint 8 (squelette), complété
 * Sprint 17 (suite 4, 23/08/2026).
 *
 * Le cahier des charges donne la STRUCTURE :
 *   SI adhésion >= seuil ET tolérance = bonne ET progression = favorable
 *   ALORS proposer niveau supérieur
 * Les seuils eux-mêmes viennent des règles `clinical_rules` (action
 * `adjust_progression`, colonne `progression_decision` — migration 0013),
 * jamais codés en dur ici. §70 reste impératif : « Ne jamais augmenter
 * automatiquement la difficulté sur la seule base de la présence de
 * l'utilisateur » — c'est pourquoi une règle qui matche mais ne porte
 * AUCUNE `progressionDecision` est ignorée plutôt que de retomber sur une
 * valeur par défaut devinée (même principe que `programId` pour
 * `allow_program`, §57/§59/§78).
 *
 * Mise à jour Sprint 18 (31/08/2026) : 24 règles `adjust_progression`
 * réelles sont désormais actives (`infra/db/seed/0014_adjust_progression_
 * rules_dr_nikiema_20260831.sql`, une par décision × 6 pathologies), et
 * cette fonction est câblée depuis `apps/web/src/app/api/statistics/
 * progression/route.ts` (GET, affichage informatif seul) et consommée en
 * lecture seule par `apps/web/src/app/api/programs/progress/route.ts`
 * (POST, qui la recalcule côté serveur avant toute bascule de niveau —
 * jamais de confiance dans une décision envoyée par le client). Le champ
 * `progression_signal` consommé ici vient de `computeProgressionFacts`
 * (`packages/domain/src/sessions.ts`).
 */
export type ProgressionDecision = "progress" | "maintain" | "reduce" | "suspend" | typeof MEDICAL_PARAMETER_REQUIRED;

export interface ProgressionResult {
  decision: ProgressionDecision;
  matchedRuleId?: string;
}

/** Version du code de l'interpréteur de progression (distincte de la version
 * de chaque règle). Traçabilité §43, §65 ; câblé Sprint 18 (31/08/2026)
 * depuis `apps/web/src/app/api/statistics/progression/route.ts`. */
export const PROGRESSION_ENGINE_VERSION = "progression-engine-V1.0-data-driven";

export function evaluateProgressionDecision(
  pathology: PathologyCode,
  facts: Facts,
  rules: ClinicalRule[]
): ProgressionResult {
  const matched = evaluateRules(
    rules.filter((rule) => rule.pathology === pathology && rule.action === "adjust_progression"),
    facts
  );

  // Une règle qui matche mais ne porte aucune décision explicite est
  // ignorée : on ne devine jamais (§57, §59, §78). `evaluateRules` trie
  // déjà par sévérité décroissante — la première règle porteuse d'une
  // décision est donc la plus prioritaire.
  const decided = matched.find((rule) => Boolean(rule.progressionDecision));

  if (!decided || !decided.progressionDecision) {
    return { decision: MEDICAL_PARAMETER_REQUIRED };
  }

  return { decision: decided.progressionDecision, matchedRuleId: decided.ruleId };
}
