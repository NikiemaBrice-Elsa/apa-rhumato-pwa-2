import { describe, expect, it } from "vitest";
import { pathologiesWithExercises, categoriesForPathology } from "../exercises";

/**
 * Sprint 28 (20/09/2026) — nouvel affichage de la bibliothèque d'exercices
 * (pathologie → types recommandés → exercices → détail), voir le
 * commentaire de tête de ces deux fonctions dans exercises.ts.
 */
describe("pathologiesWithExercises", () => {
  it("retourne une liste vide si aucun exercice n'a de pathologie", () => {
    expect(pathologiesWithExercises([])).toEqual([]);
    expect(pathologiesWithExercises([{ pathologies: [] }])).toEqual([]);
  });

  it("ne retourne que les pathologies réellement couvertes par au moins un exercice", () => {
    const exercises = [
      { pathologies: ["ARTHROSE_GENOU" as const] },
      { pathologies: ["LOMBALGIE_COMMUNE" as const, "OSTEOPOROSE" as const] },
    ];
    expect(pathologiesWithExercises(exercises)).toEqual(["LOMBALGIE_COMMUNE", "ARTHROSE_GENOU", "OSTEOPOROSE"]);
  });

  it("respecte toujours l'ordre de référence PATHOLOGY_CODES, pas l'ordre d'apparition", () => {
    const exercises = [{ pathologies: ["OSTEOPOROSE" as const, "LOMBALGIE_COMMUNE" as const] }];
    expect(pathologiesWithExercises(exercises)).toEqual(["LOMBALGIE_COMMUNE", "OSTEOPOROSE"]);
  });

  it("ne duplique pas une pathologie couverte par plusieurs exercices", () => {
    const exercises = [{ pathologies: ["ARTHROSE_GENOU" as const] }, { pathologies: ["ARTHROSE_GENOU" as const] }];
    expect(pathologiesWithExercises(exercises)).toEqual(["ARTHROSE_GENOU"]);
  });
});

describe("categoriesForPathology", () => {
  it("ne retourne que les types d'exercice présents pour la pathologie demandée", () => {
    const exercises = [
      { pathologies: ["ARTHROSE_GENOU" as const], category: "renforcement" as const },
      { pathologies: ["ARTHROSE_GENOU" as const], category: "mobilite" as const },
      { pathologies: ["LOMBALGIE_COMMUNE" as const], category: "aerobique" as const },
    ];
    expect(categoriesForPathology(exercises, "ARTHROSE_GENOU")).toEqual(["renforcement", "mobilite"]);
    expect(categoriesForPathology(exercises, "LOMBALGIE_COMMUNE")).toEqual(["aerobique"]);
    expect(categoriesForPathology(exercises, "OSTEOPOROSE")).toEqual([]);
  });

  it("un exercice couvrant plusieurs pathologies apparaît sous chacune d'elles", () => {
    const exercises = [{ pathologies: ["ARTHROSE_GENOU" as const, "ARTHROSE_HANCHE" as const], category: "equilibre" as const }];
    expect(categoriesForPathology(exercises, "ARTHROSE_GENOU")).toEqual(["equilibre"]);
    expect(categoriesForPathology(exercises, "ARTHROSE_HANCHE")).toEqual(["equilibre"]);
  });
});
