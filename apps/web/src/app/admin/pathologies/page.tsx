import { AdminPathologies } from "@/components/admin/AdminPathologies";

export default function AdminPathologiesPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary-900">Pathologies</h1>
      <p className="text-sm text-primary-500">
        Les 6 pathologies de la V1 (§7) forment un ensemble fermé référencé dans tout le code applicatif : vous pouvez modifier leur
        libellé, leur description et leur activation, mais pas en ajouter une nouvelle depuis cet écran.
      </p>
      <AdminPathologies />
    </div>
  );
}
