"use client";

import { useEffect, useState } from "react";
import { NOTIFICATION_TYPE_LABELS_FR, type NotificationType } from "@apa/domain";

interface Stats {
  windowDays: number;
  totalSent: number;
  totalRead: number;
  byType: Array<{ notificationType: NotificationType; total: number; read: number }>;
}

export function AdminNotificationsStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/admin/notifications");
      const data = await res.json();
      if (res.ok) {
        setStats(data);
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
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-primary-200 bg-white p-4">
          <p className="text-sm text-primary-500">Envoyées ({stats.windowDays} j.)</p>
          <p className="text-2xl font-semibold text-primary-900">{stats.totalSent}</p>
        </div>
        <div className="rounded-xl border border-primary-200 bg-white p-4">
          <p className="text-sm text-primary-500">Lues</p>
          <p className="text-2xl font-semibold text-primary-900">{stats.totalRead}</p>
        </div>
      </div>
      <div className="rounded-xl border border-primary-200 bg-white p-4">
        <h2 className="mb-2 font-semibold text-primary-900">Répartition par type</h2>
        {stats.byType.length === 0 ? (
          <p className="text-sm text-primary-500">Aucune notification envoyée sur cette période.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm text-primary-700">
            {stats.byType.map((t) => (
              <li key={t.notificationType} className="flex justify-between">
                <span>{NOTIFICATION_TYPE_LABELS_FR[t.notificationType]}</span>
                <span className="font-medium">
                  {t.read}/{t.total} lues
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
