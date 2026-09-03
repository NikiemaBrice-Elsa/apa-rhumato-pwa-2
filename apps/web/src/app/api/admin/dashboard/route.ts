import { NextResponse } from "next/server";
import {
  computeAdherencePercent,
  computeAdminDashboardStats,
  computeGlobalAdherenceStats,
  getWeekBounds,
  ADMIN_DASHBOARD_ACTIVE_USER_WINDOW_DAYS,
  ADMIN_DASHBOARD_NEW_USER_WINDOW_DAYS,
} from "@apa/domain";
import { requireAdmin } from "@/lib/adminAuth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/serviceRole";

/**
 * §64 « Tableau de bord administrateur ». Toutes les statistiques sont des
 * comptages/agrégats (§64 : « anonymisées autant que possible ») — aucune
 * donnée nominative n'est renvoyée ici (pour la liste des utilisateurs
 * elle-même, voir GET /api/admin/users, qui EST nominative par nécessité de
 * gestion de compte).
 *
 * Abonnements/revenus (Sprint 14) et erreurs techniques (aucune
 * infrastructure de journalisation d'erreurs mise en place dans ce
 * scaffold) restent explicitement `null` — voir `computeAdminDashboardStats`
 * (packages/domain/src/admin.ts) pour la justification (§57, §59, §79).
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createSupabaseServiceRoleClient();
  const now = new Date();
  const activeSince = new Date(now.getTime() - ADMIN_DASHBOARD_ACTIVE_USER_WINDOW_DAYS * 86400000).toISOString();
  const newSince = new Date(now.getTime() - ADMIN_DASHBOARD_NEW_USER_WINDOW_DAYS * 86400000).toISOString();
  const { weekStart, weekEnd } = getWeekBounds(now);

  const [totalUsersRes, newUsersRes, recentSessionsRes, completedSessionsRes, thisWeekCompletedRes, exerciseRowsRes, assignmentsRes] =
    await Promise.all([
      supabase.from("users").select("id", { count: "exact", head: true }).neq("status", "deleted"),
      supabase.from("users").select("id", { count: "exact", head: true }).neq("status", "deleted").gte("created_at", newSince),
      supabase.from("sessions").select("user_id").gte("started_at", activeSince),
      supabase.from("sessions").select("user_id, pathology, program_id").eq("status", "completed"),
      supabase
        .from("sessions")
        .select("user_id")
        .eq("status", "completed")
        .gte("started_at", weekStart.toISOString())
        .lte("started_at", weekEnd.toISOString()),
      supabase.from("session_exercises").select("exercise_id").eq("completed", true),
      supabase
        .from("user_program_assignments")
        .select("user_id, pathology, program_id, created_at")
        .order("created_at", { ascending: false }),
    ]);

  const firstError = [totalUsersRes, newUsersRes, recentSessionsRes, completedSessionsRes, thisWeekCompletedRes, exerciseRowsRes, assignmentsRes].find(
    (r) => r.error
  )?.error;
  if (firstError) {
    return NextResponse.json({ message: firstError.message }, { status: 500 });
  }

  const activeUsers = new Set((recentSessionsRes.data ?? []).map((s) => s.user_id)).size;
  const sessionsCompleted = (completedSessionsRes.data ?? []).length;
  const programsPracticed = new Set(
    (completedSessionsRes.data ?? []).map((s) => s.program_id).filter((id): id is string => Boolean(id))
  ).size;

  const pathologyCountMap = new Map<string, number>();
  for (const s of completedSessionsRes.data ?? []) {
    pathologyCountMap.set(s.pathology, (pathologyCountMap.get(s.pathology) ?? 0) + 1);
  }

  const exerciseCountMap = new Map<string, number>();
  for (const row of exerciseRowsRes.data ?? []) {
    exerciseCountMap.set(row.exercise_id, (exerciseCountMap.get(row.exercise_id) ?? 0) + 1);
  }

  // Adhésion globale (§64) : dernière attribution par (utilisateur,
  // pathologie) -> fréquence cible = somme des `frequency_per_week` des
  // programmes VALIDÉS assignés -> comparée aux séances réalisées CETTE
  // semaine (même fenêtre que /api/statistics/weekly, Sprint 9), un
  // pourcentage par utilisateur, moyenné par `computeGlobalAdherenceStats`.
  const latestAssignment = new Map<string, string | null>(); // clé "userId::pathology" -> programId
  for (const row of assignmentsRes.data ?? []) {
    const key = `${row.user_id}::${row.pathology}`;
    if (!latestAssignment.has(key)) {
      latestAssignment.set(key, row.program_id);
    }
  }

  const candidateProgramIds = Array.from(new Set(Array.from(latestAssignment.values()).filter((id): id is string => Boolean(id))));
  let validatedFrequencyByProgram = new Map<string, number>();
  if (candidateProgramIds.length > 0) {
    const { data: programs } = await supabase
      .from("programs")
      .select("program_id, frequency_per_week")
      .in("program_id", candidateProgramIds)
      .eq("medical_validation_status", "validated");
    validatedFrequencyByProgram = new Map(
      (programs ?? [])
        .filter((p) => typeof p.frequency_per_week === "number" && p.frequency_per_week > 0)
        .map((p) => [p.program_id, p.frequency_per_week as number])
    );
  }

  const targetFrequencyByUser = new Map<string, number>();
  for (const [key, programId] of latestAssignment.entries()) {
    if (!programId) continue;
    const frequency = validatedFrequencyByProgram.get(programId);
    if (!frequency) continue;
    const userId = key.split("::")[0];
    targetFrequencyByUser.set(userId, (targetFrequencyByUser.get(userId) ?? 0) + frequency);
  }

  const sessionsThisWeekByUser = new Map<string, number>();
  for (const s of thisWeekCompletedRes.data ?? []) {
    sessionsThisWeekByUser.set(s.user_id, (sessionsThisWeekByUser.get(s.user_id) ?? 0) + 1);
  }

  const perUserAdherence = Array.from(targetFrequencyByUser.entries()).map(([userId, targetFrequency]) =>
    computeAdherencePercent(sessionsThisWeekByUser.get(userId) ?? 0, targetFrequency)
  );

  const stats = computeAdminDashboardStats({
    totalUsers: totalUsersRes.count ?? 0,
    activeUsers,
    newUsers: newUsersRes.count ?? 0,
    sessionsCompleted,
    programsPracticed,
    adherence: computeGlobalAdherenceStats(perUserAdherence),
    pathologyCounts: Array.from(pathologyCountMap.entries()).map(([pathology, count]) => ({ pathology, count })),
    exerciseCounts: Array.from(exerciseCountMap.entries()).map(([exerciseId, count]) => ({ exerciseId, count })),
  });

  return NextResponse.json({ stats });
}
