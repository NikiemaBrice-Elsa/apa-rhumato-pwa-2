import type { PathologyCode } from "./pathologies";
import type { Facts } from "./rules";
import type { ExercisePhase } from "./exercises";

/**
 * §69 « Feedback après séance » : les quatre niveaux de difficulté ressentie
 * proposés au patient à la clôture. Repris tel quel du cahier des charges —
 * aucun seuil numérique associé n'est inventé ici (voir
 * docs/MEDICAL_VALIDATION_NEEDED.md pour ce qui reste à valider en aval,
 * ex. règles de progression/régression, Sprint 8).
 */
export const DIFFICULTY_LEVELS = ["facile", "adaptee", "difficile", "tres_difficile"] as const;
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

export const DIFFICULTY_LABELS_FR: Record<DifficultyLevel, string> = {
  facile: "Facile",
  adaptee: "Adaptée",
  difficile: "Difficile",
  tres_difficile: "Très difficile",
};

export const SESSION_STATUSES = ["in_progress", "completed", "abandoned"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

/** Reflète la table `sessions` (§28, §69, Sprint 7). */
export interface Session {
  id: string;
  userId: string;
  programId?: string | null;
  pathology: PathologyCode;
  status: SessionStatus;
  douleurAvant?: number | null;
  fatigueAvant?: number | null;
  etatGeneralAvant?: string | null;
  realisee?: boolean | null;
  difficulte?: DifficultyLevel | null;
  douleurApres?: number | null;
  fatigueApres?: number | null;
  ressenti?: string | null;
  startedAt: string;
  completedAt?: string | null;
  createdAt: string;
  /** §29, §33, réf. B13 (31/08/2026) — niveau de complétude du CONTENU de la
   * séance (fraction d'exercices cochés comme faits), distinct de `realisee`
   * (déclaratif global). Calculé uniquement à la clôture d'une séance
   * `realisee = true` avec au moins un exercice prescrit — voir
   * `computeSessionCompletionLevel` ci-dessous. `null` tant qu'il ne peut pas
   * être évalué (séance sans programme, séance abandonnée, ancienne séance
   * antérieure à ce champ) — jamais deviné. */
  completionLevel?: "complete" | "partial" | null;
  plannedSessionId?: string | null;
}

/** Ligne de `session_exercises` (§28 étape 4) — exercices figés au démarrage
 * de la séance, indépendamment d'une évolution ultérieure du programme.
 * `phase` (Sprint 18, §28, réf. B8) est copiée depuis `exercise_library.phase`
 * au moment du démarrage, pour la même raison que `orderIndex` : figée,
 * jamais recalculée si l'exercice est reclassé ultérieurement. */
export interface SessionExercise {
  sessionId: string;
  exerciseId: string;
  orderIndex: number;
  phase?: ExercisePhase | null;
  completed: boolean;
}

/**
 * §29, §33 — réf. B13 (« Validez-vous la formule de calcul de l'adhésion
 * actuellement implémentée ? »), réponse complétée le 31/08/2026 : la
 * formule doit être ajustée en 2 indicateurs — (1) séances complètes /
 * séances prescrites, (2) dose réellement réalisée / dose prescrite —
 * avec une séance « complète » définie par un seuil ≥ 80 % de la durée OU
 * du contenu prévu (les deux formulations sont explicitement proposées par
 * Dr Nikiema). La durée cible par séance n'étant pas trackée (aucun champ
 * de ce type dans `programs`/`session_exercises`), c'est le CONTENU
 * (fraction d'exercices prescrits effectivement cochés comme faits) qui est
 * retenu ici — un des deux critères qu'il a lui-même explicitement proposés,
 * pas une interprétation inventée.
 */
export const SESSION_COMPLETION_CONTENT_THRESHOLD = 0.8;

/**
 * Niveau de complétude d'une séance (réf. B13, 31/08/2026) à partir du
 * nombre d'exercices prescrits effectivement cochés comme faits par le
 * patient (`session_exercises.completed`). Fonction pure, aucune décision
 * clinique : `null` si `totalExerciseCount` est 0 (aucun exercice prescrit
 * — impossible d'évaluer un contenu qui n'existe pas, jamais un niveau
 * deviné par défaut).
 */
export function computeSessionCompletionLevel(
  completedExerciseCount: number,
  totalExerciseCount: number
): "complete" | "partial" | null {
  if (totalExerciseCount <= 0) return null;
  const fraction = Math.max(0, completedExerciseCount) / totalExerciseCount;
  return fraction >= SESSION_COMPLETION_CONTENT_THRESHOLD ? "complete" : "partial";
}

/**
 * Seuil de « douleur d'exercice » tolérable, tel que chiffré explicitement
 * par Dr Nikiema le 20/08/2026 (réf. B2 : « douleur d'exercice ≤ 3/10 sans
 * aggravation durable » comme critère de progression). Réutilisé ici tel
 * quel, jamais un nouveau seuil inventé — voir `computeProgressionFacts`
 * ci-dessous.
 */
export const EXERCISE_PAIN_TOLERABLE_THRESHOLD = 3;

/**
 * Seuil de fatigue « excessive » après séance, réponse A de la Question 1
 * de `QUESTIONS_PROGRESSION_REGRESSION_20260823.docx` (30/08/2026) : même
 * convention que la douleur — fatigueApres >= 7/10 = signal de vigilance
 * (pas de progression sur cette seule base, sans déclencher à elle seule
 * une régression, voir PROGRESSION_SIGNALS ci-dessous).
 */
export const PROGRESSION_FATIGUE_VIGILANCE_THRESHOLD = 7;

/**
 * Seuil de douleur « critique » (signal prioritaire sur les règles de
 * progression, réponse à la Question 2 : « Tout signal rouge... prime sur
 * les règles de progression »). PAS un nouveau seuil : reprend exactement
 * le seuil rouge transversal déjà validé (réf. B1, 20/08/2026,
 * `PAIN_ROUGE_*` dans infra/db/seed/0008_...sql, `douleur >= 7`), appliqué
 * ici à la douleur ressentie APRÈS une séance plutôt qu'au dépistage.
 */
export const PROGRESSION_PAIN_CRITICAL_THRESHOLD = 7;

/**
 * Classification synthétique du signal de la dernière séance (§29, §58,
 * §70 ; réponses du 30/08/2026 à `QUESTIONS_PROGRESSION_REGRESSION_
 * 20260823.docx`) :
 *   - "critique" : douleur après séance >= seuil rouge transversal — prime
 *     sur tout le reste (« tout signal rouge... prime sur les règles de
 *     progression »).
 *   - "repete" : le MÊME signal négatif (douleur non tolérée persistant
 *     au-delà de 24h, fatigue >= 7/10, ou difficulté « très difficile »)
 *     est présent sur les 2 dernières séances consécutives.
 *   - "isole" : un signal négatif est présent sur la dernière séance
 *     seulement (pas de répétition) — « 1 séance isolée = maintien ».
 *   - "aucun" : aucun des signaux ci-dessus, sur la base des données
 *     disponibles.
 * Cette classification est un FAIT dérivé, pas une décision : la décision
 * elle-même (progress/maintain/reduce/suspend) reste portée par les règles
 * `clinical_rules` (action `adjust_progression`), jamais codée en dur ici
 * (§30 : le contenu médical vit dans les données, pas dans le code).
 */
export const PROGRESSION_SIGNALS = ["aucun", "isole", "repete", "critique"] as const;
export type ProgressionSignal = (typeof PROGRESSION_SIGNALS)[number];

/**
 * Dérive des faits de progression/régression (§29, §58, §70) à partir d'un
 * historique de séances déjà enregistré et du taux d'adhésion de la
 * semaine (déjà calculé par `computeAdherencePercent`, `statistics.ts`,
 * Sprint 9) — fonction pure, aucune décision clinique prise ici (§57,
 * §59 : ne jamais inventer une donnée médicale).
 *
 * Sprint 17 (suite 4, 23/08/2026) : construit strictement à partir de ce
 * que Dr Nikiema a explicitement chiffré dans ses réponses B2 (adhésion
 * ≥ 80 %, douleur d'exercice ≤ 3/10, retour au niveau habituel sous 24h)
 * et B9 (aggravation de la douleur au-delà de 24h = signal de régression).
 *
 * Sprint 18 (30/08/2026) : complété avec ses réponses à
 * `QUESTIONS_PROGRESSION_REGRESSION_20260823.docx` — seuil de fatigue
 * excessive (Q1), distinction signal isolé/répété/critique (Q2),
 * synthétisée dans le fait `progression_signal`. Reste volontairement
 * silencieux sur ce que ces réponses ne chiffrent toujours pas :
 * gonflement/raideur et baisse fonctionnelle (non trackés par `sessions`
 * ni `measurements` à ce jour — réponse Q3 : démarrer avec les critères
 * déjà chiffrés, ajouter le reste dans un second temps si nécessaire).
 *
 * 24 règles `adjust_progression` réelles sont désormais actives (une par
 * décision × 6 pathologies, `infra/db/seed/0014_adjust_progression_rules_
 * dr_nikiema_20260831.sql`) et `evaluateProgressionDecision` est câblé
 * depuis `apps/web/src/app/api/statistics/progression/route.ts` — la
 * décision reste toujours un AFFICHAGE INFORMATIF (réponse Q4 : « ne
 * modifie jamais automatiquement le programme du patient »), toute
 * bascule de niveau reste une action volontaire du patient (voir
 * `apps/web/src/app/api/programs/progress/route.ts`).
 *
 * `recentSessions` doit être trié de la plus récente à la plus ancienne
 * (ex. `.order("started_at", { ascending: false })`), séances `completed`
 * de préférence — au moins la dernière séance ; les deux dernières sont
 * nécessaires pour la détection d'un signal répété.
 */
export function computeProgressionFacts(recentSessions: Session[], adherencePercentThisWeek: number | null | undefined): Facts {
  const facts: Record<string, boolean | number | string> = {};

  if (typeof adherencePercentThisWeek === "number") {
    facts.adherence_percent_semaine = adherencePercentThisWeek;
  }

  const [last, previous] = recentSessions;

  if (last) {
    if (typeof last.realisee === "boolean") facts.derniere_seance_realisee = last.realisee;
    if (typeof last.douleurApres === "number") facts.douleur_apres_derniere_seance = last.douleurApres;
    if (typeof last.fatigueApres === "number") facts.fatigue_apres_derniere_seance = last.fatigueApres;
    if (last.difficulte) facts.difficulte_derniere_seance = last.difficulte;
  }

  // B9 : « aggravation de la douleur au-delà de 24h ». Compare la douleur
  // ressentie à la FIN de l'avant-dernière séance (`previous.douleurApres`)
  // à celle ressentie au DÉBUT de la dernière séance (`last.douleurAvant`),
  // uniquement si celle-ci a démarré au moins 24h après le début de la
  // précédente. Seuil réutilisé : > 3/10 (EXERCISE_PAIN_TOLERABLE_THRESHOLD),
  // exactement la valeur donnée par Dr Nikiema pour la douleur d'exercice
  // tolérable (B2) — pas un nouveau seuil inventé.
  let douleurAggravationPersistante24h: boolean | undefined;
  if (last && previous && typeof previous.douleurApres === "number" && typeof last.douleurAvant === "number") {
    const hoursBetween = (new Date(last.startedAt).getTime() - new Date(previous.startedAt).getTime()) / 3_600_000;
    if (hoursBetween >= 24) {
      douleurAggravationPersistante24h =
        previous.douleurApres > EXERCISE_PAIN_TOLERABLE_THRESHOLD && last.douleurAvant > EXERCISE_PAIN_TOLERABLE_THRESHOLD;
      facts.douleur_aggravation_persistante_24h = douleurAggravationPersistante24h;
    }
  }

  // Q2 (30/08/2026) : « 2 séances consécutives avec le même signal négatif »
  // pour la fatigue et la difficulté — pas de contrainte de délai de 24h
  // donnée pour ces deux axes (contrairement à la douleur, B9), donc
  // simplement les 2 dernières séances, dans l'ordre où elles ont eu lieu.
  const fatigueRepetee =
    typeof last?.fatigueApres === "number" &&
    typeof previous?.fatigueApres === "number" &&
    last.fatigueApres >= PROGRESSION_FATIGUE_VIGILANCE_THRESHOLD &&
    previous.fatigueApres >= PROGRESSION_FATIGUE_VIGILANCE_THRESHOLD;
  if (fatigueRepetee) facts.fatigue_elevee_repetee_2_seances = true;

  const difficulteRepetee =
    last?.difficulte === "tres_difficile" && previous?.difficulte === "tres_difficile";
  if (difficulteRepetee) facts.difficulte_tres_difficile_repetee_2_seances = true;

  // Synthèse `progression_signal` — voir le commentaire de PROGRESSION_SIGNALS.
  // Ordre de priorité : critique > repete > isole > aucun. N'est calculé QUE
  // s'il existe au moins une donnée exploitable sur la dernière séance
  // (jamais "aucun" par défaut sur une séance sans aucun retour, ce serait
  // une conclusion inventée).
  if (last) {
    const lastPainCritical = typeof last.douleurApres === "number" && last.douleurApres >= PROGRESSION_PAIN_CRITICAL_THRESHOLD;
    const lastPainExceedsTolerable = typeof last.douleurApres === "number" && last.douleurApres > EXERCISE_PAIN_TOLERABLE_THRESHOLD;
    const lastFatigueElevee = typeof last.fatigueApres === "number" && last.fatigueApres >= PROGRESSION_FATIGUE_VIGILANCE_THRESHOLD;
    const lastDifficulteTresDifficile = last.difficulte === "tres_difficile";
    const hasAnySignalData = typeof last.douleurApres === "number" || typeof last.fatigueApres === "number" || Boolean(last.difficulte);

    if (lastPainCritical) {
      facts.progression_signal = "critique";
    } else if (douleurAggravationPersistante24h || fatigueRepetee || difficulteRepetee) {
      facts.progression_signal = "repete";
    } else if (lastPainExceedsTolerable || lastFatigueElevee || lastDifficulteTresDifficile) {
      facts.progression_signal = "isole";
    } else if (hasAnySignalData) {
      facts.progression_signal = "aucun";
    }
    // Sinon : aucune donnée exploitable sur la dernière séance -> pas de
    // clé `progression_signal` du tout (§57, §59 : ne jamais deviner).
  }

  return facts;
}
