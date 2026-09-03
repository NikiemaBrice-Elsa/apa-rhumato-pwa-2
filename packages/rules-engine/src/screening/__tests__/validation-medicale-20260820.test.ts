import { describe, expect, it } from "vitest";
import type { ClinicalRule } from "@apa/domain";
import { evaluateSafetyScreeningFromRules } from "../index";

/**
 * Tests du dépistage réel pour les règles ajoutées le 20/08/2026
 * (infra/db/seed/0008_validation_medicale_dr_nikiema_20260820_partie2.sql
 * + activation de infra/db/seed/0004_.../0006_... pour les red flags
 * Coakley/Shah). Les fixtures ci-dessous reprennent EXACTEMENT les
 * conditions et actions du seed (même discipline que dispatcher.test.ts et
 * proposed-red-flags.test.ts : les fixtures ne remplacent jamais la
 * vérification réelle contre la base — voir infra/db/scripts/verify_rls.sh
 * — mais couvrent le mécanisme indépendamment d'elle).
 *
 * C'est la première fois que ce projet teste un vrai `vert`/`orange`
 * produit par le dépistage réel (voir aussi
 * apps/web/tests/security/screening-no-invented-green.test.ts pour le
 * garde-fou générique).
 */

const PAIN_ORANGE = (pathology: ClinicalRule["pathology"], field: string): ClinicalRule => ({
  ruleId: `PAIN_ORANGE_${pathology}`,
  pathology,
  condition: { field, operator: "gte", value: 4 },
  severity: "warning",
  action: "require_precaution",
  message: "douleur modérée",
  active: true,
  version: "V1.0",
});

const PAIN_ROUGE = (pathology: ClinicalRule["pathology"], field: string): ClinicalRule => ({
  ruleId: `PAIN_ROUGE_${pathology}`,
  pathology,
  condition: { field, operator: "gte", value: 7 },
  severity: "critical",
  action: "medical_referral",
  message: "douleur élevée",
  active: true,
  version: "V1.0",
});

describe("Arthrose du genou — vert/orange/rouge réels (20/08/2026)", () => {
  const HOT_JOINT: ClinicalRule = {
    ruleId: "PROPOSED_OA_GENOU_HOT_JOINT",
    pathology: "ARTHROSE_GENOU",
    condition: {
      any: [
        { field: "fievre", operator: "equals", value: true },
        { all: [{ field: "gonflement", operator: "equals", value: true }, { field: "chaleur_locale", operator: "equals", value: true }] },
      ],
    },
    severity: "critical",
    action: "medical_referral",
    message: "arthrite septique suspectée",
    active: true,
    version: "V1.0",
  };
  const GONFLEMENT_ROUGE: ClinicalRule = {
    ruleId: "GENOU_GONFLEMENT_ROUGE",
    pathology: "ARTHROSE_GENOU",
    condition: { field: "gonflement_evolution", operator: "gte", value: 2 },
    severity: "critical",
    action: "medical_referral",
    message: "gonflement important",
    active: true,
    version: "V1.0",
  };
  const RULES = [HOT_JOINT, PAIN_ORANGE("ARTHROSE_GENOU", "douleur"), PAIN_ROUGE("ARTHROSE_GENOU", "douleur"), GONFLEMENT_ROUGE];

  it("douleur 2/10, rien d'autre déclenché -> vert réel", () => {
    const result = evaluateSafetyScreeningFromRules("ARTHROSE_GENOU", { douleur: 2, fievre: false, gonflement: false }, RULES);
    expect(result.status).toBe("vert");
    expect(result.ruleImplemented).toBe(true);
  });

  it("douleur 5/10 -> orange", () => {
    const result = evaluateSafetyScreeningFromRules("ARTHROSE_GENOU", { douleur: 5, fievre: false }, RULES);
    expect(result.status).toBe("orange");
  });

  it("douleur 8/10 -> rouge (priorité sur l'orange)", () => {
    const result = evaluateSafetyScreeningFromRules("ARTHROSE_GENOU", { douleur: 8, fievre: false }, RULES);
    expect(result.status).toBe("rouge");
    expect(result.triggeredFlags).toContain("PAIN_ROUGE_ARTHROSE_GENOU");
  });

  it("gonflement_evolution = 2 (sans lien avec la douleur) -> rouge", () => {
    const result = evaluateSafetyScreeningFromRules("ARTHROSE_GENOU", { douleur: 1, gonflement_evolution: 2 }, RULES);
    expect(result.status).toBe("rouge");
    expect(result.triggeredFlags).toContain("GENOU_GONFLEMENT_ROUGE");
  });

  it("fièvre isolée -> rouge (Coakley et al. 2006, réf. A1)", () => {
    const result = evaluateSafetyScreeningFromRules("ARTHROSE_GENOU", { douleur: 1, fievre: true }, RULES);
    expect(result.status).toBe("rouge");
    expect(result.triggeredFlags).toContain("PROPOSED_OA_GENOU_HOT_JOINT");
  });
});

describe("Arthrose genou — chirurgie/traumatisme récent + restrictions (réf. D1, 20/08/2026)", () => {
  const ROUGE: ClinicalRule = {
    ruleId: "GENOU_CHIRURGIE_TRAUMA_RESTRICTIONS_ROUGE",
    pathology: "ARTHROSE_GENOU",
    condition: {
      all: [
        { any: [{ field: "chirurgie_recente", operator: "equals", value: true }, { field: "traumatisme_recent", operator: "equals", value: true }] },
        { field: "restrictions_pro_recentes", operator: "equals", value: true },
      ],
    },
    severity: "critical",
    action: "medical_referral",
    message: "restrictions actives",
    active: true,
    version: "V1.0",
  };
  const ORANGE: ClinicalRule = {
    ruleId: "GENOU_CHIRURGIE_TRAUMA_RECENT_ORANGE",
    pathology: "ARTHROSE_GENOU",
    condition: {
      all: [
        { any: [{ field: "chirurgie_recente", operator: "equals", value: true }, { field: "traumatisme_recent", operator: "equals", value: true }] },
        { field: "restrictions_pro_recentes", operator: "equals", value: false },
      ],
    },
    severity: "warning",
    action: "require_precaution",
    message: "prudence, événement récent",
    active: true,
    version: "V1.0",
  };
  const RULES = [ROUGE, ORANGE];

  it("chirurgie récente + restrictions actives -> rouge (la restriction prime sur le délai, réf. D1)", () => {
    const result = evaluateSafetyScreeningFromRules(
      "ARTHROSE_GENOU",
      { chirurgie_recente: true, traumatisme_recent: false, restrictions_pro_recentes: true },
      RULES
    );
    expect(result.status).toBe("rouge");
  });

  it("traumatisme récent SANS restriction active -> orange (prudence)", () => {
    const result = evaluateSafetyScreeningFromRules(
      "ARTHROSE_GENOU",
      { chirurgie_recente: false, traumatisme_recent: true, restrictions_pro_recentes: false },
      RULES
    );
    expect(result.status).toBe("orange");
  });

  it("ni chirurgie ni traumatisme récents -> aucune des deux règles ne se déclenche", () => {
    const result = evaluateSafetyScreeningFromRules(
      "ARTHROSE_GENOU",
      { chirurgie_recente: false, traumatisme_recent: false, restrictions_pro_recentes: false },
      RULES
    );
    expect(result.triggeredFlags).toEqual([]);
  });
});

describe("Polyarthrite rhumatoïde — poussée récente (réf. A3, décision du 20/08/2026 : rouge)", () => {
  const RULE: ClinicalRule = {
    ruleId: "PR_POUSSEE_RECENTE_ROUGE",
    pathology: "POLYARTHRITE_RHUMATOIDE",
    condition: { field: "poussee_recente", operator: "equals", value: true },
    severity: "critical",
    action: "medical_referral",
    message: "poussée récente",
    active: true,
    version: "V1.0",
  };

  it("poussée récente déclarée -> rouge", () => {
    const result = evaluateSafetyScreeningFromRules("POLYARTHRITE_RHUMATOIDE", { poussee_recente: true }, [RULE]);
    expect(result.status).toBe("rouge");
  });

  it("pas de poussée + douleur faible -> vert réel (avec une couverture orange par ailleurs)", () => {
    const result = evaluateSafetyScreeningFromRules(
      "POLYARTHRITE_RHUMATOIDE",
      { poussee_recente: false, douleur: 1 },
      [RULE, PAIN_ORANGE("POLYARTHRITE_RHUMATOIDE", "douleur")]
    );
    expect(result.status).toBe("vert");
  });
});

describe("Ostéoporose — risque de chute (réf. G1, 20/08/2026), distinct du risque fracturaire", () => {
  const CHUTE_MULTIPLE_ROUGE: ClinicalRule = {
    ruleId: "OSTEO_CHUTE_MULTIPLE_ROUGE",
    pathology: "OSTEOPOROSE",
    condition: { field: "chutes_12_mois", operator: "gte", value: 2 },
    severity: "critical",
    action: "medical_referral",
    message: "chutes répétées",
    active: true,
    version: "V1.0",
  };
  const CHUTE_ORANGE: ClinicalRule = {
    ruleId: "OSTEO_CHUTE_ORANGE",
    pathology: "OSTEOPOROSE",
    condition: { field: "chutes_12_mois", operator: "gte", value: 1 },
    severity: "warning",
    action: "require_precaution",
    message: "une chute",
    active: true,
    version: "V1.0",
  };
  const FRACTURE_RECENTE: ClinicalRule = {
    ruleId: "OSTEO_RECENT_FRACTURE",
    pathology: "OSTEOPOROSE",
    condition: { field: "fracture_recente", operator: "equals", value: true },
    severity: "critical",
    action: "stop_program",
    message: "fracture récente",
    active: true,
    version: "V1.0",
  };
  const RULES = [CHUTE_MULTIPLE_ROUGE, CHUTE_ORANGE, FRACTURE_RECENTE];

  it("2 chutes en 12 mois -> rouge, même sans fracture", () => {
    const result = evaluateSafetyScreeningFromRules("OSTEOPOROSE", { chutes_12_mois: 2, fracture_recente: false }, RULES);
    expect(result.status).toBe("rouge");
    expect(result.triggeredFlags).toEqual(["OSTEO_CHUTE_MULTIPLE_ROUGE"]);
  });

  it("1 chute -> orange (pas rouge : le risque de chute isolé n'est pas un red flag)", () => {
    const result = evaluateSafetyScreeningFromRules("OSTEOPOROSE", { chutes_12_mois: 1, fracture_recente: false }, RULES);
    expect(result.status).toBe("orange");
  });

  it("aucune chute, pas de fracture récente -> vert réel", () => {
    const result = evaluateSafetyScreeningFromRules("OSTEOPOROSE", { chutes_12_mois: 0, fracture_recente: false }, RULES);
    expect(result.status).toBe("vert");
  });

  it("fracture récente ostéoporotique sans historique de chute -> rouge quand même (risques distincts, réf. G1)", () => {
    const result = evaluateSafetyScreeningFromRules("OSTEOPOROSE", { chutes_12_mois: 0, fracture_recente: true }, RULES);
    expect(result.status).toBe("rouge");
    expect(result.triggeredFlags).toEqual(["OSTEO_RECENT_FRACTURE"]);
  });
});

describe("Spondyloarthrite axiale — signes d'alerte et effort perçu (réf. F1, F2, 20/08/2026)", () => {
  const RED_FLAG_THORAX: ClinicalRule = {
    ruleId: "SPA_RED_FLAG_DOULEUR_THORACIQUE",
    pathology: "SPONDYLOARTHRITE_AXIALE",
    condition: { field: "douleur_thoracique_ou_malaise", operator: "equals", value: true },
    severity: "critical",
    action: "medical_referral",
    message: "douleur thoracique",
    active: true,
    version: "V1.0",
  };
  const EFFORT_ORANGE: ClinicalRule = {
    ruleId: "SPA_EFFORT_BORG_ORANGE",
    pathology: "SPONDYLOARTHRITE_AXIALE",
    condition: { field: "effort_percu_borg", operator: "gte", value: 5 },
    severity: "warning",
    action: "require_precaution",
    message: "effort supérieur à la cible",
    active: true,
    version: "V1.0",
  };
  const RULES = [RED_FLAG_THORAX, EFFORT_ORANGE];

  it("raideur chronique stable et douleur habituelle -> vert (ne pas transformer une limitation stable en orange, principe explicite de Dr Nikiema)", () => {
    const result = evaluateSafetyScreeningFromRules(
      "SPONDYLOARTHRITE_AXIALE",
      { douleur_thoracique_ou_malaise: false, effort_percu_borg: 3 },
      RULES
    );
    expect(result.status).toBe("vert");
  });

  it("effort perçu Borg 7/10 -> orange", () => {
    const result = evaluateSafetyScreeningFromRules(
      "SPONDYLOARTHRITE_AXIALE",
      { douleur_thoracique_ou_malaise: false, effort_percu_borg: 7 },
      RULES
    );
    expect(result.status).toBe("orange");
  });

  it("douleur thoracique -> rouge, prioritaire sur tout le reste", () => {
    const result = evaluateSafetyScreeningFromRules(
      "SPONDYLOARTHRITE_AXIALE",
      { douleur_thoracique_ou_malaise: true, effort_percu_borg: 1 },
      RULES
    );
    expect(result.status).toBe("rouge");
  });
});

describe("Lombalgie — premier vrai vert/orange de l'histoire de ce module (réf. B1, 20/08/2026)", () => {
  const RED_FLAG: ClinicalRule = {
    ruleId: "LBP_RED_FLAG_FIEVRE",
    pathology: "LOMBALGIE_COMMUNE",
    condition: { field: "fievre_contexte_infectieux", operator: "equals", value: true },
    severity: "critical",
    action: "medical_referral",
    message: "red flag",
    active: true,
    version: "V1.0",
  };
  const RULES = [RED_FLAG, PAIN_ORANGE("LOMBALGIE_COMMUNE", "douleur"), PAIN_ROUGE("LOMBALGIE_COMMUNE", "douleur")];

  it("aucun red flag, douleur 2/10 -> vert (jusqu'ici structurellement impossible avant le 20/08/2026)", () => {
    const result = evaluateSafetyScreeningFromRules(
      "LOMBALGIE_COMMUNE",
      { fievre_contexte_infectieux: false, douleur: 2 },
      RULES
    );
    expect(result.status).toBe("vert");
  });

  it("aucun red flag, douleur 5/10 -> orange", () => {
    const result = evaluateSafetyScreeningFromRules(
      "LOMBALGIE_COMMUNE",
      { fievre_contexte_infectieux: false, douleur: 5 },
      RULES
    );
    expect(result.status).toBe("orange");
  });

  it("red flag présent, douleur basse -> rouge (le red flag prime toujours)", () => {
    const result = evaluateSafetyScreeningFromRules(
      "LOMBALGIE_COMMUNE",
      { fievre_contexte_infectieux: true, douleur: 1 },
      RULES
    );
    expect(result.status).toBe("rouge");
  });
});

describe("Lombalgie — critères qualitatifs (réf. C3 puis Q4, 21/08/2026)", () => {
  const AGGRAVATION_ORANGE: ClinicalRule = {
    ruleId: "LOMBALGIE_AGGRAVATION_ORANGE",
    pathology: "LOMBALGIE_COMMUNE",
    condition: { field: "aggravation_recente", operator: "equals", value: true },
    severity: "warning",
    action: "require_precaution",
    message: "aggravation",
    active: true,
    version: "V1.0",
  };
  const LIMITATION_ORANGE: ClinicalRule = {
    ruleId: "LOMBALGIE_NOUVELLE_LIMITATION_ORANGE",
    pathology: "LOMBALGIE_COMMUNE",
    condition: { field: "nouvelle_limitation_fonctionnelle_importante", operator: "equals", value: true },
    severity: "warning",
    action: "require_precaution",
    message: "nouvelle limitation",
    active: true,
    version: "V1.0",
  };
  const RULES = [AGGRAVATION_ORANGE, LIMITATION_ORANGE, PAIN_ORANGE("LOMBALGIE_COMMUNE", "douleur")];

  it("douleur 2/10 mais aggravation récente déclarée -> orange quand même (décision explicite de Dr Nikiema, Q4)", () => {
    const result = evaluateSafetyScreeningFromRules(
      "LOMBALGIE_COMMUNE",
      { douleur: 2, aggravation_recente: true, nouvelle_limitation_fonctionnelle_importante: false },
      RULES
    );
    expect(result.status).toBe("orange");
    expect(result.triggeredFlags).toContain("LOMBALGIE_AGGRAVATION_ORANGE");
  });

  it("douleur 2/10, nouvelle limitation fonctionnelle importante -> orange quand même", () => {
    const result = evaluateSafetyScreeningFromRules(
      "LOMBALGIE_COMMUNE",
      { douleur: 2, aggravation_recente: false, nouvelle_limitation_fonctionnelle_importante: true },
      RULES
    );
    expect(result.status).toBe("orange");
    expect(result.triggeredFlags).toContain("LOMBALGIE_NOUVELLE_LIMITATION_ORANGE");
  });

  it("douleur basse, stable, sans nouvelle limitation -> vert réel", () => {
    const result = evaluateSafetyScreeningFromRules(
      "LOMBALGIE_COMMUNE",
      { douleur: 1, aggravation_recente: false, nouvelle_limitation_fonctionnelle_importante: false },
      RULES
    );
    expect(result.status).toBe("vert");
  });
});

describe("Lombalgie — signal de vigilance « autre situation » (réf. C1 puis Q6, 21/08/2026)", () => {
  const VIGILANCE_ORANGE: ClinicalRule = {
    ruleId: "LOMBALGIE_VIGILANCE_AUTRE_ORANGE",
    pathology: "LOMBALGIE_COMMUNE",
    condition: { field: "signal_vigilance_autre", operator: "equals", value: true },
    severity: "warning",
    action: "require_precaution",
    message: "vigilance",
    active: true,
    version: "V1.0",
  };
  const RULES = [VIGILANCE_ORANGE, PAIN_ORANGE("LOMBALGIE_COMMUNE", "douleur")];

  it("signal de vigilance déclaré -> orange, PAS rouge (contrairement aux 9 autres red flags, décision explicite de Dr Nikiema)", () => {
    const result = evaluateSafetyScreeningFromRules("LOMBALGIE_COMMUNE", { douleur: 1, signal_vigilance_autre: true }, RULES);
    expect(result.status).toBe("orange");
    expect(result.status).not.toBe("rouge");
  });

  it("aucun signal -> vert réel", () => {
    const result = evaluateSafetyScreeningFromRules("LOMBALGIE_COMMUNE", { douleur: 1, signal_vigilance_autre: false }, RULES);
    expect(result.status).toBe("vert");
  });
});

describe("Arthrose de hanche — statut des restrictions à 3 niveaux (réf. D2 puis Q3, 21/08/2026)", () => {
  const RESTRICTIONS_ACTIVES_ROUGE: ClinicalRule = {
    ruleId: "HANCHE_CHIRURGIE_TRAUMA_RESTRICTIONS_ACTIVES_ROUGE",
    pathology: "ARTHROSE_HANCHE",
    condition: {
      all: [
        { any: [{ field: "chirurgie_recente", operator: "equals", value: true }, { field: "traumatisme", operator: "equals", value: true }] },
        { field: "statut_restrictions_hanche", operator: "equals", value: 2 },
      ],
    },
    severity: "critical",
    action: "medical_referral",
    message: "restrictions actives",
    active: true,
    version: "V1.0",
  };
  const RESTRICTIONS_PARTIELLES_ORANGE: ClinicalRule = {
    ruleId: "HANCHE_CHIRURGIE_TRAUMA_RESTRICTIONS_PARTIELLES_ORANGE",
    pathology: "ARTHROSE_HANCHE",
    condition: {
      all: [
        { any: [{ field: "chirurgie_recente", operator: "equals", value: true }, { field: "traumatisme", operator: "equals", value: true }] },
        { field: "statut_restrictions_hanche", operator: "equals", value: 1 },
      ],
    },
    severity: "warning",
    action: "require_precaution",
    message: "restrictions partielles",
    active: true,
    version: "V1.0",
  };
  const RULES = [RESTRICTIONS_ACTIVES_ROUGE, RESTRICTIONS_PARTIELLES_ORANGE, PAIN_ORANGE("ARTHROSE_HANCHE", "douleur")];

  it("restrictions actives (statut 2) -> rouge", () => {
    const result = evaluateSafetyScreeningFromRules(
      "ARTHROSE_HANCHE",
      { chirurgie_recente: true, traumatisme: false, statut_restrictions_hanche: 2, douleur: 1 },
      RULES
    );
    expect(result.status).toBe("rouge");
  });

  it("restrictions partielles (statut 1) -> orange", () => {
    const result = evaluateSafetyScreeningFromRules(
      "ARTHROSE_HANCHE",
      { chirurgie_recente: true, traumatisme: false, statut_restrictions_hanche: 1, douleur: 1 },
      RULES
    );
    expect(result.status).toBe("orange");
  });

  it("restrictions levées (statut 0) -> aucune règle de restriction ne se déclenche, statut régi par la douleur (vert ici)", () => {
    const result = evaluateSafetyScreeningFromRules(
      "ARTHROSE_HANCHE",
      { chirurgie_recente: true, traumatisme: false, statut_restrictions_hanche: 0, douleur: 1 },
      RULES
    );
    expect(result.status).toBe("vert");
    expect(result.triggeredFlags).toEqual([]);
  });

  it("restrictions levées (statut 0) mais douleur modérée -> orange via la règle de douleur, pas via une règle de restriction", () => {
    const result = evaluateSafetyScreeningFromRules(
      "ARTHROSE_HANCHE",
      { chirurgie_recente: true, traumatisme: false, statut_restrictions_hanche: 0, douleur: 5 },
      RULES
    );
    expect(result.status).toBe("orange");
    expect(result.triggeredFlags).toEqual(["PAIN_ORANGE_ARTHROSE_HANCHE"]);
  });
});

describe("Spondyloarthrite axiale — symptômes périphériques (réf. F2 puis Q2, 21/08/2026)", () => {
  const PERIPHERIQUE_ORANGE: ClinicalRule = {
    ruleId: "SPA_PERIPHERIQUE_ORANGE",
    pathology: "SPONDYLOARTHRITE_AXIALE",
    condition: {
      all: [
        {
          any: [
            { field: "arthrite_peripherique_presente", operator: "equals", value: true },
            { field: "enthesite_presente", operator: "equals", value: true },
            { field: "dactylite_presente", operator: "equals", value: true },
          ],
        },
        {
          any: [
            { field: "douleur_peripherique", operator: "gte", value: 4 },
            { field: "evolution_peripherique", operator: "gte", value: 1 },
            { field: "gonflement_chaleur_peripherique", operator: "equals", value: true },
            { field: "limitation_fonctionnelle_peripherique", operator: "equals", value: true },
          ],
        },
      ],
    },
    severity: "warning",
    action: "require_precaution",
    message: "atteinte périphérique active",
    active: true,
    version: "V1.0",
  };
  const PERIPHERIQUE_ROUGE: ClinicalRule = {
    ruleId: "SPA_PERIPHERIQUE_ROUGE",
    pathology: "SPONDYLOARTHRITE_AXIALE",
    condition: {
      all: [
        {
          any: [
            { field: "arthrite_peripherique_presente", operator: "equals", value: true },
            { field: "enthesite_presente", operator: "equals", value: true },
            { field: "dactylite_presente", operator: "equals", value: true },
          ],
        },
        {
          any: [
            { field: "douleur_peripherique", operator: "gte", value: 7 },
            { field: "evolution_peripherique", operator: "gte", value: 2 },
          ],
        },
      ],
    },
    severity: "critical",
    action: "medical_referral",
    message: "atteinte périphérique sévère",
    active: true,
    version: "V1.0",
  };
  const RULES = [PERIPHERIQUE_ORANGE, PERIPHERIQUE_ROUGE];

  it("atteinte périphérique déclarée, légère et stable -> vert (une atteinte légère et stable reste compatible avec un vert, réponse Q2)", () => {
    const result = evaluateSafetyScreeningFromRules(
      "SPONDYLOARTHRITE_AXIALE",
      {
        arthrite_peripherique_presente: true,
        enthesite_presente: false,
        dactylite_presente: false,
        douleur_peripherique: 2,
        evolution_peripherique: 0,
        gonflement_chaleur_peripherique: false,
        limitation_fonctionnelle_peripherique: false,
      },
      RULES
    );
    expect(result.status).toBe("vert");
  });

  it("aucune localisation déclarée -> les champs de sévérité seuls ne déclenchent rien (garde-fou de la condition combinée)", () => {
    const result = evaluateSafetyScreeningFromRules(
      "SPONDYLOARTHRITE_AXIALE",
      {
        arthrite_peripherique_presente: false,
        enthesite_presente: false,
        dactylite_presente: false,
        douleur_peripherique: 9,
        evolution_peripherique: 2,
      },
      RULES
    );
    expect(result.triggeredFlags).toEqual([]);
  });

  it("dactylite douloureuse et fonctionnellement limitante -> orange", () => {
    const result = evaluateSafetyScreeningFromRules(
      "SPONDYLOARTHRITE_AXIALE",
      {
        arthrite_peripherique_presente: false,
        enthesite_presente: false,
        dactylite_presente: true,
        douleur_peripherique: 5,
        evolution_peripherique: 0,
        gonflement_chaleur_peripherique: false,
        limitation_fonctionnelle_peripherique: true,
      },
      RULES
    );
    expect(result.status).toBe("orange");
  });

  it("enthésite très douloureuse et rapidement aggravée -> rouge", () => {
    const result = evaluateSafetyScreeningFromRules(
      "SPONDYLOARTHRITE_AXIALE",
      {
        arthrite_peripherique_presente: false,
        enthesite_presente: true,
        dactylite_presente: false,
        douleur_peripherique: 8,
        evolution_peripherique: 2,
      },
      RULES
    );
    expect(result.status).toBe("rouge");
  });
});
