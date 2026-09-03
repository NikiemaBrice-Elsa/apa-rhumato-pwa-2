/**
 * §33 « Aujourd'hui » / « Séance du jour » (réf. B11) — Sprint 19 (31/08/2026).
 *
 * Réponse de Dr Nikiema (B11, 20/08/2026) : « oui, séance planifiée
 * automatiquement selon le FITT-VP du patient, avec fenêtre de réalisation
 * flexible (pas d'heure imposée) et report possible sans pénalisation ».
 * Cette réponse donne le PRINCIPE (planification automatique à partir de la
 * fréquence hebdomadaire déjà validée dans le programme, §67-68) mais ne
 * précise pas QUELS jours de la semaine — un choix qui n'engage aucun
 * paramètre clinique (contrairement à la fréquence elle-même, qui reste
 * entièrement la sienne via `programs.frequency_per_week`) : c'est une
 * convention de répartition, documentée comme telle et ajustable, exactement
 * comme `MISSED_SESSION_GAP_DAYS`/`FUNCTIONAL_CAPACITY_REASSESSMENT_DAYS`
 * (choix produit dans l'esprit de sa réponse, pas un seuil médical).
 */

/** Jours de la semaine, 0 = lundi ... 6 = dimanche (convention ISO, cohérente
 * avec `getWeekBounds`, `packages/domain/src/statistics.ts`). */
export const WEEKDAY_LABELS_FR = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;

/**
 * Répartit `frequencyPerWeek` séances sur la semaine (0 = lundi ... 6 =
 * dimanche), aussi régulièrement que possible, en partant du lundi.
 * Fonction pure et déterministe — pas de contenu clinique, une convention de
 * planification (voir commentaire d'en-tête). `frequencyPerWeek <= 0` ->
 * aucun jour (rien à planifier, jamais une séance inventée) ;
 * `frequencyPerWeek >= 7` -> tous les jours.
 */
export function computeWeeklyScheduleWeekdays(frequencyPerWeek: number): number[] {
  if (!Number.isFinite(frequencyPerWeek) || frequencyPerWeek <= 0) return [];
  const frequency = Math.min(7, Math.round(frequencyPerWeek));
  const days = new Set<number>();
  for (let i = 0; i < frequency; i++) {
    days.add(Math.round((i * 7) / frequency) % 7);
  }
  return Array.from(days).sort((a, b) => a - b);
}

/** `true` si `weekday` (0 = lundi ... 6 = dimanche) fait partie des jours
 * planifiés pour cette fréquence — pure, dérivée de `computeWeeklyScheduleWeekdays`. */
export function isWeekdayScheduled(weekday: number, frequencyPerWeek: number): boolean {
  return computeWeeklyScheduleWeekdays(frequencyPerWeek).includes(weekday);
}

/**
 * Fenêtre de rappel pour une séance planifiée non réalisée (réf. B14,
 * 20/08/2026) : « rappel de séance 24-48h si séance planifiée manquée ».
 * Milieu de la fourchette qu'il a donnée (même convention que
 * `MISSED_SESSION_GAP_DAYS`, `packages/domain/src/notifications.ts`) — un
 * choix de cadence produit, pas un seuil clinique. Exposée comme fonction
 * pure ; **pas encore câblée dans le système de notifications** (§39 ne
 * liste que 6 types, ajouter un 7ᵉ type nécessiterait d'étendre le schéma
 * `notifications` déjà en production — même retenue volontaire que pour la
 * réévaluation fonctionnelle, Sprint 18, `FUNCTIONAL_CAPACITY_REASSESSMENT_DAYS`).
 */
export const PLANNED_SESSION_REMINDER_WINDOW_HOURS = 36;

export function isPlannedSessionOverdueForReminder(plannedFor: string, now: Date): boolean {
  const plannedDate = new Date(`${plannedFor}T00:00:00.000Z`);
  if (Number.isNaN(plannedDate.getTime())) return false;
  const hoursSince = (now.getTime() - plannedDate.getTime()) / 3_600_000;
  return hoursSince >= PLANNED_SESSION_REMINDER_WINDOW_HOURS;
}

export const PLANNED_SESSION_STATUSES = ["due", "completed", "cancelled_safety"] as const;
export type PlannedSessionStatus = (typeof PLANNED_SESSION_STATUSES)[number];
