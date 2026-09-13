import Link from "next/link";
import { redirect } from "next/navigation";
import { isSubscriptionCurrentlyActive, getSubscriptionDaysRemaining } from "@apa/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PlannedSessionCard } from "@/components/dashboard/PlannedSessionCard";
import { SubscriptionStatusCard } from "@/components/dashboard/SubscriptionStatusCard";
import { LogoutButton } from "@/components/auth/LogoutButton";

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

  // §47, §48 : dernière souscription connue, pour la carte "Mon abonnement"
  // (durée restante + alerte à 10 jours ou moins de l'échéance, demande du
  // 09/09/2026). Même logique que /api/subscription : recalculée à la
  // demande depuis `subscriptions`, jamais un statut supposé.
  const { data: latestSubscription } = await supabase
    .from("subscriptions")
    .select("plan_code, status, expires_at")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date();
  const isCurrentlyActive = latestSubscription
    ? isSubscriptionCurrentlyActive({ status: latestSubscription.status, expiresAt: latestSubscription.expires_at }, now)
    : false;
  const daysRemaining = latestSubscription
    ? getSubscriptionDaysRemaining(latestSubscription.expires_at, now)
    : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold text-primary-900">
        Bonjour {appUser?.first_name ?? ""}
      </h1>
      <p className="text-primary-700">
        Votre compte et votre profil sont enregistrés.
      </p>
      <SubscriptionStatusCard
        planCode={latestSubscription?.plan_code ?? null}
        status={latestSubscription?.status ?? null}
        isCurrentlyActive={isCurrentlyActive}
        daysRemaining={daysRemaining}
        expiresAt={latestSubscription?.expires_at ?? null}
      />
      <PlannedSessionCard />
      <Link
        href="/profil"
        className="rounded-xl border border-primary-300 px-5 py-3 text-center font-medium text-primary-700"
      >
        Mon profil
      </Link>
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
      <Link
        href="/professionnels"
        className="rounded-xl border border-primary-300 px-5 py-3 text-center font-medium text-primary-700"
      >
        Mes professionnels de santé (§41)
      </Link>
      {appUser?.role === "professional" && (
        <Link
          href="/professionnel"
          className="rounded-xl border border-primary-300 px-5 py-3 text-center font-medium text-primary-700"
        >
          Espace professionnel de santé (§41)
        </Link>
      )}
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
      <LogoutButton className="mt-2" />
    </main>
  );
}
