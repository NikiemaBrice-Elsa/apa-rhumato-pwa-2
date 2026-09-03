import type { PathologyCode } from "./pathologies";
import type { ObjectiveCode } from "./objectives";
import type { MedicalValidationStatus } from "./exercises";
import type { SafetyStatus } from "./screening";

/**
 * §67-68 : structure d'un programme. Le cahier des charges donne l'exemple
 * "niveau = débutant" (§30) : ces trois niveaux sont donc repris comme
 * vocabulaire de base. Les CRITÈRES DE PASSAGE du niveau INITIAL (classification
 * de départ, distincte de la progression entre séances — réf. B2) sont
 * restés `TODO_MEDICAL_VALIDATION` (§58) jusqu'au 23/08/2026, date à
 * laquelle Dr Nikiema y a répondu explicitement (`QUESTIONS_ALLOW_PROGRAM_
 * 20260823.docx`, Questions 1 et 2) — voir `classifyInitialProfileLevel`
 * ci-dessous pour l'implémentation exacte de sa réponse.
 */
export const PROFILE_LEVELS = ["debutant", "intermediaire", "avance"] as const;
export type ProfileLevel = (typeof PROFILE_LEVELS)[number];

export const PROFILE_LEVEL_LABELS_FR: Record<ProfileLevel, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

/**
 * Niveau suivant dans l'ordre débutant -> intermédiaire -> avancé, ou
 * `null` si déjà au niveau le plus avancé (rien à proposer). Fonction pure
 * de pur ordonnancement — ne décide jamais QUAND progresser (voir
 * `packages/rules-engine/src/progression.ts`), seulement VERS QUEL niveau,
 * utilisée par `apps/web/src/app/api/programs/progress/route.ts` (Sprint 18,
 * réponse Q4 de `QUESTIONS_PROGRESSION_REGRESSION_20260823.docx` : la
 * bascule de niveau reste une action volontaire du patient, jamais
 * automatique).
 */
export function nextProfileLevel(level: ProfileLevel): ProfileLevel | null {
  const index = PROFILE_LEVELS.indexOf(level);
  return index >= 0 && index < PROFILE_LEVELS.length - 1 ? PROFILE_LEVELS[index + 1] : null;
}

/** Reflète la table `programs` (§67) — champs strictement conformes à la
 * structure imposée par le cahier des charges. Aucun programme réel n'est
 * fourni par le code : cette interface décrit la FORME des données. */
export interface Program {
  programId: string;
  programCode: string;
  pathology: PathologyCode;
  profileLevel: ProfileLevel;
  objective?: ObjectiveCode | string | null;
  durationWeeks?: number | null;
  frequencyPerWeek?: number | null;
  intensity?: string | null;
  aerobicComponent?: string | null;
  strengthComponent?: string | null;
  mobilityComponent?: string | null;
  balanceComponent?: string | null;
  functionalComponent?: string | null;
  progressionRule?: string | null;
  regressionRule?: string | null;
  safetyRules?: string | null;
  scientificReferenceIds: string[];
  version: string;
  medicalValidationStatus: MedicalValidationStatus;
}

/** Ligne de `user_program_assignments` (Sprint 6) — historique immuable
 * d'une tentative d'attribution de programme, une par évaluation (§65). */
export interface ProgramAssignmentRecord {
  id: string;
  userId: string;
  assessmentId?: string | null;
  pathology: PathologyCode;
  programId?: string | null;
  status: "assigned" | "pending_validation";
  matchedRuleId?: string | null;
  engineVersion: string;
  createdAt: string;
}

/**
 * Classification du niveau initial (débutant/intermédiaire/avancé) d'un
 * patient — fait `niveau` consommé par les règles `allow_program`
 * (`clinical_rules`, action `allow_program`) via le moteur générique
 * (`@apa/rules-engine`, `evaluateProgramAssignment`). Implémente
 * littéralement les réponses de Dr Nikiema du 23/08/2026 à
 * `QUESTIONS_ALLOW_PROGRAM_20260823.docx` :
 *
 * - **Dépistage `vert`** : le niveau initial dépend du niveau d'activité
 *   physique déclaré à l'inscription (`physical_activity_level`, échelle
 *   1-5, §13) — Proposition A retenue, uniforme sur les 6 pathologies :
 *   1-2 → `debutant`, 3 → `intermediaire`, 4-5 → `avance`.
 * - **Dépistage `orange`** : niveau initial systématiquement plafonné à
 *   `debutant`, QUEL QUE SOIT le niveau d'activité déclaré — réponse
 *   explicite de Dr Nikiema (Question 1 : « le niveau est automatiquement
 *   plafonné à débutant » ; Question 2 : accès automatique autorisé, mais
 *   « exclusivement au niveau débutant »). L'assignation au programme
 *   débutant déjà validé (avec ses propres `safety_rules`) EST
 *   l'« adaptation de sécurité » qu'il demande — aucun critère
 *   supplémentaire par motif d'alerte n'a été introduit, pour ne pas
 *   inventer une granularité qu'il n'a pas fournie.
 * - **Dépistage `rouge` ou `pending_validation`** : retourne `null`, pour
 *   qu'aucune règle `allow_program` ne puisse jamais matcher — le rouge
 *   bloque déjà tout programme automatique (mécanisme indépendant, Sprint
 *   3) ; `pending_validation` ne doit jamais produire d'attribution
 *   automatique (§57, §59, §78).
 * - **`physicalActivityLevel` absent ou hors de l'échelle 1-5, sous un
 *   dépistage `vert`** : retourne `null` plutôt que de deviner un niveau —
 *   se traduit par `MEDICAL_PARAMETER_REQUIRED` côté sélection de
 *   programme (aucune règle `allow_program` ne matche sans fait `niveau`).
 */
export function classifyInitialProfileLevel(
  physicalActivityLevel: number | null | undefined,
  screeningStatus: SafetyStatus
): ProfileLevel | null {
  if (screeningStatus === "rouge" || screeningStatus === "pending_validation") {
    return null;
  }

  if (screeningStatus === "orange") {
    return "debutant";
  }

  // screeningStatus === "vert"
  if (
    physicalActivityLevel === null ||
    physicalActivityLevel === undefined ||
    !Number.isInteger(physicalActivityLevel) ||
    physicalActivityLevel < 1 ||
    physicalActivityLevel > 5
  ) {
    return null;
  }

  if (physicalActivityLevel <= 2) return "debutant";
  if (physicalActivityLevel === 3) return "intermediaire";
  return "avance";
}
