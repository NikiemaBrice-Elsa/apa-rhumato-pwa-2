import { AdminAuditLog } from "@/components/admin/AdminAuditLog";

export default function AdminAuditPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary-900">Journal d'audit</h1>
      <p className="text-sm text-primary-500">§45 : chaque écriture administrative sensible de cet espace est journalisée ici.</p>
      <AdminAuditLog />
    </div>
  );
}
