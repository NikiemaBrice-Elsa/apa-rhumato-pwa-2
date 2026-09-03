import { NextResponse } from "next/server";
import { getWeekBounds, sessionDurationMinutes } from "@apa/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DEFAULT_WEEKS = 8;
const MAX_WEEKS = 26;

/**
 * §33 « Progression » — courbes « activité » et « séances » — Sprint 9.
 * Agrège les séances déjà enregistrées (Sprint 7) par semaine ISO, sur les N
 * dernières semaines (8 par défaut). Purement arithmétique : aucune
 * interprétation de la tendance n'est faite ici (même principe que §34 pour
 * la douleur).
 */
export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requestedWeeks = Number(searchParams.get("weeks"));
  const weeks = Number.isFinite(requestedWeeks) && requestedWeeks > 0 ? Math.min(requestedWeeks, MAX_WEEKS) : DEFAULT_WEEKS;

  const { weekStart: currentWeekStart } = getWeekBounds(new Date());
  const earliestWeekStart = new Date(currentWeekStart);
  earliestWeekStart.setDate(earliestWeekStart.getDate() - (weeks - 1) * 7);

  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("status, started_at, completed_at")
    .eq("user_id", user.id)
    .gte("started_at", earliestWeekStart.toISOString());

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const buckets = new Map<string, { sessionsCompleted: number; totalActiveMinutes: number }>();
  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date(earliestWeekStart);
    weekStart.setDate(weekStart.getDate() + i * 7);
    buckets.set(weekStart.toISOString(), { sessionsCompleted: 0, totalActiveMinutes: 0 });
  }

  for (const session of sessions ?? []) {
    if (session.status !== "completed") continue;
    const { weekStart } = getWeekBounds(new Date(session.started_at));
    const key = weekStart.toISOString();
    const bucket = buckets.get(key);
    if (!bucket) continue; // hors de la fenêtre demandée (garde-fou d'arrondi)
    bucket.sessionsCompleted += 1;
    bucket.totalActiveMinutes += sessionDurationMinutes(session.started_at, session.completed_at) ?? 0;
  }

  const series = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, values]) => ({ weekStart, ...values }));

  return NextResponse.json({ weeks: series });
}
