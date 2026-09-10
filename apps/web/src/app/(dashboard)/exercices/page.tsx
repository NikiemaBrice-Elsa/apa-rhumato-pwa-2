import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EXERCISE_CATEGORY_LABELS_FR, type ExerciseCategory } from "@apa/domain";
import { ExerciseDetails } from "@/components/exercises/ExerciseDetails";
import { AudioCoach } from "@/components/exercises/AudioCoach";

interface ExerciseRow {
  exercise_id: string;
  name: string;
  short_description: string;
  category: ExerciseCategory;
  difficulty: string | null;
  starting_position: string | null;
  execution_steps: string | null;
  breathing_instruction: string | null;
  duration_seconds: number | null;
  repetitions: number | null;
  sets: number | null;
  rest_time_seconds: number | null;
  precautions: string | null;
  contraindications: string | null;
  stop_criteria: string | null;
  audio_preparation_url: string | null;
  audio_exercise_url: string | null;
}

/**
 * Bibliothèque d'exercices (§25, §26) — Sprint 5.
 * N'affiche que les exercices validés (imposé par la RLS de la base, voir
 * infra/db/migrations/0005_exercise_library.sql) ; reste vide tant que le
 * concepteur médical n'a validé aucun contenu (voir
 * infra/db/seed/tools/gabarit_exercices_apa_rhumato.xlsx).
 */
export default async function ExercisesPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion");
  }

  // 10/09/2026 : précautions, contre-indications et critères d'arrêt sont
  // déjà validés pour les exercices en ligne mais n'étaient jamais
  // transmis ici — voir ExerciseDetails.tsx pour le détail de la découverte
  // et la règle d'affichage (rien n'est montré si le champ est vide).
  // audio_preparation_url/audio_exercise_url (coach vocal, Sprint 20,
  // priorisé le 10/09/2026) suivent la même règle — voir AudioCoach.tsx.
  const { data } = await supabase
    .from("exercise_library")
    .select(
      "exercise_id, name, short_description, category, difficulty, starting_position, execution_steps, breathing_instruction, duration_seconds, repetitions, sets, rest_time_seconds, precautions, contraindications, stop_criteria, audio_preparation_url, audio_exercise_url"
    )
    .order("name");

  const exercises = (data ?? []) as ExerciseRow[];

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-primary-900">Bibliothèque d'exercices</h1>

      {exercises.length === 0 ? (
        <p className="text-primary-700">
          Aucun exercice n'est encore disponible : le contenu doit d'abord être validé par le
          concepteur médical.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {exercises.map((exercise) => (
            <li key={exercise.exercise_id} className="rounded-xl border border-primary-300 bg-white p-4">
              <p className="font-medium text-primary-900">{exercise.name}</p>
              <p className="text-sm text-primary-700">{exercise.short_description}</p>
              <p className="mt-1 text-xs text-primary-500">
                {EXERCISE_CATEGORY_LABELS_FR[exercise.category]}
                {exercise.difficulty ? ` · ${exercise.difficulty}` : ""}
              </p>
              <ExerciseDetails
                ex={{
                  startingPosition: exercise.starting_position,
                  executionSteps: exercise.execution_steps,
                  breathingInstruction: exercise.breathing_instruction,
                  durationSeconds: exercise.duration_seconds,
                  repetitions: exercise.repetitions,
                  sets: exercise.sets,
                  restTimeSeconds: exercise.rest_time_seconds,
                  precautions: exercise.precautions,
                  contraindications: exercise.contraindications,
                  stopCriteria: exercise.stop_criteria,
                }}
              />
              <AudioCoach
                ex={{
                  audioPreparationUrl: exercise.audio_preparation_url,
                  audioExerciseUrl: exercise.audio_exercise_url,
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
