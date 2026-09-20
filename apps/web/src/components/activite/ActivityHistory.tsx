"use client";

import { useEffect, useState } from "react";
import {
  formatActivityDurationLabel,
  formatWalkDistanceLabel,
  PHYSICAL_ACTIVITY_TYPE_LABELS_FR,
  type PhysicalActivityType,
} from "@apa/domain";

interface ActivityRow {
  id: string;
  activity_type: PhysicalActivityType;
  duration_seconds: number;
  distance_meters: number | null;
  started_at: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Historique des activités physiques (Sprint 26, 21/09/2026) — demande de
 * Dr Nikiema après le déploiement du chronomètre/suivi de marche GPS
 * (Sprint 25). Lit `GET /api/physical-activities` (les 50 plus récentes,
 * les plus récentes en tête). `refreshKey` (fourni par `ActiviteFlow`)
 * force un rechargement juste après l'enregistrement d'une nouvelle
 * activité, sans dupliquer la logique de récupération à deux endroits.
 */
export function ActivityHistory({ refreshKey }: { refreshKey: number }) {
  const [activities, setActivities] = useState<ActivityRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetch("/api/physical-activities?limit=50")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("http"))))
      .then((data) => {
        if (!cancelled) setActivities(Array.isArray(data.activities) ? data.activities : []);
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger l'historique pour le moment.");
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary-200 p-4">
      <h2 className="font-semibold text-primary-900">Historique</h2>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      {!error && activities === null && <p className="text-sm text-primary-500">Chargement…</p>}

      {activities !== null && activities.length === 0 && (
        <p className="text-sm text-primary-500">Aucune activité enregistrée pour l&apos;instant.</p>
      )}

      {activities !== null && activities.length > 0 && (
        <ul className="flex flex-col gap-2 text-sm">
          {activities.map((a) => (
            <li key={a.id} className="flex items-baseline justify-between gap-2 border-b border-primary-100 pb-1 last:border-none">
              <span className="text-primary-700">
                {formatDate(a.started_at)} — {PHYSICAL_ACTIVITY_TYPE_LABELS_FR[a.activity_type] ?? a.activity_type}
              </span>
              <span className="whitespace-nowrap font-medium text-primary-900">
                {formatActivityDurationLabel(a.duration_seconds)}
                {a.distance_meters ? ` · ${formatWalkDistanceLabel(a.distance_meters)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
