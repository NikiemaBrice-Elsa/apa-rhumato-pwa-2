import { describe, expect, it } from "vitest";
import {
  PROFILE_LEVELS,
  PROFILE_LEVEL_LABELS_FR,
  PROFILE_LEVEL_GUIDANCE,
  PROGRESSION_WINDOW_WEEKS,
  classifyInitialProfileLevel,
  nextProfileLevel,
} from "../programs";
import type { SafetyStatus } from "../screening";

describe("PROFILE_LEVELS (§30, §58)", () => {
  it("couvre les trois niveaux repris de l'exemple du cahier des charges", () => {
    expect(PROFILE_LEVELS).toEqual(["debutant", "intermediaire", "avance"]);
  });

  it("chaque niveau a un libellé FR", () => {
    for (const level of PROFILE_LEVELS) {
      expect(PROFILE_LEVEL_LABELS_FR[level]).toBeTruthy();
    }
  });
});

/**
 * Sprint 18 (31/08/2026) — `nextProfileLevel`, utilisée par
 * `POST /api/programs/progress` (réponse Q4 : la bascule de niveau reste
 * une action volontaire du patient, jamais automatique).
 */
describe("nextProfileLevel", () => {
  it("débutant -> intermédiaire", () => {
    expect(nextProfileLevel("debutant")).toBe("intermediaire");
  });

  it("intermédiaire -> avancé", () => {
    expect(nextProfileLevel("intermediaire")).toBe("avance");
  });

  it("avancé -> null (déjà au niveau le plus avancé, rien à proposer)", () => {
    expect(nextProfileLevel("avance")).toBeNull();
  });
});

/**
 * §58 — classification du niveau initial, réponses de Dr Nikiema du
 * 23/08/2026 (QUESTIONS_ALLOW_PROGRAM_20260823.docx, Questions 1 et 2).
 */
describe("classifyInitialProfileLevel (§58, réponses du 23/08/2026)", () => {
  it("dépistage vert : niveau d'activité 1 ou 2 -> débutant", () => {
    expect(classifyInitialProfileLevel(1, "vert")).toBe("debutant");
    expect(classifyInitialProfileLevel(2, "vert")).toBe("debutant");
  });

  it("dépistage vert : niveau d'activité 3 -> intermédiaire", () => {
    expect(classifyInitialProfileLevel(3, "vert")).toBe("intermediaire");
  });

  it("dépistage vert : niveau d'activité 4 ou 5 -> avancé", () => {
    expect(classifyInitialProfileLevel(4, "vert")).toBe("avance");
    expect(classifyInitialProfileLevel(5, "vert")).toBe("avance");
  });

  it("dépistage vert mais niveau d'activité absent ou hors échelle -> null (jamais deviné)", () => {
    expect(classifyInitialProfileLevel(null, "vert")).toBeNull();
    expect(classifyInitialProfileLevel(undefined, "vert")).toBeNull();
    expect(classifyInitialProfileLevel(0, "vert")).toBeNull();
    expect(classifyInitialProfileLevel(6, "vert")).toBeNull();
    expect(classifyInitialProfileLevel(2.5, "vert")).toBeNull();
  });

  it("dépistage orange : toujours débutant, quel que soit le niveau d'activité déclaré", () => {
    expect(classifyInitialProfileLevel(1, "orange")).toBe("debutant");
    expect(classifyInitialProfileLevel(3, "orange")).toBe("debutant");
    expect(classifyInitialProfileLevel(5, "orange")).toBe("debutant");
    expect(classifyInitialProfileLevel(null, "orange")).toBe("debutant");
  });

  it("dépistage rouge : jamais de niveau (aucune attribution automatique)", () => {
    expect(classifyInitialProfileLevel(5, "rouge")).toBeNull();
    expect(classifyInitialProfileLevel(null, "rouge")).toBeNull();
  });

  it("dépistage pending_validation : jamais de niveau (aucune attribution automatique)", () => {
    expect(classifyInitialProfileLevel(5, "pending_validation")).toBeNull();
  });

  it.each<SafetyStatus>(["vert", "orange", "rouge", "pending_validation"])(
    "%s : ne retourne jamais autre chose qu'un ProfileLevel valide ou null",
    (status) => {
      const result = classifyInitialProfileLevel(3, status);
      expect(result === null || PROFILE_LEVELS.includes(result)).toBe(true);
    }
  );
});

/**
 * §29, §58 — document « système de progression » (21/09/2026, section A) :
 * cadre indicatif fréquence/durée par niveau, repris littéralement.
 */
describe("PROFILE_LEVEL_GUIDANCE (document « système de progression », 21/09/2026)", () => {
  it("reprend les bornes exactes données par Dr Nikiema pour chaque niveau", () => {
    expect(PROFILE_LEVEL_GUIDANCE.debutant).toEqual({
      sessionsPerWeekMin: 2,
      sessionsPerWeekMax: 3,
      sessionDurationMinutesMin: 20,
      sessionDurationMinutesMax: 30,
    });
    expect(PROFILE_LEVEL_GUIDANCE.intermediaire).toEqual({
      sessionsPerWeekMin: 3,
      sessionsPerWeekMax: 4,
      sessionDurationMinutesMin: 30,
      sessionDurationMinutesMax: 45,
    });
    expect(PROFILE_LEVEL_GUIDANCE.avance).toEqual({
      sessionsPerWeekMin: 4,
      sessionsPerWeekMax: 5,
      sessionDurationMinutesMin: 45,
      sessionDurationMinutesMax: 60,
    });
  });

  it("couvre les trois niveaux, aucun de plus", () => {
    expect(Object.keys(PROFILE_LEVEL_GUIDANCE).sort()).toEqual([...PROFILE_LEVELS].sort());
  });
});

/**
 * §29, §58, §70 — fenêtres d'observation pour le passage de niveau (document
 * « système de progression », 21/09/2026, section B).
 */
describe("PROGRESSION_WINDOW_WEEKS (document « système de progression », 21/09/2026)", () => {
  it("4 semaines pour débutant -> intermédiaire", () => {
    expect(PROGRESSION_WINDOW_WEEKS.debutant).toBe(4);
  });

  it("6 semaines pour intermédiaire -> supérieur", () => {
    expect(PROGRESSION_WINDOW_WEEKS.intermediaire).toBe(6);
  });

  it("aucune fenêtre pour avancé (pas de niveau supérieur, jamais une fenêtre inventée)", () => {
    expect(PROGRESSION_WINDOW_WEEKS.avance).toBeUndefined();
  });
});
