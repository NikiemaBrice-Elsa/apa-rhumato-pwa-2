import { NextResponse } from "next/server";
import { startSessionWithPlanningSchema } from "@apa/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Démarrage d'une séance (§28 étapes 1-2) — Sprint 7.
 *
 * Une séance ne propose des exercices (§28 étape 4) QUE si l'utilisateur a
 * un programme déjà attribué ET validé médicalement pour la pathologie
 * concernée (`user_program_assignments` + `programs.medical_validation_status
 * = 'validated'`, mêmes garanties que la route /api/programs, Sprint 6).
 * Tant qu'aucun programme validé n'existe (voir
 * docs/MEDICAL_VALIDATION_NEEDED.md), la séance démarre quand même — pour ne
 * pas bloquer la fonctionnalité de suivi (§69) — mais sans aucun exercice
 * proposé : jamais de contenu d'exercice inventé ou substitué (§57, §59, §78).
 */
export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  const parsed = startSessionWithPlanningSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? "form")] = issue.message;
    }
    return NextResponse.json({ message: "Certains champs sont invalides.", fieldErrors }, { status: 422 });
  }

  const { pathology, douleurAvant, fatigueAvant, etatGeneralAvant, plannedSessionId } = parsed.data;

  // Réf. B11 (31/08/2026) : si la séance démarre depuis la « séance du
  // jour », vérifier que cette ligne planifiée appartient bien à
  // l'utilisateur ET est encore `due` avant de la lier (défense en
  // profondeur, §46 — ne jamais faire confiance à un identifiant transmis
  // par le client sans le revérifier côté serveur).
  let linkedPlannedSessionId: string | null = null;
  if (plannedSessionId) {
    const { data: plannedSession } = await supabase
      .from("planned_sessions")
      .select("id, status")
      .eq("id", plannedSessionId)
      .eq("user_id", user.id)
      .eq("pathology", pathology)
      .maybeSingle();
    if (plannedSession?.status === "due") {
      linkedPlannedSessionId = plannedSession.id;
    }
  }

  const { data: assignment } = await supabase
    .from("user_program_assignments")
    .select("program_id")
    .eq("user_id", user.id)
    .eq("pathology", pathology)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let validatedProgramId: string | null = null;
  if (assignment?.program_id) {
    // Vérification explicite en plus de la RLS (défense en profondeur, §57,
    // §59) : ne jamais supposer qu'un program_id présent est forcément validé.
    const { data: program } = await supabase
      .from("programs")
      .select("program_id")
      .eq("program_id", assignment.program_id)
      .eq("medical_validation_status", "validated")
      .maybeSingle();
    validatedProgramId = program?.program_id ?? null;
  }

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      program_id: validatedProgramId,
      pathology,
      status: "in_progress",
      douleur_avant: douleurAvant ?? null,
      fatigue_avant: fatigueAvant ?? null,
      etat_general_avant: etatGeneralAvant ?? null,
      planned_session_id: linkedPlannedSessionId,
    })
    .select("id, status, started_at")
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  let exercises: unknown[] = [];
  if (validatedProgramId) {
    const { data: programExercises } = await supabase
      .from("program_exercises")
      .select(
        "order_index, exercise_id, exercise_library!inner(exercise_id, name, short_description, category, phase, medical_validation_status)"
      )
      .eq("program_id", validatedProgramId)
      .eq("exercise_library.medical_validation_status", "validated")
      .order("order_index");

    const rows = programExercises ?? [];
    if (rows.length > 0) {
      const exerciseByRow = rows.map((row) => {
        const exercise = Array.isArray(row.exercise_library) ? row.exercise_library[0] : row.exercise_library;
        return { row, exercise };
      });

      // §28, réf. B8 (Sprint 18) : la phase est figée au démarrage, comme
      // order_index — une reclassification ultérieure de l'exercice dans
      // exercise_library ne doit jamais changer rétroactivement une séance
      // déjà commencée (voir infra/db/migrations/0014_...sql).
      const { error: sessionExercisesError } = await supabase.from("session_exercises").insert(
        exerciseByRow.map(({ row, exercise }) => ({
          session_id: session.id,
          exercise_id: row.exercise_id,
          order_index: row.order_index,
          phase: exercise?.phase ?? null,
        }))
      );
      // Une erreur d'écriture des exercices figés ne doit pas faire échouer
      // le démarrage de la séance déjà enregistré ci-dessus (§79 :
      // transparence plutôt qu'échec silencieux ou faux positif de sécurité).
      if (!sessionExercisesError) {
        exercises = exerciseByRow.map(({ row, exercise }) => ({
          exerciseId: row.exercise_id,
          orderIndex: row.order_index,
          phase: exercise?.phase ?? null,
          name: exercise?.name,
          shortDescription: exercise?.short_description,
          category: exercise?.category,
        }));
      }
    }
  }

  return NextResponse.json(
    {
      sessionId: session.id,
      status: session.status,
      startedAt: session.started_at,
      programAssigned: Boolean(validatedProgramId),
      exercises,
      plannedSessionId: linkedPlannedSessionId,
    },
    { status: 201 }
  );
}

export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("sessions")
    .select("id, pathology, status, realisee, difficulte, started_at, completed_at")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ sessions: data });
}
