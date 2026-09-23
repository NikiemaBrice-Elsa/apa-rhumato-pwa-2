import Link from "next/link";
import { redirect } from "next/navigation";
import { PATHOLOGY_CODES, type PathologyCode } from "@apa/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SessionFlow } from "@/components/forms/SessionFlow";
import { getPremiumStatus } from "@/lib/premiumAccess";

function asPathology(value: string | string[] | undefined): PathologyCode | undefined {
  const code = Array.isArray(value) ? value[0] : value;
  return (PATHOLOGY_CODES as readonly string[]).includes(code ?? "") ? (code as PathologyCode) : undefined;
}

/** Réf. B11 (31/08/2026) : accessible depuis « Séance du jour » (tableau de
 * bord) avec `?pathology=...&planned=<plannedSessionId>` pour pré-remplir
 * la situation et lier la séance réelle à sa ligne planifiée. */
export default async function SeancePage({
  searchParams,
}: {
  searchParams: { pathology?: string; planned?: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion");
  }

  const { isPremium } = await getPremiumStatus(supabase, user.id);

  // Réponse de Dr Nikiema du 23/09/2026, point 2 : quand le patient est
  // suivi pour plusieurs pathologies, celles-ci doivent s'afficher pour
  // qu'il choisisse. Même source que le tableau de bord
  // (apps/web/src/app/(dashboard)/tableau-de-bord/page.tsx) :
  // `user_program_assignments` est la source de vérité des pathologies
  // effectivement suivies (pas la pathologie déclarée en profil).
  const { data: assignments } = await supabase
    .from("user_program_assignments")
    .select("pathology")
    .eq("user_id", user.id);
  const trackedPathologies = Array.from(
    new Set((assignments ?? []).map((row) => row.pathology as PathologyCode))
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-primary-900">Séance</h1>
      <SessionFlow
        initialPathology={asPathology(searchParams.pathology)}
        initialPlannedSessionId={typeof searchParams.planned === "string" ? searchParams.planned : undefined}
        isPremium={isPremium}
        trackedPathologies={trackedPathologies}
      />
      <p className="text-center text-sm text-primary-500">
        Vous avez fait votre séance hors de l'application&nbsp;?{" "}
        <Link href="/seance/declarer" className="font-medium text-primary-700 underline">
          Déclarez-la ici
        </Link>
        .
      </p>
    </main>
  );
}
