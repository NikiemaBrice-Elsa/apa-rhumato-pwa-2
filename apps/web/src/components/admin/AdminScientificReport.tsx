"use client";

import { useEffect, useState } from "react";
import { PATHOLOGY_LABELS_FR } from "@apa/domain";

interface ReportRow {
  rule_id: string;
  pathology: string;
  severity: string;
  action: string;
  version: string;
  active: boolean;
  validated_by: string | null;
  validated_date: string | null;
  scientific_references: { id: string; title: string; authors: string; organization: string; doi: string | null; evidence_level: string | null; year: number } | null;
}

export function AdminScientificReport() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/admin/scientific-report");
      const data = await res.json();
      if (res.ok) {
        setRows(data.rules ?? []);
      } else {
        setError(data.message ?? "Une erreur est survenue.");
      }
    }
    load();
  }, []);

  if (error) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-primary-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-primary-50 text-primary-700">
          <tr>
            <th className="px-3 py-2">Règle</th>
            <th className="px-3 py-2">Pathologie</th>
            <th className="px-3 py-2">Version</th>
            <th className="px-3 py-2">Statut</th>
            <th className="px-3 py-2">Validée par / le</th>
            <th className="px-3 py-2">Référence scientifique</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.rule_id} className="border-t border-primary-100 align-top">
              <td className="px-3 py-2 font-mono text-xs">{r.rule_id}</td>
              <td className="px-3 py-2">{PATHOLOGY_LABELS_FR[r.pathology as keyof typeof PATHOLOGY_LABELS_FR] ?? r.pathology}</td>
              <td className="px-3 py-2">{r.version}</td>
              <td className="px-3 py-2">{r.active ? "Active" : "Inactive"}</td>
              <td className="px-3 py-2 text-primary-500">
                {r.validated_by ?? "—"} {r.validated_date ? `· ${r.validated_date}` : ""}
              </td>
              <td className="px-3 py-2 text-primary-500">
                {r.scientific_references ? (
                  <>
                    {r.scientific_references.title} ({r.scientific_references.year}) — {r.scientific_references.organization}
                    {r.scientific_references.evidence_level ? ` · niveau ${r.scientific_references.evidence_level}` : ""}
                  </>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="p-4 text-sm text-primary-500">Aucune règle enregistrée.</p>}
    </div>
  );
}
