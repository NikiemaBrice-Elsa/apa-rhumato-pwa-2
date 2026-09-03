import { AdminUsers } from "@/components/admin/AdminUsers";

export default function AdminUsersPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary-900">Utilisateurs</h1>
      <AdminUsers />
    </div>
  );
}
