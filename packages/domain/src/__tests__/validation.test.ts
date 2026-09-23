import { describe, expect, it } from "vitest";
import {
  signUpSchema,
  patientProfileSchema,
  startSessionSchema,
  completeSessionSchema,
  declareSessionSchema,
  measurementSchema,
  reportRequestSchema,
  exerciseUpsertSchema,
  functionalCapacityAssessmentSchema,
  professionalLinkInviteSchema,
} from "../validation";

describe("signUpSchema (§12 — création de compte)", () => {
  const base = {
    firstName: "Aïcha",
    password: "motdepasse123",
    consentTerms: true as const,
    consentDataProcessing: true as const,
  };

  it("accepte un email seul", () => {
    const result = signUpSchema.safeParse({ ...base, email: "aicha@example.com" });
    expect(result.success).toBe(true);
  });

  it("accepte un téléphone seul", () => {
    const result = signUpSchema.safeParse({ ...base, phone: "+22670000000" });
    expect(result.success).toBe(true);
  });

  it("refuse l'absence d'email ET de téléphone", () => {
    const result = signUpSchema.safeParse(base);
    expect(result.success).toBe(false);
  });

  it("refuse un consentement CGU manquant", () => {
    const result = signUpSchema.safeParse({
      ...base,
      email: "aicha@example.com",
      consentTerms: false,
    });
    expect(result.success).toBe(false);
  });

  /** 22/09/2026 : corrige un compte introuvable par recherche email à cause
   * d'une casse différente (réf. « Mes professionnels de santé », message
   * direct de Dr Nikiema). */
  it("normalise l'email en minuscules", () => {
    const result = signUpSchema.safeParse({ ...base, email: "Aicha.KABORE@Example.COM" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("aicha.kabore@example.com");
    }
  });
});

describe("patientProfileSchema (§13 — profil patient)", () => {
  it("accepte un profil minimal valide", () => {
    const result = patientProfileSchema.safeParse({
      mainPathologies: ["ARTHROSE_GENOU"],
      objectives: ["AMELIORER_MOBILITE"],
    });
    expect(result.success).toBe(true);
  });

  it("refuse une douleur hors de l'échelle 0-10 (§34)", () => {
    const result = patientProfileSchema.safeParse({ painBaseline: 15 });
    expect(result.success).toBe(false);
  });

  it("refuse une pathologie hors des six modules V1 (§7)", () => {
    const result = patientProfileSchema.safeParse({ mainPathologies: ["FIBROMYALGIE"] });
    expect(result.success).toBe(false);
  });

  // Sprint 32 (23/09/2026, instruction directe de Dr Nikiema) : choix
  // multiple désormais possible pour les pathologies suivies dans le profil.
  it("accepte plusieurs pathologies suivies à la fois", () => {
    const result = patientProfileSchema.safeParse({
      mainPathologies: ["ARTHROSE_GENOU", "LOMBALGIE_COMMUNE", "OSTEOPOROSE"],
      objectives: [],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mainPathologies).toHaveLength(3);
    }
  });

  it("prend par défaut une liste vide de pathologies si aucune n'est fournie", () => {
    const result = patientProfileSchema.safeParse({ objectives: [] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mainPathologies).toEqual([]);
    }
  });
});

describe("startSessionSchema (§28 étape 2 — vérification rapide)", () => {
  it("accepte un démarrage minimal (pathologie seule)", () => {
    const result = startSessionSchema.safeParse({ pathology: "ARTHROSE_GENOU" });
    expect(result.success).toBe(true);
  });

  it("refuse une douleur hors de l'échelle 0-10", () => {
    const result = startSessionSchema.safeParse({ pathology: "ARTHROSE_GENOU", douleurAvant: 11 });
    expect(result.success).toBe(false);
  });

  it("refuse une pathologie hors des six modules V1 (§7)", () => {
    const result = startSessionSchema.safeParse({ pathology: "FIBROMYALGIE" });
    expect(result.success).toBe(false);
  });
});

describe("completeSessionSchema (§69 — feedback après séance)", () => {
  it("accepte une séance non réalisée (abandon) sans détail", () => {
    const result = completeSessionSchema.safeParse({ realisee: false });
    expect(result.success).toBe(true);
  });

  it("accepte une séance réalisée avec feedback complet", () => {
    const result = completeSessionSchema.safeParse({
      realisee: true,
      difficulte: "adaptee",
      douleurApres: 3,
      fatigueApres: 4,
      ressenti: "Séance plutôt bien vécue.",
    });
    expect(result.success).toBe(true);
  });

  it("refuse une difficulté renseignée si la séance n'a pas été réalisée", () => {
    const result = completeSessionSchema.safeParse({ realisee: false, difficulte: "facile" });
    expect(result.success).toBe(false);
  });

  it("refuse une douleur après séance hors de l'échelle 0-10", () => {
    const result = completeSessionSchema.safeParse({ realisee: true, douleurApres: 12 });
    expect(result.success).toBe(false);
  });
});

/**
 * Sprint 29 (22/09/2026) — déclarer une séance déjà réalisée hors de
 * l'application, en un seul envoi (vérification + feedback réunis, contrairement
 * à startSessionSchema/completeSessionSchema qui couvrent une séance en direct).
 */
describe("declareSessionSchema (document « séance hors application », 22/09/2026)", () => {
  it("accepte une déclaration minimale valide", () => {
    const result = declareSessionSchema.safeParse({
      pathology: "ARTHROSE_GENOU",
      date: "2026-09-20",
      realisee: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepte une déclaration avec feedback complet", () => {
    const result = declareSessionSchema.safeParse({
      pathology: "ARTHROSE_GENOU",
      date: "2026-09-20",
      douleurAvant: 3,
      fatigueAvant: 2,
      realisee: true,
      difficulte: "adaptee",
      douleurApres: 2,
      fatigueApres: 3,
      ressenti: "Fait à la maison, sans l'appli.",
    });
    expect(result.success).toBe(true);
  });

  it("refuse une date dans le futur (on ne déclare pas une séance qui n'a pas encore eu lieu)", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const result = declareSessionSchema.safeParse({ pathology: "ARTHROSE_GENOU", date: future, realisee: true });
    expect(result.success).toBe(false);
  });

  it("accepte une date dans le passé", () => {
    const result = declareSessionSchema.safeParse({ pathology: "ARTHROSE_GENOU", date: "2020-01-01", realisee: true });
    expect(result.success).toBe(true);
  });

  it("refuse un format de date invalide", () => {
    const result = declareSessionSchema.safeParse({ pathology: "ARTHROSE_GENOU", date: "20/09/2026", realisee: true });
    expect(result.success).toBe(false);
  });

  it("refuse une difficulté renseignée si la séance n'a pas été réalisée", () => {
    const result = declareSessionSchema.safeParse({
      pathology: "ARTHROSE_GENOU",
      date: "2026-09-20",
      realisee: false,
      difficulte: "facile",
    });
    expect(result.success).toBe(false);
  });

  it("refuse une pathologie hors des six modules V1 (§7)", () => {
    const result = declareSessionSchema.safeParse({ pathology: "FIBROMYALGIE", date: "2026-09-20", realisee: true });
    expect(result.success).toBe(false);
  });
});

/**
 * §41 (invitation d'un professionnel de santé) — 22/09/2026 : corrige un
 * compte professionnel introuvable par recherche email à cause d'une casse
 * différente (message direct de Dr Nikiema, « Mes professionnels de santé »).
 */
describe("professionalLinkInviteSchema (§41, correctif casse email 22/09/2026)", () => {
  it("accepte un email valide", () => {
    const result = professionalLinkInviteSchema.safeParse({ professionalEmail: "kine@cabinet.tld" });
    expect(result.success).toBe(true);
  });

  it("normalise l'email en minuscules", () => {
    const result = professionalLinkInviteSchema.safeParse({ professionalEmail: "Kine@Cabinet.TLD" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.professionalEmail).toBe("kine@cabinet.tld");
    }
  });

  it("refuse un email invalide", () => {
    const result = professionalLinkInviteSchema.safeParse({ professionalEmail: "pas-un-email" });
    expect(result.success).toBe(false);
  });
});

describe("measurementSchema (§35-38 — Sprint 8)", () => {
  it("accepte une saisie de poids valide", () => {
    const result = measurementSchema.safeParse({ measurementType: "poids", weightKg: 72.5 });
    expect(result.success).toBe(true);
  });

  it("accepte une saisie de tour de taille valide", () => {
    const result = measurementSchema.safeParse({ measurementType: "tour_de_taille", waistCircumferenceCm: 90 });
    expect(result.success).toBe(true);
  });

  it("accepte une tension artérielle valide, fréquence cardiaque facultative", () => {
    const result = measurementSchema.safeParse({
      measurementType: "tension_arterielle",
      systolicMmhg: 120,
      diastolicMmhg: 80,
    });
    expect(result.success).toBe(true);
  });

  it("accepte une glycémie valide avec son unité", () => {
    const result = measurementSchema.safeParse({ measurementType: "glycemie", glycemiaValue: 1.1, glycemiaUnit: "g_l" });
    expect(result.success).toBe(true);
  });

  it("refuse un poids sans le champ weightKg (pas de mélange de champs entre types)", () => {
    const result = measurementSchema.safeParse({ measurementType: "poids", waistCircumferenceCm: 90 });
    expect(result.success).toBe(false);
  });

  it("refuse une glycémie sans unité", () => {
    const result = measurementSchema.safeParse({ measurementType: "glycemie", glycemiaValue: 1.1 });
    expect(result.success).toBe(false);
  });

  it("refuse un type de mesure inconnu", () => {
    const result = measurementSchema.safeParse({ measurementType: "taille", value: 175 });
    expect(result.success).toBe(false);
  });
});

describe("reportRequestSchema (§40, §71 — Sprint 10)", () => {
  it("accepte une demande minimale (pathologie seule)", () => {
    const result = reportRequestSchema.safeParse({ pathology: "ARTHROSE_GENOU" });
    expect(result.success).toBe(true);
  });

  it("accepte une période et une note utilisateur", () => {
    const result = reportRequestSchema.safeParse({
      pathology: "ARTHROSE_GENOU",
      from: "2026-07-01T00:00:00Z",
      to: "2026-07-31T23:59:59Z",
      userNote: "Tout va bien.",
    });
    expect(result.success).toBe(true);
  });

  it("refuse une pathologie hors des six modules V1 (§7)", () => {
    const result = reportRequestSchema.safeParse({ pathology: "FIBROMYALGIE" });
    expect(result.success).toBe(false);
  });
});

/** §28, réf. B8 (20/08/2026), Sprint 18. */
describe("exerciseUpsertSchema — champ phase (§28, réf. B8)", () => {
  const base = { name: "Exercice test", shortDescription: "Description", category: "mobilite" as const };

  it("accepte l'absence de phase (non classé)", () => {
    const result = exerciseUpsertSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("accepte chacune des 3 phases valides", () => {
    for (const phase of ["echauffement", "principal", "retour_au_calme"] as const) {
      const result = exerciseUpsertSchema.safeParse({ ...base, phase });
      expect(result.success).toBe(true);
    }
  });

  it("refuse une phase hors de la liste fermée", () => {
    const result = exerciseUpsertSchema.safeParse({ ...base, phase: "milieu_de_seance" });
    expect(result.success).toBe(false);
  });
});

/** §33, réf. B10 (20/08/2026), Sprint 18. */
describe("functionalCapacityAssessmentSchema (§33, réf. B10)", () => {
  it("accepte un PSFS avec 3 activités (minimum méthodologique)", () => {
    const result = functionalCapacityAssessmentSchema.safeParse({
      instrument: "psfs",
      activities: [
        { activityLabel: "Monter les escaliers", difficultyScore: 6 },
        { activityLabel: "Porter les courses", difficultyScore: 4 },
        { activityLabel: "Jardiner", difficultyScore: 8 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("refuse un PSFS avec moins de 3 activités", () => {
    const result = functionalCapacityAssessmentSchema.safeParse({
      instrument: "psfs",
      activities: [{ activityLabel: "Monter les escaliers", difficultyScore: 6 }],
    });
    expect(result.success).toBe(false);
  });

  it("refuse un PSFS avec plus de 5 activités", () => {
    const result = functionalCapacityAssessmentSchema.safeParse({
      instrument: "psfs",
      activities: Array.from({ length: 6 }, (_, i) => ({ activityLabel: `Activité ${i}`, difficultyScore: 5 })),
    });
    expect(result.success).toBe(false);
  });

  it("refuse un score de difficulté hors de l'échelle 0-10", () => {
    const result = functionalCapacityAssessmentSchema.safeParse({
      instrument: "psfs",
      activities: [
        { activityLabel: "A", difficultyScore: 11 },
        { activityLabel: "B", difficultyScore: 5 },
        { activityLabel: "C", difficultyScore: 5 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepte un score PROMIS déjà obtenu ailleurs (T-score + erreur standard)", () => {
    const result = functionalCapacityAssessmentSchema.safeParse({
      instrument: "promis_pf_cat",
      promisTScore: 45.2,
      promisStandardError: 3.1,
    });
    expect(result.success).toBe(true);
  });

  it("accepte un score PROMIS sans erreur standard (facultative)", () => {
    const result = functionalCapacityAssessmentSchema.safeParse({ instrument: "promis_pf_cat", promisTScore: 50 });
    expect(result.success).toBe(true);
  });
});
