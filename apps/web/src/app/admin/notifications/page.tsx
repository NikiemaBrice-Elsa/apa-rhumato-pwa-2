import { AdminNotificationsStats } from "@/components/admin/AdminNotificationsStats";

export default function AdminNotificationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary-900">Notifications</h1>
      <p className="text-sm text-primary-500">
        Le contenu des notifications est généré par des fonctions versionnées dans le code (Sprint 11), pas par des données éditables :
        cet écran se limite à la supervision des volumes envoyés.
      </p>
      <AdminNotificationsStats />
    </div>
  );
}
