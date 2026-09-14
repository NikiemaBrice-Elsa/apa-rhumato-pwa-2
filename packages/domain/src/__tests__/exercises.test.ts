import { describe, expect, it } from "vitest";
import {
  EXERCISE_CATEGORIES,
  EQUIPMENT_ITEMS,
  MEDICAL_VALIDATION_STATUSES,
  EXERCISE_PHASES,
  EXERCISE_PHASE_LABELS_FR,
  EXERCISE_DIFFICULTY_LEVELS,
  EXERCISE_DIFFICULTY_LABELS_FR,
  BORG_CR10_MIN,
  BORG_CR10_MAX,
} from "../exercises";
import { PROFILE_LEVELS } from "../programs";

describe("EXERCISE_CATEGORIES (§25)", () => {
  it("couvre les six catégories du cahier des charges", () => {
    expect(EXERCISE_CATEGORIES).toHaveLength(6);
  });
});

describe("EQUIPMENT_ITEMS (§27)", () => {
  it("couvre le matériel autorisé, y compris 'aucun'", () => {
    expect(EQUIPMENT_ITEMS).toContain("aucun");
    expect(EQUIPMENT_ITEMS).toContain("elastique");
  });
});

describe("MEDICAL_VALIDATION_STATUSES (§57)", () => {
  it("n'autorise la visibilité qu'à l'état validated (contrôlé côté API/RLS)", () => {
    expect(MEDICAL_VALIDATION_STATUSES).toEqual(["draft", "pending_validation", "validated"]);
  });
});

/** §28, réf. B8 (20/08/2026), Sprint 18. */
describe("EXERCISE_PHASES (§28, réf. B8)", () => {
  it("couvre les 3 phases d'une séance, dans l'ordre de déroulement", () => {
    expect(EXERCISE_PHASES).toEqual(["echauffement", "principal", "retour_au_calme"]);
  });

  it("chaque phase a un libellé FR", () => {
    for (const phase of EXERCISE_PHASES) {
      expect(EXERCISE_PHASE_LABELS_FR[phase]).toBeTruthy();
    }
  });
});

/** §58, Sprint 24 (14/09/2026), Q2 validée : format débutant/intermédiaire/avancé
 * (réutilisation stricte de PROFILE_LEVELS) + Borg CR10 (0-10). */
describe("EXERCISE_DIFFICULTY_LEVELS (§58, Sprint 24)", () => {
  it("reprend exactement le même vocabulaire que PROFILE_LEVELS (§30)", () => {
    expect(EXERCISE_DIFFICULTY_LEVELS).toEqual(PROFILE_LEVELS);
  });

  it("chaque niveau a un libellé FR", () => {
    for (const level of EXERCISE_DIFFICULTY_LEVELS) {
      expect(EXERCISE_DIFFICULTY_LABELS_FR[level]).toBeTruthy();
    }
  });
});

describe("BORG_CR10_MIN / BORG_CR10_MAX (§58, réf. B6, Sprint 24)", () => {
  it("couvre l'échelle complète de Borg CR10 (0 à 10)", () => {
    expect(BORG_CR10_MIN).toBe(0);
    expect(BORG_CR10_MAX).toBe(10);
  });
});
