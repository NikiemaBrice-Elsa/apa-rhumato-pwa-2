import { describe, expect, it } from "vitest";
import type { ClinicalRule } from "@apa/domain";
import { evaluateCondition, evaluateRules } from "../engine";

// Règles synthétiques (fixtures), sans lien avec un contenu médical réel —
// on teste ici uniquement le mécanisme d'évaluation générique.
function makeRule(overrides: Partial<ClinicalRule>): ClinicalRule {
  return {
    ruleId: "TEST_RULE",
    pathology: "LOMBALGIE_COMMUNE",
    condition: { field: "x", operator: "equals", value: true },
    severity: "info",
    action: "allow_program",
    message: "test",
    active: true,
    version: "V1.0",
    ...overrides,
  };
}

describe("evaluateCondition", () => {
  it("equals", () => {
    expect(evaluateCondition({ field: "a", operator: "equals", value: 1 }, { a: 1 })).toBe(true);
    expect(evaluateCondition({ field: "a", operator: "equals", value: 1 }, { a: 2 })).toBe(false);
  });

  it("not_equals", () => {
    expect(evaluateCondition({ field: "a", operator: "not_equals", value: 1 }, { a: 2 })).toBe(true);
  });

  it("gte / lte", () => {
    expect(evaluateCondition({ field: "pain", operator: "gte", value: 7 }, { pain: 8 })).toBe(true);
    expect(evaluateCondition({ field: "pain", operator: "gte", value: 7 }, { pain: 3 })).toBe(false);
    expect(evaluateCondition({ field: "pain", operator: "lte", value: 3 }, { pain: 2 })).toBe(true);
  });

  it("in", () => {
    expect(evaluateCondition({ field: "level", operator: "in", value: [1, 2] }, { level: 2 })).toBe(true);
    expect(evaluateCondition({ field: "level", operator: "in", value: [1, 2] }, { level: 3 })).toBe(false);
  });

  it("exists", () => {
    expect(evaluateCondition({ field: "note", operator: "exists" }, { note: "x" })).toBe(true);
    expect(evaluateCondition({ field: "note", operator: "exists" }, {})).toBe(false);
    expect(evaluateCondition({ field: "note", operator: "exists" }, { note: "" })).toBe(false);
  });

  it("all (ET logique)", () => {
    const condition = {
      all: [
        { field: "a", operator: "equals" as const, value: true },
        { field: "b", operator: "gte" as const, value: 5 },
      ],
    };
    expect(evaluateCondition(condition, { a: true, b: 6 })).toBe(true);
    expect(evaluateCondition(condition, { a: true, b: 4 })).toBe(false);
  });

  it("any (OU logique)", () => {
    const condition = {
      any: [
        { field: "a", operator: "equals" as const, value: true },
        { field: "b", operator: "equals" as const, value: true },
      ],
    };
    expect(evaluateCondition(condition, { a: false, b: true })).toBe(true);
    expect(evaluateCondition(condition, { a: false, b: false })).toBe(false);
  });
});

describe("evaluateRules", () => {
  it("ignore les règles inactives", () => {
    const rules = [makeRule({ ruleId: "INACTIVE", active: false })];
    expect(evaluateRules(rules, { x: true })).toHaveLength(0);
  });

  it("ignore les règles dont la condition n'est pas satisfaite", () => {
    const rules = [makeRule({ ruleId: "NO_MATCH" })];
    expect(evaluateRules(rules, { x: false })).toHaveLength(0);
  });

  it("trie les règles déclenchées par sévérité décroissante", () => {
    const rules = [
      makeRule({ ruleId: "INFO", severity: "info" }),
      makeRule({ ruleId: "CRITICAL", severity: "critical" }),
      makeRule({ ruleId: "WARNING", severity: "warning" }),
    ];
    const result = evaluateRules(rules, { x: true });
    expect(result.map((r) => r.ruleId)).toEqual(["CRITICAL", "WARNING", "INFO"]);
  });
});
