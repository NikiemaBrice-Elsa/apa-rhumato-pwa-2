import { AdminReferences } from "@/components/admin/AdminReferences";

export default function AdminReferencesPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary-900">Références scientifiques</h1>
      <AdminReferences />
    </div>
  );
}
