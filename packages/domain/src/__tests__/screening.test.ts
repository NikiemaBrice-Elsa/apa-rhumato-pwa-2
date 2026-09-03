import { describe, expect, it } from "vitest";
import { initialAssessmentSchema } from "../validation";
import { LOMBALGIE_RED_FLAGS, SCREENING_ITEMS_BY_PATHOLOGY } from "../screening";

describe("initialAssessmentSchema (§14, §15-21)", () => {
  it("accepte une soumission lombalgie avec réponses booléennes", () => {
    const result = initialAssessmentSchema.safeParse({
      pathology: "LOMBALGIE_COMMUNE",
      responses: { traumatisme_important: false, fievre_contexte_infectieux: true },
    });
    expect(result.success).toBe(true);
  });

  it("refuse une pathologie hors des six modules V1", () => {
    const result = initialAssessmentSchema.safeParse({
      pathology: "FIBROMYALGIE",
      responses: {},
    });
    expect(result.success).toBe(false);
  });
});

describe("SCREENING_ITEMS_BY_PATHOLOGY (§16-21)", () => {
  it("expose les red flags lombalgie du §16 (9 depuis le 21/08/2026)", () => {
    // À l'origine 11 items (§16). Réduits à 9 le 21/08/2026 (réponses Q5/Q6
    // au document de questions ouvertes du Sprint 16) : « suspicion de
    // syndrome de la queue de cheval » est retirée en tant que question
    // patient (ses deux composantes, troubles_sphincteriens et
    // anesthesie_en_selle, restent ici et déclenchent chacune
    // indépendamment le rouge) ; « autre situation préoccupante » est
    // retirée de ce tableau de red flags rouges et déplacée dans
    // LOMBALGIE_COMMUNE_ITEMS comme signal de vigilance déclenchant l'orange
    // (pas un red flag automatique), voir packages/domain/src/screening.ts.
    expect(LOMBALGIE_RED_FLAGS).toHaveLength(9);
  });

  it("couvre les six modules de la V1", () => {
    expect(Object.keys(SCREENING_ITEMS_BY_PATHOLOGY)).toHaveLength(6);
  });
});
