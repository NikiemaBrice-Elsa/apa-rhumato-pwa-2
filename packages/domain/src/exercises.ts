import type { PathologyCode } from "./pathologies";
import type { ObjectiveCode } from "./objectives";

/** §25 : grandes catégories d'exercices. */
export const EXERCISE_CATEGORIES = [
  "aerobique",
  "renforcement",
  "mobilite",
  "equilibre",
  "controle_moteur",
  "fonctionnel",
] as const;
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

export const EXERCISE_CATEGORY_LABELS_FR: Record<ExerciseCategory, string> = {
  aerobique: "Aérobique",
  renforcement: "Renforcement",
  mobilite: "Mobilité",
  equilibre: "Équilibre",
  controle_moteur: "Contrôle moteur",
  fonctionnel: "Fonctionnel",
};

/** §27 : matériel autorisé en V1 (exercices à domicile, peu ou pas de matériel). */
export const EQUIPMENT_ITEMS = [
  "chaise",
  "mur",
  "tapis",
  "serviette",
  "bouteille_eau",
  "elastique",
  "aucun",
] as const;
export type EquipmentItem = (typeof EQUIPMENT_ITEMS)[number];

export const EQUIPMENT_LABELS_FR: Record<EquipmentItem, string> = {
  chaise: "Chaise",
  mur: "Mur",
  tapis: "Tapis",
  serviette: "Serviette",
  bouteille_eau: "Bouteille d'eau",
  elastique: "Élastique simple",
  aucun: "Aucun matériel",
};

/** §57/§58 : un exercice n'est visible des utilisateurs qu'une fois `validated`. */
export const MEDICAL_VALIDATION_STATUSES = ["draft", "pending_validation", "validated"] as const;
export type MedicalValidationStatus = (typeof MEDICAL_VALIDATION_STATUSES)[number];

/**
 * §58, Sprint 24 (14/09/2026) : format de difficulté par exercice, validé
 * par Dr Nikiema (Question 2 « a » du document
 * Propositions_Reformulation_Echelle_Premium_20260913.docx) — reprend
 * EXACTEMENT le même vocabulaire que `PROFILE_LEVELS`
 * (packages/domain/src/programs.ts, §30) plutôt que d'introduire une
 * troisième échelle. Dupliqué ici (et non importé depuis `programs.ts`)
 * pour éviter une dépendance circulaire — `programs.ts` importe déjà
 * `MedicalValidationStatus` depuis ce fichier. Les deux listes DOIVENT
 * rester identiques ; voir aussi `packages/domain/src/__tests__/exercises.test.ts`.
 */
export const EXERCISE_DIFFICULTY_LEVELS = ["debutant", "intermediaire", "avance"] as const;
export type ExerciseDifficultyLevel = (typeof EXERCISE_DIFFICULTY_LEVELS)[number];

export const EXERCISE_DIFFICULTY_LABELS_FR: Record<ExerciseDifficultyLevel, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

/** Borne d'une fourchette d'intensité cible en échelle de Borg CR10 (0 =
 * aucun effort, 10 = effort maximal — même échelle que `effort_percu_borg`,
 * packages/domain/src/screening.ts, réf. B6). */
export const BORG_CR10_MIN = 0;
export const BORG_CR10_MAX = 10;

/**
 * §28, réf. B8 (20/08/2026) : classement d'un exercice dans l'une des 3
 * phases d'une séance. `null`/absent = non classé — jamais une valeur
 * devinée (§57, §59) ; voir `infra/db/migrations/0014_...sql`.
 */
export const EXERCISE_PHASES = ["echauffement", "principal", "retour_au_calme"] as const;
export type ExercisePhase = (typeof EXERCISE_PHASES)[number];

export const EXERCISE_PHASE_LABELS_FR: Record<ExercisePhase, string> = {
  echauffement: "Échauffement",
  principal: "Partie principale",
  retour_au_calme: "Retour au calme",
};

/** Reflète la table `exercise_library` (§26) — champs strictement conformes
 * à la liste imposée par le cahier des charges. */
export interface Exercise {
  exerciseId: string;
  name: string;
  shortDescription: string;
  detailedDescription?: string | null;
  pathologies: PathologyCode[];
  objectives: ObjectiveCode[];
  category: ExerciseCategory;
  phase?: ExercisePhase | null;
  difficulty?: string | null;
  /** §58, Sprint 24 : niveau affiché au patient (Débutant/Intermédiaire/Avancé).
   * Distinct de `difficulty` (texte libre, documentation clinique interne). */
  difficultyLevel?: ExerciseDifficultyLevel | null;
  startingPosition?: string | null;
  executionSteps?: string | null;
  breathingInstruction?: string | null;
  durationSeconds?: number | null;
  repetitions?: number | null;
  sets?: number | null;
  restTimeSeconds?: number | null;
  frequency?: string | null;
  intensity?: string | null;
  /** §58, Sprint 24 : fourchette cible affichée au patient (Borg CR10).
   * Distincts de `intensity` (texte libre, documentation clinique interne). */
  intensityBorgMin?: number | null;
  intensityBorgMax?: number | null;
  progression?: string | null;
  regression?: string | null;
  contraindications?: string | null;
  precautions?: string | null;
  stopCriteria?: string | null;
  targetMuscles?: string | null;
  equipmentRequired: EquipmentItem[];
  videoUrl?: string | null;
  /** Coach vocal (Sprint 20) : audio joué avant l'exercice. */
  audioPreparationUrl?: string | null;
  /** Coach vocal (Sprint 20) : audio joué pendant l'exercice. */
  audioExerciseUrl?: string | null;
  thumbnailUrl?: string | null;
  scientificReferenceIds: string[];
  lastReviewed?: string | null;
  medicalValidationStatus: MedicalValidationStatus;
}
