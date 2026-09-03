import { AdminSubscriptions } from "@/components/admin/AdminSubscriptions";

export default function AdminSubscriptionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary-900">Abonnements</h1>
      <AdminSubscriptions />
    </div>
  );
}
