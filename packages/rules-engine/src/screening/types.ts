import type { Facts, PathologyCode, SafetyStatus } from "@apa/domain";

export interface ScreeningResult {
  status: SafetyStatus;
  message: string;
  /** Identifiants des règles (`clinical_rules.rule_id`) déclenchées, le cas échéant. */
  triggeredFlags: string[];
  /** Vrai si au moins une règle de dépistage active existe pour cette
   * pathologie dans `clinical_rules`. Faux => statut nécessairement
   * `pending_validation`, jamais `vert` ni `orange` (aucune invention de
   * seuil médical, §57/§59). */
  ruleImplemented: boolean;
}

/** Alias — conservé pour lisibilité dans le contexte du dépistage. */
export type ScreeningResponses = Facts;

/** Version du code de l'interpréteur de dépistage (distincte de la version
 * de chaque règle, stockée sur `clinical_rules.version`). Traçabilité §43, §65. */
export const SAFETY_SCREENING_ENGINE_VERSION = "safety-screening-engine-V2.0-data-driven";

export type { PathologyCode };
