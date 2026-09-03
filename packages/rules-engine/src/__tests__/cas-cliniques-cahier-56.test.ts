import { describe, expect, it } from "vitest";
import type { ClinicalRule } from "@apa/domain";
import { LOMBALGIE_URGENT_MESSAGE, OSTEOPOROSE_RECENT_FRACTURE_MESSAGE } from "@apa/domain";
import { evaluateSafetyScreeningFromRules } from "../screening";
import { evaluateProgramAssignment } from "../program-selection";
import { MEDICAL_PARAMETER_REQUIRED } from "../constants";

/**
 * §56 « TESTS DU MOTEUR MÉDICAL » — Sprint 15.
 *
 * Le cahier des charges impose quatre cas de test fictifs précis. Ce
 * fichier les rassemble tous les quatre au même endroit pour une
 * traçabilité directe avec le §56 (les Cas 2 et 4 étaient déjà couverts
 * séparément dans screening/__tests__/dispatcher.test.ts ; ils sont
 * repris ici tels quels pour la vue d'ensemble).
 *
 * IMPORTANT — pourquoi les Cas 1 et 3 ne peuvent TOUJOURS PAS être
 * démontrés de bout en bout (dépistage réel -> attribution) aujourd'hui,
 * et ce qui a changé le 20/08/2026 :
 *
 * Jusqu'au 20/08/2026, `evaluateSafetyScreeningFromRules` (le dépistage
 * RÉEL, voir screening/index.ts) ne renvoyait JAMAIS `vert` ni `orange` —
 * uniquement `rouge` ou `pending_validation` — car aucun seuil gradué
 * n'avait encore été validé par le concepteur médical (§58). Ce n'est plus
 * vrai : le seuil de douleur harmonisé (réf. B1 du questionnaire de
 * validation médicale, voir docs/DECISIONS.md) est désormais une règle
 * active pour plusieurs pathologies (dont arthrose du genou et PR), et le
 * dépistage réel PEUT donc produire un vrai `vert`/`orange` — voir
 * apps/web/tests/security/screening-no-invented-green.test.ts, qui vérifie
 * à la fois que ce nouveau comportement est correct ET qu'il reste
 * strictement conditionné à l'existence d'une règle active validée
 * (jamais inventé).
 *
 * Ce qui manque ENCORE pour dérouler les Cas 1 et 3 de bout en bout n'est
 * donc plus le dépistage, mais l'ATTRIBUTION DE PROGRAMME : aucune règle
 * `allow_program` validée n'existe (la table `programs` reste vide, voir
 * docs/DEPLOYMENT.md) — `evaluateProgramAssignment` retournerait
 * systématiquement `MEDICAL_PARAMETER_REQUIRED` même avec un vrai
 * `screening: "vert"` en entrée. Les Cas 1 et 3 restent donc vérifiés ici
 * comme des tests DU MÉCANISME de sélection de programme PRIS ISOLÉMENT,
 * avec un statut de dépistage vert fourni comme fait fictif explicite —
 * mais ce fait fictif est maintenant plausible (il pourrait provenir d'un
 * vrai dépistage), alors qu'il était auparavant structurellement
 * impossible. Cette distinction est documentée ici précisément pour
 * qu'elle ne soit jamais confondue avec un comportement réel de
 * l'attribution de programme, qui reste `pending_validation` aujourd'hui.
 */

describe("§56 Cas 1 : Arthrose genou + débutant + screening vert -> Programme débutant", () => {
  it("attribue le programme débutant quand une règle allow_program validée le prévoit (mécanisme isolé, screening vert fictif)", () => {
    const rules: ClinicalRule[] = [
      {
        ruleId: "FIXTURE_CAS1_OA_GENOU_DEBUTANT",
        pathology: "ARTHROSE_GENOU",
        condition: {
          all: [
            { field: "niveau", operator: "equals", value: "debutant" },
            { field: "screening", operator: "equals", value: "vert" },
          ],
        },
        severity: "info",
        action: "allow_program",
        message: "fixture Cas 1 §56",
        programId: "OA_GENOU_DEBUTANT_01",
        active: true,
        version: "V1.0",
      },
    ];

    const result = evaluateProgramAssignment("ARTHROSE_GENOU", { niveau: "debutant", screening: "vert" }, rules);

    expect(result.status).toBe("assigned");
    expect(result.programId).toBe("OA_GENOU_DEBUTANT_01");
  });
});

describe("§56 Cas 2 : Lombalgie + signe d'alerte critique -> Aucun programme, orientation médicale", () => {
  // Fixture reprenant un red flag lombalgie toujours réel et actif
  // (troubles_sphincteriens) — jusqu'au 21/08/2026 cette fixture utilisait
  // `suspicion_queue_de_cheval`, retiré depuis comme champ de dépistage
  // patient (réponse Q5 au document de questions ouvertes du Sprint 16 :
  // ce concept clinique reste une synthèse interne, plus une question posée
  // — voir packages/domain/src/screening.ts et
  // infra/db/seed/0009_reponses_questions_ouvertes_20260821.sql). Le
  // mécanisme démontré ici (red flag rouge -> jamais de programme) est
  // inchangé, seul le champ fixture a été mis à jour pour rester réaliste.
  const LOMBALGIE_RULES: ClinicalRule[] = [
    {
      ruleId: "LBP_RED_FLAG_SPHINCTER",
      pathology: "LOMBALGIE_COMMUNE",
      condition: { field: "troubles_sphincteriens", operator: "equals", value: true },
      severity: "critical",
      action: "medical_referral",
      message: LOMBALGIE_URGENT_MESSAGE,
      active: true,
      version: "V1.0",
    },
  ];

  it("bloque le dépistage à rouge (dépistage RÉEL) puis ne propose jamais de programme (mécanisme réel de bout en bout)", () => {
    const screening = evaluateSafetyScreeningFromRules(
      "LOMBALGIE_COMMUNE",
      { troubles_sphincteriens: true },
      LOMBALGIE_RULES
    );
    expect(screening.status).toBe("rouge");
    expect(screening.message).toBe(LOMBALGIE_URGENT_MESSAGE);

    // Aucune règle allow_program n'existe (et n'existerait jamais) pour un
    // statut rouge : l'attribution de programme n'est même pas tentée côté
    // application réelle (voir apps/web/src/app/api/assessments/route.ts).
    // On le vérifie quand même explicitement ici avec le statut réel produit
    // par le dépistage, pour prouver que la chaîne complète n'aboutit
    // jamais à un programme.
    const assignment = evaluateProgramAssignment("LOMBALGIE_COMMUNE", { screening: screening.status }, []);
    expect(assignment.status).toBe(MEDICAL_PARAMETER_REQUIRED);
    expect(assignment.programId).toBeUndefined();
  });
});

describe("§56 Cas 3 : PR + activité physique faible + screening vert -> Programme adapté débutant", () => {
  it("attribue un programme débutant adapté quand une règle allow_program validée combine les deux conditions (mécanisme isolé, screening vert fictif)", () => {
    const rules: ClinicalRule[] = [
      {
        ruleId: "FIXTURE_CAS3_PR_ACTIVITE_FAIBLE_DEBUTANT",
        pathology: "POLYARTHRITE_RHUMATOIDE",
        condition: {
          all: [
            { field: "activite_physique", operator: "equals", value: "faible" },
            { field: "screening", operator: "equals", value: "vert" },
          ],
        },
        severity: "info",
        action: "allow_program",
        message: "fixture Cas 3 §56",
        programId: "PR_DEBUTANT_ADAPTE_01",
        active: true,
        version: "V1.0",
      },
    ];

    const result = evaluateProgramAssignment(
      "POLYARTHRITE_RHUMATOIDE",
      { activite_physique: "faible", screening: "vert" },
      rules
    );

    expect(result.status).toBe("assigned");
    expect(result.programId).toBe("PR_DEBUTANT_ADAPTE_01");
  });

  it("n'attribue rien si l'activité physique n'est pas renseignée comme 'faible' (aucune règle plus permissive inventée)", () => {
    const rules: ClinicalRule[] = [
      {
        ruleId: "FIXTURE_CAS3_PR_ACTIVITE_FAIBLE_DEBUTANT",
        pathology: "POLYARTHRITE_RHUMATOIDE",
        condition: {
          all: [
            { field: "activite_physique", operator: "equals", value: "faible" },
            { field: "screening", operator: "equals", value: "vert" },
          ],
        },
        severity: "info",
        action: "allow_program",
        message: "fixture Cas 3 §56",
        programId: "PR_DEBUTANT_ADAPTE_01",
        active: true,
        version: "V1.0",
      },
    ];

    const result = evaluateProgramAssignment(
      "POLYARTHRITE_RHUMATOIDE",
      { activite_physique: "elevee", screening: "vert" },
      rules
    );
    expect(result.status).toBe(MEDICAL_PARAMETER_REQUIRED);
  });
});

describe("§56 Cas 4 : Ostéoporose + fracture récente -> Pas de programme automatisé sans validation appropriée", () => {
  const OSTEOPOROSE_RULES: ClinicalRule[] = [
    {
      ruleId: "OSTEO_RECENT_FRACTURE",
      pathology: "OSTEOPOROSE",
      condition: { field: "fracture_recente", operator: "equals", value: true },
      severity: "critical",
      action: "stop_program",
      message: OSTEOPOROSE_RECENT_FRACTURE_MESSAGE,
      active: true,
      version: "V1.0",
    },
  ];

  it("bloque le dépistage à rouge (dépistage RÉEL) puis ne propose jamais de programme (mécanisme réel de bout en bout)", () => {
    const screening = evaluateSafetyScreeningFromRules("OSTEOPOROSE", { fracture_recente: true }, OSTEOPOROSE_RULES);
    expect(screening.status).toBe("rouge");
    expect(screening.triggeredFlags).toEqual(["OSTEO_RECENT_FRACTURE"]);

    const assignment = evaluateProgramAssignment("OSTEOPOROSE", { screening: screening.status }, []);
    expect(assignment.status).toBe(MEDICAL_PARAMETER_REQUIRED);
    expect(assignment.programId).toBeUndefined();
  });
});
