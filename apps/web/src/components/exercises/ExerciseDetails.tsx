"use client";

import { useState, type ReactNode } from "react";

export interface ExerciseDetailFields {
  startingPosition?: string | null;
  executionSteps?: string | null;
  breathingInstruction?: string | null;
  durationSeconds?: number | null;
  repetitions?: number | null;
  sets?: number | null;
  restTimeSeconds?: number | null;
  precautions?: string | null;
  contraindications?: string | null;
  stopCriteria?: string | null;
}

interface Tab {
  key: string;
  label: string;
  content: ReactNode;
}

/**
 * Détails d'exécution et de sécurité d'un exercice (durée, répétitions,
 * consignes, précautions, contre-indications, critères d'arrêt).
 *
 * Découverte du 10/09/2026 : ces champs existent dans `exercise_library`
 * depuis le Sprint 5, et `precautions`/`contraindications`/`stop_criteria`
 * sont déjà validés pour les 8 exercices en ligne — mais n'étaient
 * jusqu'alors affichés NULLE PART côté patient (ni dans la bibliothèque
 * d'exercices, ni pendant une séance). Ce composant partagé corrige les
 * deux écrans à la fois (voir apps/web/src/app/(dashboard)/exercices/page.tsx
 * et apps/web/src/components/forms/SessionFlow.tsx).
 *
 * Mise à jour du 10/09/2026 (retour patient : « les caractéristiques sont
 * déversées ») : les trois champs de sécurité (précautions, contre-
 * indications, critères d'arrêt) sont chacun de longs paragraphes sourcés
 * dans la littérature (§81) — empilés verticalement, ils formaient un mur
 * de texte. Regroupés désormais en onglets, un groupe par nature
 * d'information, un seul visible à la fois. Passe en "use client" pour
 * l'état de l'onglet actif (aucun impact : ce composant reste importable
 * depuis un Server Component, voir exercices/page.tsx, comme n'importe quel
 * Client Component).
 *
 * Sprint 28 (20/09/2026) : reste utilisé tel quel par `SessionFlow.tsx`
 * (case à cocher d'une séance en cours). La bibliothèque d'exercices
 * (`exercices/page.tsx`) utilise désormais son propre composant dédié,
 * `ExerciseLibraryDetail.tsx` (description brève + lecture à voix haute,
 * puis seulement 3 onglets de sécurité), pour répondre à une demande
 * d'affichage spécifique à cet écran sans changer le comportement, déjà
 * en place et non remis en cause, de l'écran de séance.
 *
 * §57, §59, §78 : n'affiche que ce qui est réellement renseigné — jamais un
 * intitulé de champ vide ni une valeur déduite. Un exercice pour lequel
 * rien de tout cela n'a encore été rempli ne montre donc rien de plus que
 * son nom et sa courte description, comme avant. Un seul onglet renseigné
 * s'affiche directement, sans barre d'onglets inutile.
 */
export function ExerciseDetails({ ex }: { ex: ExerciseDetailFields }) {
  const metrics: string[] = [];
  if (ex.durationSeconds) metrics.push(`${ex.durationSeconds} s`);
  if (ex.repetitions) metrics.push(`${ex.repetitions} répétitions`);
  if (ex.sets) metrics.push(`${ex.sets} séries`);
  if (ex.restTimeSeconds) metrics.push(`${ex.restTimeSeconds} s de récupération`);

  const hasDeroule = metrics.length > 0 || Boolean(ex.startingPosition) || Boolean(ex.executionSteps) || Boolean(ex.breathingInstruction);

  const tabs: Tab[] = [];

  if (hasDeroule) {
    tabs.push({
      key: "deroule",
      label: "Déroulé",
      content: (
        <div className="flex flex-col gap-1">
          {metrics.length > 0 && <p className="text-primary-700">{metrics.join(" · ")}</p>}
          {ex.startingPosition && (
            <p className="text-primary-700">
              <span className="font-medium">Position de départ : </span>
              {ex.startingPosition}
            </p>
          )}
          {ex.executionSteps && (
            <p className="text-primary-700">
              <span className="font-medium">Consignes : </span>
              {ex.executionSteps}
            </p>
          )}
          {ex.breathingInstruction && (
            <p className="text-primary-700">
              <span className="font-medium">Respiration : </span>
              {ex.breathingInstruction}
            </p>
          )}
        </div>
      ),
    });
  }

  if (ex.precautions) {
    tabs.push({
      key: "precautions",
      label: "Précautions",
      content: <p className="text-amber-800">{ex.precautions}</p>,
    });
  }

  if (ex.contraindications) {
    tabs.push({
      key: "contraindications",
      label: "Contre-indications",
      content: <p className="text-amber-800">{ex.contraindications}</p>,
    });
  }

  if (ex.stopCriteria) {
    tabs.push({
      key: "stop",
      label: "Critères d'arrêt",
      content: <p className="font-medium text-red-700">Arrêtez l&apos;exercice si : {ex.stopCriteria}</p>,
    });
  }

  if (tabs.length === 0) return null;

  return <ExerciseDetailsTabs tabs={tabs} />;
}

function ExerciseDetailsTabs({ tabs }: { tabs: Tab[] }) {
  const [activeKey, setActiveKey] = useState(tabs[0].key);
  const active = tabs.find((t) => t.key === activeKey) ?? tabs[0];

  if (tabs.length === 1) {
    return <div className="mt-2 border-t border-primary-100 pt-2 text-sm">{tabs[0].content}</div>;
  }

  return (
    <div className="mt-2 border-t border-primary-100 pt-2 text-sm">
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-primary-100 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={tab.key === active.key}
            onClick={() => setActiveKey(tab.key)}
            className={
              tab.key === active.key
                ? "rounded-full bg-primary-700 px-3 py-1 text-xs font-medium text-white"
                : "rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100"
            }
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="pt-2">
        {active.content}
      </div>
    </div>
  );
}
