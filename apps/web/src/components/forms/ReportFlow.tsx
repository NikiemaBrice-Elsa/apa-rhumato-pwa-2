"use client";

import { useState } from "react";
import { PATHOLOGY_CODES, PATHOLOGY_LABELS_FR, type PathologyCode } from "@apa/domain";
import { Button } from "@/components/ui/Button";

function defaultDateInput(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

/**
 * Génération du rapport PDF (§40, §71) — Sprint 10. Le rapport est produit
 * côté serveur (`/api/reports/pdf`, qui délègue à `@apa/pdf-report`) à
 * partir des données déjà enregistrées ; ce composant se contente de
 * collecter la pathologie, la période et une note facultative propre à
 * l'utilisateur, puis de déclencher le téléchargement.
 */
export function ReportFlow() {
  const [pathology, setPathology] = useState<PathologyCode>(PATHOLOGY_CODES[0]);
  const [from, setFrom] = useState(defaultDateInput(30));
  const [to, setTo] = useState(defaultDateInput(0));
  const [userNote, setUserNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateReport() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reports/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pathology,
          from: new Date(from).toISOString(),
          to: new Date(to).toISOString(),
          userNote: userNote || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Une erreur est survenue lors de la génération du rapport.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rapport-apa-${pathology.toLowerCase()}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Une erreur est survenue. Vous pouvez réessayer.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-primary-700">
        Le rapport reprend vos séances, votre douleur, vos mesures et vos observations sur la période
        choisie. Il ne remplace pas une évaluation médicale.
      </p>

      <div className="flex flex-col gap-1">
        <label className="font-medium text-primary-900">Pathologie</label>
        <select
          value={pathology}
          onChange={(e) => setPathology(e.target.value as PathologyCode)}
          className="input"
        >
          {PATHOLOGY_CODES.map((code) => (
            <option key={code} value={code}>
              {PATHOLOGY_LABELS_FR[code]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <label className="font-medium text-primary-900">Du</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label className="font-medium text-primary-900">Au</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="font-medium text-primary-900">Note à ajouter au rapport (facultatif)</label>
        <textarea
          className="input"
          value={userNote}
          onChange={(e) => setUserNote(e.target.value)}
          placeholder="Par exemple, un contexte particulier sur la période."
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <Button type="button" onClick={generateReport} disabled={submitting}>
        {submitting ? "Génération…" : "Générer le PDF"}
      </Button>
    </div>
  );
}
