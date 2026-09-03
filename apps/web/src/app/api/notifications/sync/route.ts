import { NextResponse } from "next/server";
import { computeDueNotifications, type NotificationFacts } from "@apa/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Calcule et enregistre les notifications dues pour l'utilisateur connecté
 * (§39) — Sprint 11. Sans infrastructure de push/cron réelle (voir
 * docs/DECISIONS.md), ce calcul est déclenché à la demande (ex. à
 * l'ouverture du tableau de bord ou de la page Notifications) plutôt que
 * planifié en arrière-plan. Idempotent sur une même journée : n'insère pas
 * un doublon d'un type déjà généré aujourd'hui.
 */
export async function POST() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  const now = new Date();
  const todayStart = startOfDay(now);

  const [{ data: recentSessions }, { data: lastAssessment }, { data: lastMeasurement }] = await Promise.all([
    supabase
      .from("sessions")
      .select("status, started_at")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(10),
    supabase
      .from("clinical_assessments")
      .select("created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("measurements")
      .select("recorded_at")
      .eq("user_id", user.id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const sessions = recentSessions ?? [];
  const lastCompleted = sessions.find((s) => s.status === "completed");
  const hasCompletedSessionToday = sessions.some(
    (s) => s.status === "completed" && new Date(s.started_at) >= todayStart
  );

  let consecutiveCompletedSessions = 0;
  for (const s of sessions) {
    if (s.status === "completed") {
      consecutiveCompletedSessions += 1;
    } else {
      break;
    }
  }

  const facts: NotificationFacts = {
    lastCompletedSessionAt: lastCompleted?.started_at ?? null,
    hasCompletedSessionToday,
    consecutiveCompletedSessions,
    lastAssessmentAt: lastAssessment?.created_at ?? null,
    lastMeasurementAt: lastMeasurement?.recorded_at ?? null,
  };

  const due = computeDueNotifications(facts, now);

  const { data: alreadyToday } = await supabase
    .from("notifications")
    .select("notification_type")
    .eq("user_id", user.id)
    .gte("created_at", todayStart.toISOString());

  const typesAlreadyGeneratedToday = new Set((alreadyToday ?? []).map((n) => n.notification_type));
  const toInsert = due.filter((n) => !typesAlreadyGeneratedToday.has(n.type));

  if (toInsert.length === 0) {
    return NextResponse.json({ created: [] });
  }

  const { data: inserted, error } = await supabase
    .from("notifications")
    .insert(
      toInsert.map((n) => ({
        user_id: user.id,
        notification_type: n.type,
        title: n.title,
        body: n.body,
      }))
    )
    .select("id, notification_type, title, body, read, created_at");

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ created: inserted });
}
