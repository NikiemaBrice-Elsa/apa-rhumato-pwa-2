import { describe, expect, it } from "vitest";
import { buildSeriesPoints, computeValueRange, hasAnyChartData } from "../chart";

describe("buildSeriesPoints (Sprint 38)", () => {
  const xFor = (i: number) => i * 10;
  const yFor = (v: number) => v * 2;

  it("retourne un tableau vide sans aucune valeur", () => {
    expect(buildSeriesPoints([], xFor, yFor)).toEqual([]);
  });

  it("garde un point par valeur non nulle, dans l'ordre, avec sa valeur d'origine", () => {
    const points = buildSeriesPoints([1, 2, 3], xFor, yFor);
    expect(points).toEqual([
      { x: 0, y: 2, value: 1 },
      { x: 10, y: 4, value: 2 },
      { x: 20, y: 6, value: 3 },
    ]);
  });

  it("ignore les valeurs null sans rien fabriquer à leur place (§57, §59) — la série reste composée uniquement de points réellement enregistrés", () => {
    const points = buildSeriesPoints([1, null, 3, 4, null, null, 7], xFor, yFor);
    expect(points).toEqual([
      { x: 0, y: 2, value: 1 },
      { x: 20, y: 6, value: 3 },
      { x: 30, y: 8, value: 4 },
      { x: 60, y: 14, value: 7 },
    ]);
  });

  it("ne coupe plus la série en segments : les points de part et d'autre d'un trou restent dans le même tableau, prêts à être reliés directement (Sprint 38 — avant/après ne sont plus fragmentés)", () => {
    const points = buildSeriesPoints([5, null, null, 8], xFor, yFor);
    expect(points).toHaveLength(2);
    expect(points[0].value).toBe(5);
    expect(points[1].value).toBe(8);
  });

  it("retourne un tableau vide quand toutes les valeurs sont null", () => {
    expect(buildSeriesPoints([null, null], xFor, yFor)).toEqual([]);
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
