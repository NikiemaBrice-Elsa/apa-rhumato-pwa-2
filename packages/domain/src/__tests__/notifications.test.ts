import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS_FR,
  buildSessionReminderMessage,
  buildAssessmentReminderMessage,
  buildMeasurementReminderMessage,
  buildEncouragementMessage,
  buildMissedSessionsReminderMessage,
  buildStreakCongratulationsMessage,
  containsGuiltTrippingLanguage,
  computeDueNotifications,
  STREAK_CONGRATULATIONS_THRESHOLD,
  MISSED_SESSION_GAP_DAYS,
  type NotificationFacts,
} from "../notifications";

describe("NOTIFICATION_TYPES (§39)", () => {
  it("couvre les six types imposés par le cahier des charges", () => {
    expect(NOTIFICATION_TYPES).toEqual([
      "session_reminder",
      "assessment_reminder",
      "measurement_reminder",
      "encouragement",
      "missed_sessions_reminder",
      "streak_congratulations",
    ]);
  });

  it("chaque type a un libellé FR", () => {
    for (const type of NOTIFICATION_TYPES) {
      expect(NOTIFICATION_TYPE_LABELS_FR[type]).toBeTruthy();
    }
  });
});

describe("buildMissedSessionsReminderMessage (§39 — exemple verbatim)", () => {
  it("reprend exactement l'exemple du cahier des charges", () => {
    expect(buildMissedSessionsReminderMessage().body).toBe(
      "Vous avez manqué votre séance prévue. Ce n'est pas grave. Vous pouvez reprendre aujourd'hui avec une séance adaptée."
    );
  });
});

describe("containsGuiltTrippingLanguage (§39 — garde-fou de ton)", () => {
  it("détecte des tournures culpabilisantes évidentes", () => {
    expect(containsGuiltTrippingLanguage("Vous auriez dû faire votre séance.")).toBe(true);
    expect(containsGuiltTrippingLanguage("Vous devez reprendre immédiatement.")).toBe(true);
    expect(containsGuiltTrippingLanguage("C'est décevant de vous voir abandonner.")).toBe(true);
  });

  it("laisse passer un message neutre ou positif", () => {
    expect(containsGuiltTrippingLanguage("Bravo, 3 séances réalisées d'affilée !")).toBe(false);
    expect(containsGuiltTrippingLanguage("Vous pouvez reprendre aujourd'hui avec une séance adaptée.")).toBe(
      false
    );
  });

  it("aucun message généré par ce module n'est culpabilisant", () => {
    const messages = [
      buildSessionReminderMessage(),
      buildAssessmentReminderMessage(),
      buildMeasurementReminderMessage(),
      buildEncouragementMessage(),
      buildMissedSessionsReminderMessage(),
      buildStreakCongratulationsMessage(5),
    ];
    for (const message of messages) {
      expect(containsGuiltTrippingLanguage(message.title)).toBe(false);
      expect(containsGuiltTrippingLanguage(message.body)).toBe(false);
    }
  });
});

describe("computeDueNotifications", () => {
  const now = new Date(2026, 7, 19);

  const baseline: NotificationFacts = {
    lastCompletedSessionAt: now.toISOString(),
    hasCompletedSessionToday: true,
    consecutiveCompletedSessions: 1,
    lastAssessmentAt: now.toISOString(),
    lastMeasurementAt: now.toISOString(),
  };

  it("ne signale rien de particulier -> encouragement", () => {
    const due = computeDueNotifications(baseline, now);
    expect(due.map((d) => d.type)).toEqual(["encouragement"]);
  });

  it("rappelle la séance du jour si aucune séance n'est faite aujourd'hui et pas d'écart long", () => {
    const facts: NotificationFacts = { ...baseline, hasCompletedSessionToday: false };
    const due = computeDueNotifications(facts, now);
    expect(due.map((d) => d.type)).toContain("session_reminder");
  });

  it(`rappelle après ${MISSED_SESSION_GAP_DAYS} jours sans séance, avec le message verbatim`, () => {
    const oldDate = new Date(now.getTime() - (MISSED_SESSION_GAP_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString();
    const facts: NotificationFacts = { ...baseline, lastCompletedSessionAt: oldDate, hasCompletedSessionToday: false };
    const due = computeDueNotifications(facts, now);
    const missed = due.find((d) => d.type === "missed_sessions_reminder");
    expect(missed).toBeDefined();
    expect(missed?.body).toContain("Ce n'est pas grave");
  });

  it(`félicite à partir de ${STREAK_CONGRATULATIONS_THRESHOLD} séances consécutives`, () => {
    const facts: NotificationFacts = { ...baseline, consecutiveCompletedSessions: STREAK_CONGRATULATIONS_THRESHOLD };
    const due = computeDueNotifications(facts, now);
    expect(due.map((d) => d.type)).toContain("streak_congratulations");
  });

  it("ne félicite pas en dessous du seuil", () => {
    const facts: NotificationFacts = { ...baseline, consecutiveCompletedSessions: STREAK_CONGRATULATIONS_THRESHOLD - 1 };
    const due = computeDueNotifications(facts, now);
    expect(due.map((d) => d.type)).not.toContain("streak_congratulations");
  });

  it("rappelle l'évaluation si aucune n'a jamais été faite", () => {
    const facts: NotificationFacts = { ...baseline, lastAssessmentAt: null };
    const due = computeDueNotifications(facts, now);
    expect(due.map((d) => d.type)).toContain("assessment_reminder");
  });

  it("rappelle la mesure si aucune n'a jamais été enregistrée", () => {
    const facts: NotificationFacts = { ...baseline, lastMeasurementAt: null };
    const due = computeDueNotifications(facts, now);
    expect(due.map((d) => d.type)).toContain("measurement_reminder");
  });

  it("peut cumuler plusieurs notifications dues simultanément", () => {
    const facts: NotificationFacts = {
      lastCompletedSessionAt: null,
      hasCompletedSessionToday: false,
      consecutiveCompletedSessions: 0,
      lastAssessmentAt: null,
      lastMeasurementAt: null,
    };
    const due = computeDueNotifications(facts, now);
    expect(due.map((d) => d.type)).toEqual(
      expect.arrayContaining(["session_reminder", "assessment_reminder", "measurement_reminder"])
    );
  });
});
