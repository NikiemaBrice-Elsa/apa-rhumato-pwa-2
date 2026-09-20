"use client";

import { useEffect, useRef, useState } from "react";
import {
  cumulativeWalkDistanceMeters,
  formatWalkDistanceLabel,
  GPS_MAX_ACCEPTABLE_ACCURACY_METERS,
  type GeoPoint,
} from "@apa/domain";
import { Button } from "@/components/ui/Button";

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export interface WalkSessionSummary {
  durationSeconds: number;
  distanceMeters: number;
  startedAt: string;
  completedAt: string;
}

/**
 * Suivi de marche/vélo par distance/durée GPS (Sprint 25, 20/09/2026 ;
 * corrigé Sprint 26, 21/09/2026) — remplace entièrement l'idée de compteur
 * de pas (réponse « c » à la Question 2 de
 * `Proposition_Pas_Chrono_Mediatheque_20260919.docx` : « Remplacer
 * entièrement l'idée de pas par une distance/durée GPS, valable sur les
 * deux systèmes »). Choix motivé par une contrainte technique vérifiée en
 * 09/2026 : l'API de capteur de mouvement (accéléromètre) est bloquée sans
 * contournement sur iOS Safari, alors que `navigator.geolocation`
 * fonctionne aussi bien sur Android que sur iPhone.
 *
 * Même limitation « premier plan uniquement » que CountdownTimer.tsx
 * (V1 simple) : le suivi s'interrompt si la page n'est plus visible.
 *
 * Sprint 26 (21/09/2026) — correction du bug remonté par Dr Nikiema
 * (« la distance parcourue bugue et ne suit pas vraiment la marche ») :
 * - `maximumAge: 0` remplace `5000` : chaque position est fraîche, jamais
 *   une valeur mise en cache par le navigateur (qui pouvait répéter une
 *   position obsolète pendant plusieurs secondes).
 * - Toute position dont la précision annoncée (`coords.accuracy`) dépasse
 *   `GPS_MAX_ACCEPTABLE_ACCURACY_METERS` (packages/domain/src/geo.ts) est
 *   ignorée pour le calcul de distance — cause la plus probable de saccades
 *   et de distances aberrantes (premier fix GPS souvent très imprécis,
 *   signal faible en intérieur/sous couvert). Le suivi reste actif :
 *   la position suivante, si suffisamment précise, est prise en compte
 *   normalement. La précision courante est affichée au patient pour
 *   expliquer une distance qui progresse plus lentement en cas de mauvais
 *   signal, plutôt que de laisser croire à un bug silencieux (§79).
 *
 * `onSessionComplete` (Sprint 26) transmet durée + distance réellement
 * mesurées à l'arrêt, pour enregistrement dans l'historique par
 * `ActiviteFlow`. `onRunningChange` verrouille le sélecteur de type
 * d'activité pendant le suivi.
 */
export function WalkTracker({
  activityLabel,
  onGoalReached,
  onSessionComplete,
  onRunningChange,
}: {
  activityLabel: string;
  onGoalReached: () => void;
  onSessionComplete: (summary: WalkSessionSummary) => void;
  onRunningChange?: (inProgress: boolean) => void;
}) {
  const [tracking, setTracking] = useState(false);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastAccuracyMeters, setLastAccuracyMeters] = useState<number | null>(null);
  const [goalMinutes, setGoalMinutes] = useState<number | "">("");

  const pointsRef = useRef<GeoPoint[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const sessionStartedAtRef = useRef<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const goalReachedRef = useRef(false);
  const onGoalReachedRef = useRef(onGoalReached);
  onGoalReachedRef.current = onGoalReached;
  const onSessionCompleteRef = useRef(onSessionComplete);
  onSessionCompleteRef.current = onSessionComplete;

  function stopTracking() {
    if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (tickIntervalRef.current !== null) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
    setTracking(false);
  }

  useEffect(() => stopTracking, []);

  function handleStart() {
    setErrorMessage(null);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setErrorMessage("La géolocalisation n'est pas disponible sur cet appareil ou ce navigateur.");
      return;
    }

    pointsRef.current = [];
    setDistanceMeters(0);
    setElapsedSeconds(0);
    setLastAccuracyMeters(null);
    goalReachedRef.current = false;
    startTimeRef.current = Date.now();
    sessionStartedAtRef.current = new Date().toISOString();
    onRunningChange?.(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setLastAccuracyMeters(position.coords.accuracy);
        // Sprint 26 : ignore les positions trop imprécises pour le calcul de
        // distance (voir le commentaire de tête) — le suivi reste actif.
        if (position.coords.accuracy > GPS_MAX_ACCEPTABLE_ACCURACY_METERS) {
          return;
        }
        const point: GeoPoint = {
          latitudeDeg: position.coords.latitude,
          longitudeDeg: position.coords.longitude,
        };
        pointsRef.current = [...pointsRef.current, point];
        setDistanceMeters(cumulativeWalkDistanceMeters(pointsRef.current));
      },
      (err) => {
        setErrorMessage(
          err.code === err.PERMISSION_DENIED
            ? "Accès à la position refusé. Autorisez la localisation pour suivre votre marche."
            : "Impossible d'obtenir votre position pour le moment. Vérifiez votre connexion et votre GPS."
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );

    tickIntervalRef.current = setInterval(() => {
      if (startTimeRef.current === null) return;
      const seconds = Math.round((Date.now() - startTimeRef.current) / 1000);
      setElapsedSeconds(seconds);
      if (!goalReachedRef.current && typeof goalMinutes === "number" && goalMinutes > 0 && seconds >= goalMinutes * 60) {
        goalReachedRef.current = true;
        onGoalReachedRef.current();
      }
    }, 1000);

    setTracking(true);
  }

  function handleStop() {
    const durationSeconds = startTimeRef.current !== null ? Math.round((Date.now() - startTimeRef.current) / 1000) : 0;
    const finalDistance = distanceMeters;
    const startedAt = sessionStartedAtRef.current ?? new Date().toISOString();
    stopTracking();
    onRunningChange?.(false);
    if (durationSeconds > 0) {
      onSessionCompleteRef.current({
        durationSeconds,
        distanceMeters: finalDistance,
        startedAt,
        completedAt: new Date().toISOString(),
      });
    }
  }

  function handleReset() {
    stopTracking();
    onRunningChange?.(false);
    setDistanceMeters(0);
    setElapsedSeconds(0);
    setErrorMessage(null);
    setLastAccuracyMeters(null);
    goalReachedRef.current = false;
    pointsRef.current = [];
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary-200 p-4">
      <h2 className="font-semibold text-primary-900">{activityLabel} (distance et durée GPS)</h2>

      {tracking && (
        <p className="animate-pulse text-center text-sm font-semibold text-amber-600">
          ⚠️ Gardez l&apos;écran allumé et l&apos;application ouverte
        </p>
      )}

      <p className="text-xs text-primary-500">
        Distance estimée par GPS, nécessite l&apos;autorisation de localisation.
        {tracking && lastAccuracyMeters !== null && (
          <>
            {" "}
            Précision actuelle : ±{Math.round(lastAccuracyMeters)} m
            {lastAccuracyMeters > GPS_MAX_ACCEPTABLE_ACCURACY_METERS ? " (trop faible, en attente d'un meilleur signal)" : ""}
          </>
        )}
      </p>

      {!tracking && (
        <label className="flex flex-col text-sm text-primary-700">
          Objectif de durée (minutes, facultatif)
          <input
            type="number"
            min={0}
            max={180}
            value={goalMinutes}
            onChange={(e) => setGoalMinutes(e.target.value === "" ? "" : Math.max(0, Number(e.target.value) || 0))}
            className="input w-24"
            placeholder="—"
          />
        </label>
      )}

      <div className="flex justify-around text-center">
        <div>
          <p className="text-2xl font-semibold tabular-nums text-primary-900">{formatWalkDistanceLabel(distanceMeters)}</p>
          <p className="text-xs text-primary-500">Distance</p>
        </div>
        <div>
          <p className="text-2xl font-semibold tabular-nums text-primary-900">{formatDuration(elapsedSeconds)}</p>
          <p className="text-xs text-primary-500">Durée</p>
        </div>
      </div>

      {errorMessage && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      )}

      <div className="flex gap-2">
        {!tracking ? (
          <Button type="button" onClick={handleStart}>
            Démarrer
          </Button>
        ) : (
          <Button type="button" variant="secondary" onClick={handleStop}>
            Arrêter
          </Button>
        )}
        {!tracking && (distanceMeters > 0 || elapsedSeconds > 0) && (
          <Button type="button" variant="secondary" onClick={handleReset}>
            Réinitialiser
          </Button>
        )}
      </div>
    </div>
  );
}
