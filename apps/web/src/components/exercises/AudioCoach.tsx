export interface AudioCoachFields {
  audioPreparationUrl?: string | null;
  audioExerciseUrl?: string | null;
}

/**
 * « Coach vocal intégré » (Sprint 20, 10/09/2026) — deux clips audio
 * facultatifs par exercice : un joué avant l'exercice (préparation), un
 * joué pendant l'exercice. Priorisé par Dr Nikiema devant la configuration
 * Resend/SMTP et les notifications push (voir docs/DECISIONS.md,
 * FEUILLE_DE_ROUTE_20260821.md section 4bis).
 *
 * Périmètre V1 : uniquement la partie principale — aucun audio
 * d'échauffement/retour au calme, ce contenu n'existant pas (Dr Nikiema a
 * explicitement choisi de ne pas le fournir pour l'instant, Question 1 du
 * 09/09/2026). Dr Nikiema enregistre lui-même (Question 5 du 09/09/2026) et
 * dépose les liens via l'écran d'administration des exercices ; rien ne
 * s'affiche tant qu'aucun lien n'est renseigné (§57, §59, §78 — même
 * discipline que ExerciseDetails.tsx).
 *
 * Lecteur natif `<audio controls>` plutôt qu'un lecteur personnalisé :
 * fournit nativement barre de progression, pause/lecture et volume/muet, et
 * ne déclenche jamais de lecture automatique au chargement — les
 * navigateurs mobiles bloquent de toute façon l'autoplay avec le son activé,
 * donc la lecture reste toujours une action volontaire du patient (appui
 * sur ▶️), sans code spécifique à maintenir pour contourner cette
 * restriction (même discipline « adaptateur mince » que sw.js, Sprint 12).
 */
export function AudioCoach({ ex }: { ex: AudioCoachFields }) {
  if (!ex.audioPreparationUrl && !ex.audioExerciseUrl) return null;

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-primary-100 pt-2 text-sm">
      <p className="font-medium text-primary-900">🎧 Coach vocal</p>
      {ex.audioPreparationUrl && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-primary-600">Avant l&apos;exercice</span>
          <audio controls preload="none" className="w-full" src={ex.audioPreparationUrl}>
            Votre navigateur ne prend pas en charge la lecture audio.
          </audio>
        </div>
      )}
      {ex.audioExerciseUrl && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-primary-600">Pendant l&apos;exercice</span>
          <audio controls preload="none" className="w-full" src={ex.audioExerciseUrl}>
            Votre navigateur ne prend pas en charge la lecture audio.
          </audio>
        </div>
      )}
    </div>
  );
}
