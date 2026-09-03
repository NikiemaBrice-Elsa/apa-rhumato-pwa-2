import {
  PENDING_VALIDATION_MESSAGE,
  SCREENING_VERT_MESSAGE,
  type ClinicalRule,
  type Facts,
  type PathologyCode,
  type RuleAction,
} from "@apa/domain";
import { evaluateRules } from "../engine";
import type { ScreeningResult } from "./types";

export * from "./types";

/**
 * Point d'entrée du dépistage de sécurité (§15), désormais entièrement
 * piloté par les données de `clinical_rules` (§30, §43) plutôt que par du
 * code spécifique à chaque pathologie.
 *
 * Toute règle active dont l'action est `medical_referral` ou `stop_program`
 * et dont la condition est satisfaite fait basculer le statut à `rouge`.
 * Sinon, toute règle active `require_precaution` satisfaite fait basculer à
 * `orange`. Sinon, SI AU MOINS UNE RÈGLE `require_precaution` (pas
 * seulement rouge) est active pour cette pathologie, le statut est `vert`.
 *
 * Pourquoi spécifiquement une règle `require_precaution`, et pas n'importe
 * quelle règle active : un red flag rouge (ex. suspicion d'arthrite
 * septique, fracture récente) est une alarme binaire sur UN scénario
 * précis — son absence ne prouve rien sur les autres dimensions du tableau
 * clinique (douleur, gonflement...) qui n'ont, elles, jamais été évaluées.
 * Une règle `require_precaution` active, en revanche, signifie qu'une
 * dimension a été graduée de bout en bout (vert/orange/rouge) par le
 * concepteur médical — c'est ELLE qui justifie epistémiquement un `vert`
 * réel quand rien ne se déclenche. Si AUCUNE règle `require_precaution`
 * n'est active pour la pathologie (seulement des red flags, ou rien du
 * tout), le statut reste `pending_validation` : ne jamais inférer un
 * `vert` en l'absence d'une telle validation graduée (priorité absolue
 * « Sécurité du patient », §78 ; §57, §59).
 *
 * Historique (jusqu'au 20/08/2026) : ce dispatcher ne produisait jamais que
 * `rouge` ou `pending_validation` — aucun seuil `orange`/`vert` gradué
 * n'avait alors été validé par le concepteur médical, donc les chemins
 * orange/vert n'existaient pas dans le code, par construction. Le seuil de
 * douleur harmonisé (réf. B1 du questionnaire de validation médicale) est
 * le premier seuil gradué validé — voir `docs/DECISIONS.md` (section
 * « Intégration du questionnaire de validation médicale »).
 *
 * Les règles elles-mêmes (quelles conditions, quels messages) sont fournies
 * par l'appelant (lues depuis la table `clinical_rules`) : ce module ne
 * contient aucun contenu médical.
 */
const REFERRAL_ACTIONS: RuleAction[] = ["medical_referral", "stop_program"];
const PRECAUTION_ACTIONS: RuleAction[] = ["require_precaution"];

export function evaluateSafetyScreeningFromRules(
  pathology: PathologyCode,
  facts: Facts,
  rules: ClinicalRule[]
): ScreeningResult {
  const pathologyRules = rules.filter((rule) => rule.pathology === pathology);
  const matched = evaluateRules(pathologyRules, facts);

  const referralMatches = matched.filter((rule) => REFERRAL_ACTIONS.includes(rule.action));
  if (referralMatches.length > 0) {
    return {
      status: "rouge",
      // Règle la plus sévère en premier (evaluateRules trie déjà par sévérité).
      message: referralMatches[0].message,
      triggeredFlags: referralMatches.map((rule) => rule.ruleId),
      ruleImplemented: true,
    };
  }

  const precautionMatches = matched.filter((rule) => PRECAUTION_ACTIONS.includes(rule.action));
  if (precautionMatches.length > 0) {
    return {
      status: "orange",
      message: precautionMatches[0].message,
      triggeredFlags: precautionMatches.map((rule) => rule.ruleId),
      ruleImplemented: true,
    };
  }

  const hasValidatedSafetyCoverage = pathologyRules.some(
    (rule) => rule.active && PRECAUTION_ACTIONS.includes(rule.action)
  );

  if (hasValidatedSafetyCoverage) {
    return {
      status: "vert",
      message: SCREENING_VERT_MESSAGE,
      triggeredFlags: [],
      ruleImplemented: true,
    };
  }

  return {
    status: "pending_validation",
    message: PENDING_VALIDATION_MESSAGE,
    triggeredFlags: [],
    ruleImplemented: false,
  };
}
