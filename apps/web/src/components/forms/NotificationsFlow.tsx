"use client";

import { useEffect, useState } from "react";
import { NOTIFICATION_TYPE_LABELS_FR, type NotificationType } from "@apa/domain";
import { Button } from "@/components/ui/Button";

interface NotificationRow {
  id: string;
  notification_type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/**
 * Centre de notifications (§39) — Sprint 11. À l'ouverture, déclenche le
 * calcul des notifications dues (`/api/notifications/sync`) puis affiche
 * l'historique. Aucun ton culpabilisant n'est possible ici : les messages
 * viennent tous de `@apa/domain` (packages/domain/src/notifications.ts),
 * garanti par un test dédié.
 */
export function NotificationsFlow() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const res = await fetch("/api/notifications");
    const data = await res.json();
    if (res.ok) {
      setNotifications(data.notifications ?? []);
    } else {
      setError(data.message ?? "Une erreur est survenue.");
    }
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      setError(null);
      try {
        await fetch("/api/notifications/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Heure locale du patient ("HH:MM") : le serveur ne connaît pas son
          // fuseau horaire — voir /api/notifications/sync (Sprint 23, 13/09/2026).
          body: JSON.stringify({ localTime: new Date().toTimeString().slice(0, 5) }),
        });
        await reload();
      } catch {
        setError("Impossible de charger vos notifications pour le moment.");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
    await reload();
  }

  async function remove(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    await reload();
  }

  if (loading) {
    return <p className="text-primary-700">Chargement de vos notifications…</p>;
  }

  if (error) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </p>
    );
  }

  if (notifications.length === 0) {
    return <p className="text-primary-700">Aucune notification pour l'instant.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {notifications.map((n) => (
        <li
          key={n.id}
          className={`rounded-xl border p-4 ${n.read ? "border-primary-200 bg-white" : "border-primary-400 bg-primary-50"}`}
        >
          <p className="text-xs text-primary-500">
            {NOTIFICATION_TYPE_LABELS_FR[n.notification_type]} · {formatDateTime(n.created_at)}
          </p>
          <p className="font-medium text-primary-900">{n.title}</p>
          <p className="text-primary-700">{n.body}</p>
          <div className="mt-2 flex gap-2">
            {!n.read && (
              <Button type="button" variant="secondary" onClick={() => markRead(n.id)}>
                Marquer comme lue
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={() => remove(n.id)}>
              Supprimer
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
