"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

interface PathologyRow {
  id: string;
  code: string;
  name_fr: string;
  description: string | null;
  active: boolean;
}

export function AdminPathologies() {
  const [pathologies, setPathologies] = useState<PathologyRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { name_fr: string; description: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reload() {
    const res = await fetch("/api/admin/pathologies");
    const data = await res.json();
    if (res.ok) {
      setPathologies(data.pathologies ?? []);
      const nextDrafts: Record<string, { name_fr: string; description: string }> = {};
      for (const p of data.pathologies ?? []) {
        nextDrafts[p.id] = { name_fr: p.name_fr, description: p.description ?? "" };
      }
      setDrafts(nextDrafts);
    } else {
      setError(data.message ?? "Une erreur est survenue.");
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function save(id: string, patch: Record<string, unknown>) {
    setBusyId(id);
    const res = await fetch(`/api/admin/pathologies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) setError(data.message ?? "Une erreur est survenue.");
    await reload();
    setBusyId(null);
  }

  if (error) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {pathologies.map((p) => {
        const draft = drafts[p.id] ?? { name_fr: p.name_fr, description: p.description ?? "" };
        return (
          <div key={p.id} className="rounded-xl border border-primary-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-primary-500">{p.code}</span>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={p.active} disabled={busyId === p.id} onChange={(e) => save(p.id, { active: e.target.checked })} />
                Active
              </label>
            </div>
            <input
              className="mt-2 w-full rounded border border-primary-300 px-3 py-2"
              value={draft.name_fr}
              onChange={(e) => setDrafts({ ...drafts, [p.id]: { ...draft, name_fr: e.target.value } })}
            />
            <textarea
              className="mt-2 w-full rounded border border-primary-300 px-3 py-2"
              rows={2}
              placeholder="Description"
              value={draft.description}
              onChange={(e) => setDrafts({ ...drafts, [p.id]: { ...draft, description: e.target.value } })}
            />
            <Button
              type="button"
              variant="secondary"
              className="mt-2 w-auto px-4 py-2 text-sm"
              disabled={busyId === p.id}
              onClick={() => save(p.id, { nameFr: draft.name_fr, description: draft.description })}
            >
              Enregistrer
            </Button>
          </div>
        );
      })}
    </div>
  );
}
