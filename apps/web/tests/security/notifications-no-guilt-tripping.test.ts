import { describe, expect, it } from "vitest";
import {
  computeDueNotifications,
  containsGuiltTrippingLanguage,
  type NotificationFacts,
} from "@apa/domain";

/**
 * Test sécurité (§55), Sprint 11. Garde-fou : « Ne jamais utiliser un ton
 * culpabilisant » (§39) est une contrainte absolue du cahier des charges,
 * au même titre que les autres règles de sécurité de ce projet. Ce test
 * fait tourner `computeDueNotifications` sur un large échantillon de
 * situations (y compris les pires cas : aucune séance depuis longtemps,
 * aucune évaluation, aucune mesure) et vérifie qu'aucun message produit ne
 * déclenche le garde-fou de ton.
 */
describe("Garde-fou : aucune notification générée n'est culpabilisante", () => {
  const now = new Date(2026, 7, 19);

  const scenarios: NotificationFacts[] = [
    {
      lastCompletedSessionAt: null,
      hasCompletedSessionToday: false,
      consecutiveCompletedSessions: 0,
      lastAssessmentAt: null,
      lastMeasurementAt: null,
    },
    {
      lastCompletedSessionAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      hasCompletedSessionToday: false,
      consecutiveCompletedSessions: 0,
      lastAssessmentAt: new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000).toISOString(),
      lastMeasurementAt: new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      lastCompletedSessionAt: now.toISOString(),
      hasCompletedSessionToday: true,
      consecutiveCompletedSessions: 12,
      lastAssessmentAt: now.toISOString(),
      lastMeasurementAt: now.toISOString(),
    },
  ];

  it.each(scenarios.map((s, i) => [i, s] as const))("scénario %i : aucun message culpabilisant", (_i, facts) => {
    const due = computeDueNotifications(facts, now);
    for (const notification of due) {
      expect(containsGuiltTrippingLanguage(notification.title)).toBe(false);
      expect(containsGuiltTrippingLanguage(notification.body)).toBe(false);
    }
  });
});
