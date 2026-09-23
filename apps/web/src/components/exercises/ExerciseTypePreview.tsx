"use client";

import { useState } from "react";
import { PATHOLOGY_LABELS_FR, type PathologyCode } from "@apa/domain";

type ExerciseImageType = "aerobique" | "renforcement";

const TABS: readonly ExerciseImageType[] = ["aerobique", "renforcement"];

const TAB_LABELS_FR: Record<ExerciseImageType, string> = {
  aerobique: "Aérobie",
  renforcement: "Renforcement musculaire",
};

interface ExerciseTypePreviewProps {
  pathology: PathologyCode;
}

/**
 * Infographie « Quels exercices pour quelle pathologie ? » validée par
 * Dr Nikiema (fournie le 22/09/2026), découpée en 12 images (6 pathologies x
 * 2 types d'exercice : aérobie / renforcement musculaire — voir
 * apps/web/public/images/pathologies/). Réponses du 23/09/2026 sur le
 * placement :
 *
 * 1. « mettre deux onglets côte à côte (aérobie et renforcement). Le patient
 *    clique sur ce qu'il veut faire et l'image correspondante apparaît » —
 *    implémenté ci-dessous avec deux boutons faisant office d'onglets.
 * 2. Affiché (a) une fois après l'évaluation initiale / attribution du
 *    programme (AssessmentFlow, écran pédagogique — voir
 *    apps/web/src/lib/exerciseTypeEducation.ts pour le « déjà vu ») et
 *    (b) à CHAQUE démarrage de séance (SessionFlow, étape "type_exercice",
 *    sans notion de « déjà vu » — affiché systématiquement).
 *
 * Composant volontairement sans état persistant : c'est à l'appelant
 * (AssessmentFlow / SessionFlow) de décider QUAND l'afficher ; ce composant
 * se contente d'afficher l'image correspondant à l'onglet choisi par le
 * patient pour UNE pathologie donnée.
 */
export function ExerciseTypePreview({ pathology }: ExerciseTypePreviewProps) {
  const [type, setType] = useState<ExerciseImageType>("aerobique");
  const imageSrc = `/images/pathologies/${pathology}_${type}.jpg`;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary-300 bg-white p-4">
      <p className="font-medium text-primary-900">
        Exercices adaptés — {PATHOLOGY_LABELS_FR[pathology]}
      </p>
      <div className="flex gap-2" role="tablist" aria-label="Type d'exercice">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={type === t}
            onClick={() => setType(t)}
            className={
              type === t
                ? "flex-1 rounded-lg border border-primary-700 bg-primary-700 px-3 py-2 text-sm font-medium text-white"
                : "flex-1 rounded-lg border border-primary-300 bg-white px-3 py-2 text-sm font-medium text-primary-700 hover:border-primary-500"
            }
          >
            {TAB_LABELS_FR[t]}
          </button>
        ))}
      </div>
      {/* Images statiques locales (public/) : balise <img> simple plutôt que
          next/image, pas de redimensionnement dynamique nécessaire ici. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageSrc}
        alt={`Exercices ${TAB_LABELS_FR[type].toLowerCase()} recommandés pour : ${PATHOLOGY_LABELS_FR[pathology]}`}
        className="w-full rounded-lg border border-primary-200"
      />
    </div>
  );
}
