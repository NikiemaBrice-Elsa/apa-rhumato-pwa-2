import { z } from "zod";
import { PROGRESSION_DECISIONS } from "./rules";
import { PHYSICAL_ACTIVITY_TYPES } from "./physicalActivities";
import { PATHOLOGY_CODES } from "./pathologies";

/**
 * Schémas de validation partagés (utilisés côté client ET côté serveur —
 * §46 : « ne jamais faire confiance uniquement aux contrôles frontend »).
 */

export const signUpSchema = z.object({
  firstName: z.string().trim().min(1, "Le prénom est requis."),
  lastName: z.string().trim().optional(),
  // .toLowerCase() (22/09/2026) : l'email n'était normalisé nulle part avant
  // stockage dans `users.email`, alors que la recherche d'un professionnel
  // par email (`POST /api/professional-links`) fait une comparaison exacte
  // — un compte créé avec une majuscule quelconque devenait introuvable pour
  // un patient qui tape la même adresse tout en minuscules, un cas d'usage
  // courant. Corrige la cause à la source pour toute NOUVELLE inscription ;
  // voir aussi la comparaison insensible à la casse côté recherche, pour les
  // comptes déjà existants.
  email: z.string().trim().toLowerCase().email().optional(),
  phone: z.string().trim().optional(),
  password: z.string().min(8, "8 caractères minimum."),
  birthDate: z.string().optional(),
  sex: z.enum(["female", "male", "other", "undisclosed"]).optional(),
  consentTerms: z.literal(true, {
    errorMap: () => ({ message: "Vous devez accepter les conditions d'utilisation." }),
  }),
  consentDataProcessing: z.literal(true, {
    errorMap: () => ({ message: "Vous devez consentir au traitement des données." }),
  }),
}).refine((data) => Boolean(data.email) || Boolean(data.phone), {
  message: "Un email ou un numéro de téléphone est requis.",
  path: ["email"],
});

export type SignUpInput = z.infer<typeof signUpSchema>;

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Email ou téléphone requis."),
  password: z.string().min(1, "Mot de passe requis."),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const patientProfileSchema = z.object({
  heightCm: z.number().positive().max(260).optional(),
  weightKg: z.number().positive().max(400).optional(),
  waistCircumferenceCm: z.number().positive().max(300).optional(),
  physicalActivityLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  // Sprint 32 (23/09/2026, instruction directe de Dr Nikiema) : « dans le
  // profil on ne peut pas choisir plusieurs pathologies actuellement. Il
  // faut modifier pour qu'un choix multiple soit possible » — remplace le
  // choix unique (`z.enum(...).optional()`) par un tableau, même discipline
  // que `objectives` juste en dessous (défaut tableau vide, jamais `null`).
  // `.max(6)` : il n'existe que 6 pathologies V1 (§7), aucune limite
  // artificielle en deçà.
  mainPathologies: z.array(z.enum(PATHOLOGY_CODES)).max(6).default([]),
  objectives: z.array(z.string()).max(10).default([]),
  functionalLimitations: z.string().max(2000).optional(),
  painBaseline: z.number().int().min(0).max(10).optional(),
  fatigueBaseline: z.number().int().min(0).max(10).optional(),
  trackCardioParams: z.boolean().default(false),
  /** §39, Sprint 23 (13/09/2026) : heure à laquelle le patient souhaite
   * recevoir son rappel quotidien de séance (24h, "HH:MM") — remplace une
   * heure fixe unique décidée par l'administrateur (voir
   * packages/domain/src/notifications.ts, `isReminderTimeReached`). */
  reminderTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure invalide (format HH:MM).")
    .default("09:00"),
});

export type PatientProfileInput = z.infer<typeof patientProfileSchema>;

/** §14 (Bloc A) + §15-21 (dépistage) : soumission d'une évaluation initiale. */
export const initialAssessmentSchema = z.object({
  pathology: z.enum([
    "LOMBALGIE_COMMUNE",
    "ARTHROSE_GENOU",
    "ARTHROSE_HANCHE",
    "POLYARTHRITE_RHUMATOIDE",
    "SPONDYLOARTHRITE_AXIALE",
    "OSTEOPOROSE",
  ]),
  // Réponses libres, clé = code de l'item (voir SCREENING_ITEMS_BY_PATHOLOGY),
  // valeur = booléen, nombre (échelle 0-10) ou texte selon le type de l'item.
  responses: z.record(z.string(), z.union([z.boolean(), z.number(), z.string()])),
});

export type InitialAssessmentInput = z.infer<typeof initialAssessmentSchema>;

/** §28 étape 2 « Vérification rapide » : démarrage d'une séance. */
export const startSessionSchema = z.object({
  pathology: z.enum([
    "LOMBALGIE_COMMUNE",
    "ARTHROSE_GENOU",
    "ARTHROSE_HANCHE",
    "POLYARTHRITE_RHUMATOIDE",
    "SPONDYLOARTHRITE_AXIALE",
    "OSTEOPOROSE",
  ]),
  douleurAvant: z.number().int().min(0).max(10).optional(),
  fatigueAvant: z.number().int().min(0).max(10).optional(),
  etatGeneralAvant: z.string().max(500).optional(),
});

export type StartSessionInput = z.infer<typeof startSessionSchema>;

/** §69 « Feedback après séance » : clôture d'une séance (in_progress ->
 * completed | abandoned). `realisee = false` correspond à un abandon ; dans
 * ce cas le reste du feedback détaillé reste optionnel (§69 ne l'impose pas
 * pour une séance non réalisée). */
export const completeSessionSchema = z
  .object({
    realisee: z.boolean(),
    difficulte: z.enum(["facile", "adaptee", "difficile", "tres_difficile"]).optional(),
    douleurApres: z.number().int().min(0).max(10).optional(),
    fatigueApres: z.number().int().min(0).max(10).optional(),
    ressenti: z.string().max(2000).optional(),
    // Réf. B13 (31/08/2026) : liste des exercices prescrits que le patient
    // déclare avoir effectivement faits — sert à calculer `completion_level`
    // (packages/domain/src/sessions.ts, `computeSessionCompletionLevel`).
    // Optionnel : une séance sans programme (aucun exercice prescrit) ne
    // fournit simplement rien ici.
    completedExerciseIds: z.array(z.string().uuid()).optional(),
  })
  .refine((data) => data.realisee || data.difficulte === undefined, {
    message: "La difficulté ne peut être renseignée que si la séance a été réalisée.",
    path: ["difficulte"],
  });

export type CompleteSessionInput = z.infer<typeof completeSessionSchema>;

/** Réf. B11 (31/08/2026) : démarrer une séance depuis la « séance du jour »
 * planifiée — `plannedSessionId` est optionnel, purement une propagation de
 * contexte pour lier la séance réelle à la ligne `planned_sessions`
 * correspondante (aucune conséquence clinique par elle-même). */
export const startSessionWithPlanningSchema = startSessionSchema.extend({
  plannedSessionId: z.string().uuid().optional(),
});

/**
 * Sprint 29 (22/09/2026, message direct de Dr Nikiema) : « Le patient doit
 * pouvoir faire ses exercices sans passer par l'appli et renseigner plus
 * tard dans l'appli puis enregistrer. » Contrairement à `startSessionSchema`
 * + `completeSessionSchema` (deux appels, séance déjà en cours), ce schéma
 * couvre une séance déclarée A POSTERIORI en un seul envoi : la date réelle
 * de la séance (`date`, jamais dans le futur — on ne peut pas déclarer une
 * séance qui n'a pas encore eu lieu) plus tous les champs de vérification ET
 * de feedback réunis, puisque les deux étapes ont déjà eu lieu hors de
 * l'application au moment de la saisie.
 */
export const declareSessionSchema = z
  .object({
    pathology: z.enum([
      "LOMBALGIE_COMMUNE",
      "ARTHROSE_GENOU",
      "ARTHROSE_HANCHE",
      "POLYARTHRITE_RHUMATOIDE",
      "SPONDYLOARTHRITE_AXIALE",
      "OSTEOPOROSE",
    ]),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (format attendu AAAA-MM-JJ)."),
    douleurAvant: z.number().int().min(0).max(10).optional(),
    fatigueAvant: z.number().int().min(0).max(10).optional(),
    etatGeneralAvant: z.string().max(500).optional(),
    realisee: z.boolean(),
    difficulte: z.enum(["facile", "adaptee", "difficile", "tres_difficile"]).optional(),
    douleurApres: z.number().int().min(0).max(10).optional(),
    fatigueApres: z.number().int().min(0).max(10).optional(),
    ressenti: z.string().max(2000).optional(),
    completedExerciseIds: z.array(z.string().uuid()).optional(),
  })
  .refine((data) => data.realisee || data.difficulte === undefined, {
    message: "La difficulté ne peut être renseignée que si la séance a été réalisée.",
    path: ["difficulte"],
  })
  // Correctif Sprint 33 (24/09/2026) : comparait auparavant la FIN de la
  // journée déclarée (T23:59:59.999) à l'instant présent, ce qui rejetait
  // systématiquement une déclaration pour AUJOURD'HUI (le cas le plus
  // fréquent) — « 23:59:59.999 aujourd'hui » est presque toujours dans le
  // futur par rapport à « maintenant ». On compare désormais le DÉBUT de la
  // journée déclarée : une date d'aujourd'hui ou d'hier est toujours
  // acceptée, seule une date strictement future reste refusée. Signalé par
  // Dr Nikiema (« certains champs sont invalides et l'enregistrement
  // échoue » en renseignant une séance hors application).
  .refine((data) => new Date(`${data.date}T00:00:00.000`).getTime() <= Date.now(), {
    message: "La date ne peut pas être dans le futur.",
    path: ["date"],
  });

export type DeclareSessionInput = z.infer<typeof declareSessionSchema>;

/** Réf. B11 : report d'une séance planifiée, « sans pénalisation » — aucune
 * limite numérique de report n'a été chiffrée par Dr Nikiema ; la seule
 * contrainte imposée ici est que la nouvelle date soit strictement dans le
 * futur (une séance ne peut pas être reportée dans le passé). */
export const postponePlannedSessionSchema = z.object({
  newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (format attendu AAAA-MM-JJ)."),
});

/**
 * §35-38 (Sprint 8) : saisie d'une mesure de suivi. Une union discriminée par
 * `measurementType` pour que chaque type ne puisse porter que ses champs
 * pertinents (§35 poids, §36 tour de taille, §37 tension, §38 glycémie).
 */
export const measurementSchema = z.discriminatedUnion("measurementType", [
  z.object({
    measurementType: z.literal("poids"),
    weightKg: z.number().positive().max(400),
    recordedAt: z.string().optional(),
  }),
  z.object({
    measurementType: z.literal("tour_de_taille"),
    waistCircumferenceCm: z.number().positive().max(300),
    recordedAt: z.string().optional(),
  }),
  z.object({
    measurementType: z.literal("tension_arterielle"),
    systolicMmhg: z.number().int().positive().max(300),
    diastolicMmhg: z.number().int().positive().max(200),
    heartRateBpm: z.number().int().positive().max(250).optional(),
    recordedAt: z.string().optional(),
  }),
  z.object({
    measurementType: z.literal("glycemie"),
    glycemiaValue: z.number().positive().max(100),
    glycemiaUnit: z.enum(["g_l", "mmol_l"]),
    recordedAt: z.string().optional(),
  }),
]);

export type MeasurementInput = z.infer<typeof measurementSchema>;

/**
 * Sprint 26 (21/09/2026) : enregistrement d'une activité physique
 * (chronomètre ou suivi de marche/vélo GPS, Sprint 25) dans l'historique.
 * `distanceMeters` reste facultatif — non pertinent pour aérobie/fitness/
 * natation/autre (voir `isGpsTrackedActivityType`, packages/domain/src/
 * physicalActivities.ts) ; le serveur ne l'exige jamais, il se contente de
 * l'enregistrer si présent. Durée plafonnée à 6 heures (garde-fou anti
 * saisie aberrante, pas une limite clinique).
 */
export const physicalActivitySchema = z.object({
  activityType: z.enum(PHYSICAL_ACTIVITY_TYPES),
  durationSeconds: z.number().int().positive().max(6 * 60 * 60),
  distanceMeters: z.number().nonnegative().max(200_000).optional(),
  startedAt: z.string(),
  completedAt: z.string(),
});

export type PhysicalActivityInput = z.infer<typeof physicalActivitySchema>;

/**
 * §33, réf. B10 (20/08/2026), Sprint 18 : saisie d'une évaluation de
 * capacité fonctionnelle. PSFS est une saisie patient complète (3 à 5
 * activités nommées, méthodologie standard de l'instrument — voir
 * packages/domain/src/functionalCapacity.ts). PROMIS n'accepte QUE
 * l'enregistrement d'un score déjà obtenu ailleurs (T-score + erreur
 * standard) : aucune administration de l'algorithme adaptatif n'est
 * implémentée (§57, §59 — voir le commentaire de tête de
 * infra/db/migrations/0015_functional_capacity.sql).
 */
export const functionalCapacityAssessmentSchema = z.discriminatedUnion("instrument", [
  z.object({
    instrument: z.literal("psfs"),
    activities: z
      .array(
        z.object({
          activityLabel: z.string().trim().min(1).max(200),
          difficultyScore: z.number().int().min(0).max(10),
        })
      )
      .min(3)
      .max(5),
    assessedAt: z.string().optional(),
  }),
  z.object({
    instrument: z.literal("promis_pf_cat"),
    promisTScore: z.number().min(0).max(100),
    promisStandardError: z.number().min(0).max(20).optional(),
    assessedAt: z.string().optional(),
  }),
]);
export type FunctionalCapacityAssessmentInput = z.infer<typeof functionalCapacityAssessmentSchema>;

/** §40, §71 (Sprint 10) : demande de génération du rapport PDF. `from`/`to`
 * sont optionnels (défaut : les 30 derniers jours, appliqué côté route).
 * `userNote` est un texte librement rédigé par l'utilisateur lui-même — pas
 * une donnée clinique calculée, donc pas de contrainte de contenu au-delà
 * de la longueur. */
export const reportRequestSchema = z.object({
  pathology: z.enum([
    "LOMBALGIE_COMMUNE",
    "ARTHROSE_GENOU",
    "ARTHROSE_HANCHE",
    "POLYARTHRITE_RHUMATOIDE",
    "SPONDYLOARTHRITE_AXIALE",
    "OSTEOPOROSE",
  ]),
  from: z.string().optional(),
  to: z.string().optional(),
  userNote: z.string().max(2000).optional(),
});

export type ReportRequestInput = z.infer<typeof reportRequestSchema>;

/**
 * Espace administrateur (§42, Sprint 13). Ces schémas valident les écritures
 * ADMINISTRATEUR côté serveur (§46) — la clé service_role qui exécute ces
 * écritures contourne RLS, donc la validation applicative est ici la seule
 * ligne de défense sur la forme des données, en plus du contrôle de rôle
 * (voir apps/web/src/lib/adminAuth.ts).
 */

const PATHOLOGY_CODE_ENUM = z.enum([
  "LOMBALGIE_COMMUNE",
  "ARTHROSE_GENOU",
  "ARTHROSE_HANCHE",
  "POLYARTHRITE_RHUMATOIDE",
  "SPONDYLOARTHRITE_AXIALE",
  "OSTEOPOROSE",
]);

export const adminUserStatusSchema = z.object({
  status: z.enum(["active", "suspended"]),
});
export type AdminUserStatusInput = z.infer<typeof adminUserStatusSchema>;

/** §41, Sprint 23 : le patient invite un professionnel par son email — le
 * professionnel doit déjà avoir un compte (rôle attribué par l'admin,
 * `/admin/utilisateurs`) ; on ne crée jamais de compte depuis cet écran. */
export const professionalLinkInviteSchema = z.object({
  // .toLowerCase() (22/09/2026) — même correctif que signUpSchema.email.
  professionalEmail: z.string().trim().toLowerCase().email("Email invalide."),
});
export type ProfessionalLinkInviteInput = z.infer<typeof professionalLinkInviteSchema>;

/** §41 : action du patient (annuler/révoquer/réinviter) ou du professionnel
 * (accepter/décliner) sur un lien existant — la transition exacte permise
 * est vérifiée via `canTransitionProfessionalLinkStatus` (packages/domain/src/professional.ts)
 * ET par les policies RLS (migration 0021), jamais par ce schéma seul. */
export const professionalLinkStatusSchema = z.object({
  status: z.enum(["pending", "authorized", "revoked"]),
});
export type ProfessionalLinkStatusInput = z.infer<typeof professionalLinkStatusSchema>;

export const adminUserRoleSchema = z.object({
  role: z.enum(["patient", "professional", "admin"]),
});
export type AdminUserRoleInput = z.infer<typeof adminUserRoleSchema>;

export const pathologyUpsertSchema = z.object({
  code: z.string().trim().min(1),
  nameFr: z.string().trim().min(1),
  description: z.string().max(2000).optional(),
  moduleVersion: z.string().trim().min(1).default("V1.0"),
  active: z.boolean().default(true),
});
export type PathologyUpsertInput = z.infer<typeof pathologyUpsertSchema>;

export const scientificReferenceUpsertSchema = z.object({
  title: z.string().trim().min(1),
  authors: z.string().trim().min(1),
  journal: z.string().trim().optional(),
  year: z.number().int().min(1950).max(2100),
  doi: z.string().trim().optional(),
  url: z.string().trim().url().optional().or(z.literal("")),
  organization: z.string().trim().min(1),
  pathologies: z.array(z.string()).default([]),
  recommendationSummary: z.string().trim().min(1).max(4000),
  evidenceLevel: z.string().trim().optional(),
  lastChecked: z.string().optional(),
});
export type ScientificReferenceUpsertInput = z.infer<typeof scientificReferenceUpsertSchema>;

/** §26 : mêmes champs que `packages/domain/src/exercises.ts#Exercise`, tous
 * facultatifs sauf le strict minimum (nom, description courte, catégorie) —
 * la plupart restent `TODO_MEDICAL_VALIDATION` tant que le concepteur
 * médical ne les a pas renseignés (§58), ce n'est pas une erreur de saisie. */
export const exerciseUpsertSchema = z.object({
  name: z.string().trim().min(1),
  shortDescription: z.string().trim().min(1).max(500),
  detailedDescription: z.string().max(4000).optional(),
  category: z.enum(["aerobique", "renforcement", "mobilite", "equilibre", "controle_moteur", "fonctionnel"]),
  // §28, réf. B8 : facultatif — un exercice peut rester non classé (voir
  // packages/domain/src/exercises.ts#EXERCISE_PHASES), jamais de valeur par défaut devinée.
  phase: z.enum(["echauffement", "principal", "retour_au_calme"]).optional(),
  difficulty: z.string().max(100).optional(),
  // §58, Sprint 24 (14/09/2026, Q2 validée) : format affiché au patient,
  // distinct de `difficulty` ci-dessus (texte libre, documentation interne).
  difficultyLevel: z.enum(["debutant", "intermediaire", "avance"]).optional(),
  startingPosition: z.string().max(1000).optional(),
  executionSteps: z.string().max(4000).optional(),
  breathingInstruction: z.string().max(1000).optional(),
  durationSeconds: z.number().int().positive().optional(),
  repetitions: z.number().int().positive().optional(),
  sets: z.number().int().positive().optional(),
  restTimeSeconds: z.number().int().nonnegative().optional(),
  frequency: z.string().max(200).optional(),
  intensity: z.string().max(200).optional(),
  // §58, Sprint 24 (14/09/2026, Q2 validée) : fourchette Borg CR10 affichée
  // au patient, distincte de `intensity` ci-dessus (texte libre interne).
  intensityBorgMin: z.number().int().min(0).max(10).optional(),
  intensityBorgMax: z.number().int().min(0).max(10).optional(),
  progression: z.string().max(1000).optional(),
  regression: z.string().max(1000).optional(),
  contraindications: z.string().max(2000).optional(),
  precautions: z.string().max(2000).optional(),
  stopCriteria: z.string().max(2000).optional(),
  targetMuscles: z.string().max(500).optional(),
  equipmentRequired: z.array(z.enum(["chaise", "mur", "tapis", "serviette", "bouteille_eau", "elastique", "aucun"])).default([]),
  videoUrl: z.string().trim().url().optional().or(z.literal("")),
  audioPreparationUrl: z.string().trim().url().optional().or(z.literal("")),
  audioExerciseUrl: z.string().trim().url().optional().or(z.literal("")),
  thumbnailUrl: z.string().trim().url().optional().or(z.literal("")),
  pathologies: z.array(PATHOLOGY_CODE_ENUM).default([]),
  objectives: z.array(z.string()).default([]),
  scientificReferenceIds: z.array(z.string()).default([]),
}).refine(
  (data) => data.intensityBorgMin === undefined || data.intensityBorgMax === undefined || data.intensityBorgMin <= data.intensityBorgMax,
  { message: "La borne basse de l'intensité Borg doit être inférieure ou égale à la borne haute.", path: ["intensityBorgMin"] }
);
export type ExerciseUpsertInput = z.infer<typeof exerciseUpsertSchema>;

export const exerciseStatusSchema = z.object({
  medicalValidationStatus: z.enum(["draft", "pending_validation", "validated"]),
});
export type ExerciseStatusInput = z.infer<typeof exerciseStatusSchema>;

/** §67-68 : mêmes champs que `packages/domain/src/programs.ts#Program`. */
export const programUpsertSchema = z.object({
  programCode: z.string().trim().min(1),
  pathology: PATHOLOGY_CODE_ENUM,
  profileLevel: z.enum(["debutant", "intermediaire", "avance"]),
  objective: z.string().max(200).optional(),
  durationWeeks: z.number().int().positive().optional(),
  frequencyPerWeek: z.number().int().positive().optional(),
  intensity: z.string().max(200).optional(),
  aerobicComponent: z.string().max(1000).optional(),
  strengthComponent: z.string().max(1000).optional(),
  mobilityComponent: z.string().max(1000).optional(),
  balanceComponent: z.string().max(1000).optional(),
  functionalComponent: z.string().max(1000).optional(),
  progressionRule: z.string().max(1000).optional(),
  regressionRule: z.string().max(1000).optional(),
  safetyRules: z.string().max(2000).optional(),
  scientificReferenceIds: z.array(z.string()).default([]),
  exerciseIds: z.array(z.string()).default([]),
});
export type ProgramUpsertInput = z.infer<typeof programUpsertSchema>;

export const programStatusSchema = z.object({
  medicalValidationStatus: z.enum(["draft", "pending_validation", "validated"]),
});
export type ProgramStatusInput = z.infer<typeof programStatusSchema>;

/** §31, §43 : une règle clinique. `condition` est vérifiée par
 * `isValidRuleCondition` (packages/domain/src/rules.ts) côté route, pas ici
 * — zod valide la forme JSON générique, la validation métier de la
 * condition elle-même est un cas plus riche que zod n'exprime pas bien. */
export const clinicalRuleUpsertSchema = z.object({
  ruleId: z.string().trim().min(1),
  pathology: PATHOLOGY_CODE_ENUM,
  condition: z.record(z.string(), z.unknown()),
  severity: z.enum(["info", "warning", "critical"]),
  action: z.enum(["allow_program", "require_precaution", "medical_referral", "adjust_progression", "stop_program"]),
  message: z.string().trim().min(1).max(2000),
  referenceId: z.string().trim().optional(),
  programId: z.string().trim().optional(),
  progressionDecision: z.enum(PROGRESSION_DECISIONS).optional(),
  validatedBy: z.string().trim().optional(),
  validatedDate: z.string().optional(),
});
export type ClinicalRuleUpsertInput = z.infer<typeof clinicalRuleUpsertSchema>;

export const clinicalRuleActiveSchema = z.object({
  active: z.boolean(),
});
export type ClinicalRuleActiveInput = z.infer<typeof clinicalRuleActiveSchema>;

/**
 * §47, §48 (Sprint 14). `subscriptionRequestSchema` : le patient ne peut
 * demander qu'un plan PREMIUM (le plan `free` est l'état par défaut, on ne
 * le "demande" pas). `paymentClaimSchema` : le patient déclare avoir payé
 * et fournit une référence — jamais un statut, qui reste exclusivement
 * décidé par un administrateur (voir apps/web/src/app/api/payments/route.ts
 * et la policy RLS correspondante, migration 0011).
 */
export const subscriptionRequestSchema = z.object({
  planCode: z.enum(["premium_monthly", "premium_yearly"]),
});
export type SubscriptionRequestInput = z.infer<typeof subscriptionRequestSchema>;

export const paymentClaimSchema = z.object({
  subscriptionId: z.string().trim().min(1),
  provider: z.enum(["orange_money", "moov_money", "mobile_money", "manual"]),
  amount: z.number().positive(),
  currency: z.string().trim().min(1).default("XOF"),
  externalReference: z.string().trim().min(1).max(200),
});
export type PaymentClaimInput = z.infer<typeof paymentClaimSchema>;

export const adminSubscriptionPlanUpsertSchema = z.object({
  planCode: z.enum(["free", "premium_monthly", "premium_yearly"]),
  nameFr: z.string().trim().min(1),
  priceAmount: z.number().positive().nullable(),
  priceCurrency: z.string().trim().min(1).default("XOF"),
  billingPeriod: z.enum(["monthly", "quarterly", "yearly"]).nullable(),
  paymentInstructionsFr: z.string().max(2000).optional(),
  active: z.boolean().default(true),
});
export type AdminSubscriptionPlanUpsertInput = z.infer<typeof adminSubscriptionPlanUpsertSchema>;

export const adminSubscriptionStatusSchema = z.object({
  status: z.enum(["active", "expired", "canceled"]),
});
export type AdminSubscriptionStatusInput = z.infer<typeof adminSubscriptionStatusSchema>;

export const adminPaymentStatusSchema = z.object({
  status: z.enum(["confirmed", "failed", "refunded"]),
  notes: z.string().max(1000).optional(),
});
export type AdminPaymentStatusInput = z.infer<typeof adminPaymentStatusSchema>;
