"use client";

import { useRef, useState } from "react";
import { PHYSICAL_ACTIVITY_TYPE_LABELS_FR, PHYSICAL_ACTIVITY_TYPES, isGpsTrackedActivityType, type PhysicalActivityType } from "@apa/domain";
import { CountdownTimer, type CountdownSessionSummary } from "@/components/activite/CountdownTimer";
import { WalkTracker, type WalkSessionSummary } from "@/components/activite/WalkTracker";
import { ActivityHistory } from "@/components/activite/ActivityHistory";
import { Button } from "@/components/ui/Button";
import { enqueueOperation } from "@/lib/offlineStorage";

/**
 * Chronomètre + marche/vélo GPS + historique (Sprint 25 le 20/09/2026,
 * étendu Sprint 26 le 21/09/2026).
 *
 * Contexte (docs/DECISIONS.md) : demande initiale de Dr Nikiema du
 * 19/09/2026 (« Intégrer compteur de pas et un chronomètre... »), précisée
 * en deux allers-retours de questions/réponses en document Word (§ règle
 * personnelle : décisions cliniques/produit toujours en Q/R Word). Après
 * déploiement et essai réel du Sprint 25, Dr Nikiema a demandé le 21/09/2026
 * (Sprint 26, cette fois en message direct — évolution d'ergonomie, pas une
 * décision clinique/produit nécessitant un document Word) :
 * 1. Choisir le type d'activité avant de lancer le compte à rebours (marche,
 *    vélo, aérobie, fitness, natation, autre).
 * 2. Un historique de la durée et du type des activités.
 * 3. Ces activités dans le rapport PDF de suivi (voir packages/pdf-report).
 * 4. Corriger le bug de distance GPS (voir packages/domain/src/geo.ts,
 *    `GPS_MAX_ACCEPTABLE_ACCURACY_METERS`).
 * 5. Raccourcir + faire clignoter l'avertissement « gardez l'écran allumé »
 *    (voir CountdownTimer.tsx / WalkTracker.tsx, `animate-pulse`).
 *
 * Marche et vélo utilisent le suivi GPS (`WalkTracker`, distance + durée) ;
 * aérobie, fitness, natation et autre utilisent le compte à rebours
 * (`CountdownTimer`, durée programmée, pas de distance) — un seul outil
 * affiché à la fois, déterminé par le type sélectionné
 * (`isGpsTrackedActivityType`). Le sélecteur est verrouillé pendant qu'une
 * session est en cours (`sessionActive`) pour ne jamais changer de type au
 * milieu d'une activité déjà commencée.
 *
 * Persistance (Sprint 26) : `POST /api/physical-activities` à la fin de
 * chaque session (§57, §59 : uniquement une durée réellement effectuée,
 * jamais une durée programmée non atteinte — voir CountdownTimer.tsx,
 * « Terminer maintenant »). Repli sur la file hors connexion
 * (`enqueueOperation`, même mécanisme que SuiviFlow.tsx/PatientProfileForm.tsx
 * depuis le Sprint 24) si l'enregistrement échoue — utile en particulier
 * pour la marche/le vélo en extérieur, où la connexion peut être absente au
 * moment où l'activité se termine.
 *
 * Note vocale de fin : strictement limitée à cette phrase de fin d'activité
 * (réponse du 20/09/2026, Question 1 « a ») ; PAS de voix de synthèse —
 * Dr Nikiema a enregistré lui-même une phrase générique, sans nom ni
 * civilité, pour préserver l'anonymat et le secret médical (réponses du
 * 20/09/2026, Questions 2 « b » et 3, réponse libre : « Ne pas insérer cette
 * option pour renforcer l'anonymat et le secret médical »).
 *
 * Médiathèque par pathologie (images/audio) : explicitement reportée par
 * Dr Nikiema (« À faire plus tard ») — hors périmètre, non traitée ici.
 */
export function ActiviteFlow() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [activityType, setActivityType] = useState<PhysicalActivityType>("marche");
  const [sessionActive, setSessionActive] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

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

  async function saveActivity(summary: CountdownSessionSummary | WalkSessionSummary) {
    if (summary.durationSeconds <= 0) return;

    const payload = {
      activityType,
      durationSeconds: summary.durationSeconds,
      distanceMeters: summary.distanceMeters ?? undefined,
      startedAt: summary.startedAt,
      completedAt: summary.completedAt,
    };

    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("offline");
      }
      const res = await fetch("/api/physical-activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("http-error");
      setSaveMessage("Activité enregistrée dans votre historique.");
      setHistoryRefreshKey((k) => k + 1);
    } catch {
      enqueueOperation({
        id: crypto.randomUUID(),
        entityType: "physical_activity",
        method: "POST",
        url: "/api/physical-activities",
        body: payload,
      });
      setSaveMessage("Hors connexion : cette activité sera enregistrée dès que la connexion sera rétablie.");
    }
  }

  const usesGps = isGpsTrackedActivityType(activityType);

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

      <div className="flex flex-col gap-2 rounded-xl border border-primary-200 p-4">
        <h2 className="font-semibold text-primary-900">Type d&apos;activité</h2>
        <select
          className="input"
          value={activityType}
          disabled={sessionActive}
          onChange={(e) => setActivityType(e.target.value as PhysicalActivityType)}
        >
          {PHYSICAL_ACTIVITY_TYPES.map((type) => (
            <option key={type} value={type}>
              {PHYSICAL_ACTIVITY_TYPE_LABELS_FR[type]}
            </option>
          ))}
        </select>
        {sessionActive && <p className="text-xs text-primary-500">Type verrouillé pendant l&apos;activité en cours.</p>}
      </div>

      {saveMessage && <p className="text-sm text-primary-700">{saveMessage}</p>}

      {usesGps ? (
        <WalkTracker
          activityLabel={PHYSICAL_ACTIVITY_TYPE_LABELS_FR[activityType]}
          onGoalReached={playCompletionSound}
          onSessionComplete={saveActivity}
          onRunningChange={setSessionActive}
        />
      ) : (
        <CountdownTimer onComplete={playCompletionSound} onSessionComplete={saveActivity} onRunningChange={setSessionActive} />
      )}

      <ActivityHistory refreshKey={historyRefreshKey} />
    </div>
  );
}
