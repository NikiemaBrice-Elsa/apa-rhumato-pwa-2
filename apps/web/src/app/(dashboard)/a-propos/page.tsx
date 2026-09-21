import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PATHOLOGY_LABELS_FR, type PathologyCode } from "@apa/domain";

interface ReferenceRow {
  id: string;
  title: string;
  authors: string;
  journal: string | null;
  year: number;
  doi: string | null;
  url: string | null;
  organization: string;
  pathologies: string[];
}

function isPathologyCode(code: string): code is PathologyCode {
  return code in PATHOLOGY_LABELS_FR;
}

/**
 * « À propos » de l'application (§40) — Sprint 28 (20/09/2026, complété
 * 21/09/2026).
 *
 * Dr Nikiema a demandé que le fait que l'application s'appuie sur les
 * recommandations scientifiques des sociétés savantes soit décrit ICI
 * plutôt que dans le détail de chaque exercice (voir
 * ExerciseLibraryDetail.tsx, qui ne montre plus aucune référence
 * scientifique au patient). Un texte générique a d'abord été proposé pour
 * validation (document Word, sa règle personnelle) ; ses réponses du
 * 21/09/2026 :
 * - Question 1 : le texte de présentation ci-dessous est validé tel quel.
 * - Question 2 : au lieu d'une formulation générale, il souhaite « nommer
 *   la liste de toutes les références scientifiques employées » — cette
 *   page interroge donc désormais `scientific_references` (§81, table déjà
 *   en lecture authentifiée pour tout patient depuis la migration 0002,
 *   contenu déjà vérifié — DOI non inventés, voir docs/DECISIONS.md Sprint
 *   3) et affiche chaque référence (titre, auteurs, revue, année,
 *   organisation/société savante, DOI le cas échéant). Aucune référence
 *   n'est filtrée ni reformulée : ce qui est affiché est exactement ce que
 *   le concepteur médical a validé en base.
 */
export default async function AboutPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion");
  }

  const { data } = await supabase
    .from("scientific_references")
    .select("id, title, authors, journal, year, doi, url, organization, pathologies")
    .order("year", { ascending: false });

  const references = (data ?? []) as ReferenceRow[];

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-primary-900">À propos de l&apos;application</h1>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-primary-900">Une base scientifique</h2>
        <p className="text-primary-700">
          Les programmes et les exercices proposés dans l&apos;application s&apos;appuient sur des données de la
          littérature scientifique et sur les recommandations de sociétés savantes de rhumatologie et de médecine du
          sport. Chaque contenu est sélectionné, adapté et validé par le concepteur médical de l&apos;application avant
          d&apos;être proposé aux patients.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-primary-900">Un outil de suivi, pas un diagnostic</h2>
        <p className="text-primary-700">
          L&apos;application est un outil d&apos;accompagnement et de suivi numérique. Elle ne remplace pas une
          évaluation médicale, un diagnostic ou l&apos;avis de votre médecin ou de votre professionnel de santé.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-primary-900">Références scientifiques utilisées</h2>
        {references.length === 0 ? (
          <p className="text-primary-700">Aucune référence n&apos;est encore renseignée.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {references.map((ref) => (
              <li key={ref.id} className="rounded-xl border border-primary-200 p-3 text-sm">
                <p className="font-medium text-primary-900">{ref.title}</p>
                <p className="text-primary-700">
                  {ref.authors}
                  {ref.journal ? ` — ${ref.journal}` : ""}, {ref.year}
                </p>
                <p className="text-xs text-primary-500">
                  {ref.organization}
                  {ref.pathologies.length > 0
                    ? ` · ${ref.pathologies
                        .map((code) => (isPathologyCode(code) ? PATHOLOGY_LABELS_FR[code] : code))
                        .join(", ")}`
                    : ""}
                </p>
                {(ref.doi || ref.url) && (
                  <a
                    href={ref.doi ? `https://doi.org/${ref.doi}` : ref.url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary-600 underline"
                  >
                    {ref.doi ? `DOI : ${ref.doi}` : "Voir la source"}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
