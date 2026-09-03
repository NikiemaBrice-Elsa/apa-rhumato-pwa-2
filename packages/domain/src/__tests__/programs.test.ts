import { describe, expect, it } from "vitest";
import { PROFILE_LEVELS, PROFILE_LEVEL_LABELS_FR, classifyInitialProfileLevel, nextProfileLevel } from "../programs";
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
