import { describe, expect, it } from "vitest";
import { EXERCISE_CATEGORIES, EQUIPMENT_ITEMS, MEDICAL_VALIDATION_STATUSES, EXERCISE_PHASES, EXERCISE_PHASE_LABELS_FR } from "../exercises";

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
