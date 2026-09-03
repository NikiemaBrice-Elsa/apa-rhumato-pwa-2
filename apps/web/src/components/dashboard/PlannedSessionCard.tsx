"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PATHOLOGY_LABELS_FR, type PathologyCode } from "@apa/domain";
import { Button } from "@/components/ui/Button";

interface PlannedExerciseView {
  exerciseId: string;
  orderIndex: number;
  name?: string;
  shortDescription?: string;
}

interface PlannedSessionRow {
  plannedSessionId: string;
  pathology: PathologyCode;
  plannedFor: string;
  isOverdue: boolean;
  wasPostponed: boolean;
  exercises: PlannedExerciseView[];
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "2-digit" });
}

/**
 * « Séance du jour » (§33, réf. B11, 31/08/2026) : affichée sur le tableau
 * de bord uniquement s'il existe au moins une séance planifiée `due`
 * (aujourd'hui ou en retard) pour l'une des pathologies de l'utilisateur.
 * Report ou annulation pour raison de sécurité restent des actions
 * strictement volontaires du patient — jamais automatiques (§57, §59, §78).
 */
export function PlannedSessionCard() {
  const [rows, setRows] = useState<PlannedSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [postponingId, setPostponingId] = useState<string | null>(null);
  const [postponeDate, setPostponeDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/planning/today");
      const data = await res.json();
      if (res.ok) setRows(data.plannedSessions ?? []);
    } catch {
      // Ne bloque pas le tableau de bord si la planification échoue à charger.
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function confirmPostpone(id: string) {
    if (!postponeDate) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/planning/${id}/postpone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newDate: postponeDate }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Une erreur est survenue.");
        return;
      }
      setPostponingId(null);
      setPostponeDate("");
      await load();
    } catch {
      setError("Impossible de reporter cette séance pour le moment.");
    } finally {
      setBusyId(null);
    }
  }

  async function cancelSafety(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/planning/${id}/cancel-safety`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Une erreur est survenue.");
        return;
      }
      await load();
    } catch {
      setError("Impossible d'annuler cette séance pour le moment.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading || rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary-300 bg-white p-4">
      <h2 className="font-semibold text-primary-900">Séance du jour (§33)</h2>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.plannedSessionId} className="flex flex-col gap-2 rounded-lg border border-primary-200 p-3">
            <p className="font-medium text-primary-900">
              {PATHOLOGY_LABELS_FR[row.pathology]}
              {row.isOverdue && <span className="ml-2 text-sm font-normal text-orange-700">(en retard — {formatDate(row.plannedFor)})</span>}
              {row.wasPostponed && !row.isOverdue && <span className="ml-2 text-sm font-normal text-primary-500">(reportée)</span>}
            </p>
            <p className="text-sm text-primary-500">
              {row.exercises.length > 0
                ? `${row.exercises.length} exercice${row.exercises.length > 1 ? "s" : ""} prévu${row.exercises.length > 1 ? "s" : ""}`
                : "Aucun exercice programmé pour cette pathologie."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/seance?pathology=${row.pathology}&planned=${row.plannedSessionId}`}
                className="rounded-lg bg-primary-700 px-3 py-2 text-center text-sm font-medium text-white"
              >
                Démarrer
              </Link>
              <Button
                type="button"
                variant="secondary"
                className="w-auto px-3 py-2 text-sm"
                disabled={busyId === row.plannedSessionId}
                onClick={() => setPostponingId(postponingId === row.plannedSessionId ? null : row.plannedSessionId)}
              >
                Reporter
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-auto px-3 py-2 text-sm text-red-700"
                disabled={busyId === row.plannedSessionId}
                onClick={() => cancelSafety(row.plannedSessionId)}
              >
                Annuler (raison de sécurité)
              </Button>
            </div>
            {postponingId === row.plannedSessionId && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  className="input"
                  min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                  value={postponeDate}
                  onChange={(e) => setPostponeDate(e.target.value)}
                />
                <Button
                  type="button"
                  className="w-auto px-3 py-2 text-sm"
                  disabled={!postponeDate || busyId === row.plannedSessionId}
                  onClick={() => confirmPostpone(row.plannedSessionId)}
                >
                  Confirmer
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="text-sm text-primary-500">
        Le report d'une séance ne pénalise jamais votre suivi. Utilisez « Annuler (raison de sécurité) » si vous ne
        pouvez pas réaliser cette séance pour une raison de santé.
      </p>
    </div>
  );
}
