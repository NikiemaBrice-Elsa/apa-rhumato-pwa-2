/**
 * Notifications (§39) — Sprint 11.
 *
 * §39 impose six types de notification et une contrainte de ton absolue :
 * « Ne jamais utiliser un ton culpabilisant. » L'exemple donné est repris
 * VERBATIM ci-dessous pour `missed_sessions_reminder`. Ce module ne contient
 * aucun contenu médical (§57, §59 ne s'appliquent pas ici au sens strict :
 * ce sont des messages d'engagement, pas des recommandations cliniques),
 * mais applique la même discipline de rigueur : chaque message est une
 * fonction pure et testée, et un garde-fou (`containsGuiltTrippingLanguage`)
 * vérifie automatiquement qu'aucun message généré ne culpabilise l'utilisateur.
 */

export const NOTIFICATION_TYPES = [
  "session_reminder",
  "assessment_reminder",
  "measurement_reminder",
  "encouragement",
  "missed_sessions_reminder",
  "streak_congratulations",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_TYPE_LABELS_FR: Record<NotificationType, string> = {
  session_reminder: "Rappel de séance",
  assessment_reminder: "Rappel d'évaluation",
  measurement_reminder: "Rappel de mesure",
  encouragement: "Encouragement",
  missed_sessions_reminder: "Reprise après séances manquées",
  streak_congratulations: "Félicitations",
};

export interface Notification {
  id: string;
  userId: string;
  notificationType: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationContent {
  type: NotificationType;
  title: string;
  body: string;
}

/**
 * Cadences par défaut — des choix d'engagement/produit, PAS des seuils
 * cliniques (aucun rapport avec la sécurité du patient) : documentées dans
 * docs/MEDICAL_VALIDATION_NEEDED.md par transparence (§79) mais pas
 * soumises au mécanisme `active=false` des `clinical_rules`.
 *
 * Mise à jour du 20/08/2026 (réf. B14 du questionnaire de validation
 * médicale, Dr Nikiema) : `MISSED_SESSION_GAP_DAYS` est ajusté de 7 à 4
 * jours (milieu de la fourchette « 3-5 jours » qu'il recommande pour un
 * rappel doux en l'absence de toute séance réalisée). Les autres valeurs
 * restent inchangées (`MEASUREMENT_REMINDER_GAP_DAYS` et
 * `STREAK_CONGRATULATIONS_THRESHOLD` correspondent déjà à ses
 * recommandations ; `ASSESSMENT_REMINDER_GAP_DAYS` à 90 jours est proche
 * de sa recommandation « ~12 semaines »). Sa proposition la plus riche —
 * un rappel de séance à 24-48h calé sur une séance PLANIFIÉE manquée,
 * distincte de ce rappel d'absence d'activité générale — nécessite la
 * fonctionnalité « séance du jour » (réf. B11), non encore implémentée ;
 * voir docs/MEDICAL_VALIDATION_NEEDED.md.
 */
export const MISSED_SESSION_GAP_DAYS = 4;
export const ASSESSMENT_REMINDER_GAP_DAYS = 90;
export const MEASUREMENT_REMINDER_GAP_DAYS = 14;
export const STREAK_CONGRATULATIONS_THRESHOLD = 3;

function daysSince(dateIso: string, now: Date): number {
  return (now.getTime() - new Date(dateIso).getTime()) / (24 * 60 * 60 * 1000);
}

export function buildSessionReminderMessage(): NotificationContent {
  return {
    type: "session_reminder",
    title: "Rappel de séance",
    body: "Pensez à votre séance du jour si vous ne l'avez pas encore faite.",
  };
}

export function buildAssessmentReminderMessage(): NotificationContent {
  return {
    type: "assessment_reminder",
    title: "Rappel d'évaluation",
    body: "Cela fait un moment : une nouvelle évaluation permettrait de faire le point avec vous.",
  };
}

export function buildMeasurementReminderMessage(): NotificationContent {
  return {
    type: "measurement_reminder",
    title: "Rappel de mesure",
    body: "Pensez à enregistrer une nouvelle mesure pour continuer à suivre votre évolution.",
  };
}

export function buildEncouragementMessage(): NotificationContent {
  return {
    type: "encouragement",
    title: "Encouragement",
    body: "Chaque séance compte, quel que soit son format aujourd'hui.",
  };
}

/** §39 : exemple donné verbatim par le cahier des charges — ne jamais reformuler. */
export function buildMissedSessionsReminderMessage(): NotificationContent {
  return {
    type: "missed_sessions_reminder",
    title: "Reprise en douceur",
    body: "Vous avez manqué votre séance prévue. Ce n'est pas grave. Vous pouvez reprendre aujourd'hui avec une séance adaptée.",
  };
}

export function buildStreakCongratulationsMessage(consecutiveCompletedSessions: number): NotificationContent {
  return {
    type: "streak_congratulations",
    title: "Félicitations",
    body: `Bravo, ${consecutiveCompletedSessions} séances réalisées d'affilée !`,
  };
}

/**
 * Garde-fou direct pour « Ne jamais utiliser un ton culpabilisant » (§39).
 * Liste non exhaustive mais couvre les tournures les plus évidentes
 * (reproche, obligation, échec). Testé sur TOUS les messages générés par ce
 * module (packages/domain/src/__tests__/notifications.test.ts).
 */
const GUILT_TRIPPING_PATTERNS: RegExp[] = [
  /vous auriez d[ûu]/i,
  /vous devez/i,
  /vous n['’]avez pas réussi/i,
  /ce n['’]est pas normal/i,
  /encore (raté|échoué)/i,
  /faute/i,
  /négligé/i,
  /abandonné(e)?\b/i,
  /décevant/i,
  /honte/i,
];

export function containsGuiltTrippingLanguage(text: string): boolean {
  return GUILT_TRIPPING_PATTERNS.some((pattern) => pattern.test(text));
}

export interface NotificationFacts {
  lastCompletedSessionAt: string | null;
  hasCompletedSessionToday: boolean;
  consecutiveCompletedSessions: number;
  lastAssessmentAt: string | null;
  lastMeasurementAt: string | null;
  /**
   * Heure de rappel quotidien du patient (`patient_profiles.reminder_time`,
   * Sprint 23 — 13/09/2026, décision Q5 de Dr Nikiema : « rappel quotidien, à
   * une heure choisie par le patient lui-même ») déjà atteinte ou dépassée,
   * dans le fuseau horaire LOCAL du patient. Calculée côté route
   * (`isReminderTimeReached`) à partir de l'heure locale transmise par le
   * client — le serveur ne connaît pas le fuseau horaire du patient et ne
   * doit jamais deviner son heure locale à partir de l'heure serveur (UTC).
   * Ne gate QUE `session_reminder` (le rappel quotidien "routine") : les
   * autres types de rappel ne sont pas liés à un moment précis de la
   * journée, et `missed_sessions_reminder` (plusieurs jours sans séance)
   * reste volontairement affiché dès que dû, sans attendre cette heure.
   */
  reminderTimeReached: boolean;
}

/**
 * Compare l'heure locale du patient à son heure de rappel préférée — deux
 * chaînes `HH:MM` (24h, zéro-paddées), comparables lexicographiquement sans
 * conversion en `Date` (évite tout piège de fuseau horaire : on compare deux
 * heures "murales", jamais deux instants). Pure et testée isolément.
 */
export function isReminderTimeReached(reminderTime: string, localTimeHHMM: string): boolean {
  return localTimeHHMM >= reminderTime;
}

/**
 * Calcule les notifications dues à l'instant `now`, à partir de faits déjà
 * observés (aucune requête, aucun effet de bord — testable de façon
 * déterministe). La route API (Sprint 11) se contente de rassembler ces
 * faits depuis Supabase puis d'appeler cette fonction.
 */
export function computeDueNotifications(facts: NotificationFacts, now: Date): NotificationContent[] {
  const due: NotificationContent[] = [];

  if (
    facts.lastCompletedSessionAt &&
    daysSince(facts.lastCompletedSessionAt, now) >= MISSED_SESSION_GAP_DAYS
  ) {
    due.push(buildMissedSessionsReminderMessage());
  } else if (!facts.hasCompletedSessionToday && facts.reminderTimeReached) {
    due.push(buildSessionReminderMessage());
  }

  if (facts.consecutiveCompletedSessions >= STREAK_CONGRATULATIONS_THRESHOLD) {
    due.push(buildStreakCongratulationsMessage(facts.consecutiveCompletedSessions));
  }

  if (!facts.lastAssessmentAt || daysSince(facts.lastAssessmentAt, now) >= ASSESSMENT_REMINDER_GAP_DAYS) {
    due.push(buildAssessmentReminderMessage());
  }

  if (!facts.lastMeasurementAt || daysSince(facts.lastMeasurementAt, now) >= MEASUREMENT_REMINDER_GAP_DAYS) {
    due.push(buildMeasurementReminderMessage());
  }

  // Rien de particulier à signaler : un encouragement plutôt qu'un silence
  // total (§39 cite explicitement « encouragement » comme type à part entière).
  if (due.length === 0) {
    due.push(buildEncouragementMessage());
  }

  return due;
}
