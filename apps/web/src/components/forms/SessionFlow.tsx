"use client";

import { useState } from "react";
import {
  PATHOLOGY_CODES,
  PATHOLOGY_LABELS_FR,
  DIFFICULTY_LEVELS,
  DIFFICULTY_LABELS_FR,
  EXERCISE_PHASES,
  EXERCISE_PHASE_LABELS_FR,
  type PathologyCode,
  type DifficultyLevel,
  type ExercisePhase,
} from "@apa/domain";
import { Button } from "@/components/ui/Button";
import { dependencyToken } from "@/lib/offlineQueue";
import { enqueueOperation } from "@/lib/offlineStorage";
import { ExerciseDetails } from "@/components/exercises/ExerciseDetails";
import { AudioCoach } from "@/components/exercises/AudioCoach";

type Step = "pathology" | "verification" | "session" | "feedback" | "result";

interface SessionExerciseView {
  exerciseId: string;
  orderIndex: number;
  phase?: ExercisePhase | null;
  name?: string;
  shortDescription?: string;
  category?: string;
  // Ajoutés le 10/09/2026 — voir apps/web/src/app/api/sessions/route.ts et
  // apps/web/src/components/exercises/ExerciseDetails.tsx. Chacun peut être
  // `null` — ne jamais afficher une valeur par défaut à la place, un champ
  // vide signifie seulement qu'il n'a pas encore été renseigné pour cet
  // exercice.
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
  // Ajoutés le 10/09/2026 — « coach vocal intégré » (Sprint 20), voir
  // apps/web/src/components/exercises/AudioCoach.tsx. Même règle : `null`
  // tant qu'aucun audio n'a été déposé côté admin, jamais de lecture
  // automatique.
  audioPreparationUrl?: string | null;
  audioExerciseUrl?: string | null;
}

/**
 * Séance guidée (§28 « Structure d'une séance », §69 « Feedback après
 * séance ») — Sprint 7, structure en 3 phases ajoutée au Sprint 18 (réf. B8).
 *
 * §28 distingue 6 étapes : 1. Présentation, 2. Vérification rapide,
 * 3. Échauffement, 4. Exercices principaux, 5. Retour au calme,
 * 6. Feedback. `exercise_library.phase` (migration 0014) permet désormais de
 * classer un exercice dans l'une de ces 3 phases, mais RESTE NULLABLE : tant
 * qu'un exercice donné n'a pas été explicitement classé par le concepteur
 * médical, `phase` est `null` (inventer ce classement serait exactement le
 * type de contenu médical non sourcé interdit par §57/§59). Ce composant
 * n'affiche donc les 3 sections nommées « Échauffement / Partie principale /
 * Retour au calme » QUE si TOUS les exercices de la séance ont une phase
 * renseignée ; dès qu'un seul exercice n'est pas classé, il retombe sur
 * l'affichage historique en une seule liste (jamais de section « non classé »
 * fusionnée silencieusement avec une vraie phase, qui laisserait croire à un
 * classement partiel qui n'existe pas).
 *
 * §54, §10 (Sprint 12) : « réalisation d'une séance » et « enregistrement
 * temporaire des données » hors connexion sont le minimum explicitement
 * demandé par le cahier des charges. Démarrer une séance ou envoyer son
 * feedback hors ligne (ou en cas d'échec réseau) met l'opération en file
 * (src/lib/offlineQueue.ts) au lieu d'afficher une erreur bloquante ; la
 * synchronisation a lieu automatiquement au retour de connexion (voir
 * OfflineBanner, monté dans le layout du groupe (dashboard)).
 */
function allExercisesClassified(exercises: SessionExerciseView[]): boolean {
  return exercises.length > 0 && exercises.every((ex) => ex.phase != null);
}

interface SessionFlowProps {
  /** Réf. B11 (31/08/2026) : pré-sélection depuis la « séance du jour ». */
  initialPathology?: PathologyCode;
  initialPlannedSessionId?: string;
  /**
   * §48, Sprint 24 (14/09/2026, Q4 « a » validée) : statut premium calculé
   * une seule fois côté serveur (voir apps/web/src/app/(dashboard)/seance/page.tsx
   * et apps/web/src/lib/premiumAccess.ts) et transmis tel quel à AudioCoach —
   * ce composant client ne recalcule jamais lui-même l'accès premium.
   */
  isPremium?: boolean;
}

export function SessionFlow({ initialPathology, initialPlannedSessionId, isPremium = false }: SessionFlowProps = {}) {
  const [step, setStep] = useState<Step>(initialPathology ? "verification" : "pathology");
  const [pathology, setPathology] = useState<PathologyCode | null>(initialPathology ?? null);
  const [plannedSessionId] = useState<string | undefined>(initialPlannedSessionId);
  const [completedExerciseIds, setCompletedExerciseIds] = useState<Set<string>>(new Set());
  const [douleurAvant, setDouleurAvant] = useState(0);
  const [fatigueAvant, setFatigueAvant] = useState(0);
  const [etatGeneralAvant, setEtatGeneralAvant] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionIsLocal, setSessionIsLocal] = useState(false);
  const [programAssigned, setProgramAssigned] = useState(false);
  const [exercises, setExercises] = useState<SessionExerciseView[]>([]);
  const [realisee, setRealisee] = useState<boolean | null>(null);
  const [difficulte, setDifficulte] = useState<DifficultyLevel | "">("");
  const [douleurApres, setDouleurApres] = useState(0);
  const [fatigueApres, setFatigueApres] = useState(0);
  const [ressenti, setRessenti] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalStatus, setFinalStatus] = useState<"completed" | "abandoned" | "queued_offline" | null>(null);

  function selectPathology(code: PathologyCode) {
    setPathology(code);
    setStep("verification");
  }

  function queueSessionStart() {
    const body = {
      pathology,
      douleurAvant,
      fatigueAvant,
      etatGeneralAvant: etatGeneralAvant || undefined,
      plannedSessionId,
    };
    const op = enqueueOperation({ id: crypto.randomUUID(), entityType: "session", method: "POST", url: "/api/sessions", body });
    setSessionId(op.id);
    setSessionIsLocal(true);
    setProgramAssigned(false);
    setExercises([]);
    setStep("session");
  }

  async function startSession() {
    if (!pathology) return;
    setSubmitting(true);
    setError(null);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      queueSessionStart();
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pathology,
          douleurAvant,
          fatigueAvant,
          etatGeneralAvant: etatGeneralAvant || undefined,
          plannedSessionId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Une erreur est survenue.");
        return;
      }
      setSessionId(data.sessionId);
      setSessionIsLocal(false);
      setProgramAssigned(Boolean(data.programAssigned));
      setExercises(data.exercises ?? []);
      setStep("session");
    } catch {
      // Échec réseau (pas seulement "hors ligne" détecté à l'avance, ex.
      // coupure en cours de requête) : on ne bloque pas la séance (§10).
      queueSessionStart();
    } finally {
      setSubmitting(false);
    }
  }

  function toggleExerciseCompleted(exerciseId: string) {
    setCompletedExerciseIds((prev) => {
      const next = new Set(prev);
      if (next.has(exerciseId)) {
        next.delete(exerciseId);
      } else {
        next.add(exerciseId);
      }
      return next;
    });
  }

  function queueFeedback() {
    if (!sessionId) return;
    const body = {
      realisee,
      difficulte: realisee && difficulte ? difficulte : undefined,
      douleurApres: realisee ? douleurApres : undefined,
      fatigueApres: realisee ? fatigueApres : undefined,
      ressenti: ressenti || undefined,
      completedExerciseIds: realisee ? Array.from(completedExerciseIds) : undefined,
    };
    enqueueOperation({
      id: crypto.randomUUID(),
      entityType: "session_feedback",
      method: "PATCH",
      url: sessionIsLocal ? `/api/sessions/${dependencyToken(sessionId)}` : `/api/sessions/${sessionId}`,
      body,
      dependsOnOperationId: sessionIsLocal ? sessionId : null,
    });
    setFinalStatus("queued_offline");
    setStep("result");
  }

  async function submitFeedback() {
    if (!sessionId || realisee === null) return;
    setSubmitting(true);
    setError(null);

    if (sessionIsLocal || (typeof navigator !== "undefined" && !navigator.onLine)) {
      queueFeedback();
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          realisee,
          difficulte: realisee && difficulte ? difficulte : undefined,
          douleurApres: realisee ? douleurApres : undefined,
          fatigueApres: realisee ? fatigueApres : undefined,
          ressenti: ressenti || undefined,
          completedExerciseIds: realisee ? Array.from(completedExerciseIds) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Une erreur est survenue.");
        return;
      }
      setFinalStatus(data.status);
      setStep("result");
    } catch {
      queueFeedback();
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "pathology") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-primary-700">Pour quelle situation de santé démarrez-vous une séance&nbsp;?</p>
        {PATHOLOGY_CODES.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => selectPathology(code)}
            className="rounded-xl border border-primary-300 bg-white px-4 py-3 text-left font-medium text-primary-900 hover:border-primary-500"
          >
            {PATHOLOGY_LABELS_FR[code]}
          </button>
        ))}
      </div>
    );
  }

  if (step === "verification" && pathology) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-primary-500">
          Situation sélectionnée : <strong>{PATHOLOGY_LABELS_FR[pathology]}</strong>
        </p>
        <h2 className="font-semibold text-primary-900">Vérification rapide</h2>
        <div className="flex flex-col gap-1">
          <label className="font-medium text-primary-900">Douleur actuelle (0 = aucune, 10 = maximale)</label>
          <input
            type="range"
            min={0}
            max={10}
            value={douleurAvant}
            onChange={(e) => setDouleurAvant(Number(e.target.value))}
          />
          <span className="text-sm text-primary-500">{douleurAvant}/10</span>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium text-primary-900">Fatigue actuelle (0 = aucune, 10 = maximale)</label>
          <input
            type="range"
            min={0}
            max={10}
            value={fatigueAvant}
            onChange={(e) => setFatigueAvant(Number(e.target.value))}
          />
          <span className="text-sm text-primary-500">{fatigueAvant}/10</span>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium text-primary-900">Comment vous sentez-vous aujourd'hui&nbsp;? (facultatif)</label>
          <input
            type="text"
            className="input"
            value={etatGeneralAvant}
            onChange={(e) => setEtatGeneralAvant(e.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <Button type="button" onClick={startSession} disabled={submitting}>
          {submitting ? "Démarrage…" : "Démarrer la séance"}
        </Button>
      </div>
    );
  }

  if (step === "session") {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="font-semibold text-primary-900">Exercices de la séance</h2>
        {sessionIsLocal ? (
          <p className="text-orange-700">
            Séance démarrée hors connexion : les exercices de votre programme ne peuvent pas être affichés
            sans réseau. Vous pouvez tout de même réaliser votre séance et enregistrer votre ressenti
            ci-dessous ; tout sera synchronisé dès que la connexion reviendra.
          </p>
        ) : programAssigned && exercises.length > 0 ? (
          <>
            <p className="text-sm text-primary-500">
              Cochez les exercices que vous avez effectivement faits — cela permet de mieux suivre votre séance
              (réf. B13).
            </p>
            {allExercisesClassified(exercises) ? (
              <div className="flex flex-col gap-5">
                {EXERCISE_PHASES.map((phase) => {
                  const phaseExercises = exercises.filter((ex) => ex.phase === phase);
                  if (phaseExercises.length === 0) return null;
                  return (
                    <div key={phase} className="flex flex-col gap-2">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-primary-500">
                        {EXERCISE_PHASE_LABELS_FR[phase]}
                      </h3>
                      <ul className="flex flex-col gap-3">
                        {phaseExercises.map((ex) => (
                          <li key={ex.exerciseId} className="rounded-xl border border-primary-300 bg-white p-4">
                            <label className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                className="mt-1"
                                checked={completedExerciseIds.has(ex.exerciseId)}
                                onChange={() => toggleExerciseCompleted(ex.exerciseId)}
                              />
                              <div className="flex-1">
                                <p className="font-medium text-primary-900">{ex.name}</p>
                                {ex.shortDescription && <p className="text-sm text-primary-700">{ex.shortDescription}</p>}
                                <ExerciseDetails ex={ex} />
                                <AudioCoach ex={ex} isPremium={isPremium} />
                              </div>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {exercises.map((ex) => (
                  <li key={ex.exerciseId} className="rounded-xl border border-primary-300 bg-white p-4">
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={completedExerciseIds.has(ex.exerciseId)}
                        onChange={() => toggleExerciseCompleted(ex.exerciseId)}
                      />
                      <div className="flex-1">
                        <p className="font-medium text-primary-900">{ex.name}</p>
                        {ex.shortDescription && <p className="text-sm text-primary-700">{ex.shortDescription}</p>}
                        <ExerciseDetails ex={ex} />
                        <AudioCoach ex={ex} isPremium={isPremium} />
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-primary-700">
            Aucun programme d'exercices validé n'est encore disponible pour cette situation de santé (voir
            « Mon programme »). Vous pouvez tout de même enregistrer votre ressenti ci-dessous.
          </p>
        )}
        <Button type="button" onClick={() => setStep("feedback")}>
          Terminer la séance
        </Button>
      </div>
    );
  }

  if (step === "feedback") {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="font-semibold text-primary-900">Feedback après séance</h2>
        <div className="flex flex-col gap-1">
          <label className="font-medium text-primary-900">Séance réalisée&nbsp;?</label>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1">
              <input type="radio" name="realisee" onChange={() => setRealisee(true)} />
              Oui
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" name="realisee" onChange={() => setRealisee(false)} />
              Non
            </label>
          </div>
        </div>

        {realisee && (
          <>
            <div className="flex flex-col gap-1">
              <label className="font-medium text-primary-900">Difficulté ressentie</label>
              <div className="flex flex-col gap-1 text-sm">
                {DIFFICULTY_LEVELS.map((level) => (
                  <label key={level} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="difficulte"
                      checked={difficulte === level}
                      onChange={() => setDifficulte(level)}
                    />
                    {DIFFICULTY_LABELS_FR[level]}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-medium text-primary-900">Douleur après la séance (0-10)</label>
              <input
                type="range"
                min={0}
                max={10}
                value={douleurApres}
                onChange={(e) => setDouleurApres(Number(e.target.value))}
              />
              <span className="text-sm text-primary-500">{douleurApres}/10</span>
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-medium text-primary-900">Fatigue après la séance (0-10)</label>
              <input
                type="range"
                min={0}
                max={10}
                value={fatigueApres}
                onChange={(e) => setFatigueApres(Number(e.target.value))}
              />
              <span className="text-sm text-primary-500">{fatigueApres}/10</span>
            </div>
          </>
        )}

        <div className="flex flex-col gap-1">
          <label className="font-medium text-primary-900">Comment vous sentez-vous&nbsp;? (facultatif)</label>
          <textarea className="input" value={ressenti} onChange={(e) => setRessenti(e.target.value)} />
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <Button type="button" onClick={submitFeedback} disabled={submitting || realisee === null}>
          {submitting ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    );
  }

  if (step === "result") {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-primary-300 bg-white p-4">
        <h2 className="font-semibold text-primary-900">
          {finalStatus === "completed"
            ? "Séance enregistrée, bravo !"
            : finalStatus === "queued_offline"
              ? "Séance enregistrée hors connexion"
              : "Séance enregistrée"}
        </h2>
        {finalStatus === "queued_offline" ? (
          <p className="text-primary-700">
            Vous n'étiez pas connecté(e). Votre séance et votre feedback sont conservés sur cet
            appareil et seront synchronisés automatiquement dès que la connexion reviendra.
          </p>
        ) : (
          <p className="text-primary-700">Votre feedback a bien été pris en compte.</p>
        )}
      </div>
    );
  }

  return null;
}
