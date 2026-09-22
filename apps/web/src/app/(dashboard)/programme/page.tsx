import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PATHOLOGY_LABELS_FR,
  PROFILE_LEVEL_LABELS_FR,
  EXERCISE_CATEGORY_LABELS_FR,
  categoriesForPathology,
  type PathologyCode,
  type ProfileLevel,
  type ExerciseCategory,
} from "@apa/domain";

interface AssignmentRow {
  pathology: PathologyCode;
  program_id: string | null;
  status: "assigned" | "pending_validation";
  created_at: string;
}

interface ProgramRow {
  program_id: string;
  program_code: string;
  profile_level: ProfileLevel;
  objective: string | null;
  duration_weeks: number | null;
  frequency_per_week: number | null;
}

interface ExerciseCategoryRow {
  category: ExerciseCategory;
  exercise_pathologies: Array<{ pathology_code: PathologyCode }>;
}

/**
 * "Mon programme" (§67-68) — Sprint 6.
 * Affiche la dernière tentative d'attribution par pathologie
 * (`user_program_assignments`). Tant qu'aucune règle `allow_program`
 * validée n'existe (voir docs/MEDICAL_VALIDATION_NEEDED.md), l'état est
 * volontairement « en attente » pour toutes les pathologies évaluées —
 * jamais de programme inventé (§57, §59, §78).
 *
 * Sprint 29 (22/09/2026, message direct de Dr Nikiema) : « ce sont les types
 * d'exercices autorisés pour la pathologie du patient qui doivent
 * apparaitre » — pour chaque pathologie évaluée, affiche désormais aussi les
 * types d'exercices (`EXERCISE_CATEGORIES`) réellement disponibles pour
 * cette pathologie, via `categoriesForPathology` (déjà construite au
 * Sprint 28 pour la bibliothèque d'exercices, même source de données —
 * `exercise_library` validés uniquement, joints à `exercise_pathologies`).
 * Affiché indépendamment de l'attribution d'un programme précis : ce sont
 * les types d'exercices liés à la PATHOLOGIE, pas au programme assigné.
 */
export default async function ProgrammePage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion");
  }

  const { data: assignments } = await supabase
    .from("user_program_assignments")
    .select("pathology, program_id, status, created_at")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  const latestByPathology = new Map<PathologyCode, AssignmentRow>();
  for (const row of (assignments ?? []) as AssignmentRow[]) {
    if (!latestByPathology.has(row.pathology)) {
      latestByPathology.set(row.pathology, row);
    }
  }

  const programIds = Array.from(latestByPathology.values())
    .map((row) => row.program_id)
    .filter((id): id is string => Boolean(id));

  let programsById = new Map<string, ProgramRow>();
  if (programIds.length > 0) {
    const { data: programs } = await supabase
      .from("programs")
      .select("program_id, program_code, profile_level, objective, duration_weeks, frequency_per_week")
      .in("program_id", programIds)
      .eq("medical_validation_status", "validated");
    programsById = new Map(((programs ?? []) as ProgramRow[]).map((p) => [p.program_id, p]));
  }

  const rows = Array.from(latestByPathology.values());

  const { data: exerciseRows } = await supabase
    .from("exercise_library")
    .select("category, exercise_pathologies(pathology_code)");

  const exercisesForCategories = ((exerciseRows ?? []) as ExerciseCategoryRow[]).map((row) => ({
    category: row.category,
    pathologies: (row.exercise_pathologies ?? []).map((p) => p.pathology_code),
  }));

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-primary-900">Mon programme</h1>

      {rows.length === 0 ? (
        <p className="text-primary-700">
          Aucun programme n'a encore pu être proposé : faites d'abord votre{" "}
          <a href="/evaluation" className="underline">
            évaluation initiale
          </a>
          .
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => {
            const program = row.program_id ? programsById.get(row.program_id) : undefined;
            const categories = categoriesForPathology(exercisesForCategories, row.pathology);
            return (
              <li key={row.pathology} className="rounded-xl border border-primary-300 bg-white p-4">
                <p className="font-medium text-primary-900">{PATHOLOGY_LABELS_FR[row.pathology]}</p>
                {program ? (
                  <>
                    <p className="text-sm text-primary-700">
                      Niveau {PROFILE_LEVEL_LABELS_FR[program.profile_level]}
                      {program.frequency_per_week ? ` · ${program.frequency_per_week}x/semaine` : ""}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-primary-700">
                    Aucun programme ne peut encore être attribué automatiquement pour cette pathologie :
                    en attente de validation médicale des critères d'attribution et des programmes
                    eux-mêmes (voir « Paramètres médicaux en attente de validation »).
                  </p>
                )}
                {categories.length > 0 ? (
                  <div className="mt-2 flex flex-col gap-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-primary-500">
                      Types d&apos;exercices autorisés
                    </p>
                    <ul className="flex flex-wrap gap-1.5">
                      {categories.map((category) => (
                        <li
                          key={category}
                          className="rounded-full border border-primary-200 bg-primary-50 px-2.5 py-0.5 text-xs text-primary-700"
                        >
                          {EXERCISE_CATEGORY_LABELS_FR[category]}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-primary-500">
                    Aucun type d&apos;exercice validé pour cette pathologie pour le moment.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
