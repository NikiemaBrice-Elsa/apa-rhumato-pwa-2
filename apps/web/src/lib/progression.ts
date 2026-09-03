import { computeProgressionFacts, computeAdherencePercent, getWeekBounds, nextProfileLevel, type ProfileLevel } from "@apa/domain";
import { evaluateProgressionDecision, PROGRESSION_ENGINE_VERSION, MEDICAL_PARAMETER_REQUIRED } from "@apa/rules-engine";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadActiveClinicalRules } from "@/lib/clinicalRules";

export interface PathologyProgressionResult {
  pathology: string;
  decision: string;
  message: string | null;
  currentProfileLevel: string;
  currentProgramId: string;
  canProgressToLevel: ProfileLevel | null;
  matchedRuleId?: string;
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

  const facts = computeProgressionFacts(sessions, adherencePercent);

  const { rules, error: rulesError } = await loadActiveClinicalRules(supabase, pathology);
  if (rulesError) {
    return {
      pathology,
      decision: MEDICAL_PARAMETER_REQUIRED,
      message: null,
      currentProfileLevel: program.profile_level,
      currentProgramId: assignment.program_id,
      canProgressToLevel: null,
    };
  }

  const decisionResult = evaluateProgressionDecision(pathology as never, facts, rules);
  const matchedRule = decisionResult.matchedRuleId ? rules.find((r) => r.ruleId === decisionResult.matchedRuleId) : undefined;

  const canProgressToLevel =
    decisionResult.decision === "progress" ? nextProfileLevel(program.profile_level as ProfileLevel) : null;

  return {
    pathology,
    decision: decisionResult.decision,
    message: matchedRule?.message ?? null,
    currentProfileLevel: program.profile_level,
    currentProgramId: assignment.program_id,
    canProgressToLevel,
    matchedRuleId: decisionResult.matchedRuleId,
  };
}

export { PROGRESSION_ENGINE_VERSION };
