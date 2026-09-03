/**
 * Statistiques (§33 « Cette semaine »/« Progression », §70) — Sprint 9.
 * Fonctions pures uniquement : aucune décision clinique n'est prise ici,
 * seulement des calculs arithmétiques sur des données déjà enregistrées
 * (§57, §59 — ne jamais inventer une donnée médicale, y compris un taux
 * d'adhésion sans fréquence cible réellement validée).
 */

/** Bornes de la semaine ISO (lundi 00:00:00 -> dimanche 23:59:59.999)
 * contenant `reference`. Le paramètre est explicite (pas de `new Date()`
 * interne) pour rester testable de façon déterministe. */
export function getWeekBounds(reference: Date): { weekStart: Date; weekEnd: Date } {
  const day = reference.getDay(); // 0 = dimanche .. 6 = samedi
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const weekStart = new Date(reference);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() + diffToMonday);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
}

/** Durée d'une séance en minutes entières, ou `null` si la séance n'est pas
 * clôturée (§28, §69) — jamais une durée estimée ou inventée. */
export function sessionDurationMinutes(startedAt: string, completedAt: string | null | undefined): number | null {
  if (!completedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.round((end - start) / 60000);
}

/**
 * Taux d'adhésion = séances réalisées cette semaine / fréquence cible
 * hebdomadaire, plafonné à 100. Retourne `null` (jamais 0, jamais une
 * estimation) quand aucune fréquence cible n'est disponible — c'est-à-dire
 * tant qu'aucun programme validé médicalement (`programs.frequency_per_week`)
 * n'est attribué à l'utilisateur (§29, §30, §57, §59). Documenté au
 * Sprint 8 (docs/DECISIONS.md) : ne jamais inventer cette formule sans
 * dénominateur réel.
 */
export function computeAdherencePercent(
  sessionsCompletedThisWeek: number,
  targetFrequencyPerWeek: number | null | undefined
): number | null {
  if (!targetFrequencyPerWeek || targetFrequencyPerWeek <= 0) return null;
  const percent = (sessionsCompletedThisWeek / targetFrequencyPerWeek) * 100;
  return Math.round(Math.min(100, Math.max(0, percent)));
}

/**
 * §29, §33 — réf. B13, réponse complétée le 31/08/2026 : nouvelle formule
 * d'adhésion à 2 indicateurs, en remplacement de l'affichage patient de
 * l'ancienne formule à indicateur unique (`computeAdherencePercent`
 * ci-dessus, conservée telle quelle car elle continue d'alimenter le fait
 * `adherence_percent_semaine` des règles de progression déjà validées le
 * 31/08/2026 sur SA PROPRE définition d'origine — la faire pointer vers
 * cette nouvelle formule sans nouvelle confirmation explicite changerait
 * silencieusement un comportement clinique déjà validé, voir
 * docs/DECISIONS.md).
 *
 * - `sessionsCompletionPercent` : séances « complètes » (`completion_level
 *   = 'complete'`, réf. B13, `computeSessionCompletionLevel`) réalisées
 *   cette semaine / fréquence cible hebdomadaire. `null` sans fréquence
 *   cible (même garde-fou que `computeAdherencePercent`).
 * - `doseCompletionPercent` : exercices prescrits effectivement cochés
 *   comme faits cette semaine / exercices prescrits cette semaine (toutes
 *   séances confondues). `null` si aucun exercice n'a été prescrit cette
 *   semaine (jamais un pourcentage inventé sans dénominateur réel).
 */
export function computeAdherenceIndicators(input: {
  completeSessionsThisWeek: number;
  targetFrequencyPerWeek: number | null | undefined;
  completedExercisesThisWeek: number;
  prescribedExercisesThisWeek: number;
}): { sessionsCompletionPercent: number | null; doseCompletionPercent: number | null } {
  const { completeSessionsThisWeek, targetFrequencyPerWeek, completedExercisesThisWeek, prescribedExercisesThisWeek } =
    input;

  const sessionsCompletionPercent = computeAdherencePercent(completeSessionsThisWeek, targetFrequencyPerWeek);

  const doseCompletionPercent =
    prescribedExercisesThisWeek > 0
      ? Math.round(Math.min(100, Math.max(0, (completedExercisesThisWeek / prescribedExercisesThisWeek) * 100)))
      : null;

  return { sessionsCompletionPercent, doseCompletionPercent };
}

/**
 * §64 (Sprint 13) : agrège les taux d'adhésion individuels (déjà calculés
 * par `computeAdherencePercent`, un par utilisateur) en une statistique
 * globale pour le tableau de bord administrateur. Les utilisateurs sans
 * fréquence cible (valeur `null`) sont exclus du calcul plutôt que comptés
 * comme 0 — inclure un `null` comme un échec fausserait la moyenne avec une
 * donnée qui n'existe simplement pas encore (même principe que
 * `computeAdherencePercent` lui-même : jamais inventer un dénominateur).
 */
export function computeGlobalAdherenceStats(
  perUserAdherencePercents: Array<number | null>
): { averagePercent: number | null; usersWithData: number } {
  const withData = perUserAdherencePercents.filter((value): value is number => value !== null);
  if (withData.length === 0) return { averagePercent: null, usersWithData: 0 };
  const average = withData.reduce((sum, value) => sum + value, 0) / withData.length;
  return { averagePercent: Math.round(average), usersWithData: withData.length };
}
