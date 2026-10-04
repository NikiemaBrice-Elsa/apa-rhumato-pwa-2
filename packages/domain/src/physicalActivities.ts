/**
 * Historique des activités physiques (Sprint 26, 21/09/2026) — répond à la
 * demande de Dr Nikiema, après déploiement du chronomètre/suivi de marche
 * GPS (Sprint 25), de : (1) choisir un type d'activité avant de lancer le
 * compte à rebours, (2) conserver un historique (durée + type), (3) faire
 * figurer ces activités dans le rapport PDF de suivi (§40, §71).
 *
 * Donnée autodéclarée par le patient, sans logique clinique : aucune
 * décision (progression, alerte) ne dépend de cette table (§57, §59).
 */

/**
 * Sprint 39 (04/10/2026, instruction directe de Dr Nikiema) : « Dans la liste
 * des activités physiques il faut ajouter "Renforcement musculaire" » —
 * type sans suivi GPS (compte à rebours uniquement), comme aérobie/fitness.
 */
export const PHYSICAL_ACTIVITY_TYPES = [
  "marche",
  "velo",
  "aerobie",
  "renforcement_musculaire",
  "fitness",
  "natation",
  "autre",
] as const;
export type PhysicalActivityType = (typeof PHYSICAL_ACTIVITY_TYPES)[number];

export const PHYSICAL_ACTIVITY_TYPE_LABELS_FR: Record<PhysicalActivityType, string> = {
  marche: "Marche",
  velo: "Vélo",
  aerobie: "Aérobie",
  renforcement_musculaire: "Renforcement musculaire",
  fitness: "Fitness",
  natation: "Natation",
  autre: "Autre",
};

/** Types pour lesquels un suivi de distance par GPS a un sens (Sprint 25) —
 * les autres (aérobie, renforcement musculaire, fitness, natation, autre) utilisent uniquement le
 * compte à rebours, sans distance. */
export const GPS_TRACKED_ACTIVITY_TYPES: ReadonlySet<PhysicalActivityType> = new Set(["marche", "velo"]);

export function isGpsTrackedActivityType(activityType: PhysicalActivityType): boolean {
  return GPS_TRACKED_ACTIVITY_TYPES.has(activityType);
}

/** Reflète une ligne de la table `physical_activities` (Sprint 26). */
export interface PhysicalActivity {
  id: string;
  userId: string;
  activityType: PhysicalActivityType;
  durationSeconds: number;
  distanceMeters?: number | null;
  startedAt: string;
  completedAt: string;
  createdAt: string;
}

/** Formate une durée en secondes pour affichage patient (ex. « 12 min », « 1 h 05 »). */
export function formatActivityDurationLabel(durationSeconds: number): string {
  const totalMinutes = Math.round(durationSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours} h ${String(minutes).padStart(2, "0")}` : `${hours} h`;
}

export interface PhysicalActivityTypeTotal {
  activityType: PhysicalActivityType;
  totalDurationSeconds: number;
  count: number;
}

/**
 * Additionne la durée totale et le nombre de séances par type d'activité,
 * dans l'ordre de `PHYSICAL_ACTIVITY_TYPES` (types absents de `activities`
 * omis du résultat). Fonction pure, utilisée pour un futur résumé (rapport,
 * tableau de bord) — aucun calcul clinique.
 */
export function summarizePhysicalActivitiesByType(
  activities: Pick<PhysicalActivity, "activityType" | "durationSeconds">[]
): PhysicalActivityTypeTotal[] {
  const totals = new Map<PhysicalActivityType, { totalDurationSeconds: number; count: number }>();
  for (const activity of activities) {
    const entry = totals.get(activity.activityType) ?? { totalDurationSeconds: 0, count: 0 };
    entry.totalDurationSeconds += activity.durationSeconds;
    entry.count += 1;
    totals.set(activity.activityType, entry);
  }
  return PHYSICAL_ACTIVITY_TYPES.filter((type) => totals.has(type)).map((type) => ({
    activityType: type,
    ...(totals.get(type) as { totalDurationSeconds: number; count: number }),
  }));
}

export interface PhysicalActivityPeriod {
  from: string;
  to: string;
}

/**
 * Moyenne hebdomadaire (heures/semaine) du temps total passé en activité
 * physique sur une période donnée (Sprint 35, 30/09/2026, instruction
 * directe de Dr Nikiema : « une moyenne de la durée des activités physiques
 * réalisées sous forme de nombre d'heures par semaine », destinée au
 * rapport PDF). Fonction pure, aucun calcul clinique.
 *
 * Un résultat à 0 h/semaine est un fait (aucune activité enregistrée sur la
 * période), pas une valeur devinée — il est donc bien retourné (§57, §59
 * interdisent d'inventer une valeur non enregistrée, pas d'afficher un
 * total réel de zéro). `null` n'est retourné que si la période elle-même
 * est invalide (durée nulle ou négative), pour éviter une division absurde
 * plutôt que produire un nombre qui n'aurait pas de sens.
 */
export function computeAveragePhysicalActivityHoursPerWeek(
  activities: Pick<PhysicalActivity, "durationSeconds">[],
  period: PhysicalActivityPeriod
): number | null {
  const periodMs = new Date(period.to).getTime() - new Date(period.from).getTime();
  if (!Number.isFinite(periodMs) || periodMs <= 0) return null;

  const periodWeeks = periodMs / (1000 * 60 * 60 * 24 * 7);
  const totalHours = activities.reduce((sum, a) => sum + a.durationSeconds, 0) / 3600;

  // Arrondi à 2 décimales pour un affichage lisible (ex. 1.25 h/semaine).
  return Math.round((totalHours / periodWeeks) * 100) / 100;
}

export interface SessionForActivityTotal {
  status: string;
  startedAt: string;
  completedAt: string | null | undefined;
}

/**
 * Durées (en secondes) des séances d'exercices RÉELLEMENT terminées — séances
 * guidées en direct (« Démarrer une séance ») et séances déclarées hors de
 * l'application (« Déclarer une séance ») — pour les additionner aux activités
 * libres (chronomètre, marche/vélo) dans la moyenne hebdomadaire du rapport
 * (Sprint 39, 04/10/2026, instruction directe de Dr Nikiema : « je veux que la
 * durée de toute activité réalisée aussi dans "mon programme, démarrer une
 * séance, déclarer une séance faite hors de l'appli" soit comptabilisée »).
 *
 * Ne retient que les séances `completed` dont les deux horodatages sont
 * valides et dont la durée est strictement positive : une séance sans durée
 * connue (ex. déclarée sans durée, `started_at` = `completed_at`) contribue
 * pour 0 et n'est donc jamais comptée à une durée devinée (§57, §59).
 */
export function completedSessionDurationsSeconds(sessions: SessionForActivityTotal[]): number[] {
  const durations: number[] = [];
  for (const session of sessions) {
    if (session.status !== "completed" || !session.completedAt) continue;
    const start = new Date(session.startedAt).getTime();
    const end = new Date(session.completedAt).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) continue;
    durations.push(Math.round((end - start) / 1000));
  }
  return durations;
}
