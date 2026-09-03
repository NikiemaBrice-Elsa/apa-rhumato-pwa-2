"use client";

import { useEffect, useState } from "react";
import { getConflictCount, getPendingCount, onQueueChanged, syncNow } from "@/lib/offlineStorage";

/**
 * Indicateur hors connexion + synchronisation (§54, §10) — Sprint 12.
 * Affiché sur les pages où des écritures hors connexion sont possibles
 * (aujourd'hui : la séance, voir SessionFlow.tsx). Se synchronise
 * automatiquement dès que la connexion revient (évènement `online`), et
 * propose un bouton manuel — jamais de synchronisation silencieuse qui
 * cacherait un conflit à l'utilisateur (§79).
 */
export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [conflicts, setConflicts] = useState(0);
  const [syncing, setSyncing] = useState(false);

  function refreshCounts() {
    setPending(getPendingCount());
    setConflicts(getConflictCount());
  }

  async function trySync() {
    if (syncing) return;
    setSyncing(true);
    try {
      await syncNow();
    } finally {
      setSyncing(false);
      refreshCounts();
    }
  }

  useEffect(() => {
    setIsOnline(navigator.onLine);
    refreshCounts();

    const unsubscribe = onQueueChanged(refreshCounts);
    const handleOnline = () => {
      setIsOnline(true);
      trySync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isOnline && pending === 0 && conflicts === 0) {
    return null;
  }

  return (
    <div
      className={`rounded-xl border px-4 py-2 text-sm ${
        conflicts > 0
          ? "border-red-300 bg-red-50 text-red-700"
          : isOnline
            ? "border-primary-300 bg-primary-50 text-primary-700"
            : "border-orange-300 bg-orange-50 text-orange-700"
      }`}
    >
      {!isOnline && <p>Vous êtes hors connexion. Vos actions sont enregistrées et seront synchronisées.</p>}
      {pending > 0 && <p>{pending} action(s) en attente de synchronisation.</p>}
      {conflicts > 0 && <p>{conflicts} action(s) n'ont pas pu être synchronisées (conflit). Voir le détail dans la séance concernée.</p>}
      {isOnline && pending > 0 && (
        <button type="button" onClick={trySync} disabled={syncing} className="mt-1 underline disabled:opacity-50">
          {syncing ? "Synchronisation…" : "Synchroniser maintenant"}
        </button>
      )}
    </div>
  );
}
