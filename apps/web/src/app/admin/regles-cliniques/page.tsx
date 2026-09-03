import { AdminClinicalRules } from "@/components/admin/AdminClinicalRules";

export default function AdminClinicalRulesPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary-900">Règles cliniques</h1>
      <p className="text-sm text-primary-500">
        Toute nouvelle règle démarre inactive. Chaque modification de contenu incrémente automatiquement la version (§43, §66) ; activer
        ou désactiver une règle n'y change rien, ce n'est pas un changement scientifique.
      </p>
      <AdminClinicalRules />
    </div>
  );
}
