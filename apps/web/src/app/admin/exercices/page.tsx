import { AdminExercises } from "@/components/admin/AdminExercises";

export default function AdminExercisesPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary-900">Exercices</h1>
      <p className="text-sm text-primary-500">
        Un exercice n'est jamais visible des patients tant qu'il n'est pas « validé » (§57, §59). La publication passe toujours par
        « soumis à relecture », jamais directement de brouillon à validé.
      </p>
      <AdminExercises />
    </div>
  );
}
