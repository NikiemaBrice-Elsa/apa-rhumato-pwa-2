"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

interface ReferenceRow {
  id: string;
  title: string;
  authors: string;
  journal: string | null;
  year: number;
  doi: string | null;
  url: string | null;
  organization: string;
  pathologies: string[];
  recommendation_summary: string;
  evidence_level: string | null;
  last_checked: string;
}

const EMPTY_FORM = {
  title: "",
  authors: "",
  journal: "",
  year: new Date().getFullYear(),
  doi: "",
  url: "",
  organization: "",
  pathologies: "",
  recommendationSummary: "",
  evidenceLevel: "",
};

function toFormValues(r: ReferenceRow) {
  return {
    title: r.title,
    authors: r.authors,
    journal: r.journal ?? "",
    year: r.year,
    doi: r.doi ?? "",
    url: r.url ?? "",
    organization: r.organization,
    pathologies: r.pathologies.join(", "),
    recommendationSummary: r.recommendation_summary,
    evidenceLevel: r.evidence_level ?? "",
  };
}

/** §32, §42 « gestion références scientifiques ». */
export function AdminReferences() {
  const [references, setReferences] = useState<ReferenceRow[]>([]);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function reload() {
    const res = await fetch("/api/admin/references");
    const data = await res.json();
    if (res.ok) {
      setReferences(data.references ?? []);
    } else {
      setError(data.message ?? "Une erreur est survenue.");
    }
  }

  useEffect(() => {
    reload();
  }, []);

  function startCreate() {
    setForm(EMPTY_FORM);
    setEditingId("new");
  }

  function startEdit(r: ReferenceRow) {
    setForm(toFormValues(r));
    setEditingId(r.id);
  }

  async function submit() {
    setSaving(true);
    setError(null);
    const payload = {
      ...form,
      year: Number(form.year),
      pathologies: form.pathologies
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
    };
    const url = editingId === "new" ? "/api/admin/references" : `/api/admin/references/${editingId}`;
    const method = editingId === "new" ? "POST" : "PATCH";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? "Une erreur est survenue.");
      setSaving(false);
      return;
    }
    setEditingId(null);
    await reload();
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {editingId === null && (
        <Button type="button" className="w-auto px-4 py-2" onClick={startCreate}>
          + Nouvelle référence
        </Button>
      )}

      {editingId !== null && (
        <div className="flex flex-col gap-3 rounded-xl border border-primary-300 bg-white p-4">
          <Field label="Titre" htmlFor="ref-title">
            <input id="ref-title" className="w-full rounded border border-primary-300 px-3 py-2" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Auteurs" htmlFor="ref-authors">
            <input id="ref-authors" className="w-full rounded border border-primary-300 px-3 py-2" value={form.authors} onChange={(e) => setForm({ ...form, authors: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Revue" htmlFor="ref-journal">
              <input id="ref-journal" className="w-full rounded border border-primary-300 px-3 py-2" value={form.journal} onChange={(e) => setForm({ ...form, journal: e.target.value })} />
            </Field>
            <Field label="Année" htmlFor="ref-year">
              <input id="ref-year" type="number" className="w-full rounded border border-primary-300 px-3 py-2" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
            </Field>
            <Field label="DOI" htmlFor="ref-doi">
              <input id="ref-doi" className="w-full rounded border border-primary-300 px-3 py-2" value={form.doi} onChange={(e) => setForm({ ...form, doi: e.target.value })} />
            </Field>
            <Field label="URL" htmlFor="ref-url">
              <input id="ref-url" className="w-full rounded border border-primary-300 px-3 py-2" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            </Field>
          </div>
          <Field label="Organisation" htmlFor="ref-org">
            <input id="ref-org" className="w-full rounded border border-primary-300 px-3 py-2" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} />
          </Field>
          <Field label="Pathologies concernées" htmlFor="ref-pathologies" hint="Codes séparés par des virgules, ex. ARTHROSE_GENOU, ARTHROSE_HANCHE">
            <input id="ref-pathologies" className="w-full rounded border border-primary-300 px-3 py-2" value={form.pathologies} onChange={(e) => setForm({ ...form, pathologies: e.target.value })} />
          </Field>
          <Field label="Résumé de la recommandation" htmlFor="ref-summary">
            <textarea id="ref-summary" rows={3} className="w-full rounded border border-primary-300 px-3 py-2" value={form.recommendationSummary} onChange={(e) => setForm({ ...form, recommendationSummary: e.target.value })} />
          </Field>
          <Field label="Niveau de preuve" htmlFor="ref-evidence">
            <input id="ref-evidence" className="w-full rounded border border-primary-300 px-3 py-2" value={form.evidenceLevel} onChange={(e) => setForm({ ...form, evidenceLevel: e.target.value })} />
          </Field>
          <div className="flex gap-2">
            <Button type="button" className="w-auto px-4 py-2" disabled={saving} onClick={submit}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
            <Button type="button" variant="secondary" className="w-auto px-4 py-2" onClick={() => setEditingId(null)}>
              Annuler
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {references.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-xl border border-primary-200 bg-white p-3">
            <div>
              <p className="font-medium text-primary-900">{r.title}</p>
              <p className="text-xs text-primary-500">
                {r.authors} · {r.organization} · {r.year}
              </p>
            </div>
            <Button type="button" variant="secondary" className="w-auto px-3 py-1 text-xs" onClick={() => startEdit(r)}>
              Modifier
            </Button>
          </div>
        ))}
        {references.length === 0 && <p className="text-sm text-primary-500">Aucune référence enregistrée.</p>}
      </div>
    </div>
  );
}
