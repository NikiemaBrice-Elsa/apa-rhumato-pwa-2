import { NextResponse } from "next/server";
import { declareSessionSchema, computeSessionCompletionLevel } from "@apa/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * §28, §69 — Sprint 29 (22/09/2026, message direct de Dr Nikiema) :
 * « Le patient doit pouvoir faire ses exercices sans passer par l'appli et
 * renseigner plus tard dans l'appli puis enregistrer. »
 *
 * Contrairement à `POST /api/sessions` (démarrage, §28 étapes 1-2) suivi de
 * `PATCH /api/sessions/:id` (clôture avec feedback, §69), les deux étapes
 * ont déjà eu lieu HORS de l'application au moment de cet appel : cette
 * route crée directement une séance déjà `completed`/`abandoned`, en un seul
 * envoi, datée du jour réellement déclaré par le patient (`date`) plutôt que
 * de l'instant de la saisie.
 *
 * `started_at`/`completed_at` sont tous deux fixés à midi (heure non
 * connue — jamais une heure précise inventée, §57/§59) le jour déclaré :
 * cela donne une durée de séance de 0 minute plutôt qu'une durée devinée.
 * `sessionDurationMinutes` (packages/domain/src/statistics.ts) continuera
 * donc à afficher une durée nulle pour ces séances déclarées a posteriori —
 * c'est le comportement honnête attendu tant qu'aucune durée réelle n'est
 * connue, pas un bug.
 *
 * Même garanties de sécurité que les deux routes existantes qu'elle
 * remplace pour ce cas d'usage : le programme validé de l'utilisateur est
 * revérifié côté serveur (jamais transmis par le client, §46), les
 * exercices prescrits sont figés à partir de `program_exercises` (comme au
 * démarrage d'une séance en direct), et `completion_level` est calculé de la
 * même façon que `PATCH /api/sessions/:id` (réf. B13).
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

  const parsed = declareSessionSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? "form")] = issue.message;
    }
    return NextResponse.json({ message: "Certains champs sont invalides.", fieldErrors }, { status: 422 });
  }

  const {
    pathology,
    date,
    douleurAvant,
    fatigueAvant,
    etatGeneralAvant,
    realisee,
    difficulte,
    douleurApres,
    fatigueApres,
    ressenti,
    completedExerciseIds,
  } = parsed.data;

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
    const { data: program } = await supabase
      .from("programs")
      .select("program_id")
      .eq("program_id", assignment.program_id)
      .eq("medical_validation_status", "validated")
      .maybeSingle();
    validatedProgramId = program?.program_id ?? null;
  }

  let prescribedExercises: { exerciseId: string; orderIndex: number }[] = [];
  if (validatedProgramId) {
    const { data: programExercises } = await supabase
      .from("program_exercises")
      .select("order_index, exercise_id, exercise_library!inner(exercise_id, medical_validation_status)")
      .eq("program_id", validatedProgramId)
      .eq("exercise_library.medical_validation_status", "validated")
      .order("order_index");

    prescribedExercises = (programExercises ?? []).map((row) => ({
      exerciseId: row.exercise_id,
      orderIndex: row.order_index,
    }));
  }

  const completedIds = new Set(completedExerciseIds ?? []);
  const completionLevel =
    realisee && prescribedExercises.length > 0
      ? computeSessionCompletionLevel(
          prescribedExercises.filter((ex) => completedIds.has(ex.exerciseId)).length,
          prescribedExercises.length
        )
      : null;

  // Heure non connue (séance faite hors application) : midi, choix neutre et
  // documenté plutôt qu'une heure inventée — voir le commentaire d'en-tête.
  const declaredAt = `${date}T12:00:00.000`;

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      program_id: validatedProgramId,
      pathology,
      status: realisee ? "completed" : "abandoned",
      douleur_avant: douleurAvant ?? null,
      fatigue_avant: fatigueAvant ?? null,
      etat_general_avant: etatGeneralAvant ?? null,
      realisee,
      difficulte: difficulte ?? null,
      douleur_apres: douleurApres ?? null,
      fatigue_apres: fatigueApres ?? null,
      ressenti: ressenti ?? null,
      completion_level: completionLevel,
      started_at: declaredAt,
      completed_at: declaredAt,
    })
    .select("id, status, started_at, completed_at")
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  if (prescribedExercises.length > 0) {
    // Une erreur d'écriture des exercices figés ne doit pas faire échouer la
    // déclaration de séance déjà enregistrée ci-dessus (§79 : transparence
    // plutôt qu'échec silencieux) — même principe que POST /api/sessions.
    await supabase.from("session_exercises").insert(
      prescribedExercises.map((ex) => ({
        session_id: session.id,
        exercise_id: ex.exerciseId,
        order_index: ex.orderIndex,
        completed: completedIds.has(ex.exerciseId),
      }))
    );
  }

  return NextResponse.json(
    {
      sessionId: session.id,
      status: session.status,
      completionLevel,
      startedAt: session.started_at,
      completedAt: session.completed_at,
      programAssigned: Boolean(validatedProgramId),
    },
    { status: 201 }
  );
}

/**
 * Liste les exercices prescrits (programme validé courant) pour une
 * pathologie, afin que le formulaire de déclaration a posteriori
 * (`DeclareSessionFlow.tsx`) puisse proposer les mêmes cases à cocher que
 * l'écran de séance en direct — sans démarrer de séance. Retourne une liste
 * vide (pas une erreur) si aucun programme validé n'est assigné : le
 * formulaire reste utilisable, juste sans liste d'exercices à cocher.
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
  const pathology = searchParams.get("pathology");
  if (!pathology) {
    return NextResponse.json({ message: "Pathologie requise." }, { status: 400 });
  }

  const { data: assignment } = await supabase
    .from("user_program_assignments")
    .select("program_id")
    .eq("user_id", user.id)
    .eq("pathology", pathology)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!assignment?.program_id) {
    return NextResponse.json({ exercises: [], programAssigned: false });
  }

  const { data: program } = await supabase
    .from("programs")
    .select("program_id")
    .eq("program_id", assignment.program_id)
    .eq("medical_validation_status", "validated")
    .maybeSingle();

  if (!program) {
    return NextResponse.json({ exercises: [], programAssigned: false });
  }

  const { data: programExercises } = await supabase
    .from("program_exercises")
    .select(
      "order_index, exercise_id, exercise_library!inner(exercise_id, name, short_description, category, medical_validation_status)"
    )
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
      category: exercise?.category,
    };
  });

  return NextResponse.json({ exercises, programAssigned: true });
}
