"use client";

import { useEffect, useState } from "react";
import { getConflictCount, getPendingCount, onQueueChanged, syncNow } from "@/lib/offlineStorage";

/**
 * Indicateur hors connexion + synchronisation (§54, §10) — Sprint 12,
 * étendu au Sprint 24 (14/09/2026) aux mesures de suivi (`SuiviFlow.tsx`)
 * et au profil patient (`PatientProfileForm.tsx`), en plus de la séance
 * (`SessionFlow.tsx`) — la file d'attente elle-même (`offlineQueue.ts`)
 * était déjà générique par entité, seuls ces deux écrans ne l'utilisaient
 * pas encore et échouaient silencieusement hors connexion.
 *
 * Sprint 29 (22/09/2026, message direct de Dr Nikiema) : « je veux que la
 * synchronisation soit automatique au retour de la connexion et ne pas
 * paraitre comme une option à valider par le patient. » La synchronisation
 * au retour de connexion (évènement `online`) était déjà automatique (pas
 * de changement nécessaire là) ; ce qui a changé ici est la présence d'un
 * bouton « Synchroniser maintenant » qui laissait croire à une action
 * requise. Il est retiré : la bannière redevient purement informative
 * (jamais un bouton à actionner). Pour rester fiable SANS ce filet manuel
 * (ex. un échec transitoire pendant que l'appareil se croit déjà en ligne,
 * ou une file restée en attente d'une visite précédente), la
 * synchronisation se déclenche désormais aussi automatiquement (a) au
 * montage du composant si l'appareil est déjà en ligne, et (b) à chaque
 * retour au premier plan de l'onglet (`visibilitychange`) — en plus de
 * l'évènement `online` existant. Les conflits (§79 : jamais cachés à
 * l'utilisateur) restent affichés tels quels : ce ne sont pas des
 * resynchronisations à valider, mais des données qui n'ont pas pu être
 * enregistrées et que le patient doit ressaisir depuis l'écran d'origine —
 * aucun bouton ne peut « résoudre » un conflit automatiquement.
 */
export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [conflicts, setConflicts] = useState(0);

  function refreshCounts() {
    setPending(getPendingCount());
    setConflicts(getConflictCount());
  }

  useEffect(() => {
    let syncing = false;
    async function trySync() {
      if (syncing) return;
      syncing = true;
      try {
        await syncNow();
      } finally {
        syncing = false;
        refreshCounts();
      }
    }

    setIsOnline(navigator.onLine);
    refreshCounts();
    if (navigator.onLine) {
      trySync();
    }

    const unsubscribe = onQueueChanged(refreshCounts);
    const handleOnline = () => {
      setIsOnline(true);
      trySync();
    };
    const handleOffline = () => setIsOnline(false);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        trySync();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      unsubscribe();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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
      {!isOnline && <p>Vous êtes hors connexion. Vos actions sont enregistrées et seront synchronisées automatiquement dès que la connexion reviendra.</p>}
      {pending > 0 && <p>{pending} action(s) en attente de synchronisation automatique.</p>}
      {conflicts > 0 && (
        <p>{conflicts} action(s) n'ont pas pu être synchronisées (conflit). Réessayez l'action concernée (séance, mesure ou profil) depuis l'écran où vous l'avez saisie.</p>
      )}
    </div>
  );
}
