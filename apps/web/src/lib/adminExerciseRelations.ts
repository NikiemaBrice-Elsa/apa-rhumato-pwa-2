import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Remplace les liaisons pathologies/objectifs/références d'un exercice —
 * approche "supprimer puis réinsérer", plus simple et plus sûre qu'un diff
 * fin pour des tables de jonction sans autre colonne que les clés
 * (exercise_pathologies, exercise_objectives, exercise_references,
 * migration 0005). Utilisé par les routes POST/PATCH admin exercices.
 */
export async function linkExerciseRelations(
  supabase: SupabaseClient,
  exerciseId: string,
  input: { pathologies: string[]; objectives: string[]; scientificReferenceIds: string[] }
) {
  await Promise.all([
    supabase.from("exercise_pathologies").delete().eq("exercise_id", exerciseId),
    supabase.from("exercise_objectives").delete().eq("exercise_id", exerciseId),
    supabase.from("exercise_references").delete().eq("exercise_id", exerciseId),
  ]);

  const inserts: PromiseLike<unknown>[] = [];
  if (input.pathologies.length > 0) {
    inserts.push(
      supabase.from("exercise_pathologies").insert(input.pathologies.map((code) => ({ exercise_id: exerciseId, pathology_code: code })))
    );
  }
  if (input.objectives.length > 0) {
    inserts.push(
      supabase.from("exercise_objectives").insert(input.objectives.map((code) => ({ exercise_id: exerciseId, objective_code: code })))
    );
  }
  if (input.scientificReferenceIds.length > 0) {
    inserts.push(
      supabase
        .from("exercise_references")
        .insert(input.scientificReferenceIds.map((referenceId) => ({ exercise_id: exerciseId, reference_id: referenceId })))
    );
  }
  await Promise.all(inserts);
}
