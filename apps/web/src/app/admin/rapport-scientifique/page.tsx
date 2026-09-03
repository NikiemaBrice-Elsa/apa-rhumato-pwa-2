import { AdminScientificReport } from "@/components/admin/AdminScientificReport";

export default function AdminScientificReportPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary-900">Rapport scientifique interne</h1>
      <p className="text-sm text-primary-500">
        §65 : quelle règle médicale a été utilisée, quelle version, quelle référence scientifique, quelle date de validation — pour
        permettre un audit scientifique ultérieur.
      </p>
      <AdminScientificReport />
    </div>
  );
}
