"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

function formatMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

/**
 * Chronomètre / compte à rebours pour une activité physique (Sprint 25,
 * 20/09/2026 — réponse « V1 simple » à la Question 1 de
 * `Proposition_Pas_Chrono_Mediatheque_20260919.docx`).
 *
 * Périmètre V1, assumé et affiché au patient : fonctionne uniquement tant
 * que l'application reste ouverte et visible à l'écran. Les navigateurs
 * mobiles (Android et surtout iOS) suspendent l'exécution JavaScript en
 * arrière-plan ou écran verrouillé (vérifié 09/2026) — aucune notification
 * fiable ne peut donc être garantie hors de l'application au premier plan.
 * Ceci recoupe la limitation déjà documentée pour les notifications push
 * réelles (Priorité 3, reportée le 12/09/2026) : même contrainte technique,
 * pas une nouvelle décision.
 *
 * Le temps restant est recalculé à partir d'une échéance absolue
 * (`Date.now()` + durée), jamais par simple décompte de ticks : si le
 * navigateur ralentit ou suspend le minuteur en arrière-plan, l'affichage se
 * corrige tout seul dès que l'application redevient visible, plutôt que de
 * dériver silencieusement.
 *
 * `onComplete` est appelé une seule fois lorsque le compte à rebours atteint
 * zéro — le composant appelant (`ActiviteFlow`) déclenche la note vocale de
 * fin (fichier audio statique, aucune synthèse vocale, aucune
 * personnalisation — voir docs/DECISIONS.md, Sprint 25).
 */
export function CountdownTimer({ onComplete }: { onComplete: () => void }) {
  const [inputMinutes, setInputMinutes] = useState(10);
  const [inputSeconds, setInputSeconds] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  const deadlineRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  function clearTick() {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function tick() {
    if (deadlineRef.current === null) return;
    const secondsLeft = Math.round((deadlineRef.current - Date.now()) / 1000);
    if (secondsLeft <= 0) {
      setRemainingSeconds(0);
      setRunning(false);
      setFinished(true);
      clearTick();
      onCompleteRef.current();
      return;
    }
    setRemainingSeconds(secondsLeft);
  }

  function handleStart() {
    const baseSeconds = remainingSeconds ?? inputMinutes * 60 + inputSeconds;
    if (baseSeconds <= 0) return;
    setFinished(false);
    deadlineRef.current = Date.now() + baseSeconds * 1000;
    setRemainingSeconds(baseSeconds);
    setRunning(true);
    clearTick();
    intervalRef.current = setInterval(tick, 250);
  }

  function handlePause() {
    if (deadlineRef.current !== null) {
      const secondsLeft = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));
      setRemainingSeconds(secondsLeft);
    }
    setRunning(false);
    clearTick();
  }

  function handleReset() {
    setRunning(false);
    setFinished(false);
    setRemainingSeconds(null);
    deadlineRef.current = null;
    clearTick();
  }

  useEffect(() => clearTick, []);

  const displaySeconds = remainingSeconds ?? inputMinutes * 60 + inputSeconds;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary-200 p-4">
      <h2 className="font-semibold text-primary-900">Compte à rebours</h2>

      <p className="text-xs text-primary-500">
        Fonctionne tant que cette page reste ouverte et visible à l&apos;écran. Si vous verrouillez
        votre téléphone ou changez d&apos;application, le décompte peut s&apos;arrêter ou se figer ;
        la note vocale de fin sonnera à votre retour sur l&apos;application, pas forcément à
        l&apos;heure exacte.
      </p>

      {!running && remainingSeconds === null && (
        <div className="flex items-center gap-2">
          <label className="flex flex-col text-sm text-primary-700">
            Minutes
            <input
              type="number"
              min={0}
              max={180}
              value={inputMinutes}
              onChange={(e) => setInputMinutes(Math.max(0, Number(e.target.value) || 0))}
              className="input w-20"
            />
          </label>
          <label className="flex flex-col text-sm text-primary-700">
            Secondes
            <input
              type="number"
              min={0}
              max={59}
              value={inputSeconds}
              onChange={(e) => setInputSeconds(Math.min(59, Math.max(0, Number(e.target.value) || 0)))}
              className="input w-20"
            />
          </label>
        </div>
      )}

      <p className="text-center text-4xl font-semibold tabular-nums text-primary-900">
        {formatMmSs(displaySeconds)}
      </p>

      {finished && (
        <p className="text-center font-medium text-primary-700">🔔 Temps écoulé — objectif atteint !</p>
      )}

      <div className="flex gap-2">
        {!running && (
          <Button type="button" onClick={handleStart} disabled={displaySeconds <= 0}>
            {remainingSeconds !== null && !finished ? "Reprendre" : "Démarrer"}
          </Button>
        )}
        {running && (
          <Button type="button" variant="secondary" onClick={handlePause}>
            Pause
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={handleReset}>
          Réinitialiser
        </Button>
      </div>
    </div>
  );
}
