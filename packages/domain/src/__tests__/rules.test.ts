import { describe, expect, it } from "vitest";
import { isValidRuleCondition } from "../rules";

describe("isValidRuleCondition", () => {
  it("accepte une condition simple valide", () => {
    expect(isValidRuleCondition({ field: "age", operator: "gte", value: 65 })).toBe(true);
  });

  it("accepte 'exists' sans value", () => {
    expect(isValidRuleCondition({ field: "fievre", operator: "exists" })).toBe(true);
  });

  it("accepte 'in' avec un tableau de valeurs scalaires", () => {
    expect(isValidRuleCondition({ field: "pathology", operator: "in", value: ["A", "B"] })).toBe(true);
  });

  it("refuse 'in' avec une valeur non tableau", () => {
    expect(isValidRuleCondition({ field: "pathology", operator: "in", value: "A" })).toBe(false);
  });

  it("accepte all/any imbriqués récursivement", () => {
    const condition = {
      all: [
        { field: "a", operator: "equals", value: true },
        { any: [{ field: "b", operator: "gte", value: 1 }, { field: "c", operator: "lte", value: 2 }] },
      ],
    };
    expect(isValidRuleCondition(condition)).toBe(true);
  });

  it("refuse all/any vides", () => {
    expect(isValidRuleCondition({ all: [] })).toBe(false);
    expect(isValidRuleCondition({ any: [] })).toBe(false);
  });

  it("refuse un opérateur inconnu", () => {
    expect(isValidRuleCondition({ field: "a", operator: "contains", value: "x" })).toBe(false);
  });

  it("refuse une valeur manquante quand l'opérateur l'exige", () => {
    expect(isValidRuleCondition({ field: "a", operator: "equals" })).toBe(false);
  });

  it("refuse les types non-objet, null, tableaux", () => {
    expect(isValidRuleCondition(null)).toBe(false);
    expect(isValidRuleCondition("field")).toBe(false);
    expect(isValidRuleCondition(42)).toBe(false);
    expect(isValidRuleCondition([])).toBe(false);
  });

  it("refuse un objet sans field/operator ni all/any", () => {
    expect(isValidRuleCondition({ foo: "bar" })).toBe(false);
  });
});
