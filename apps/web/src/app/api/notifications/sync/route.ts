import { NextResponse } from "next/server";
import { computeDueNotifications, isReminderTimeReached, type NotificationFacts } from "@apa/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const LOCAL_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

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
export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  const now = new Date();
  const todayStart = startOfDay(now);

  // Correctif du 13/09/2026 (Sprint 23, Q5) : le rappel quotidien de séance
  // n'est plus généré dès l'ouverture de l'application, mais seulement une
  // fois l'heure choisie par le patient atteinte. Le serveur ne connaît pas
  // le fuseau horaire du patient : le client transmet son heure locale
  // (`localTime`, "HH:MM") ; à défaut (corps absent/invalide), repli
  // explicite sur l'heure serveur (UTC) — imprécis hors UTC, mais assumé.
  const body = await request.json().catch(() => null);
  const localTime =
    body && typeof body.localTime === "string" && LOCAL_TIME_PATTERN.test(body.localTime)
      ? body.localTime
      : now.toISOString().slice(11, 16);

  const [{ data: recentSessions }, { data: lastAssessment }, { data: lastMeasurement }, { data: profile }] =
    await Promise.all([
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
      supabase.from("patient_profiles").select("reminder_time").eq("user_id", user.id).maybeSingle(),
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

  const reminderTime = profile?.reminder_time ?? "09:00";

  const facts: NotificationFacts = {
    lastCompletedSessionAt: lastCompleted?.started_at ?? null,
    hasCompletedSessionToday,
    consecutiveCompletedSessions,
    lastAssessmentAt: lastAssessment?.created_at ?? null,
    lastMeasurementAt: lastMeasurement?.recorded_at ?? null,
    reminderTimeReached: isReminderTimeReached(reminderTime, localTime),
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
