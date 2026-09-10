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
  startingPosition?: string | null;
  executionSteps?: string | null;
  breathingInstruction?: string | null;
  durationSeconds?: number | null;
  repetitions?: number | null;
  sets?: number | null;
  restTimeSeconds?: number | null;
  frequency?: string | null;
  intensity?: string | null;
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
