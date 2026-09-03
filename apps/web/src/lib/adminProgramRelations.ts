import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Remplace les liaisons exercices/références d'un programme (tables
 * program_exercises, program_references, migration 0006). `order_index`
 * suit l'ordre du tableau `exerciseIds` reçu ; les surcharges fines
 * (`sets_override`, `repetitions_override`, `notes`) ne sont pas exposées
 * dans ce premier écran d'administration — limitation assumée, à étendre si
 * le concepteur médical en a besoin (voir docs/DECISIONS.md, Sprint 13).
 */
export async function linkProgramRelations(
  supabase: SupabaseClient,
  programId: string,
  input: { exerciseIds: string[]; scientificReferenceIds: string[] }
) {
  await Promise.all([
    supabase.from("program_exercises").delete().eq("program_id", programId),
    supabase.from("program_references").delete().eq("program_id", programId),
  ]);

  const inserts: PromiseLike<unknown>[] = [];
  if (input.exerciseIds.length > 0) {
    inserts.push(
      supabase
        .from("program_exercises")
        .insert(input.exerciseIds.map((exerciseId, index) => ({ program_id: programId, exercise_id: exerciseId, order_index: index })))
    );
  }
  if (input.scientificReferenceIds.length > 0) {
    inserts.push(
      supabase
        .from("program_references")
        .insert(input.scientificReferenceIds.map((referenceId) => ({ program_id: programId, reference_id: referenceId })))
    );
  }
  await Promise.all(inserts);
}
