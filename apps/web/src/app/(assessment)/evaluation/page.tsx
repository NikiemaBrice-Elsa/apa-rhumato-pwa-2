import { AssessmentFlow } from "@/components/forms/AssessmentFlow";

export default function EvaluationPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-primary-900">Évaluation initiale</h1>
      <AssessmentFlow />
    </main>
  );
}
