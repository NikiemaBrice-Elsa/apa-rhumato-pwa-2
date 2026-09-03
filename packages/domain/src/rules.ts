import type { PathologyCode } from "./pathologies";

/**
 * Vocabulaire du moteur de règles médicales déterministe (§30, §31).
 * Ces types décrivent la FORME des règles (table `clinical_rules`) — ils ne
 * contiennent eux-mêmes aucun contenu médical. Le contenu (conditions,
 * seuils, messages) vient exclusivement des lignes de données, validées par
 * le concepteur médical (§57, §59).
 */

export type ConditionOperator = "equals" | "not_equals" | "in" | "gte" | "lte" | "exists";

export interface FieldCondition {
  field: string;
  operator: ConditionOperator;
  value?: boolean | number | string | Array<number | string>;
}

export interface AllCondition {
  all: RuleCondition[];
}

export interface AnyCondition {
  any: RuleCondition[];
}

export type RuleCondition = FieldCondition | AllCondition | AnyCondition;

/**
 * Actions possibles d'une règle, reprises de la proposition d'architecture
 * (docs/ARCHITECTURE_TECHNIQUE_V1.md, section 4 — table clinical_rules).
 */
export type RuleAction =
  | "allow_program"
  | "require_precaution"
  | "medical_referral"
  | "adjust_progression"
  | "stop_program";

export type RuleSeverity = "info" | "warning" | "critical";

/** Décisions de progression possibles (§29, §58, §70 ; Sprint 8, complété
 * Sprint 17 suite 4). Reprend la sortie de `evaluateProgressionDecision`
 * (packages/rules-engine/src/progression.ts), sans son état
 * `MEDICAL_PARAMETER_REQUIRED` qui n'est jamais une valeur STOCKÉE sur une
 * règle — seulement ce que le moteur renvoie en l'absence de règle
 * correspondante. */
export const PROGRESSION_DECISIONS = ["progress", "maintain", "reduce", "suspend"] as const;
export type ProgressionRuleDecision = (typeof PROGRESSION_DECISIONS)[number];

/** Reflète une ligne de la table `clinical_rules` (§31). */
export interface ClinicalRule {
  ruleId: string;
  pathology: PathologyCode;
  condition: RuleCondition;
  severity: RuleSeverity;
  action: RuleAction;
  message: string;
  referenceId?: string | null;
  /** Programme visé, uniquement pertinent quand `action === "allow_program"`
   * (§30 exemple 1, §67-68 ; Sprint 6). Ignoré pour toute autre action. Une
   * règle `allow_program` sans `programId` ne doit jamais aboutir à une
   * attribution (§78 : sécurité du patient avant tout). */
  programId?: string | null;
  /** Décision portée par la règle, uniquement pertinente quand
   * `action === "adjust_progression"` (§29, §58, §70 ; Sprint 8/17).
   * Ignorée pour toute autre action. Une règle `adjust_progression` sans
   * `progressionDecision` ne doit jamais influencer une décision de
   * progression — même principe de sécurité que `programId` pour
   * `allow_program` : ne jamais deviner (§57, §59, §78). */
  progressionDecision?: ProgressionRuleDecision | null;
  active: boolean;
  version: string;
  validatedBy?: string | null;
  validatedDate?: string | null;
}

/** Faits observés sur un utilisateur/une session, évalués contre les règles.
 * Réutilisé par le dépistage (Sprint 3) et, plus tard, par la sélection de
 * programme et la progression (Sprint 6/8). */
export type Facts = Record<string, boolean | number | string>;

const CONDITION_OPERATORS: readonly ConditionOperator[] = ["equals", "not_equals", "in", "gte", "lte", "exists"];

/**
 * §46, §57 (Sprint 13) : valide la FORME d'une condition saisie par
 * l'administrateur (espace admin, gestion des règles cliniques) avant
 * qu'elle ne soit enregistrée. Un objet malformé ne doit jamais être
 * silencieusement accepté puis évalué à `false` en production par
 * `evaluateCondition` (packages/rules-engine) — mieux vaut un rejet
 * explicite à la saisie qu'une règle de sécurité qui ne se déclenche
 * jamais sans que personne ne s'en aperçoive. Fonction pure, récursive,
 * sans connaissance du contenu médical (comme le reste de ce fichier).
 */
export function isValidRuleCondition(value: unknown): value is RuleCondition {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;

  if ("all" in record) {
    return Array.isArray(record.all) && record.all.length > 0 && record.all.every(isValidRuleCondition);
  }
  if ("any" in record) {
    return Array.isArray(record.any) && record.any.length > 0 && record.any.every(isValidRuleCondition);
  }

  if (typeof record.field !== "string" || record.field.trim() === "") return false;
  if (typeof record.operator !== "string" || !CONDITION_OPERATORS.includes(record.operator as ConditionOperator)) {
    return false;
  }
  if (record.operator === "exists") return true; // pas de `value` requis
  if (!("value" in record)) return false;

  const { value: conditionValue } = record;
  const isScalar = typeof conditionValue === "boolean" || typeof conditionValue === "number" || typeof conditionValue === "string";
  const isScalarArray =
    Array.isArray(conditionValue) && conditionValue.every((item) => typeof item === "number" || typeof item === "string");

  if (record.operator === "in") return isScalarArray;
  return isScalar;
}
