import { NextResponse } from "next/server";
import { computeWeeklyScheduleWeekdays } from "@apa/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** JS `Date.getDay()` : 0 = dimanche ... 6 = samedi. Convertit vers la
 * convention du domaine (0 = lundi ... 6 = dimanche, cohérente avec
 * `getWeekBounds`). */
function toDomainWeekday(jsDay: number): number {
  return (jsDay + 6) % 7;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * §33 « Aujourd'hui » / « Séance du jour » (réf. B11, 31/08/2026) — Sprint 19.
 *
 * Pour chaque pathologie où l'utilisateur a un programme VALIDÉ actuellement
 * assigné : génère (à la lecture — aucune tâche planifiée côté serveur dans
 * cette architecture, §54) la ligne `planned_sessions` du jour si celui-ci
 * fait partie des jours planifiés pour la fréquence hebdomadaire du
 * programme (`computeWeeklyScheduleWeekdays`), et renvoie aussi toute séance
 * planifiée `due` d'une date PASSÉE non résolue (« en retard » — le patient
 * peut la démarrer ou la reporter, jamais supprimée silencieusement).
 *
 * Ne modifie jamais un programme ou n'invente aucun exercice : les
 * exercices renvoyés viennent de `program_exercises`, filtrés `validated`
 * comme partout ailleurs (défense en profondeur, §57, §59).
 */
export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  const today = todayIsoDate();
  const domainWeekday = toDomainWeekday(new Date().getDay());

  const { data: assignments, error: assignmentsError } = await supabase
    .from("user_program_assignments")
    .select("pathology, program_id, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (assignmentsError) {
    return NextResponse.json({ message: assignmentsError.message }, { status: 500 });
  }

  const latestByPathology = new Map<string, { program_id: string | null; status: string }>();
  for (const row of assignments ?? []) {
    if (!latestByPathology.has(row.pathology)) {
      latestByPathology.set(row.pathology, { program_id: row.program_id, status: row.status });
    }
  }

  const results = await Promise.all(
    Array.from(latestByPathology.entries()).map(async ([pathology, assignment]) => {
      if (assignment.status !== "assigned" || !assignment.program_id) return null;

      const { data: program } = await supabase
        .from("programs")
        .select("program_id, frequency_per_week")
        .eq("program_id", assignment.program_id)
        .eq("medical_validation_status", "validated")
        .maybeSingle();

      if (!program || typeof program.frequency_per_week !== "number") return null;

      // Génère la ligne du jour si due et pas déjà générée.
      const scheduledToday = computeWeeklyScheduleWeekdays(program.frequency_per_week).includes(domainWeekday);
      if (scheduledToday) {
        await supabase
          .from("planned_sessions")
          .insert({
            user_id: user.id,
            pathology,
            program_id: program.program_id,
            planned_for: today,
            status: "due",
          })
          .select("id")
          .maybeSingle();
        // Conflit sur (user_id, pathology, planned_for) si déjà générée :
        // ignoré silencieusement (pas d'`onConflict` nécessaire, l'erreur de
        // contrainte unique n'empêche pas la lecture qui suit).
      }

      const { data: plannedRows } = await supabase
        .from("planned_sessions")
        .select("id, planned_for, status, original_planned_for, session_id")
        .eq("user_id", user.id)
        .eq("pathology", pathology)
        .in("status", ["due"])
        .lte("planned_for", today)
        .order("planned_for", { ascending: true });

      if (!plannedRows || plannedRows.length === 0) return null;

      const { data: programExercises } = await supabase
        .from("program_exercises")
        .select("order_index, exercise_id, exercise_library!inner(exercise_id, name, short_description, medical_validation_status)")
        .eq("program_id", program.program_id)
        .eq("exercise_library.medical_validation_status", "validated")
        .order("order_index");

      const exercises = (programExercises ?? []).map((row) => {
        const exercise = Array.isArray(row.exercise_library) ? row.exercise_library[0] : row.exercise_library;
        return {
          exerciseId: row.exercise_id,
          orderIndex: row.order_index,
          name: exercise?.name,
          shortDescription: exercise?.short_description,
        };
      });

      return plannedRows.map((row) => ({
        plannedSessionId: row.id,
        pathology,
        plannedFor: row.planned_for,
        isOverdue: row.planned_for < today,
        wasPostponed: Boolean(row.original_planned_for),
        exercises,
      }));
    })
  );

  return NextResponse.json({
    plannedSessions: results.filter((r): r is NonNullable<typeof r> => r !== null).flat(),
  });
}
