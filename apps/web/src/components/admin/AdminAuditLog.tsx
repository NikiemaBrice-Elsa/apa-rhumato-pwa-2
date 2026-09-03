"use client";

import { useEffect, useState } from "react";

interface AuditLogRow {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: unknown;
  created_at: string;
}

const ENTITY_TYPES = ["users", "pathologies", "exercise_library", "programs", "clinical_rules", "scientific_references"];

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function AdminAuditLog() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [entityType, setEntityType] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function reload(type: string) {
    const res = await fetch(`/api/admin/audit-logs${type ? `?entityType=${encodeURIComponent(type)}` : ""}`);
    const data = await res.json();
    if (res.ok) {
      setLogs(data.logs ?? []);
    } else {
      setError(data.message ?? "Une erreur est survenue.");
    }
  }

  useEffect(() => {
    reload(entityType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType]);

  return (
    <div className="flex flex-col gap-4">
      <select className="w-fit rounded border border-primary-300 px-3 py-2" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
        <option value="">Toutes les entités</option>
        {ENTITY_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {logs.map((log) => (
          <div key={log.id} className="rounded-lg border border-primary-200 bg-white p-3 text-sm">
            <p className="text-xs text-primary-500">{formatDateTime(log.created_at)}</p>
            <p className="font-medium text-primary-900">
              {log.action} — {log.entity_type ?? "?"}
              {log.entity_id ? ` (${log.entity_id})` : ""}
            </p>
            {!!log.metadata && Object.keys(log.metadata as object).length > 0 && (
              <pre className="mt-1 overflow-x-auto rounded bg-primary-50 p-2 text-xs text-primary-700">{JSON.stringify(log.metadata, null, 2)}</pre>
            )}
          </div>
        ))}
        {logs.length === 0 && <p className="text-sm text-primary-500">Aucune entrée pour l'instant.</p>}
      </div>
    </div>
  );
}
