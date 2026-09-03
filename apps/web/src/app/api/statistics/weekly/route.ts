import { NextResponse } from "next/server";
import { getWeekBounds, sessionDurationMinutes, computeAdherencePercent, computeAdherenceIndicators } from "@apa/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * §33 « Cette semaine » (séances réalisées, minutes d'activité, adhésion) —
 * Sprint 9.
 *
 * L'adhésion n'est calculée QUE si l'utilisateur a, pour au moins une de ses
 * pathologies, un programme VALIDÉ médicalement portant une fréquence cible
 * (`programs.frequency_per_week`) — jamais un pourcentage affiché sans
 * dénominateur réel (§29, §57, §59, voir docs/DECISIONS.md Sprint 8/9).
 * `adherenceBasis` explique toujours à l'utilisateur pourquoi une valeur est
 * ou n'est pas affichée (§79 : transparence plutôt qu'un vide inexpliqué).
 */
export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  const { weekStart, weekEnd } = getWeekBounds(new Date());

  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("id, status, completion_level, started_at, completed_at")
    .eq("user_id", user.id)
    .gte("started_at", weekStart.toISOString())
    .lte("started_at", weekEnd.toISOString());

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const completedSessions = (sessions ?? []).filter((s) => s.status === "completed");
  const sessionsCompleted = completedSessions.length;
  const completeLevelSessionIds = completedSessions.filter((s) => s.completion_level === "complete").map((s) => s.id);
  const totalActiveMinutes = completedSessions.reduce((sum, s) => {
    const minutes = sessionDurationMinutes(s.started_at, s.completed_at);
    return sum + (minutes ?? 0);
  }, 0);

  // Fréquence cible : somme des `frequency_per_week` des programmes
  // VALIDÉS actuellement attribués (défense en profondeur en plus de la RLS
  // `programs_read_validated_only`, comme /api/programs et /api/sessions).
  const { data: assignments } = await supabase
    .from("user_program_assignments")
    .select("pathology, program_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const latestByPathology = new Map<string, { program_id: string | null }>();
  for (const row of assignments ?? []) {
    if (!latestByPathology.has(row.pathology)) {
      latestByPathology.set(row.pathology, { program_id: row.program_id });
    }
  }

  const programIds = Array.from(latestByPathology.values())
    .map((a) => a.program_id)
    .filter((id): id is string => Boolean(id));

  let targetFrequencyPerWeek: number | null = null;
  if (programIds.length > 0) {
    const { data: programs } = await supabase
      .from("programs")
      .select("frequency_per_week")
      .in("program_id", programIds)
      .eq("medical_validation_status", "validated");

    const frequencies = (programs ?? [])
      .map((p) => p.frequency_per_week)
      .filter((f): f is number => typeof f === "number" && f > 0);

    if (frequencies.length > 0) {
      targetFrequencyPerWeek = frequencies.reduce((sum, f) => sum + f, 0);
    }
  }

  const adherencePercent = computeAdherencePercent(sessionsCompleted, targetFrequencyPerWeek);

  // Réf. B13 (31/08/2026) : dose réelle / dose prescrite — exercices
  // prescrits cochés comme faits cette semaine / exercices prescrits cette
  // semaine, toutes séances confondues (pas seulement les séances déjà
  // évaluées `complete`, pour ne rien perdre du contenu partiellement fait).
  const allSessionIdsThisWeek = (sessions ?? []).map((s) => s.id);
  let completedExercisesThisWeek = 0;
  let prescribedExercisesThisWeek = 0;
  if (allSessionIdsThisWeek.length > 0) {
    const { data: exercisesThisWeek } = await supabase
      .from("session_exercises")
      .select("completed")
      .in("session_id", allSessionIdsThisWeek);
    prescribedExercisesThisWeek = exercisesThisWeek?.length ?? 0;
    completedExercisesThisWeek = (exercisesThisWeek ?? []).filter((row) => row.completed).length;
  }

  const { sessionsCompletionPercent, doseCompletionPercent } = computeAdherenceIndicators({
    completeSessionsThisWeek: completeLevelSessionIds.length,
    targetFrequencyPerWeek,
    completedExercisesThisWeek,
    prescribedExercisesThisWeek,
  });

  return NextResponse.json({
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    sessionsCompleted,
    totalActiveMinutes,
    adherencePercent,
    adherenceBasis: adherencePercent === null ? "no_validated_program_frequency" : "validated_program_frequency",
    // Réf. B13 : nouvelle formule à 2 indicateurs, affichée en remplacement
    // de l'ancien indicateur unique ci-dessus (conservé pour compatibilité
    // interne — voir packages/domain/src/statistics.ts).
    sessionsCompletionPercent,
    doseCompletionPercent,
  });
}
