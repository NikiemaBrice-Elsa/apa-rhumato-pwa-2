import { PATHOLOGY_CODES, type PathologyCode } from "@apa/domain";
import { AssessmentFlow } from "@/components/forms/AssessmentFlow";

function asPathology(value: string | string[] | undefined): PathologyCode | undefined {
  const code = Array.isArray(value) ? value[0] : value;
  return (PATHOLOGY_CODES as readonly string[]).includes(code ?? "") ? (code as PathologyCode) : undefined;
}

/**
 * Sprint 33 (27/09/2026, réponse de Dr Nikiema, Question 1) : `?pathology=...`
 * permet au bouton « Faire l'évaluation » (encadré « Pathologie(s) en
 * attente d'évaluation », Mon programme / tableau de bord) de sauter
 * directement à l'étape « screening » de cette pathologie, sans repasser par
 * l'écran de choix libre — même mécanisme que `?pathology=...` sur
 * `apps/web/src/app/(dashboard)/seance/page.tsx` (Sprint 29/31).
 */
export default function EvaluationPage({
  searchParams,
}: {
  searchParams: { pathology?: string };
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-12 sm:max-w-lg md:max-w-2xl lg:max-w-3xl xl:max-w-4xl">
      <h1 className="text-2xl font-semibold text-primary-900">Évaluation initiale</h1>
      <AssessmentFlow initialPathology={asPathology(searchParams.pathology)} />
    </main>
  );
}
