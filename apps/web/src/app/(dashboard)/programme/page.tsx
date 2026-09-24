import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PATHOLOGY_LABELS_FR,
  PROFILE_LEVEL_LABELS_FR,
  PROFILE_LEVEL_GUIDANCE,
  type PathologyCode,
  type ProfileLevel,
} from "@apa/domain";
import { ProgramExerciseTabs, type ProgramExerciseView } from "@/components/exercises/ProgramExerciseTabs";

interface ProgramExerciseWithCategory extends ProgramExerciseView {
  category: string;
}

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

interface ProgramExerciseLibraryFields {
  exercise_id: string;
  name: string;
  short_description: string;
  category: string;
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
  medical_validation_status: string;
}

interface ProgramExerciseRow {
  order_index: number;
  exercise_id: string;
  // PostgREST renvoie un objet pour une relation `!inner` sur la plupart des
  // versions, mais un tableau à un élément selon le contexte de la requête
  // (même ambiguïté déjà rencontrée dans exercices/page.tsx et
  // api/sessions/declare/route.ts) — les deux formes sont donc acceptées.
  exercise_library: ProgramExerciseLibraryFields | ProgramExerciseLibraryFields[] | null;
}

/**
 * "Mon programme" (§67-68) — Sprint 6, restructurée au Sprint 32
 * (23/09/2026, instruction directe de Dr Nikiema) :
 *
 * « Dans la section "Mon programme", il doit y avoir : La liste des
 * pathologies du patient, sous chaque pathologie les onglets "aérobie" et
 * "renforcement" et quand le patient clique dessus il voit les exercices
 * qu'il doit faire. Et depuis "Mon programme", le patient doit pouvoir
 * cliquer sur "démarrer une séance". »
 *
 * Remplace l'ancien affichage (badges "types d'exercices autorisés", sans
 * accès aux exercices concrets ni bouton de démarrage) par : la liste des
 * pathologies suivies (`user_program_assignments`, dernière tentative par
 * pathologie, comme avant), puis pour chacune deux onglets Aérobie /
 * Renforcement (`ProgramExerciseTabs`, mêmes deux types que l'écran
 * pédagogique du Sprint 31) affichant les exercices RÉELS du programme
 * validé assigné (`program_exercises` → `exercise_library`, même source de
 * données que le démarrage d'une séance en direct, `POST /api/sessions`, et
 * que la déclaration a posteriori, `GET /api/sessions/declare`) — jamais une
 * liste théorique. Tant qu'aucun programme validé n'est assigné pour une
 * pathologie, l'état « en attente de validation médicale » déjà en place
 * reste affiché (§57, §59, §78).
 *
 * Le lien « Démarrer une séance » par pathologie réutilise `?pathology=...`,
 * déjà supporté par `apps/web/src/app/(dashboard)/seance/page.tsx`
 * (Sprint 29/31) pour présélectionner la pathologie et passer directement à
 * l'écran pédagogique « quels exercices » avant la vérification rapide.
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

  // Exercices réels du programme validé, par pathologie (mêmes champs que
  // ExerciseDetails.tsx, déjà utilisé pour l'écran de séance en direct).
  const exercisesByPathology = new Map<PathologyCode, ProgramExerciseWithCategory[]>();
  await Promise.all(
    rows.map(async (row) => {
      const program = row.program_id ? programsById.get(row.program_id) : undefined;
      if (!program) return;

      const { data: programExercises } = await supabase
        .from("program_exercises")
        .select(
          "order_index, exercise_id, exercise_library!inner(exercise_id, name, short_description, category, starting_position, execution_steps, breathing_instruction, duration_seconds, repetitions, sets, rest_time_seconds, precautions, contraindications, stop_criteria, medical_validation_status)"
        )
        .eq("program_id", program.program_id)
        .eq("exercise_library.medical_validation_status", "validated")
        .order("order_index");

      // `flatMap` (retourne `[]` plutôt que `null` pour un exercice sans
      // détail) plutôt qu'un `.map().filter((ex): ex is X => ...)` : ce
      // dernier faisait échouer `next build` (`tsc --strict`) — les champs
      // optionnels d'`ExerciseDetailFields` (`startingPosition?: string |
      // null`, etc., ex-`ExerciseDetails.tsx`) acceptent `undefined`, alors
      // que l'objet construit ci-dessous les fournit toujours en
      // `string | null` (jamais absent) ; un garde de type (`ex is …`) exige
      // une compatibilité dans les deux sens que cet écart casse, alors
      // qu'une simple affectation (ce que fait `flatMap` implicitement) ne
      // vérifie que le sens utile ici et compile sans ambiguïté.
      const exercises = ((programExercises ?? []) as ProgramExerciseRow[]).flatMap((pe) => {
        const exercise = Array.isArray(pe.exercise_library) ? pe.exercise_library[0] : pe.exercise_library;
        if (!exercise) return [];
        return [
          {
            exerciseId: exercise.exercise_id,
            name: exercise.name,
            shortDescription: exercise.short_description,
            category: exercise.category,
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
          },
        ];
      });

      exercisesByPathology.set(row.pathology, exercises);
    })
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-12">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold text-primary-900">Mon programme</h1>
        <Link href="/niveaux" className="shrink-0 text-sm text-primary-600 underline">
          En savoir plus sur les niveaux
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-primary-700">
          Aucun programme n'a encore pu être proposé : faites d'abord votre{" "}
          <a href="/evaluation" className="underline">
            évaluation initiale
          </a>
          .
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((row) => {
            const program = row.program_id ? programsById.get(row.program_id) : undefined;
            const pathologyExercises = exercisesByPathology.get(row.pathology) ?? [];
            const aerobique = pathologyExercises.filter((ex) => ex.category === "aerobique");
            const renforcement = pathologyExercises.filter((ex) => ex.category === "renforcement");

            return (
              <li key={row.pathology} className="rounded-xl border border-primary-300 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-primary-900">{PATHOLOGY_LABELS_FR[row.pathology]}</p>
                  <Link
                    href={`/seance?pathology=${row.pathology}`}
                    className="shrink-0 rounded-lg bg-primary-700 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Démarrer une séance
                  </Link>
                </div>
                {program ? (
                  <>
                    <p className="text-sm text-primary-700">
                      Niveau {PROFILE_LEVEL_LABELS_FR[program.profile_level]}
                      {program.frequency_per_week ? ` · ${program.frequency_per_week}x/semaine` : ""}
                    </p>
                    {/* Sprint 33 (24/09/2026) : repère indicatif général du
                        niveau (PROFILE_LEVEL_GUIDANCE, déjà validé, jusqu'ici
                        jamais affiché) — distinct de la fréquence ci-dessus,
                        qui reste propre au programme réellement assigné. */}
                    <p className="text-xs text-primary-500">
                      Repère niveau {PROFILE_LEVEL_LABELS_FR[program.profile_level].toLowerCase()} :{" "}
                      {PROFILE_LEVEL_GUIDANCE[program.profile_level].sessionsPerWeekMin}-
                      {PROFILE_LEVEL_GUIDANCE[program.profile_level].sessionsPerWeekMax} séances/semaine,{" "}
                      {PROFILE_LEVEL_GUIDANCE[program.profile_level].sessionDurationMinutesMin}-
                      {PROFILE_LEVEL_GUIDANCE[program.profile_level].sessionDurationMinutesMax} min/séance.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-primary-700">
                    Aucun programme ne peut encore être attribué automatiquement pour cette pathologie :
                    en attente de validation médicale des critères d'attribution et des programmes
                    eux-mêmes (voir « Paramètres médicaux en attente de validation »).
                  </p>
                )}
                {program && <ProgramExerciseTabs aerobique={aerobique} renforcement={renforcement} />}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
