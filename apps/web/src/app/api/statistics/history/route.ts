import { NextResponse } from "next/server";
import { getWeekBounds, sessionDurationMinutes } from "@apa/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPremiumStatus } from "@/lib/premiumAccess";

const DEFAULT_WEEKS = 8;
const MAX_WEEKS = 26;

/**
 * §48, Sprint 24 (14/09/2026, Q4 « a » validée) : au-delà de cette fenêtre,
 * l'historique complet des statistiques devient une fonctionnalité premium.
 * Valeur choisie par défaut par Claude (≈ 30 jours), faute de chiffre précis
 * dans la proposition validée — voir docs/DECISIONS.md, Dr Nikiema peut
 * ajuster cette seule constante à tout moment.
 */
const FREE_HISTORY_MAX_WEEKS = 4;

/**
 * §33 « Progression » — courbes « activité » et « séances » — Sprint 9.
 * Agrège les séances déjà enregistrées (Sprint 7) par semaine ISO, sur les N
 * dernières semaines (8 par défaut). Purement arithmétique : aucune
 * interprétation de la tendance n'est faite ici (même principe que §34 pour
 * la douleur).
 *
 * Sprint 24 (14/09/2026) : la fenêtre est plafonnée à `FREE_HISTORY_MAX_WEEKS`
 * pour un compte gratuit (au lieu de `MAX_WEEKS`) — voir
 * apps/web/src/lib/premiumAccess.ts. Le plafonnement reste silencieux (comme
 * le plafonnement à `MAX_WEEKS` déjà existant) : aucune erreur bloquante,
 * seulement une fenêtre plus courte ; `isPremium`/`maxWeeksAllowed` sont
 * renvoyés pour permettre à l'interface d'afficher une invitation à passer au
 * premium le cas échéant.
 */
export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  const { isPremium } = await getPremiumStatus(supabase, user.id);
  const maxWeeksAllowed = isPremium ? MAX_WEEKS : FREE_HISTORY_MAX_WEEKS;

  const { searchParams } = new URL(request.url);
  const requestedWeeks = Number(searchParams.get("weeks"));
  const weeks = Number.isFinite(requestedWeeks) && requestedWeeks > 0
    ? Math.min(requestedWeeks, maxWeeksAllowed)
    : Math.min(DEFAULT_WEEKS, maxWeeksAllowed);

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

  return NextResponse.json({ weeks: series, isPremium, maxWeeksAllowed });
}
