import { NextResponse } from "next/server";
import { completeSessionSchema, computeSessionCompletionLevel } from "@apa/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Clôture d'une séance avec feedback (§28 étapes 5-6, §69) — Sprint 7.
 *
 * Transition autorisée uniquement `in_progress -> completed | abandoned`
 * (`realisee = true -> completed`, `realisee = false -> abandoned`). La
 * policy RLS `sessions_update_own` (migration 0007) garantit seulement
 * qu'un utilisateur ne modifie que ses propres séances ; cette route
 * applique en plus la restriction de transition (§46 : ne jamais faire
 * confiance uniquement aux contrôles frontend — ici, ni à RLS seule).
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
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

  const parsed = completeSessionSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? "form")] = issue.message;
    }
    return NextResponse.json({ message: "Certains champs sont invalides.", fieldErrors }, { status: 422 });
  }

  const { data: existing, error: fetchError } = await supabase
    .from("sessions")
    .select("id, status, planned_session_id")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ message: fetchError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ message: "Séance introuvable." }, { status: 404 });
  }
  if (existing.status !== "in_progress") {
    return NextResponse.json({ message: "Cette séance est déjà clôturée." }, { status: 409 });
  }

  const { realisee, difficulte, douleurApres, fatigueApres, ressenti, completedExerciseIds } = parsed.data;

  // Réf. B13 (31/08/2026) : marque les exercices prescrits que le patient
  // déclare avoir faits, puis calcule `completion_level` à partir de la
  // fraction réellement cochée — uniquement si la séance est réalisée ET
  // qu'au moins un exercice était prescrit (voir
  // `computeSessionCompletionLevel`, jamais un niveau deviné sans contenu).
  let completionLevel: "complete" | "partial" | null = null;
  if (realisee) {
    const { data: sessionExercises } = await supabase
      .from("session_exercises")
      .select("exercise_id")
      .eq("session_id", params.id);
    const totalExerciseCount = sessionExercises?.length ?? 0;

    if (totalExerciseCount > 0) {
      const completedIds = new Set(completedExerciseIds ?? []);
      if (completedIds.size > 0) {
        await supabase
          .from("session_exercises")
          .update({ completed: true })
          .eq("session_id", params.id)
          .in("exercise_id", Array.from(completedIds));
      }
      const completedCount = (sessionExercises ?? []).filter((row) => completedIds.has(row.exercise_id)).length;
      completionLevel = computeSessionCompletionLevel(completedCount, totalExerciseCount);
    }
  }

  const { data: updated, error } = await supabase
    .from("sessions")
    .update({
      status: realisee ? "completed" : "abandoned",
      realisee,
      difficulte: difficulte ?? null,
      douleur_apres: douleurApres ?? null,
      fatigue_apres: fatigueApres ?? null,
      ressenti: ressenti ?? null,
      completion_level: completionLevel,
      completed_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select("id, status, completed_at")
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  // Réf. B11 : une séance planifiée liée passe à 'completed' UNIQUEMENT si
  // la séance réelle a bien été réalisée (realisee = true) — sinon elle
  // reste 'due' (toujours à faire), aucune pénalisation supplémentaire non
  // plus (pas de statut "manquée" inventé, sa réponse n'en mentionne aucun).
  if (existing.planned_session_id && realisee) {
    await supabase
      .from("planned_sessions")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", existing.planned_session_id)
      .eq("user_id", user.id);
  }

  return NextResponse.json({
    sessionId: updated.id,
    status: updated.status,
    completionLevel,
    completedAt: updated.completed_at,
  });
}
