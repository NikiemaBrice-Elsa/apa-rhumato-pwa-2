import { AdminDashboard } from "@/components/admin/AdminDashboard";

export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary-900">Tableau de bord administrateur</h1>
      <AdminDashboard />
    </div>
  );
}
