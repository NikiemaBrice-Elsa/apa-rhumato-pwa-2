import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DeclareSessionFlow } from "@/components/forms/DeclareSessionFlow";

/**
 * §28, §69 — Sprint 29 (22/09/2026, message direct de Dr Nikiema) :
 * « Le patient doit pouvoir faire ses exercices sans passer par l'appli et
 * renseigner plus tard dans l'appli puis enregistrer. »
 *
 * Page distincte de `/seance` (séance guidée en direct) : accessible depuis
 * un lien sur `/seance` pour les patients qui ont déjà fait leur séance
 * hors de l'application et veulent simplement la déclarer a posteriori.
 */
export default async function DeclarerSeancePage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-primary-900">Déclarer une séance</h1>
      <p className="text-primary-700">
        Vous avez fait vos exercices sans passer par l'application&nbsp;? Renseignez-les ici pour qu'ils soient
        enregistrés dans votre suivi.
      </p>
      <DeclareSessionFlow />
    </main>
  );
}
