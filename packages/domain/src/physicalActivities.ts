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

export const PHYSICAL_ACTIVITY_TYPES = ["marche", "velo", "aerobie", "fitness", "natation", "autre"] as const;
export type PhysicalActivityType = (typeof PHYSICAL_ACTIVITY_TYPES)[number];

export const PHYSICAL_ACTIVITY_TYPE_LABELS_FR: Record<PhysicalActivityType, string> = {
  marche: "Marche",
  velo: "Vélo",
  aerobie: "Aérobie",
  fitness: "Fitness",
  natation: "Natation",
  autre: "Autre",
};

/** Types pour lesquels un suivi de distance par GPS a un sens (Sprint 25) —
 * les autres (aérobie, fitness, natation, autre) utilisent uniquement le
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
