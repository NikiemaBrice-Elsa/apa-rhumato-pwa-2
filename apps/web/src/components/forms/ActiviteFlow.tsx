"use client";

import { useRef, useState } from "react";
import { CountdownTimer } from "@/components/activite/CountdownTimer";
import { WalkTracker } from "@/components/activite/WalkTracker";
import { Button } from "@/components/ui/Button";

/**
 * Chronomètre + marche GPS (Sprint 25, 20/09/2026).
 *
 * Contexte (docs/DECISIONS.md, Sprint 25) : demande initiale de
 * Dr Nikiema du 19/09/2026 (« Intégrer compteur de pas et un chronomètre...
 * »), précisée en deux allers-retours de questions/réponses en document
 * Word (§ règle personnelle : décisions cliniques/produit toujours en
 * Q/R Word) :
 * - Compte à rebours : V1 simple, premier plan uniquement (réponse du
 *   19/09/2026).
 * - « Compteur de pas » : remplacé entièrement par une distance/durée GPS,
 *   pour fonctionner identiquement sur Android et iPhone (réponse du
 *   19/09/2026, l'accéléromètre étant bloqué sans contournement sur iOS
 *   Safari).
 * - Note vocale de fin : strictement limitée à cette phrase de fin
 *   d'activité (réponse du 20/09/2026, Question 1 « a ») ; PAS de voix de
 *   synthèse — Dr Nikiema a enregistré lui-même une phrase générique, sans
 *   nom ni civilité, pour préserver l'anonymat et le secret médical
 *   (réponses du 20/09/2026, Questions 2 « b » et 3, réponse libre :
 *   « Ne pas insérer cette option pour renforcer l'anonymat et le secret
 *   médical »). Le fichier audio (`objectif-atteint.mp3`) est un asset
 *   statique unique, identique pour tous les patients — aucune donnée
 *   personnelle n'y est associée, aucun appel à un service tiers.
 *
 * Médiathèque par pathologie (images/audio) : explicitement reportée par
 * Dr Nikiema (« À faire plus tard ») — hors périmètre de cette V1, non
 * traitée ici.
 *
 * Aucune persistance en base pour cette V1 (ni le chronomètre, ni la
 * marche) : non demandée, voir docs/DECISIONS.md.
 */
export function ActiviteFlow() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [soundBlocked, setSoundBlocked] = useState(false);

  function playCompletionSound() {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => setSoundBlocked(true));
    }
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.([200, 100, 200]);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-primary-700">
        Ces outils fonctionnent uniquement pendant que l&apos;application reste ouverte à
        l&apos;écran (voir le détail sous chaque outil).
      </p>

      <audio ref={audioRef} src="/audio/objectif-atteint.mp3" preload="auto" />

      <div className="flex flex-col gap-2 rounded-lg bg-primary-50 px-3 py-2">
        <p className="text-sm text-primary-700">🔊 Note vocale de fin d&apos;activité</p>
        <Button type="button" variant="secondary" onClick={playCompletionSound}>
          Tester le son
        </Button>
      </div>
      {soundBlocked && (
        <p className="text-xs text-primary-500">
          Le son n&apos;a pas pu être joué automatiquement par votre navigateur — utilisez le
          bouton « Tester le son » ci-dessus pour vérifier votre volume.
        </p>
      )}

      <CountdownTimer onComplete={playCompletionSound} />
      <WalkTracker onGoalReached={playCompletionSound} />
    </div>
  );
}
