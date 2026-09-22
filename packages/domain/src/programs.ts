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

/**
 * §29, §58 — cadre indicatif fréquence/durée par niveau, réponse explicite
 * de Dr Nikiema (document « système de progression », 21/09/2026, section A) :
 * « Débutant : 2-3 séances/semaine, 20-30 min/séance ; Intermédiaire : 3-4
 * séances/semaine, 30-45 min/séance ; Supérieur : 4-5 séances/semaine, 45-60
 * min/séance », avec « une progression progressive de la durée et surtout de
 * l'intensité, SANS OBLIGATION d'atteindre systématiquement la durée
 * maximale ». Reprise littérale de ses bornes min/max — jamais une valeur
 * unique imposée, jamais une moyenne inventée à sa place.
 *
 * Purement indicatif/affichage : le programme RÉELLEMENT assigné à un
 * patient (`programs.frequency_per_week`, §67-68) reste l'unique source de
 * vérité pour SA fréquence cible (utilisée par `computeAdherencePercent`/
 * `computeMultiWeekAdherencePercent`) — ce tableau ne la remplace jamais.
 */
export interface ProfileLevelGuidance {
  sessionsPerWeekMin: number;
  sessionsPerWeekMax: number;
  sessionDurationMinutesMin: number;
  sessionDurationMinutesMax: number;
}

export const PROFILE_LEVEL_GUIDANCE: Record<ProfileLevel, ProfileLevelGuidance> = {
  debutant: { sessionsPerWeekMin: 2, sessionsPerWeekMax: 3, sessionDurationMinutesMin: 20, sessionDurationMinutesMax: 30 },
  intermediaire: { sessionsPerWeekMin: 3, sessionsPerWeekMax: 4, sessionDurationMinutesMin: 30, sessionDurationMinutesMax: 45 },
  avance: { sessionsPerWeekMin: 4, sessionsPerWeekMax: 5, sessionDurationMinutesMin: 45, sessionDurationMinutesMax: 60 },
};

/**
 * §29, §58, §70 — fenêtres d'observation pour le passage d'un niveau à
 * l'autre, chiffrées explicitement par Dr Nikiema (document « système de
 * progression », 21/09/2026, section B) :
 *   - Débutant -> Intermédiaire : « sur les 4 dernières semaines »
 *   - Intermédiaire -> Supérieur : « sur les 6 dernières semaines »
 * Indexé par le niveau ACTUEL du patient (celui dont il pourrait sortir),
 * pas le niveau visé. `avance` n'a pas de niveau supérieur (voir
 * `nextProfileLevel`) — volontairement absent de cet objet, jamais une
 * fenêtre inventée pour un passage qui n'existe pas.
 */
export const PROGRESSION_WINDOW_WEEKS: Partial<Record<ProfileLevel, number>> = {
  debutant: 4,
  intermediaire: 6,
};

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
 * (`@apa/rules-engine`, `evaluateProgramAssignment`).
 *
 * Mise à jour Sprint 29 (22/09/2026, message direct de Dr Nikiema) :
 * « Tout patient doit passer d'abord par le niveau débutant avant de
 * progresser. » Remplace la réponse du 23/08/2026 à
 * `QUESTIONS_ALLOW_PROGRAM_20260823.docx` (Proposition A, niveau initial
 * dérivé du niveau d'activité physique déclaré : 1-2 → débutant,
 * 3 → intermédiaire, 4-5 → avancé) — décision produit/clinique ultérieure et
 * explicite qui prévaut. Toute progression vers l'intermédiaire ou l'avancé
 * passe désormais EXCLUSIVEMENT par le système de progression volontaire
 * (§29, §58, §70 ; `evaluateProgressionDecision`,
 * `POST /api/programs/progress`) — jamais par une classification initiale.
 * `physical_activity_level` (§13) reste enregistré au profil patient mais
 * n'intervient plus dans le calcul du niveau initial.
 *
 * - **Dépistage `vert` ou `orange`** : toujours `debutant` — aucune
 *   exception, quel que soit le niveau d'activité physique déclaré.
 * - **Dépistage `rouge` ou `pending_validation`** : retourne `null`, pour
 *   qu'aucune règle `allow_program` ne puisse jamais matcher — le rouge
 *   bloque déjà tout programme automatique (mécanisme indépendant, Sprint
 *   3) ; `pending_validation` ne doit jamais produire d'attribution
 *   automatique (§57, §59, §78).
 *
 * `physicalActivityLevel` reste un paramètre de la fonction (signature
 * inchangée, pour ne pas casser ses appelants) mais n'influence plus la
 * valeur retournée — conservé uniquement pour ne pas modifier
 * `apps/web/src/app/api/assessments/route.ts` au-delà de ce qui est
 * nécessaire.
 */
export function classifyInitialProfileLevel(
  physicalActivityLevel: number | null | undefined,
  screeningStatus: SafetyStatus
): ProfileLevel | null {
  if (screeningStatus === "rouge" || screeningStatus === "pending_validation") {
    return null;
  }

  // vert ou orange : toujours débutant (Sprint 29, 22/09/2026) — la
  // progression vers un niveau supérieur est désormais exclusivement
  // volontaire, via le système de progression (POST /api/programs/progress).
  return "debutant";
}
