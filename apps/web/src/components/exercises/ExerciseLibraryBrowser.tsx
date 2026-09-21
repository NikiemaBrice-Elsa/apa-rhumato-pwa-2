"use client";

import { useState } from "react";
import {
  PATHOLOGY_LABELS_FR,
  EXERCISE_CATEGORY_LABELS_FR,
  EXERCISE_DIFFICULTY_LABELS_FR,
  pathologiesWithExercises,
  categoriesForPathology,
  type PathologyCode,
  type ExerciseCategory,
  type ExerciseDifficultyLevel,
} from "@apa/domain";
import { ExerciseLibraryDetail } from "./ExerciseLibraryDetail";
import { AudioCoach } from "./AudioCoach";

export interface LibraryExercise {
  exerciseId: string;
  name: string;
  shortDescription: string;
  category: ExerciseCategory;
  pathologies: PathologyCode[];
  difficultyLevel: ExerciseDifficultyLevel | null;
  intensityBorgMin: number | null;
  intensityBorgMax: number | null;
  startingPosition: string | null;
  executionSteps: string | null;
  breathingInstruction: string | null;
  durationSeconds: number | null;
  repetitions: number | null;
  sets: number | null;
  restTimeSeconds: number | null;
  precautions: string | null;
  contraindications: string | null;
  stopCriteria: string | null;
  audioPreparationUrl: string | null;
  audioExerciseUrl: string | null;
}

/**
 * Sprint 28 (20/09/2026) — nouvel affichage de la bibliothèque d'exercices,
 * demandé par Dr Nikiema (message direct, ergonomie d'affichage — pas une
 * décision clinique/produit nécessitant un document Word) :
 *
 *   1. Liste des pathologies prises en compte.
 *   2. Clic sur une pathologie → types d'exercices recommandés (§25, les 6
 *      catégories) pour cette pathologie.
 *   3. Clic sur un type → liste des exercices de ce type pour cette
 *      pathologie.
 *   4. Clic sur un exercice → détail (`ExerciseLibraryDetail.tsx`) :
 *      description brève + lecture à voix haute, puis onglets Précautions /
 *      Contre-indications / Critères d'arrêt.
 *
 * Navigation par simple état local (pas d'URL dédiée) : cohérent avec les
 * autres parcours en plusieurs étapes de l'application (`ActiviteFlow.tsx`,
 * `SessionFlow.tsx`). Chaque étape ne propose jamais un choix qui mènerait à
 * un écran vide — `pathologiesWithExercises`/`categoriesForPathology`
 * (packages/domain/src/exercises.ts) ne retournent que ce qui a
 * effectivement du contenu validé (§57, §59).
 */
export function ExerciseLibraryBrowser({ exercises, isPremium }: { exercises: LibraryExercise[]; isPremium: boolean }) {
  const [pathology, setPathology] = useState<PathologyCode | null>(null);
  const [category, setCategory] = useState<ExerciseCategory | null>(null);
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);

  if (exercises.length === 0) {
    return (
      <p className="text-primary-700">
        Aucun exercice n&apos;est encore disponible : le contenu doit d&apos;abord être validé par le concepteur médical.
      </p>
    );
  }

  // Étape 1 : liste des pathologies.
  if (!pathology) {
    const pathologies = pathologiesWithExercises(exercises);
    return (
      <div className="flex flex-col gap-3">
        <p className="text-primary-700">Choisissez une pathologie pour voir les exercices recommandés.</p>
        <ul className="flex flex-col gap-2">
          {pathologies.map((code) => (
            <li key={code}>
              <button
                type="button"
                onClick={() => setPathology(code)}
                className="w-full rounded-xl border border-primary-300 bg-white px-4 py-3 text-left font-medium text-primary-900 hover:bg-primary-50"
              >
                {PATHOLOGY_LABELS_FR[code]}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Étape 2 : types d'exercices recommandés pour la pathologie choisie.
  if (!category) {
    const categories = categoriesForPathology(exercises, pathology);
    return (
      <div className="flex flex-col gap-3">
        <button type="button" onClick={() => setPathology(null)} className="w-fit text-sm text-primary-600 underline">
          ‹ Retour aux pathologies
        </button>
        <h2 className="font-semibold text-primary-900">{PATHOLOGY_LABELS_FR[pathology]}</h2>
        <p className="text-primary-700">Types d&apos;exercices recommandés :</p>
        <ul className="flex flex-col gap-2">
          {categories.map((cat) => (
            <li key={cat}>
              <button
                type="button"
                onClick={() => setCategory(cat)}
                className="w-full rounded-xl border border-primary-300 bg-white px-4 py-3 text-left font-medium text-primary-900 hover:bg-primary-50"
              >
                {EXERCISE_CATEGORY_LABELS_FR[cat]}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Étape 3 : exercices de ce type, pour cette pathologie.
  const matchingExercises = exercises.filter((ex) => ex.pathologies.includes(pathology) && ex.category === category);

  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={() => setCategory(null)} className="w-fit text-sm text-primary-600 underline">
        ‹ Retour aux types d&apos;exercice
      </button>
      <h2 className="font-semibold text-primary-900">
        {PATHOLOGY_LABELS_FR[pathology]} · {EXERCISE_CATEGORY_LABELS_FR[category]}
      </h2>
      <ul className="flex flex-col gap-3">
        {matchingExercises.map((ex) => {
          const expanded = expandedExerciseId === ex.exerciseId;
          return (
            <li key={ex.exerciseId} className="rounded-xl border border-primary-300 bg-white p-4">
              <button
                type="button"
                onClick={() => setExpandedExerciseId(expanded ? null : ex.exerciseId)}
                className="flex w-full flex-col gap-1 text-left"
                aria-expanded={expanded}
              >
                <span className="font-medium text-primary-900">{ex.name}</span>
                <span className="text-xs text-primary-500">
                  {ex.difficultyLevel ? EXERCISE_DIFFICULTY_LABELS_FR[ex.difficultyLevel] : ""}
                  {ex.intensityBorgMin != null && ex.intensityBorgMax != null
                    ? `${ex.difficultyLevel ? " · " : ""}Intensité cible : ${ex.intensityBorgMin}-${ex.intensityBorgMax}/10`
                    : ""}
                </span>
              </button>
              {expanded && (
                <>
                  <ExerciseLibraryDetail
                    ex={{
                      shortDescription: ex.shortDescription,
                      startingPosition: ex.startingPosition,
                      executionSteps: ex.executionSteps,
                      breathingInstruction: ex.breathingInstruction,
                      durationSeconds: ex.durationSeconds,
                      repetitions: ex.repetitions,
                      sets: ex.sets,
                      restTimeSeconds: ex.restTimeSeconds,
                      precautions: ex.precautions,
                      contraindications: ex.contraindications,
                      stopCriteria: ex.stopCriteria,
                    }}
                  />
                  <AudioCoach
                    ex={{ audioPreparationUrl: ex.audioPreparationUrl, audioExerciseUrl: ex.audioExerciseUrl }}
                    isPremium={isPremium}
                  />
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
