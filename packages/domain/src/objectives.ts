/** Objectifs sélectionnables par l'utilisateur (§22 du cahier des charges). */
export const OBJECTIVE_CODES = [
  "REDUIRE_SEDENTARITE",
  "AMELIORER_MOBILITE",
  "AMELIORER_FORCE",
  "AMELIORER_ENDURANCE",
  "AMELIORER_EQUILIBRE",
  "AMELIORER_CAPACITE_FONCTIONNELLE",
  "REPRENDRE_ACTIVITE_PROGRESSIVEMENT",
  "AMELIORER_CONDITION_PHYSIQUE",
  "MAINTENIR_AUTONOMIE",
  "AMELIORER_CONFIANCE_MOUVEMENT",
] as const;

export type ObjectiveCode = (typeof OBJECTIVE_CODES)[number];

export const OBJECTIVE_LABELS_FR: Record<ObjectiveCode, string> = {
  REDUIRE_SEDENTARITE: "Diminuer la sédentarité",
  AMELIORER_MOBILITE: "Améliorer la mobilité",
  AMELIORER_FORCE: "Améliorer la force",
  AMELIORER_ENDURANCE: "Améliorer l'endurance",
  AMELIORER_EQUILIBRE: "Améliorer l'équilibre",
  AMELIORER_CAPACITE_FONCTIONNELLE: "Améliorer la capacité fonctionnelle",
  REPRENDRE_ACTIVITE_PROGRESSIVEMENT: "Reprendre progressivement une activité physique",
  AMELIORER_CONDITION_PHYSIQUE: "Améliorer la condition physique",
  MAINTENIR_AUTONOMIE: "Maintenir l'autonomie",
  AMELIORER_CONFIANCE_MOUVEMENT: "Améliorer la confiance dans le mouvement",
};

/** Niveaux d'activité physique initiale (§23). Le classement final ne doit PAS
 * reposer uniquement sur ces libellés : cf. TODO_MEDICAL_VALIDATION dans
 * packages/rules-engine (Sprint 4) pour les critères précis de classification. */
export const ACTIVITY_LEVELS = [
  { value: 1, label: "Très faible activité" },
  { value: 2, label: "Faible activité" },
  { value: 3, label: "Activité intermédiaire" },
  { value: 4, label: "Actif" },
  { value: 5, label: "Très actif" },
] as const;
