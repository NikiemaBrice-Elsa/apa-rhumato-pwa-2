"use client";

import { useEffect, useState } from "react";
import { PATHOLOGY_CODES, PATHOLOGY_LABELS_FR, PROFESSIONAL_LINK_STATUS_LABELS_FR, type PathologyCode } from "@apa/domain";
import { Button } from "@/components/ui/Button";

interface LinkRow {
  id: string;
  status: "pending" | "authorized" | "revoked";
  requested_at: string;
  decided_at: string | null;
  patient: { id: string; first_name: string; last_name: string | null; email: string | null } | null;
}

function patientLabel(patient: LinkRow["patient"]): string {
  if (!patient) return "Patient";
  return [patient.first_name, patient.last_name].filter(Boolean).join(" ") || patient.email || "Patient";
}

function defaultDateInput(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

/**
 * Tableau de bord de l'espace professionnel de santé (§41) — Sprint 23
 * (13/09/2026). Le professionnel n'a AUCUNE action de création : il ne fait
 * qu'accepter/décliner une invitation reçue du patient, ou se retirer d'un
 * accès déjà autorisé (§46 — voir migration 0021, jamais l'inverse).
 */
export function ProfessionalDashboard() {
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);
  const [reportPatientId, setReportPatientId] = useState<string | null>(null);
  const [pathology, setPathology] = useState<PathologyCode>(PATHOLOGY_CODES[0]);
  const [from, setFrom] = useState(defaultDateInput(30));
  const [to, setTo] = useState(defaultDateInput(0));
  const [reportError, setReportError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/professionnel/patients");
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Une erreur est survenue.");
        return;
      }
      setLinks(data.links ?? []);
    } catch {
      setError("Impossible de charger vos patients pour le moment.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function decide(id: string, status: "authorized" | "revoked") {
    setActioning(id);
    try {
      const res = await fetch(`/api/professional-links/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        await reload();
      }
    } finally {
      setActioning(null);
    }
  }

  async function downloadReport(patientId: string) {
    setDownloading(true);
    setReportError(null);
    try {
      const params = new URLSearchParams({
        pathology,
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
      });
      const res = await fetch(`/api/professionnel/patients/${patientId}/report?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setReportError(data.message ?? "Impossible de générer ce rapport.");
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
      setReportError("Une erreur est survenue. Vous pouvez réessayer.");
    } finally {
      setDownloading(false);
    }
  }

  if (loading) return <p className="text-primary-700">Chargement…</p>;
  if (error) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </p>
    );
  }

  const pending = links.filter((l) => l.status === "pending");
  const authorized = links.filter((l) => l.status === "authorized");

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-primary-900">Invitations en attente</h2>
        {pending.length === 0 && <p className="text-sm text-primary-500">Aucune invitation en attente.</p>}
        {pending.map((link) => (
          <div key={link.id} className="flex items-center justify-between rounded-xl border border-primary-200 p-4">
            <span className="font-medium text-primary-900">{patientLabel(link.patient)}</span>
            <div className="flex gap-2">
              <Button type="button" disabled={actioning === link.id} onClick={() => decide(link.id, "authorized")}>
                Accepter
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={actioning === link.id}
                onClick={() => decide(link.id, "revoked")}
              >
                Décliner
              </Button>
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-primary-900">Patients qui vous ont autorisé</h2>
        {authorized.length === 0 && <p className="text-sm text-primary-500">Aucun patient ne vous a encore autorisé.</p>}
        {authorized.map((link) => (
          <div key={link.id} className="flex flex-col gap-3 rounded-xl border border-primary-200 p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-primary-900">{patientLabel(link.patient)}</span>
              <Button
                type="button"
                variant="secondary"
                disabled={actioning === link.id}
                onClick={() => decide(link.id, "revoked")}
              >
                Me retirer
              </Button>
            </div>
            {reportPatientId === link.patient?.id ? (
              <div className="flex flex-col gap-2 rounded-lg bg-primary-50 p-3">
                <select value={pathology} onChange={(e) => setPathology(e.target.value as PathologyCode)} className="input">
                  {PATHOLOGY_CODES.map((code) => (
                    <option key={code} value={code}>
                      {PATHOLOGY_LABELS_FR[code]}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
                  <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" />
                </div>
                {reportError && <p className="text-sm text-red-700">{reportError}</p>}
                <Button
                  type="button"
                  disabled={downloading}
                  onClick={() => link.patient && downloadReport(link.patient.id)}
                >
                  {downloading ? "Génération…" : "Télécharger le rapport PDF"}
                </Button>
              </div>
            ) : (
              <Button type="button" variant="secondary" onClick={() => link.patient && setReportPatientId(link.patient.id)}>
                Consulter le rapport
              </Button>
            )}
          </div>
        ))}
      </section>

      {links.some((l) => l.status === "revoked") && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-primary-500">Accès révoqués</h2>
          <p className="text-sm text-primary-500">
            {links.filter((l) => l.status === "revoked").length} lien(s) révoqué(s) — {PROFESSIONAL_LINK_STATUS_LABELS_FR.revoked.toLowerCase()}.
          </p>
        </section>
      )}
    </div>
  );
}
