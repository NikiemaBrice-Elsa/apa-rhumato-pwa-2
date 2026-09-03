import type { ClinicalRule, Facts, RuleCondition } from "@apa/domain";

/**
 * Interpréteur générique de conditions/règles (§30, §31). Pur, déterministe,
 * sans aucun appel réseau ni IA générative — conforme au §30 : « NE PAS
 * UTILISER UNE IA GÉNÉRATIVE POUR DÉCIDER SEULE DE LA PRESCRIPTION ».
 *
 * Ce module ne connaît aucune pathologie, aucun seuil, aucun message : il se
 * contente d'évaluer des structures de données (`ClinicalRule`) contre des
 * faits (`Facts`). Le contenu médical vit exclusivement dans les lignes de
 * la table `clinical_rules`, versionnées et validées (§43, §65).
 */

export function evaluateCondition(condition: RuleCondition, facts: Facts): boolean {
  if ("all" in condition) {
    return condition.all.every((sub) => evaluateCondition(sub, facts));
  }
  if ("any" in condition) {
    return condition.any.some((sub) => evaluateCondition(sub, facts));
  }

  const { field, operator, value } = condition;
  const factValue = facts[field];

  switch (operator) {
    case "exists":
      return factValue !== undefined && factValue !== null && factValue !== "";
    case "equals":
      return factValue === value;
    case "not_equals":
      return factValue !== value;
    case "in":
      return Array.isArray(value) && typeof factValue !== "undefined" && (value as Array<number | string>).includes(factValue as number | string);
    case "gte":
      return typeof factValue === "number" && typeof value === "number" && factValue >= value;
    case "lte":
      return typeof factValue === "number" && typeof value === "number" && factValue <= value;
    default:
      return false;
  }
}

const SEVERITY_RANK: Record<ClinicalRule["severity"], number> = {
  critical: 3,
  warning: 2,
  info: 1,
};

/**
 * Évalue un ensemble de règles (déjà filtrées sur la pathologie concernée)
 * contre des faits, et retourne les règles ACTIVES dont la condition est
 * satisfaite, triées par sévérité décroissante.
 */
export function evaluateRules(rules: ClinicalRule[], facts: Facts): ClinicalRule[] {
  return rules
    .filter((rule) => rule.active)
    .filter((rule) => evaluateCondition(rule.condition, facts))
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
}
