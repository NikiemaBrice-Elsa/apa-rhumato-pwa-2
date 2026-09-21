"use client";

import { useState, type ReactNode } from "react";
import { ReadAloudButton } from "./ReadAloudButton";

export interface ExerciseLibraryDetailFields {
  shortDescription: string;
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
 * Détail d'un exercice dans la BIBLIOTHÈQUE (§25, §26) uniquement — distinct
 * du composant partagé `ExerciseDetails.tsx` (toujours utilisé tel quel par
 * `SessionFlow.tsx` pendant une séance, non concerné par cette demande).
 *
 * Sprint 28 (20/09/2026) — affichage demandé par Dr Nikiema après avoir vu
 * la bibliothèque en usage réel :
 * 1. Description brève en tête, avec un bouton de lecture à voix haute
 *    (`ReadAloudButton`, Web Speech API — distinct du coach vocal
 *    pré-enregistré `AudioCoach.tsx`).
 * 2. Le déroulé (position de départ, consignes, respiration, durée,
 *    répétitions, séries, récupération) s'affiche directement, PAS en
 *    onglet — Dr Nikiema n'a demandé que 3 onglets précis (point 3).
 * 3. Seuls 3 onglets : Précautions, Contre-indications, Critères d'arrêt —
 *    brefs, invisibles tant qu'on ne clique pas dessus.
 * 4. Aucune référence scientifique montrée ici (jamais montrée non plus
 *    auparavant) : Dr Nikiema a choisi de décrire l'appui de l'application
 *    sur les recommandations des sociétés savantes dans la section
 *    « À propos » plutôt que dans le détail de chaque exercice — voir
 *    apps/web/src/app/(dashboard)/a-propos/page.tsx.
 *
 * §57, §59, §78 : n'affiche que ce qui est réellement renseigné.
 */
export function ExerciseLibraryDetail({ ex }: { ex: ExerciseLibraryDetailFields }) {
  const metrics: string[] = [];
  if (ex.durationSeconds) metrics.push(`${ex.durationSeconds} s`);
  if (ex.repetitions) metrics.push(`${ex.repetitions} répétitions`);
  if (ex.sets) metrics.push(`${ex.sets} séries`);
  if (ex.restTimeSeconds) metrics.push(`${ex.restTimeSeconds} s de récupération`);

  const hasDeroule =
    metrics.length > 0 || Boolean(ex.startingPosition) || Boolean(ex.executionSteps) || Boolean(ex.breathingInstruction);

  const tabs: Tab[] = [];

  if (ex.precautions) {
    tabs.push({ key: "precautions", label: "Précautions", content: <p className="text-amber-800">{ex.precautions}</p> });
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

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-col gap-1">
        <p className="text-primary-700">{ex.shortDescription}</p>
        <ReadAloudButton text={ex.shortDescription} />
      </div>

      {hasDeroule && (
        <div className="flex flex-col gap-1 border-t border-primary-100 pt-2">
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
      )}

      {tabs.length > 0 && <ExerciseLibraryDetailTabs tabs={tabs} />}
    </div>
  );
}

function ExerciseLibraryDetailTabs({ tabs }: { tabs: Tab[] }) {
  const [activeKey, setActiveKey] = useState(tabs[0].key);
  const active = tabs.find((t) => t.key === activeKey) ?? tabs[0];

  if (tabs.length === 1) {
    return <div className="border-t border-primary-100 pt-2">{tabs[0].content}</div>;
  }

  return (
    <div className="border-t border-primary-100 pt-2">
      <div role="tablist" className="flex flex-wrap gap-1 pb-2">
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
      <div role="tabpanel" className="pt-1">
        {active.content}
      </div>
    </div>
  );
}
