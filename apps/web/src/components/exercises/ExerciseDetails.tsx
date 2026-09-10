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
 * §57, §59, §78 : n'affiche que ce qui est réellement renseigné — jamais un
 * intitulé de champ vide ni une valeur déduite. Un exercice pour lequel
 * rien de tout cela n'a encore été rempli ne montre donc rien de plus que
 * son nom et sa courte description, comme avant.
 */
export function ExerciseDetails({ ex }: { ex: ExerciseDetailFields }) {
  const metrics: string[] = [];
  if (ex.durationSeconds) metrics.push(`${ex.durationSeconds} s`);
  if (ex.repetitions) metrics.push(`${ex.repetitions} répétitions`);
  if (ex.sets) metrics.push(`${ex.sets} séries`);
  if (ex.restTimeSeconds) metrics.push(`${ex.restTimeSeconds} s de récupération`);

  const hasDetails =
    metrics.length > 0 ||
    ex.startingPosition ||
    ex.executionSteps ||
    ex.breathingInstruction ||
    ex.precautions ||
    ex.contraindications ||
    ex.stopCriteria;

  if (!hasDetails) return null;

  return (
    <div className="mt-2 flex flex-col gap-1 border-t border-primary-100 pt-2 text-sm">
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
      {ex.precautions && (
        <p className="text-amber-800">
          <span className="font-medium">Précautions : </span>
          {ex.precautions}
        </p>
      )}
      {ex.contraindications && (
        <p className="text-amber-800">
          <span className="font-medium">Contre-indications : </span>
          {ex.contraindications}
        </p>
      )}
      {ex.stopCriteria && <p className="font-medium text-red-700">Arrêtez l&apos;exercice si : {ex.stopCriteria}</p>}
    </div>
  );
}
