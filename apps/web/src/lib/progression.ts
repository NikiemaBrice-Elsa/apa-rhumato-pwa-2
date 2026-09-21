import {
  computeProgressionFacts,
  computeAdherencePercent,
  computeMultiWeekAdherencePercent,
  computeFunctionalCapacityTrend,
  getWeekBounds,
  nextProfileLevel,
  PROGRESSION_WINDOW_WEEKS,
  type ProfileLevel,
  type FunctionalCapacityAssessment,
  type FunctionalCapacityTrend,
  type PsfsActivity,
} from "@apa/domain";
import { evaluateProgressionDecision, PROGRESSION_ENGINE_VERSION, MEDICAL_PARAMETER_REQUIRED } from "@apa/rules-engine";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadActiveClinicalRules } from "@/lib/clinicalRules";

/**
 * §29, §58 — document « système de progression » (21/09/2026, section A) :
 * jauge de progression vers le niveau suivant affichée sur le tableau de
 * bord. `null` quand il n'y a pas de niveau supérieur à viser (niveau
 * `avance`) — jamais une jauge inventée sans fenêtre de progression définie
 * (`PROGRESSION_WINDOW_WEEKS`, packages/domain/src/programs.ts).
 *
 * Volontairement PAS un pourcentage composite unique mélangeant adhésion
 * (continue) et signaux tout-ou-rien (aucun signal d'alerte, capacité
 * fonctionnelle) : Dr Nikiema n'a donné aucune pondération entre ces
 * critères, en inventer une serait un choix clinique non validé (§57, §59).
 * L'adhésion (le seul critère naturellement continu) alimente la barre de
 * progression ; les deux autres s'affichent en cases à cocher séparées,
 * `null` quand la donnée n'existe pas encore (jamais compté comme un échec).
 */
export interface ProgressionGaugeInfo {
  nextLevel: ProfileLevel;
  windowWeeks: number;
  adherenceWindowPercent: number | null;
  adherenceTargetPercent: number;
  noAlertSignal: boolean | null;
  functionalCapacityOk: boolean | null;
}

export interface PathologyProgressionResult {
  pathology: string;
  decision: string;
  message: string | null;
  currentProfileLevel: string;
  currentProgramId: string;
  canProgressToLevel: ProfileLevel | null;
  matchedRuleId?: string;
  gauge: ProgressionGaugeInfo | null;
}

/** Seuil d'adhésion pour la décision `progress` (document « système de
 * progression », 21/09/2026, section B — identique aux deux transitions).
 * Affiché ici comme `adherenceTargetPercent` de la jauge ; le seuil réel
 * appliqué à la décision reste porté par les règles `clinical_rules`
 * (§30 : jamais un seuil codé en dur côté moteur), cette constante ne sert
 * qu'à l'affichage de la jauge. */
const PROGRESSION_ADHERENCE_TARGET_PERCENT = 80;

interface FunctionalCapacityAssessmentRow {
  id: string;
  instrument: "psfs" | "promis_pf_cat";
  promis_t_score: number | null;
  promis_standard_error: number | null;
  assessed_at: string;
  psfs_activities: Array<{ id: string; activity_label: string; difficulty_score: number; order_index: number }> | null;
}

function mapAssessmentRow(userId: string, row: FunctionalCapacityAssessmentRow): FunctionalCapacityAssessment {
  const activities: PsfsActivity[] | undefined =
    row.instrument === "psfs"
      ? (row.psfs_activities ?? []).map((a) => ({
          id: a.id,
          assessmentId: row.id,
          activityLabel: a.activity_label,
          difficultyScore: a.difficulty_score,
          orderIndex: a.order_index,
        }))
      : undefined;

  return {
    id: row.id,
    userId,
    instrument: row.instrument,
    promisTScore: row.promis_t_score,
    promisStandardError: row.promis_standard_error,
    activities,
    assessedAt: row.assessed_at,
    createdAt: row.assessed_at,
  };
}

/**
 * Charge la tendance de capacité fonctionnelle (§29, §58, §70, document
 * « système de progression ») à partir des 2 évaluations les plus récentes
 * de l'utilisateur — la capacité fonctionnelle n'est pas propre à une
 * pathologie (`functional_capacity_assessments` n'a pas de colonne
 * `pathology`, voir migration 0015), donc partagée par toutes les
 * pathologies suivies. `null` si moins de 2 évaluations, ou si les 2 plus
 * récentes ne portent pas sur le même instrument (voir
 * `computeFunctionalCapacityTrend`).
 */
async function loadFunctionalCapacityTrend(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string
): Promise<FunctionalCapacityTrend | null> {
  const { data } = await supabase
    .from("functional_capacity_assessments")
    .select("id, instrument, promis_t_score, promis_standard_error, assessed_at, psfs_activities(*)")
    .eq("user_id", userId)
    .order("assessed_at", { ascending: false })
    .limit(2);

  const rows = (data ?? []) as unknown as FunctionalCapacityAssessmentRow[];
  if (rows.length < 2) return null;

  const [currentRow, previousRow] = rows;
  const current = mapAssessmentRow(userId, currentRow);
  const previous = mapAssessmentRow(userId, previousRow);
  return computeFunctionalCapacityTrend(previous, current);
}

/**
 * Calcule la décision de progression/régression (§29, §58, §70) pour UNE
 * pathologie, à partir des séances déjà enregistrées et du programme
 * actuellement assigné — logique factorisée pour être utilisée à
 * l'identique par `GET /api/statistics/progression` (affichage informatif)
 * ET `POST /api/programs/progress` (qui doit recalculer la même décision
 * côté serveur avant d'agir, §46 : ne jamais faire confiance à une valeur
 * envoyée par le client).
 *
 * Retourne `null` si l'utilisateur n'a pas de programme VALIDÉ actuellement
 * assigné pour cette pathologie — aucune notion de « niveau actuel » n'existe
 * alors, donc aucune décision de progression ne peut être évaluée.
 */
export async function computePathologyProgressionResult(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
  pathology: string
): Promise<PathologyProgressionResult | null> {
  const { data: assignment } = await supabase
    .from("user_program_assignments")
    .select("program_id, status, created_at")
    .eq("user_id", userId)
    .eq("pathology", pathology)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!assignment || assignment.status !== "assigned" || !assignment.program_id) {
    return null;
  }

  const { data: program } = await supabase
    .from("programs")
    .select("profile_level, frequency_per_week")
    .eq("program_id", assignment.program_id)
    .eq("medical_validation_status", "validated")
    .maybeSingle();

  if (!program) {
    return null;
  }

  const { data: recentSessions } = await supabase
    .from("sessions")
    .select("id, pathology, status, started_at, completed_at, douleur_avant, douleur_apres, fatigue_apres, difficulte, realisee")
    .eq("user_id", userId)
    .eq("pathology", pathology)
    .eq("status", "completed")
    .order("started_at", { ascending: false })
    .limit(2);

  const sessions = (recentSessions ?? []).map((s) => ({
    id: s.id,
    userId,
    pathology: s.pathology,
    status: s.status,
    douleurAvant: s.douleur_avant,
    douleurApres: s.douleur_apres,
    fatigueApres: s.fatigue_apres,
    difficulte: s.difficulte,
    realisee: s.realisee,
    startedAt: s.started_at,
    completedAt: s.completed_at,
    createdAt: s.started_at,
  }));

  const { weekStart, weekEnd } = getWeekBounds(new Date());
  const { data: sessionsThisWeek } = await supabase
    .from("sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("pathology", pathology)
    .eq("status", "completed")
    .gte("started_at", weekStart.toISOString())
    .lte("started_at", weekEnd.toISOString());

  const adherencePercent = computeAdherencePercent(
    (sessionsThisWeek ?? []).length,
    typeof program.frequency_per_week === "number" ? program.frequency_per_week : null
  );

  // Sprint 29 (21/09/2026, document « système de progression ») : fenêtre
  // multi-semaines et tendance de capacité fonctionnelle, propres au niveau
  // ACTUEL du patient — voir PROGRESSION_WINDOW_WEEKS (packages/domain/src/
  // programs.ts). `undefined` (niveau `avance`, pas de niveau supérieur) ->
  // aucune fenêtre à calculer, jamais un critère de progression inventé pour
  // un passage qui n'existe pas.
  const currentLevel = program.profile_level as ProfileLevel;
  const progressionWindowWeeks = PROGRESSION_WINDOW_WEEKS[currentLevel];

  let adherencePercentWindow: number | null = null;
  if (progressionWindowWeeks) {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - progressionWindowWeeks * 7);
    const { data: sessionsInWindow } = await supabase
      .from("sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("pathology", pathology)
      .eq("status", "completed")
      .gte("started_at", windowStart.toISOString());

    adherencePercentWindow = computeMultiWeekAdherencePercent(
      (sessionsInWindow ?? []).length,
      typeof program.frequency_per_week === "number" ? program.frequency_per_week : null,
      progressionWindowWeeks
    );
  }

  const functionalCapacityTrend = progressionWindowWeeks ? await loadFunctionalCapacityTrend(supabase, userId) : null;

  const facts = computeProgressionFacts(sessions, adherencePercent, {
    adherencePercentWindow,
    functionalCapacityTrend,
  });

  const nextLevel = nextProfileLevel(currentLevel);
  const gauge: ProgressionGaugeInfo | null =
    progressionWindowWeeks && nextLevel
      ? {
          nextLevel,
          windowWeeks: progressionWindowWeeks,
          adherenceWindowPercent: adherencePercentWindow,
          adherenceTargetPercent: PROGRESSION_ADHERENCE_TARGET_PERCENT,
          noAlertSignal: facts.progression_signal === undefined ? null : facts.progression_signal === "aucun",
          functionalCapacityOk:
            functionalCapacityTrend === null ? null : functionalCapacityTrend === "stable" || functionalCapacityTrend === "amelioree",
        }
      : null;

  const { rules, error: rulesError } = await loadActiveClinicalRules(supabase, pathology);
  if (rulesError) {
    return {
      pathology,
      decision: MEDICAL_PARAMETER_REQUIRED,
      message: null,
      currentProfileLevel: program.profile_level,
      currentProgramId: assignment.program_id,
      canProgressToLevel: null,
      gauge,
    };
  }

  const decisionResult = evaluateProgressionDecision(pathology as never, facts, rules);
  const matchedRule = decisionResult.matchedRuleId ? rules.find((r) => r.ruleId === decisionResult.matchedRuleId) : undefined;

  const canProgressToLevel = decisionResult.decision === "progress" ? nextLevel : null;

  return {
    pathology,
    decision: decisionResult.decision,
    message: matchedRule?.message ?? null,
    currentProfileLevel: program.profile_level,
    currentProgramId: assignment.program_id,
    canProgressToLevel,
    matchedRuleId: decisionResult.matchedRuleId,
    gauge,
  };
}

export { PROGRESSION_ENGINE_VERSION };
