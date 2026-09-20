"use client";

import { useEffect, useRef, useState } from "react";
import { cumulativeWalkDistanceMeters, type GeoPoint } from "@apa/domain";
import { Button } from "@/components/ui/Button";

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

/**
 * Suivi de marche par distance/durée GPS (Sprint 25, 20/09/2026) — remplace
 * entièrement l'idée de compteur de pas (réponse « c » à la Question 2 de
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
 * Objectif de durée facultatif : si renseigné, `onGoalReached` est appelé
 * une seule fois quand la durée écoulée l'atteint (déclenche la même note
 * vocale que le compte à rebours, via `ActiviteFlow`) — le suivi continue
 * ensuite jusqu'à l'arrêt manuel, le patient pouvant vouloir marcher plus
 * longtemps que son objectif.
 *
 * Calcul de distance : `cumulativeWalkDistanceMeters` (packages/domain,
 * fonction pure testée) à partir des positions successives de
 * `watchPosition`. Rien n'est envoyé ni stocké côté serveur — aucune
 * persistance en base pour cette V1 (non demandée, voir docs/DECISIONS.md).
 */
export function WalkTracker({ onGoalReached }: { onGoalReached: () => void }) {
  const [tracking, setTracking] = useState(false);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [goalMinutes, setGoalMinutes] = useState<number | "">("");

  const pointsRef = useRef<GeoPoint[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const goalReachedRef = useRef(false);
  const onGoalReachedRef = useRef(onGoalReached);
  onGoalReachedRef.current = onGoalReached;

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
    goalReachedRef.current = false;
    startTimeRef.current = Date.now();

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
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
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
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
    stopTracking();
  }

  function handleReset() {
    stopTracking();
    setDistanceMeters(0);
    setElapsedSeconds(0);
    setErrorMessage(null);
    goalReachedRef.current = false;
    pointsRef.current = [];
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary-200 p-4">
      <h2 className="font-semibold text-primary-900">Marche (distance et durée GPS)</h2>

      <p className="text-xs text-primary-500">
        Nécessite l&apos;autorisation de localisation et que cette page reste ouverte et visible à
        l&apos;écran pendant la marche. La distance est une estimation GPS, pas une mesure de
        précision.
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
          <p className="text-2xl font-semibold tabular-nums text-primary-900">{formatDistance(distanceMeters)}</p>
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
            Démarrer la marche
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
