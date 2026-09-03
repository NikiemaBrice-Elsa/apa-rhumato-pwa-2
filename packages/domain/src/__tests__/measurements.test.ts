import { describe, expect, it } from "vitest";
import {
  computeBmi,
  glycemiaGramsPerLToMmol,
  glycemiaMmolToGramsPerL,
  MEASUREMENT_TYPES,
  MEASUREMENT_TYPE_LABELS_FR,
  requiresCardioOptIn,
} from "../measurements";

describe("computeBmi", () => {
  it("calcule l'IMC = poids / taille² (§35)", () => {
    expect(computeBmi(70, 175)).toBeCloseTo(22.9, 1);
  });

  it("rejette une taille ou un poids nuls ou négatifs", () => {
    expect(() => computeBmi(0, 175)).toThrow(RangeError);
    expect(() => computeBmi(70, 0)).toThrow(RangeError);
    expect(() => computeBmi(-5, 175)).toThrow(RangeError);
  });
});

describe("conversion glycémie (§38 : 1 g/L = 5,5556 mmol/L)", () => {
  it("convertit g/L vers mmol/L", () => {
    expect(glycemiaGramsPerLToMmol(1)).toBeCloseTo(5.56, 1);
  });

  it("convertit mmol/L vers g/L", () => {
    expect(glycemiaMmolToGramsPerL(5.5556)).toBeCloseTo(1, 2);
  });

  it("est réversible (aller-retour) à l'arrondi près", () => {
    const original = 1.2;
    const roundTrip = glycemiaMmolToGramsPerL(glycemiaGramsPerLToMmol(original));
    expect(roundTrip).toBeCloseTo(original, 1);
  });
});

describe("MEASUREMENT_TYPES (§35-38, Sprint 8)", () => {
  it("couvre les quatre mesures de suivi (hors douleur, déjà portée par sessions/assessments)", () => {
    expect(MEASUREMENT_TYPES).toEqual(["poids", "tour_de_taille", "tension_arterielle", "glycemie"]);
  });

  it("chaque type a un libellé FR", () => {
    for (const type of MEASUREMENT_TYPES) {
      expect(MEASUREMENT_TYPE_LABELS_FR[type]).toBeTruthy();
    }
  });
});

describe("requiresCardioOptIn (§13, §37, §38)", () => {
  it("exige l'opt-in pour la tension artérielle et la glycémie", () => {
    expect(requiresCardioOptIn("tension_arterielle")).toBe(true);
    expect(requiresCardioOptIn("glycemie")).toBe(true);
  });

  it("n'exige pas l'opt-in pour le poids ou le tour de taille", () => {
    expect(requiresCardioOptIn("poids")).toBe(false);
    expect(requiresCardioOptIn("tour_de_taille")).toBe(false);
  });
});
