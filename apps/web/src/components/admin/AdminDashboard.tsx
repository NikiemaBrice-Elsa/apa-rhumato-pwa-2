"use client";

import { useEffect, useState } from "react";
import { PATHOLOGY_LABELS_FR } from "@apa/domain";

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  sessionsCompleted: number;
  programsPracticed: number;
  adherence: { averagePercent: number | null; usersWithData: number };
  topPathologies: Array<{ pathology: string; count: number }>;
  topExercises: Array<{ exerciseId: string; count: number }>;
  subscriptions: null;
  revenue: null;
  technicalErrors: null;
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-primary-200 bg-white p-4">
      <p className="text-sm text-primary-500">{label}</p>
      <p className="text-2xl font-semibold text-primary-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-primary-500">{hint}</p>}
    </div>
  );
}

/** §64 : tableau de bord administrateur. Toutes les valeurs viennent de
 * GET /api/admin/dashboard, déjà agrégées et anonymisées côté serveur
 * (voir computeAdminDashboardStats, packages/domain/src/admin.ts). */
export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/admin/dashboard");
      const data = await res.json();
      if (res.ok) {
        setStats(data.stats);
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

  if (!stats) {
    return <p className="text-primary-700">Chargement…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Utilisateurs" value={String(stats.totalUsers)} />
        <StatCard label="Utilisateurs actifs" value={String(stats.activeUsers)} hint="Au moins une séance sur 30 jours" />
        <StatCard label="Nouveaux utilisateurs" value={String(stats.newUsers)} hint="7 derniers jours" />
        <StatCard label="Séances réalisées" value={String(stats.sessionsCompleted)} />
        <StatCard label="Programmes pratiqués" value={String(stats.programsPracticed)} hint="Avec au moins une séance réalisée" />
        <StatCard
          label="Adhésion moyenne"
          value={stats.adherence.averagePercent === null ? "—" : `${stats.adherence.averagePercent} %`}
          hint={
            stats.adherence.usersWithData === 0
              ? "Aucun programme validé avec fréquence cible pour l'instant"
              : `Sur ${stats.adherence.usersWithData} utilisateur(s) avec une cible définie`
          }
        />
        <StatCard label="Abonnements" value="—" hint="Disponible à partir du Sprint 14" />
        <StatCard label="Revenus" value="—" hint="Disponible à partir du Sprint 14" />
        <StatCard label="Erreurs techniques" value="—" hint="Infrastructure de journalisation non mise en place" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-primary-200 bg-white p-4">
          <h2 className="mb-2 font-semibold text-primary-900">Pathologies les plus pratiquées</h2>
          {stats.topPathologies.length === 0 ? (
            <p className="text-sm text-primary-500">Aucune séance réalisée pour l'instant.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm text-primary-700">
              {stats.topPathologies.map((p) => (
                <li key={p.pathology} className="flex justify-between">
                  <span>{PATHOLOGY_LABELS_FR[p.pathology as keyof typeof PATHOLOGY_LABELS_FR] ?? p.pathology}</span>
                  <span className="font-medium">{p.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-primary-200 bg-white p-4">
          <h2 className="mb-2 font-semibold text-primary-900">Exercices les plus réalisés</h2>
          {stats.topExercises.length === 0 ? (
            <p className="text-sm text-primary-500">Aucun exercice réalisé pour l'instant.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm text-primary-700">
              {stats.topExercises.map((e) => (
                <li key={e.exerciseId} className="flex justify-between gap-2">
                  <span className="truncate font-mono text-xs" title={e.exerciseId}>
                    {e.exerciseId}
                  </span>
                  <span className="font-medium">{e.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
