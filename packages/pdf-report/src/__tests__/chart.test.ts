import { describe, expect, it } from "vitest";
import { buildChartSegments, computeValueRange, hasAnyChartData } from "../chart";

describe("buildChartSegments (Sprint 36)", () => {
  const xFor = (i: number) => i * 10;
  const yFor = (v: number) => v * 2;

  it("retourne un tableau vide sans aucune valeur", () => {
    expect(buildChartSegments([], xFor, yFor)).toEqual([]);
  });

  it("produit un seul segment quand aucune valeur n'est nulle", () => {
    const segments = buildChartSegments([1, 2, 3], xFor, yFor);
    expect(segments).toEqual([
      [
        { x: 0, y: 2 },
        { x: 10, y: 4 },
        { x: 20, y: 6 },
      ],
    ]);
  });

  it("coupe la ligne à chaque valeur null plutôt que de l'interpoler (§57, §59)", () => {
    const segments = buildChartSegments([1, null, 3, 4, null, null, 7], xFor, yFor);
    expect(segments).toEqual([
      [{ x: 0, y: 2 }],
      [
        { x: 20, y: 6 },
        { x: 30, y: 8 },
      ],
      [{ x: 60, y: 14 }],
    ]);
  });

  it("ignore les valeurs null en tête et en fin de série", () => {
    const segments = buildChartSegments([null, 5, null], xFor, yFor);
    expect(segments).toEqual([[{ x: 10, y: 10 }]]);
  });

  it("retourne un tableau vide quand toutes les valeurs sont null", () => {
    expect(buildChartSegments([null, null], xFor, yFor)).toEqual([]);
  });
});

describe("computeValueRange (Sprint 36)", () => {
  it("calcule min/max/range sur des valeurs distinctes", () => {
    expect(computeValueRange([4, 2, 9, 1])).toEqual({ min: 1, max: 9, range: 8 });
  });

  it("retourne un range plancher à 1 quand toutes les valeurs sont identiques (évite une division par zéro)", () => {
    expect(computeValueRange([5, 5, 5])).toEqual({ min: 5, max: 5, range: 1 });
  });

  it("fonctionne avec une seule valeur", () => {
    expect(computeValueRange([7])).toEqual({ min: 7, max: 7, range: 1 });
  });
});

describe("hasAnyChartData (Sprint 36)", () => {
  it("faux pour un tableau de séries vide", () => {
    expect(hasAnyChartData([])).toBe(false);
  });

  it("faux quand toutes les séries n'ont que des valeurs null", () => {
    expect(hasAnyChartData([{ values: [null, null] }, { values: [null] }])).toBe(false);
  });

  it("vrai dès qu'une seule valeur non nulle existe, même dans une seule série", () => {
    expect(hasAnyChartData([{ values: [null, null] }, { values: [null, 3] }])).toBe(true);
  });
});
