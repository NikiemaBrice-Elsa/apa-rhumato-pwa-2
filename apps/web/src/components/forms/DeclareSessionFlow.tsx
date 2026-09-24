"use client";

import { useEffect, useState } from "react";
import {
  PATHOLOGY_CODES,
  PATHOLOGY_LABELS_FR,
  DIFFICULTY_LEVELS,
  DIFFICULTY_LABELS_FR,
  type PathologyCode,
  type DifficultyLevel,
} from "@apa/domain";
import { Button } from "@/components/ui/Button";
import { PainRangeInput } from "@/components/ui/PainRangeInput";
import { enqueueOperation } from "@/lib/offlineStorage";

type Step = "pathology" | "form" | "result";

interface DeclarableExercise {
  exerciseId: string;
  orderIndex: number;
  name?: string;
  shortDescription?: string;
  category?: string;
}

function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Déclarer une séance déjà réalisée hors de l'application (§28, §69) —
 * Sprint 29 (22/09/2026, message direct de Dr Nikiema) : « Le patient doit
 * pouvoir faire ses exercices sans passer par l'appli et renseigner plus
 * tard dans l'appli puis enregistrer. »
 *
 * Distinct de `SessionFlow.tsx` (séance guidée EN DIRECT, démarrage puis
 * clôture en deux appels) : ici, tout est saisi et envoyé en une seule fois
 * à `POST /api/sessions/declare`, puisque la séance a déjà eu lieu — même
 * champs de vérification (§28 étape 2) ET de feedback (§69) réunis dans un
 * seul formulaire, plus la date réelle à laquelle la séance a eu lieu.
 *
 * Les exercices prescrits (si un programme validé est assigné) sont chargés
 * via `GET /api/sessions/declare?pathology=...` dès que la pathologie est
 * choisie, pour proposer les mêmes cases à cocher que l'écran de séance en
 * direct — jamais une liste d'exercices inventée en l'absence de programme
 * validé (§57, §59).
 *
 * §54, §10 : hors connexion (ou en cas d'échec réseau), la déclaration est
 * mise en file (`enqueueOperation`) au lieu d'afficher une erreur bloquante,
 * synchronisée automatiquement au retour de connexion (voir
 * `OfflineBanner.tsx`) — même mécanisme que les autres écrans, mais un seul
 * appel à mettre en file ici (pas de dépendance entre deux opérations,
 * contrairement à `SessionFlow.tsx`).
 */
export function DeclareSessionFlow() {
  const [step, setStep] = useState<Step>("pathology");
  const [pathology, setPathology] = useState<PathologyCode | null>(null);
  const [exercises, setExercises] = useState<DeclarableExercise[]>([]);
  const [exercisesLoaded, setExercisesLoaded] = useState(false);
  const [completedExerciseIds, setCompletedExerciseIds] = useState<Set<string>>(new Set());

  const [date, setDate] = useState(todayIsoDate());
  const [douleurAvant, setDouleurAvant] = useState(0);
  const [fatigueAvant, setFatigueAvant] = useState(0);
  const [etatGeneralAvant, setEtatGeneralAvant] = useState("");
  const [realisee, setRealisee] = useState<boolean | null>(null);
  const [difficulte, setDifficulte] = useState<DifficultyLevel | "">("");
  const [douleurApres, setDouleurApres] = useState(0);
  const [fatigueApres, setFatigueApres] = useState(0);
  const [ressenti, setRessenti] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalStatus, setFinalStatus] = useState<"completed" | "abandoned" | "queued_offline" | null>(null);

  useEffect(() => {
    if (!pathology) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setExercisesLoaded(true);
      return;
    }
    let cancelled = false;
    setExercisesLoaded(false);
    fetch(`/api/sessions/declare?pathology=${pathology}`)
      .then((res) => (res.ok ? res.json() : { exercises: [] }))
      .then((data) => {
        if (!cancelled) setExercises(data.exercises ?? []);
      })
      .catch(() => {
        if (!cancelled) setExercises([]);
      })
      .finally(() => {
        if (!cancelled) setExercisesLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [pathology]);

  function selectPathology(code: PathologyCode) {
    setPathology(code);
    setStep("form");
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

  function buildBody() {
    return {
      pathology,
      date,
      douleurAvant,
      fatigueAvant,
      etatGeneralAvant: etatGeneralAvant || undefined,
      realisee,
      difficulte: realisee && difficulte ? difficulte : undefined,
      douleurApres: realisee ? douleurApres : undefined,
      fatigueApres: realisee ? fatigueApres : undefined,
      ressenti: ressenti || undefined,
      completedExerciseIds: realisee ? Array.from(completedExerciseIds) : undefined,
    };
  }

  function queueDeclaration() {
    enqueueOperation({
      id: crypto.randomUUID(),
      entityType: "session_declare",
      method: "POST",
      url: "/api/sessions/declare",
      body: buildBody(),
    });
    setFinalStatus("queued_offline");
    setStep("result");
  }

  async function submitDeclaration() {
    if (!pathology || realisee === null) return;
    setSubmitting(true);
    setError(null);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      queueDeclaration();
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/sessions/declare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody()),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Une erreur est survenue.");
        return;
      }
      setFinalStatus(data.status);
      setStep("result");
    } catch {
      queueDeclaration();
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "pathology") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-primary-700">Pour quelle situation de santé était cette séance&nbsp;?</p>
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

  if (step === "form" && pathology) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-primary-500">
          Situation sélectionnée : <strong>{PATHOLOGY_LABELS_FR[pathology]}</strong>
        </p>

        <div className="flex flex-col gap-1">
          <label className="font-medium text-primary-900">Date de la séance</label>
          <input
            type="date"
            className="input"
            value={date}
            max={todayIsoDate()}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <h2 className="font-semibold text-primary-900">Avant la séance</h2>
        <div className="flex flex-col gap-1">
          <label className="font-medium text-primary-900">Douleur avant (0 = aucune, 10 = maximale)</label>
          <PainRangeInput min={0} max={10} value={douleurAvant} onChange={setDouleurAvant} />
          <span className="text-sm text-primary-500">{douleurAvant}/10</span>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium text-primary-900">Fatigue avant (0 = aucune, 10 = maximale)</label>
          <input type="range" min={0} max={10} value={fatigueAvant} onChange={(e) => setFatigueAvant(Number(e.target.value))} />
          <span className="text-sm text-primary-500">{fatigueAvant}/10</span>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium text-primary-900">Comment vous sentiez-vous&nbsp;? (facultatif)</label>
          <input type="text" className="input" value={etatGeneralAvant} onChange={(e) => setEtatGeneralAvant(e.target.value)} />
        </div>

        <h2 className="font-semibold text-primary-900">Exercices faits</h2>
        {typeof navigator !== "undefined" && !navigator.onLine ? (
          <p className="text-orange-700">
            Hors connexion : la liste de vos exercices prescrits ne peut pas être affichée sans réseau. Vous
            pouvez tout de même déclarer votre séance et son ressenti ci-dessous.
          </p>
        ) : !exercisesLoaded ? (
          <p className="text-sm text-primary-500">Chargement…</p>
        ) : exercises.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {exercises.map((ex) => (
              <li key={ex.exerciseId} className="rounded-xl border border-primary-300 bg-white p-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={completedExerciseIds.has(ex.exerciseId)}
                    onChange={() => toggleExerciseCompleted(ex.exerciseId)}
                  />
                  <span className="font-medium text-primary-900">{ex.name}</span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-primary-700">
            Aucun programme d'exercices validé n'est encore disponible pour cette situation de santé. Vous
            pouvez tout de même déclarer votre séance et son ressenti ci-dessous.
          </p>
        )}

        <h2 className="font-semibold text-primary-900">Après la séance</h2>
        <div className="flex flex-col gap-1">
          <label className="font-medium text-primary-900">Séance réalisée&nbsp;?</label>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1">
              <input type="radio" name="realisee-declare" onChange={() => setRealisee(true)} />
              Oui
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" name="realisee-declare" onChange={() => setRealisee(false)} />
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
                    <input type="radio" name="difficulte-declare" checked={difficulte === level} onChange={() => setDifficulte(level)} />
                    {DIFFICULTY_LABELS_FR[level]}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-medium text-primary-900">Douleur après la séance (0-10)</label>
              <PainRangeInput min={0} max={10} value={douleurApres} onChange={setDouleurApres} />
              <span className="text-sm text-primary-500">{douleurApres}/10</span>
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-medium text-primary-900">Fatigue après la séance (0-10)</label>
              <input type="range" min={0} max={10} value={fatigueApres} onChange={(e) => setFatigueApres(Number(e.target.value))} />
              <span className="text-sm text-primary-500">{fatigueApres}/10</span>
            </div>
          </>
        )}

        <div className="flex flex-col gap-1">
          <label className="font-medium text-primary-900">Comment vous êtes-vous senti(e)&nbsp;? (facultatif)</label>
          <textarea className="input" value={ressenti} onChange={(e) => setRessenti(e.target.value)} />
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <Button type="button" onClick={submitDeclaration} disabled={submitting || realisee === null}>
          {submitting ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    );
  }

  if (step === "result") {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-primary-300 bg-white p-4">
        <h2 className="font-semibold text-primary-900">
          {finalStatus === "queued_offline" ? "Séance enregistrée hors connexion" : "Séance déclarée, merci !"}
        </h2>
        {finalStatus === "queued_offline" ? (
          <p className="text-primary-700">
            Vous n'étiez pas connecté(e). Votre séance est conservée sur cet appareil et sera synchronisée
            automatiquement dès que la connexion reviendra.
          </p>
        ) : (
          <p className="text-primary-700">Votre séance a bien été enregistrée avec la date que vous avez indiquée.</p>
        )}
      </div>
    );
  }

  return null;
}
