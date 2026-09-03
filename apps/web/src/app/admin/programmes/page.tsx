import { AdminPrograms } from "@/components/admin/AdminPrograms";

export default function AdminProgramsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary-900">Programmes</h1>
      <p className="text-sm text-primary-500">
        Un programme n'est proposé automatiquement à un patient que si (1) il est « validé » ET (2) une règle clinique « allow_program »
        validée pointe vers lui (voir l'écran Règles cliniques).
      </p>
      <AdminPrograms />
    </div>
  );
}
