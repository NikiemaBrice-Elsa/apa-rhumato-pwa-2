import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ActiviteFlow } from "@/components/forms/ActiviteFlow";

/**
 * Page « Activité physique » (Sprint 25, 20/09/2026) : chronomètre / compte
 * à rebours et suivi de marche par distance/durée GPS. Voir
 * ActiviteFlow.tsx pour le détail des décisions produit et les limites
 * techniques assumées et communiquées au patient.
 */
export default async function ActivitePage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-primary-900">Activité physique</h1>
      <ActiviteFlow />
    </main>
  );
}
