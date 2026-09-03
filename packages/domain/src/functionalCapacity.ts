/**
 * Capacité fonctionnelle (§33, réf. B10, 20/08/2026) — Sprint 18.
 *
 * Dr Nikiema a répondu : PROMIS Physical Function (format CAT) en mesure
 * principale, complété par le Patient-Specific Functional Scale (PSFS) ;
 * recueil à l'inclusion puis à intervalles réguliers.
 *
 * PROMIS (CAT) : aucune administration réelle de l'algorithme adaptatif
 * n'est implémentée ici. Le faire sans la banque d'items et le moteur
 * officiels (HealthMeasures Assessment Center) reviendrait à fabriquer un
 * instrument validé de mémoire — exactement le contenu médical non sourcé
 * interdit par §57/§59. Ce module ne fait donc qu'ENREGISTRER un score déjà
 * obtenu par ailleurs (T-score + erreur standard), en attendant une décision
 * de Dr Nikiema sur le mode d'administration (voir
 * QUESTIONS_SEANCE_CAPACITE_FONCTIONNELLE_20260830.docx).
 *
 * PSFS : méthodologie publique de l'instrument (le patient nomme lui-même
 * 3 à 5 activités qui lui posent difficulté, note chacune 0-10, le score
 * global est la moyenne arithmétique) — ne dépend d'aucun contenu clinique
 * propre à Dr Nikiema, donc entièrement implémenté (même principe que
 * `computeBmi`/les conversions de glycémie dans measurements.ts : une
 * formule publique de l'instrument, pas un seuil clinique inventé).
 */

export const FUNCTIONAL_CAPACITY_INSTRUMENTS = ["psfs", "promis_pf_cat"] as const;
export type FunctionalCapacityInstrument = (typeof FUNCTIONAL_CAPACITY_INSTRUMENTS)[number];

export const FUNCTIONAL_CAPACITY_INSTRUMENT_LABELS_FR: Record<FunctionalCapacityInstrument, string> = {
  psfs: "Patient-Specific Functional Scale (PSFS)",
  promis_pf_cat: "PROMIS Physical Function (CAT)",
};

/** Méthodologie standard PSFS : de 3 à 5 activités nommées par le patient. */
export const PSFS_MIN_ACTIVITIES = 3;
export const PSFS_MAX_ACTIVITIES = 5;

export interface PsfsActivity {
  id: string;
  assessmentId: string;
  activityLabel: string;
  difficultyScore: number;
  orderIndex: number;
}

/** Reflète `functional_capacity_assessments` — les champs non pertinents pour
 * l'instrument concerné restent `null`/absents (même convention que `measurements`). */
export interface FunctionalCapacityAssessment {
  id: string;
  userId: string;
  instrument: FunctionalCapacityInstrument;
  promisTScore?: number | null;
  promisStandardError?: number | null;
  activities?: PsfsActivity[];
  assessedAt: string;
  createdAt: string;
}

/**
 * Score PSFS = moyenne arithmétique des scores de difficulté des activités
 * (méthodologie publiée de l'instrument, pas un calcul inventé). `null` si
 * aucune activité — jamais 0 par défaut, qui laisserait croire à un score
 * réel de « aucune difficulté ».
 */
export function computePsfsAverageScore(activities: Array<{ difficultyScore: number }>): number | null {
  if (activities.length === 0) return null;
  const sum = activities.reduce((acc, a) => acc + a.difficultyScore, 0);
  return Math.round((sum / activities.length) * 10) / 10;
}

/**
 * Cadence de réévaluation (§39/§33, réf. B14, 20/08/2026) : « réévaluation
 * fonctionnelle 4-6 semaines ». Choix de produit/engagement (comme
 * `MISSED_SESSION_GAP_DAYS`, packages/domain/src/notifications.ts), pas un
 * seuil clinique — milieu de la fourchette retenu par cohérence avec la
 * convention déjà appliquée à `MISSED_SESSION_GAP_DAYS` (milieu de « 3-5
 * jours » → 4 jours) : (4+6)/2 = 5 semaines = 35 jours.
 *
 * Fonction pure exposée pour un futur rappel dédié
 * (`packages/domain/src/notifications.ts` n'a pas encore de type de
 * notification « réévaluation fonctionnelle » — ajouter ce 7ᵉ type
 * nécessite d'étendre le schéma `notifications` (§39 n'en liste que 6) et
 * n'a volontairement pas été fait dans ce lot pour ne pas modifier une table
 * déjà en production sans nécessité immédiate).
 */
export const FUNCTIONAL_CAPACITY_REASSESSMENT_DAYS = 35;

export function isFunctionalCapacityReassessmentDue(lastAssessedAt: string | null, now: Date): boolean {
  if (!lastAssessedAt) return true;
  const daysSince = (now.getTime() - new Date(lastAssessedAt).getTime()) / (24 * 60 * 60 * 1000);
  return daysSince >= FUNCTIONAL_CAPACITY_REASSESSMENT_DAYS;
}
