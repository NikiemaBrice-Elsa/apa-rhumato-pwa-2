import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PlannedSessionCard } from "@/components/dashboard/PlannedSessionCard";

/**
 * Tableau de bord utilisateur (§33) — écran temporaire pour le Sprint 2.
 * Le contenu réel (séance du jour, courbes de progression…) est prévu au
 * Sprint 8/9, une fois l'évaluation initiale, le moteur de règles et les
 * programmes disponibles.
 */
export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion");
  }

  const { data: appUser } = await supabase
    .from("users")
    .select("first_name, role")
    .eq("id", user!.id)
    .maybeSingle();

  const { count: unreadNotifications } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user!.id)
    .eq("read", false);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold text-primary-900">
        Bonjour {appUser?.first_name ?? ""}
      </h1>
      <p className="text-primary-700">
        Votre compte et votre profil sont enregistrés.
      </p>
      <PlannedSessionCard />
      <Link
        href="/evaluation"
        className="rounded-xl bg-primary-700 px-5 py-3 text-center font-medium text-white shadow-sm"
      >
        Faire mon évaluation initiale
      </Link>
      <Link
        href="/exercices"
        className="rounded-xl border border-primary-300 px-5 py-3 text-center font-medium text-primary-700"
      >
        Voir la bibliothèque d'exercices
      </Link>
      <Link
        href="/programme"
        className="rounded-xl border border-primary-300 px-5 py-3 text-center font-medium text-primary-700"
      >
        Mon programme
      </Link>
      <Link
        href="/seance"
        className="rounded-xl border border-primary-300 px-5 py-3 text-center font-medium text-primary-700"
      >
        Démarrer une séance
      </Link>
      <Link
        href="/suivi"
        className="rounded-xl border border-primary-300 px-5 py-3 text-center font-medium text-primary-700"
      >
        Mon suivi (douleur, poids, mesures)
      </Link>
      <Link
        href="/statistiques"
        className="rounded-xl border border-primary-300 px-5 py-3 text-center font-medium text-primary-700"
      >
        Mes statistiques (§33)
      </Link>
      <Link
        href="/rapport"
        className="rounded-xl border border-primary-300 px-5 py-3 text-center font-medium text-primary-700"
      >
        Générer mon rapport PDF (§40)
      </Link>
      <Link
        href="/notifications"
        className="rounded-xl border border-primary-300 px-5 py-3 text-center font-medium text-primary-700"
      >
        Notifications{unreadNotifications ? ` (${unreadNotifications})` : ""}
      </Link>
      <Link
        href="/abonnement"
        className="rounded-xl border border-primary-300 px-5 py-3 text-center font-medium text-primary-700"
      >
        Mon abonnement (§47, §48)
      </Link>
      {appUser?.role === "admin" && (
        <Link
          href="/admin"
          className="rounded-xl border border-primary-300 px-5 py-3 text-center font-medium text-primary-700"
        >
          Espace administrateur (§42)
        </Link>
      )}
      <p className="text-sm text-primary-500">
        L'attribution automatique de programme est en attente de validation médicale (niveaux,
        seuils, contenu) — voir « Mon programme » pour le détail par pathologie. Une séance peut
        déjà être démarrée pour enregistrer votre ressenti, même sans programme validé.
      </p>
    </main>
  );
}
