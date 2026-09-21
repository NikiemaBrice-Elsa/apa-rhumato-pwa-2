import { describe, expect, it } from "vitest";
import {
  DIFFICULTY_LEVELS,
  DIFFICULTY_LABELS_FR,
  SESSION_STATUSES,
  computeProgressionFacts,
  PROGRESSION_SIGNALS,
  PROGRESSION_FATIGUE_VIGILANCE_THRESHOLD,
  PROGRESSION_PAIN_CRITICAL_THRESHOLD,
  computeSessionCompletionLevel,
  SESSION_COMPLETION_CONTENT_THRESHOLD,
  type Session,
} from "../sessions";

describe("DIFFICULTY_LEVELS (§69 — feedback après séance)", () => {
  it("couvre les quatre niveaux repris du cahier des charges", () => {
    expect(DIFFICULTY_LEVELS).toEqual(["facile", "adaptee", "difficile", "tres_difficile"]);
  });

  it("chaque niveau a un libellé FR", () => {
    for (const level of DIFFICULTY_LEVELS) {
      expect(DIFFICULTY_LABELS_FR[level]).toBeTruthy();
    }
  });
});

describe("SESSION_STATUSES", () => {
  it("couvre le cycle de vie in_progress -> completed | abandoned", () => {
    expect(SESSION_STATUSES).toEqual(["in_progress", "completed", "abandoned"]);
  });
});

function makeSession(overrides: Partial<Session> & { startedAt: string }): Session {
  return {
    id: "session-fixture",
    userId: "user-fixture",
    pathology: "LOMBALGIE_COMMUNE",
    status: "completed",
    createdAt: overrides.startedAt,
    ...overrides,
  };
}

/**
 * §29, §58, §70 ; Sprint 17 (suite 4, 23/08/2026). `computeProgressionFacts`
 * ne doit dériver QUE ce que Dr Nikiema a explicitement chiffré (B2, B9) —
 * jamais une clé pour ce qui reste non chiffré (fatigue excessive, signal
 * isolé/répété, gonflement/raideur, baisse fonctionnelle).
 */
describe("computeProgressionFacts (§29, §58, §70, réponses B2/B9 du 20/08/2026)", () => {
  it("aucune séance, pas d'adhésion connue -> aucun fait", () => {
    expect(computeProgressionFacts([], null)).toEqual({});
  });

  it("transmet le taux d'adhésion de la semaine si fourni", () => {
    expect(computeProgressionFacts([], 85)).toEqual({ adherence_percent_semaine: 85 });
  });

  it("reprend fidèlement les champs de la dernière séance quand ils sont renseignés", () => {
    const last = makeSession({ startedAt: "2026-08-23T08:00:00Z", realisee: true, douleurApres: 2, fatigueApres: 4, difficulte: "adaptee" });
    const facts = computeProgressionFacts([last], null);
    expect(facts).toEqual({
      derniere_seance_realisee: true,
      douleur_apres_derniere_seance: 2,
      fatigue_apres_derniere_seance: 4,
      difficulte_derniere_seance: "adaptee",
      progression_signal: "aucun",
    });
  });

  it("n'invente aucune clé pour un champ de la dernière séance non renseigné", () => {
    const last = makeSession({ startedAt: "2026-08-23T08:00:00Z" });
    const facts = computeProgressionFacts([last], null);
    expect(facts).toEqual({});
  });

  it("détecte une aggravation persistante au-delà de 24h (douleur > 3/10 aux deux bouts, ≥ 24h d'écart)", () => {
    const previous = makeSession({ startedAt: "2026-08-20T08:00:00Z", douleurApres: 5 });
    const last = makeSession({ startedAt: "2026-08-21T09:00:00Z", douleurAvant: 4 }); // 25h plus tard
    const facts = computeProgressionFacts([last, previous], null);
    expect(facts.douleur_aggravation_persistante_24h).toBe(true);
  });

  it("pas d'aggravation persistante si la douleur est revenue à 3/10 ou moins (seuil B2)", () => {
    const previous = makeSession({ startedAt: "2026-08-20T08:00:00Z", douleurApres: 5 });
    const last = makeSession({ startedAt: "2026-08-21T09:00:00Z", douleurAvant: 3 }); // retour au seuil tolérable
    const facts = computeProgressionFacts([last, previous], null);
    expect(facts.douleur_aggravation_persistante_24h).toBe(false);
  });

  it("ne calcule pas l'aggravation persistante si les deux séances sont espacées de moins de 24h", () => {
    const previous = makeSession({ startedAt: "2026-08-20T08:00:00Z", douleurApres: 6 });
    const last = makeSession({ startedAt: "2026-08-20T20:00:00Z", douleurAvant: 6 }); // 12h plus tard seulement
    const facts = computeProgressionFacts([last, previous], null);
    expect(facts.douleur_aggravation_persistante_24h).toBeUndefined();
  });

  it("ne calcule pas l'aggravation persistante si une seule séance est disponible", () => {
    const last = makeSession({ startedAt: "2026-08-23T08:00:00Z", douleurAvant: 6 });
    const facts = computeProgressionFacts([last], null);
    expect(facts.douleur_aggravation_persistante_24h).toBeUndefined();
  });

  it("n'introduit jamais de clé pour ce que les réponses B2/B9 ne chiffrent pas (fatigue excessive, répétition, gonflement, fonctionnel)", () => {
    const last = makeSession({ startedAt: "2026-08-23T08:00:00Z", realisee: true, douleurApres: 1, fatigueApres: 9, difficulte: "tres_difficile" });
    const facts = computeProgressionFacts([last], 90);
    const keys = Object.keys(facts);
    expect(keys).not.toContain("fatigue_excessive");
    expect(keys).not.toContain("symptomes_repetes");
    expect(keys).not.toContain("gonflement");
    expect(keys).not.toContain("raideur");
    expect(keys).not.toContain("baisse_fonctionnelle");
  });
});

/**
 * §29, §58, §70 ; Sprint 18 (30/08/2026, réponses Q1/Q2 de
 * `QUESTIONS_PROGRESSION_REGRESSION_20260823.docx`). `progression_signal`
 * est le SEUL fait de classification consommé par les 24 règles
 * `adjust_progression` (infra/db/seed/0014_...sql) — priorité
 * critique > repete > isole > aucun.
 */
describe("computeProgressionFacts — progression_signal (Q1/Q2 du 30/08/2026)", () => {
  it("couvre exactement les 4 valeurs attendues", () => {
    expect(PROGRESSION_SIGNALS).toEqual(["aucun", "isole", "repete", "critique"]);
  });

  it("aucune donnée exploitable sur la dernière séance -> pas de clé progression_signal (jamais deviné)", () => {
    const last = makeSession({ startedAt: "2026-08-23T08:00:00Z" });
    const facts = computeProgressionFacts([last], null);
    expect(facts.progression_signal).toBeUndefined();
  });

  it("douleur après séance >= seuil rouge transversal -> critique, prime sur tout le reste", () => {
    const previous = makeSession({ startedAt: "2026-08-20T08:00:00Z", douleurApres: 5 });
    const last = makeSession({
      startedAt: "2026-08-21T09:00:00Z",
      douleurAvant: 8,
      douleurApres: PROGRESSION_PAIN_CRITICAL_THRESHOLD,
      fatigueApres: 2,
      difficulte: "facile",
    });
    const facts = computeProgressionFacts([last, previous], null);
    expect(facts.progression_signal).toBe("critique");
  });

  it("douleur tolérable et sans autre signal -> aucun", () => {
    const last = makeSession({ startedAt: "2026-08-23T08:00:00Z", douleurApres: 2 });
    const facts = computeProgressionFacts([last], null);
    expect(facts.progression_signal).toBe("aucun");
  });

  it("un seul signal négatif isolé sur la dernière séance (douleur > seuil tolérable) -> isole", () => {
    const last = makeSession({ startedAt: "2026-08-23T08:00:00Z", douleurApres: 5 });
    const facts = computeProgressionFacts([last], null);
    expect(facts.progression_signal).toBe("isole");
  });

  it("fatigue >= seuil de vigilance sur la seule dernière séance -> isole", () => {
    const last = makeSession({ startedAt: "2026-08-23T08:00:00Z", fatigueApres: PROGRESSION_FATIGUE_VIGILANCE_THRESHOLD });
    const facts = computeProgressionFacts([last], null);
    expect(facts.progression_signal).toBe("isole");
  });

  it("difficulté très difficile sur la seule dernière séance -> isole", () => {
    const last = makeSession({ startedAt: "2026-08-23T08:00:00Z", difficulte: "tres_difficile" });
    const facts = computeProgressionFacts([last], null);
    expect(facts.progression_signal).toBe("isole");
  });

  it("fatigue élevée répétée sur 2 séances consécutives -> repete", () => {
    const previous = makeSession({ startedAt: "2026-08-20T08:00:00Z", fatigueApres: PROGRESSION_FATIGUE_VIGILANCE_THRESHOLD });
    const last = makeSession({ startedAt: "2026-08-22T08:00:00Z", fatigueApres: PROGRESSION_FATIGUE_VIGILANCE_THRESHOLD });
    const facts = computeProgressionFacts([last, previous], null);
    expect(facts.progression_signal).toBe("repete");
  });

  it("difficulté très difficile répétée sur 2 séances consécutives -> repete", () => {
    const previous = makeSession({ startedAt: "2026-08-20T08:00:00Z", difficulte: "tres_difficile" });
    const last = makeSession({ startedAt: "2026-08-22T08:00:00Z", difficulte: "tres_difficile" });
    const facts = computeProgressionFacts([last, previous], null);
    expect(facts.progression_signal).toBe("repete");
  });

  it("aggravation de la douleur persistante au-delà de 24h -> repete", () => {
    const previous = makeSession({ startedAt: "2026-08-20T08:00:00Z", douleurApres: 5 });
    const last = makeSession({ startedAt: "2026-08-21T09:00:00Z", douleurAvant: 4, douleurApres: 1 }); // 25h plus tard
    const facts = computeProgressionFacts([last, previous], null);
    expect(facts.progression_signal).toBe("repete");
  });

  it("un seul signal négatif isolé (pas de répétition sur la séance précédente) -> isole, pas repete", () => {
    const previous = makeSession({ startedAt: "2026-08-20T08:00:00Z", fatigueApres: 2 });
    const last = makeSession({ startedAt: "2026-08-22T08:00:00Z", fatigueApres: PROGRESSION_FATIGUE_VIGILANCE_THRESHOLD });
    const facts = computeProgressionFacts([last, previous], null);
    expect(facts.progression_signal).toBe("isole");
  });
});

/**
 * §29, §58, §70 — document « système de progression » (21/09/2026).
 * `extra` ajoute deux faits optionnels au passage de niveau, sans jamais
 * modifier les faits calculés jusqu'ici (rétrocompatible avec tous les tests
 * ci-dessus, appelés sans 3e argument).
 */
describe("computeProgressionFacts — extra (document « système de progression », 21/09/2026)", () => {
  it("sans extra, ne change rien au comportement historique", () => {
    const last = makeSession({ startedAt: "2026-08-23T08:00:00Z", douleurApres: 2 });
    expect(computeProgressionFacts([last], 85)).toEqual({
      adherence_percent_semaine: 85,
      douleur_apres_derniere_seance: 2,
      progression_signal: "aucun",
    });
  });

  it("ajoute adherence_percent_fenetre_progression quand fourni", () => {
    const last = makeSession({ startedAt: "2026-08-23T08:00:00Z", douleurApres: 2 });
    const facts = computeProgressionFacts([last], 85, { adherencePercentWindow: 92 });
    expect(facts.adherence_percent_fenetre_progression).toBe(92);
  });

  it("n'ajoute pas adherence_percent_fenetre_progression si null (jamais deviné)", () => {
    const last = makeSession({ startedAt: "2026-08-23T08:00:00Z", douleurApres: 2 });
    const facts = computeProgressionFacts([last], 85, { adherencePercentWindow: null });
    expect(facts.adherence_percent_fenetre_progression).toBeUndefined();
  });

  it("ajoute capacite_fonctionnelle_tendance quand fournie", () => {
    const last = makeSession({ startedAt: "2026-08-23T08:00:00Z", douleurApres: 2 });
    const facts = computeProgressionFacts([last], 85, { functionalCapacityTrend: "amelioree" });
    expect(facts.capacite_fonctionnelle_tendance).toBe("amelioree");
  });

  it("n'ajoute pas capacite_fonctionnelle_tendance si null (jamais devinée)", () => {
    const last = makeSession({ startedAt: "2026-08-23T08:00:00Z", douleurApres: 2 });
    const facts = computeProgressionFacts([last], 85, { functionalCapacityTrend: null });
    expect(facts.capacite_fonctionnelle_tendance).toBeUndefined();
  });
});

/**
 * §29, §33 ; réf. B13 (31/08/2026) — niveau de complétude d'une séance à
 * partir de la fraction d'exercices prescrits cochés comme faits.
 */
describe("computeSessionCompletionLevel (réf. B13, 31/08/2026)", () => {
  it("seuil retenu : 80% (un des deux critères explicitement proposés par Dr Nikiema)", () => {
    expect(SESSION_COMPLETION_CONTENT_THRESHOLD).toBe(0.8);
  });

  it("null sans exercice prescrit (rien à évaluer, jamais un niveau deviné)", () => {
    expect(computeSessionCompletionLevel(0, 0)).toBeNull();
  });

  it("complete à exactement 80%", () => {
    expect(computeSessionCompletionLevel(4, 5)).toBe("complete");
  });

  it("partial en dessous de 80%", () => {
    expect(computeSessionCompletionLevel(3, 5)).toBe("partial");
  });

  it("complete à 100%", () => {
    expect(computeSessionCompletionLevel(5, 5)).toBe("complete");
  });

  it("partial si aucun exercice coché", () => {
    expect(computeSessionCompletionLevel(0, 5)).toBe("partial");
  });
});
