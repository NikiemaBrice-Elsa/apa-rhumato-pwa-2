import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ExerciseLibraryBrowser, type LibraryExercise } from "@/components/exercises/ExerciseLibraryBrowser";
import { getPremiumStatus } from "@/lib/premiumAccess";
import type { ExerciseCategory, ExerciseDifficultyLevel, PathologyCode } from "@apa/domain";

interface ExerciseRow {
  exercise_id: string;
  name: string;
  short_description: string;
  category: ExerciseCategory;
  difficulty_level: ExerciseDifficultyLevel | null;
  intensity_borg_min: number | null;
  intensity_borg_max: number | null;
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
  exercise_pathologies: Array<{ pathology_code: PathologyCode }>;
}

/**
 * Bibliothèque d'exercices (§25, §26) — Sprint 5.
 * N'affiche que les exercices validés (imposé par la RLS de la base, voir
 * infra/db/migrations/0005_exercise_library.sql) ; reste vide tant que le
 * concepteur médical n'a validé aucun contenu (voir
 * infra/db/seed/tools/gabarit_exercices_apa_rhumato.xlsx).
 *
 * Sprint 28 (20/09/2026) — nouvel affichage demandé par Dr Nikiema :
 * pathologie → types d'exercices recommandés → exercices → détail (au lieu
 * d'une simple liste plate). Cette page reste un Server Component qui se
 * contente de charger les données (y compris les pathologies liées via
 * `exercise_pathologies`, embarquées par PostgREST, même syntaxe que
 * apps/web/src/app/api/admin/exercises/route.ts) ; toute la navigation par
 * étapes est déléguée à `ExerciseLibraryBrowser` (Client Component, pour
 * l'état de l'étape courante).
 */
export default async function ExercisesPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion");
  }

  const { isPremium } = await getPremiumStatus(supabase, user.id);

  const { data } = await supabase
    .from("exercise_library")
    .select(
      "exercise_id, name, short_description, category, difficulty_level, intensity_borg_min, intensity_borg_max, starting_position, execution_steps, breathing_instruction, duration_seconds, repetitions, sets, rest_time_seconds, precautions, contraindications, stop_criteria, audio_preparation_url, audio_exercise_url, exercise_pathologies(pathology_code)"
    )
    .order("name");

  const rows = (data ?? []) as ExerciseRow[];

  const exercises: LibraryExercise[] = rows.map((row) => ({
    exerciseId: row.exercise_id,
    name: row.name,
    shortDescription: row.short_description,
    category: row.category,
    pathologies: (row.exercise_pathologies ?? []).map((p) => p.pathology_code),
    difficultyLevel: row.difficulty_level,
    intensityBorgMin: row.intensity_borg_min,
    intensityBorgMax: row.intensity_borg_max,
    startingPosition: row.starting_position,
    executionSteps: row.execution_steps,
    breathingInstruction: row.breathing_instruction,
    durationSeconds: row.duration_seconds,
    repetitions: row.repetitions,
    sets: row.sets,
    restTimeSeconds: row.rest_time_seconds,
    precautions: row.precautions,
    contraindications: row.contraindications,
    stopCriteria: row.stop_criteria,
    audioPreparationUrl: row.audio_preparation_url,
    audioExerciseUrl: row.audio_exercise_url,
  }));

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-primary-900">Bibliothèque d&apos;exercices</h1>
      <ExerciseLibraryBrowser exercises={exercises} isPremium={isPremium} />
    </main>
  );
}
