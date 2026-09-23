"use client";

import { useState } from "react";
import { ExerciseDetails, type ExerciseDetailFields } from "./ExerciseDetails";

export interface ProgramExerciseView extends ExerciseDetailFields {
  exerciseId: string;
  name: string;
  shortDescription: string;
}

type ExerciseTypeTab = "aerobique" | "renforcement";

const TAB_LABELS_FR: Record<ExerciseTypeTab, string> = {
  aerobique: "Aérobie",
  renforcement: "Renforcement musculaire",
};

interface ProgramExerciseTabsProps {
  aerobique: ProgramExerciseView[];
  renforcement: ProgramExerciseView[];
}

/**
 * « Mon programme » (§67-68) — Sprint 32 (23/09/2026, instruction directe de
 * Dr Nikiema) : « sous chaque pathologie les onglets aérobie et
 * renforcement et quand le patient clique dessus il voit les exercices
 * qu'il doit faire. » Mêmes deux types que l'écran pédagogique
 * (`ExerciseTypePreview.tsx`, Sprint 31) — volontairement PAS les 6
 * catégories internes (`EXERCISE_CATEGORIES`) affichées jusqu'ici en simples
 * badges sur cette page : ce choix suit littéralement la demande (deux
 * onglets nommés), et le détail complet par catégorie reste consultable dans
 * la bibliothèque d'exercices (/exercices) pour qui le souhaite.
 *
 * Les exercices affichés sont ceux du programme VALIDÉ réellement assigné à
 * la pathologie (`program_exercises`, même source que le démarrage d'une
 * séance en direct — voir apps/web/src/app/(dashboard)/programme/page.tsx),
 * jamais une liste théorique : si aucun exercice validé n'existe encore pour
 * un onglet donné, l'écran le dit explicitement plutôt que d'afficher un
 * onglet vide sans explication (§57, §59, §78).
 */
export function ProgramExerciseTabs({ aerobique, renforcement }: ProgramExerciseTabsProps) {
  const lists: Record<ExerciseTypeTab, ProgramExerciseView[]> = { aerobique, renforcement };
  const [tab, setTab] = useState<ExerciseTypeTab>(aerobique.length > 0 ? "aerobique" : "renforcement");
  const activeExercises = lists[tab];

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="flex gap-2" role="tablist" aria-label="Type d'exercice">
        {(["aerobique", "renforcement"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={
              tab === t
                ? "flex-1 rounded-lg border border-primary-700 bg-primary-700 px-3 py-2 text-sm font-medium text-white"
                : "flex-1 rounded-lg border border-primary-300 bg-white px-3 py-2 text-sm font-medium text-primary-700 hover:border-primary-500"
            }
          >
            {TAB_LABELS_FR[t]}
            {lists[t].length > 0 ? ` (${lists[t].length})` : ""}
          </button>
        ))}
      </div>
      {activeExercises.length === 0 ? (
        <p className="text-sm text-primary-500">
          Aucun exercice validé n&apos;est encore disponible pour « {TAB_LABELS_FR[tab]} » pour cette pathologie.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {activeExercises.map((ex) => (
            <li key={ex.exerciseId} className="rounded-lg border border-primary-200 bg-white p-3">
              <p className="font-medium text-primary-900">{ex.name}</p>
              {ex.shortDescription && <p className="text-sm text-primary-700">{ex.shortDescription}</p>}
              <ExerciseDetails ex={ex} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
