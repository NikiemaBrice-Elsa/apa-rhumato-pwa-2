"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  computePsfsAverageScore,
  PSFS_MIN_ACTIVITIES,
  PSFS_MAX_ACTIVITIES,
  PATHOLOGY_LABELS_FR,
  PROFILE_LEVEL_LABELS_FR,
  type PathologyCode,
  type ProfileLevel,
} from "@apa/domain";
import { MiniLineChart } from "@/components/ui/MiniLineChart";
import { Button } from "@/components/ui/Button";

interface PsfsActivityRow {
  activity_label: string;
  difficulty_score: number;
  order_index: number;
}

interface FunctionalCapacityAssessmentRow {
  id: string;
  instrument: "psfs" | "promis_pf_cat";
  assessed_at: string;
  psfs_activities: PsfsActivityRow[];
}

interface WeeklyStats {
  weekStart: string;
  weekEnd: string;
  sessionsCompleted: number;
  totalActiveMinutes: number;
  adherencePercent: number | null;
  adherenceBasis: "no_validated_program_frequency" | "validated_program_frequency";
  sessionsCompletionPercent: number | null;
  doseCompletionPercent: number | null;
}

interface WeekBucket {
  weekStart: string;
  sessionsCompleted: number;
  totalActiveMinutes: number;
}

interface ProgressionRow {
  pathology: PathologyCode;
  decision: "progress" | "maintain" | "reduce" | "suspend" | "MEDICAL_PARAMETER_REQUIRED";
  message: string | null;
  currentProfileLevel: ProfileLevel;
  canProgressToLevel: ProfileLevel | null;
}

const PROGRESSION_DECISION_STYLES: Record<ProgressionRow["decision"], string> = {
  progress: "border-green-300 bg-green-50 text-green-800",
  maintain: "border-primary-300 bg-primary-50 text-primary-800",
  reduce: "border-orange-300 bg-orange-50 text-orange-800",
  suspend: "border-red-300 bg-red-50 text-red-800",
  MEDICAL_PARAMETER_REQUIRED: "border-primary-200 bg-white text-primary-500",
};

function formatWeekLabel(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

/**
 * §33 « Cette semaine » + « Progression » (activité, séances), §70 — Sprint 9.
 *
 * L'adhésion n'est affichée que si `adherenceBasis` confirme qu'un programme
 * validé avec une fréquence cible existe ; sinon un message explicite est
 * affiché plutôt qu'un chiffre inventé (§57, §59 — voir la garde-fou
 * `computeAdherencePercent`, testée dans
 * apps/web/tests/security/statistics-no-invented-adherence.test.ts).
 * La « capacité fonctionnelle » (§33, réf. B10, 20/08/2026) est recueillie
 * via 2 instruments distincts (Sprint 18) : le PSFS est une saisie patient
 * complète (méthodologie publique de l'instrument, voir
 * packages/domain/src/functionalCapacity.ts) ; PROMIS Physical Function
 * (CAT) reste explicitement en attente — administrer un vrai test adaptatif
 * sans la banque d'items et le moteur officiels (HealthMeasures Assessment
 * Center) reviendrait à fabriquer un instrument validé de mémoire (§57, §59)
 * — voir QUESTIONS_SEANCE_CAPACITE_FONCTIONNELLE_20260830.docx.
 */
function emptyPsfsActivities() {
  return Array.from({ length: PSFS_MIN_ACTIVITIES }, () => ({ label: "", score: 5 }));
}

export function StatisticsFlow() {
  const [weekly, setWeekly] = useState<WeeklyStats | null>(null);
  const [history, setHistory] = useState<WeekBucket[]>([]);
  const [historyIsPremium, setHistoryIsPremium] = useState(true);
  const [historyMaxWeeks, setHistoryMaxWeeks] = useState<number | null>(null);
  const [capacity, setCapacity] = useState<FunctionalCapacityAssessmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [progression, setProgression] = useState<ProgressionRow[]>([]);
  const [progressingPathology, setProgressingPathology] = useState<PathologyCode | null>(null);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [progressSuccess, setProgressSuccess] = useState<string | null>(null);

  const [showPsfsForm, setShowPsfsForm] = useState(false);
  const [psfsActivities, setPsfsActivities] = useState(emptyPsfsActivities());
  const [psfsSaving, setPsfsSaving] = useState(false);
  const [psfsError, setPsfsError] = useState<string | null>(null);

  async function loadCapacity() {
    const res = await fetch("/api/functional-capacity");
    const data = await res.json();
    if (res.ok) {
      setCapacity(data.assessments ?? []);
    }
  }

  async function loadProgression() {
    const res = await fetch("/api/statistics/progression");
    const data = await res.json();
    if (res.ok) {
      setProgression(data.progression ?? []);
    }
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [weeklyRes, historyRes] = await Promise.all([
          fetch("/api/statistics/weekly"),
          // §48, Sprint 24 : on demande toujours la fenêtre maximale (26 semaines) —
          // c'est l'API qui plafonne silencieusement à 4 semaines pour un compte
          // gratuit et renvoie `isPremium`/`maxWeeksAllowed` pour l'affichage.
          fetch("/api/statistics/history?weeks=26"),
        ]);
        const [weeklyData, historyData] = await Promise.all([weeklyRes.json(), historyRes.json()]);
        if (!weeklyRes.ok || !historyRes.ok) {
          setError(weeklyData.message ?? historyData.message ?? "Une erreur est survenue.");
          return;
        }
        setWeekly(weeklyData);
        setHistory(historyData.weeks ?? []);
        setHistoryIsPremium(Boolean(historyData.isPremium));
        setHistoryMaxWeeks(typeof historyData.maxWeeksAllowed === "number" ? historyData.maxWeeksAllowed : null);
        await Promise.all([loadCapacity(), loadProgression()]);
      } catch {
        setError("Impossible de charger vos statistiques pour le moment.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleProgress(pathology: PathologyCode) {
    setProgressingPathology(pathology);
    setProgressError(null);
    setProgressSuccess(null);
    try {
      const res = await fetch("/api/programs/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathology }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProgressError(data.message ?? "Une erreur est survenue.");
        return;
      }
      setProgressSuccess(
        `Programme mis à jour : ${PATHOLOGY_LABELS_FR[pathology]} passe au niveau ${PROFILE_LEVEL_LABELS_FR[data.newProfileLevel as ProfileLevel]}.`
      );
      await loadProgression();
    } catch {
      setProgressError("Impossible de mettre à jour votre programme pour le moment.");
    } finally {
      setProgressingPathology(null);
    }
  }

  function updatePsfsActivity(index: number, patch: Partial<{ label: string; score: number }>) {
    setPsfsActivities((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  function addPsfsActivity() {
    if (psfsActivities.length >= PSFS_MAX_ACTIVITIES) return;
    setPsfsActivities((prev) => [...prev, { label: "", score: 5 }]);
  }

  function removePsfsActivity(index: number) {
    if (psfsActivities.length <= PSFS_MIN_ACTIVITIES) return;
    setPsfsActivities((prev) => prev.filter((_, i) => i !== index));
  }

  async function submitPsfs() {
    setPsfsSaving(true);
    setPsfsError(null);
    const activities = psfsActivities.map((a) => ({ activityLabel: a.label.trim(), difficultyScore: a.score }));
    if (activities.some((a) => !a.activityLabel)) {
      setPsfsError("Chaque activité doit avoir un nom.");
      setPsfsSaving(false);
      return;
    }
    try {
      const res = await fetch("/api/functional-capacity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instrument: "psfs", activities }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPsfsError(data.message ?? "Une erreur est survenue.");
        return;
      }
      setShowPsfsForm(false);
      setPsfsActivities(emptyPsfsActivities());
      await loadCapacity();
    } catch {
      setPsfsError("Impossible d'enregistrer cette évaluation pour le moment.");
    } finally {
      setPsfsSaving(false);
    }
  }

  if (loading) {
    return <p className="text-primary-700">Chargement de vos statistiques…</p>;
  }

  if (error) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </p>
    );
  }

  const sessionsSeries = history.map((w) => ({ label: formatWeekLabel(w.weekStart), value: w.sessionsCompleted }));
  const minutesSeries = history.map((w) => ({ label: formatWeekLabel(w.weekStart), value: w.totalActiveMinutes }));

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2 rounded-xl border border-primary-300 bg-white p-4">
        <h2 className="font-semibold text-primary-900">Cette semaine (§33)</h2>
        <p className="text-primary-700">Séances réalisées : {weekly?.sessionsCompleted ?? 0}</p>
        <p className="text-primary-700">Minutes d'activité : {weekly?.totalActiveMinutes ?? 0}</p>
        {weekly?.sessionsCompletionPercent !== null ? (
          <p className="text-primary-700">
            Séances complètes : {weekly?.sessionsCompletionPercent}% (des séances prescrites cette semaine)
          </p>
        ) : (
          <p className="text-sm text-primary-500">
            Séances complètes : non calculable pour l'instant (aucun programme validé médicalement avec une
            fréquence cible ne vous est encore attribué — voir « Mon programme »).
          </p>
        )}
        {weekly?.doseCompletionPercent !== null ? (
          <p className="text-primary-700">
            Dose réalisée : {weekly?.doseCompletionPercent}% (exercices cochés faits / exercices prescrits)
          </p>
        ) : (
          <p className="text-sm text-primary-500">
            Dose réalisée : non calculable pour l'instant (aucun exercice prescrit enregistré cette semaine).
          </p>
        )}
        <p className="text-xs text-primary-400">
          Nouvelle formule d'adhésion à 2 indicateurs (réf. B13) : une séance est « complète » dès que 80% ou plus
          des exercices prescrits ont été cochés comme faits.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-primary-900">Progression — séances par semaine</h2>
        <MiniLineChart points={sessionsSeries} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-primary-900">Progression — minutes d'activité par semaine</h2>
        <MiniLineChart points={minutesSeries} unit=" min" />
      </section>

      {!historyIsPremium && (
        <p className="text-sm text-primary-500">
          Historique limité aux {historyMaxWeeks ?? 4} dernières semaines pour un compte gratuit.{" "}
          <Link href="/abonnement" className="underline">
            Passez au premium
          </Link>{" "}
          pour retrouver l'historique complet.
        </p>
      )}

      {progression.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold text-primary-900">Recommandation de progression</h2>
          <p className="text-sm text-primary-500">
            Ceci est un affichage informatif : votre programme n'est jamais modifié automatiquement. Une bascule de
            niveau reste toujours une action volontaire de votre part.
          </p>
          {progressSuccess && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{progressSuccess}</p>
          )}
          {progressError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {progressError}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {progression.map((row) => (
              <div
                key={row.pathology}
                className={`rounded-xl border p-4 ${PROGRESSION_DECISION_STYLES[row.decision]}`}
              >
                <p className="font-medium">
                  {PATHOLOGY_LABELS_FR[row.pathology]} — niveau actuel : {PROFILE_LEVEL_LABELS_FR[row.currentProfileLevel]}
                </p>
                {row.decision === "MEDICAL_PARAMETER_REQUIRED" ? (
                  <p className="text-sm">
                    Pas encore assez de données récentes pour établir une recommandation cette semaine.
                  </p>
                ) : (
                  <p className="text-sm">{row.message}</p>
                )}
                {row.decision === "progress" && row.canProgressToLevel && (
                  <Button
                    type="button"
                    className="mt-2 w-auto px-4 py-2"
                    disabled={progressingPathology === row.pathology}
                    onClick={() => handleProgress(row.pathology)}
                  >
                    {progressingPathology === row.pathology
                      ? "Mise à jour…"
                      : `Passer au niveau ${PROFILE_LEVEL_LABELS_FR[row.canProgressToLevel]}`}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-primary-900">Capacité fonctionnelle (PSFS)</h2>
        {(() => {
          const psfsHistory = capacity
            .filter((a) => a.instrument === "psfs")
            .map((a) => ({
              label: new Date(a.assessed_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
              value: computePsfsAverageScore(a.psfs_activities.map((x) => ({ difficultyScore: x.difficulty_score }))) ?? 0,
            }));
          return psfsHistory.length > 0 ? (
            <MiniLineChart points={psfsHistory} unit="/10" />
          ) : (
            <p className="text-sm text-primary-500">
              Aucune évaluation PSFS enregistrée pour l'instant. Le PSFS demande de nommer {PSFS_MIN_ACTIVITIES} à{" "}
              {PSFS_MAX_ACTIVITIES} activités qui vous posent difficulté et de noter chacune de 0 (aucune difficulté)
              à 10 (impossible).
            </p>
          );
        })()}

        {!showPsfsForm ? (
          <Button type="button" variant="secondary" className="w-auto px-4 py-2" onClick={() => setShowPsfsForm(true)}>
            + Nouvelle évaluation PSFS
          </Button>
        ) : (
          <div className="flex flex-col gap-3 rounded-xl border border-primary-300 bg-white p-4">
            {psfsActivities.map((activity, index) => (
              <div key={index} className="flex flex-col gap-1">
                <label className="text-sm font-medium text-primary-900">Activité {index + 1}</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ex. Monter les escaliers"
                  value={activity.label}
                  onChange={(e) => updatePsfsActivity(index, { label: e.target.value })}
                />
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={activity.score}
                  onChange={(e) => updatePsfsActivity(index, { score: Number(e.target.value) })}
                />
                <div className="flex items-center justify-between text-sm text-primary-500">
                  <span>{activity.score}/10</span>
                  {psfsActivities.length > PSFS_MIN_ACTIVITIES && (
                    <button type="button" className="underline" onClick={() => removePsfsActivity(index)}>
                      Retirer
                    </button>
                  )}
                </div>
              </div>
            ))}
            {psfsActivities.length < PSFS_MAX_ACTIVITIES && (
              <Button type="button" variant="secondary" className="w-auto px-3 py-1 text-xs" onClick={addPsfsActivity}>
                + Ajouter une activité
              </Button>
            )}
            {psfsError && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {psfsError}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="button" className="w-auto px-4 py-2" disabled={psfsSaving} onClick={submitPsfs}>
                {psfsSaving ? "Enregistrement…" : "Enregistrer"}
              </Button>
              <Button type="button" variant="secondary" className="w-auto px-4 py-2" onClick={() => setShowPsfsForm(false)}>
                Annuler
              </Button>
            </div>
          </div>
        )}

        <p className="text-sm text-primary-500">
          PROMIS Physical Function (test adaptatif) : recueil pas encore disponible dans l'application — son
          administration réelle nécessite l'outil officiel (HealthMeasures Assessment Center) ou une liste
          d'items fixe que le concepteur médical doit fournir ; en attente de sa décision (§33, §57, §59).
        </p>
      </section>

      <p className="text-sm text-primary-500">
        Pour l'évolution de la douleur, du poids, du tour de taille, de la tension et de la glycémie, voir{" "}
        <a href="/suivi" className="underline">
          Mon suivi
        </a>
        .
      </p>
    </div>
  );
}
