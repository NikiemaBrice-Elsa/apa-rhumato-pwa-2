import Link from "next/link";
import { redirect } from "next/navigation";
import {
  isSubscriptionCurrentlyActive,
  getSubscriptionDaysRemaining,
  PATHOLOGY_LABELS_FR,
  describeSessionPreAlertSignals,
  type PathologyCode,
} from "@apa/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { computePathologyProgressionResult } from "@/lib/progression";
import { PlannedSessionCard } from "@/components/dashboard/PlannedSessionCard";
import { SubscriptionStatusCard } from "@/components/dashboard/SubscriptionStatusCard";
import { ProgressionGaugeCard } from "@/components/dashboard/ProgressionGaugeCard";
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

  // Correctif Sprint 33 (24/09/2026, « la lenteur de l'appli est globale ») :
  // ces 4 requêtes ne dépendent QUE de `user.id`, jamais les unes des
  // autres — elles étaient auparavant enchaînées en série (`await` un par
  // un), ce qui imposait 4 allers-retours réseau successifs avant de pouvoir
  // afficher l'écran d'accueil (celui que chaque patient revoit le plus
  // souvent). `Promise.all` les lance en parallèle : même résultat, un seul
  // aller-retour au pire (le plus lent des quatre) au lieu de la somme des
  // quatre.
  const [
    { data: appUser },
    { count: unreadNotifications },
    { data: latestSubscription },
    { data: assignments },
    { data: profile },
    { data: preAlertCancellations },
    { data: recentSessionsForAlert },
  ] = await Promise.all([
    supabase.from("users").select("first_name, role").eq("id", user!.id).maybeSingle(),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user!.id).eq("read", false),
    // §47, §48 : dernière souscription connue, pour la carte "Mon abonnement"
    // (durée restante + alerte à 10 jours ou moins de l'échéance, demande du
    // 09/09/2026). Même logique que /api/subscription : recalculée à la
    // demande depuis `subscriptions`, jamais un statut supposé.
    supabase
      .from("subscriptions")
      .select("plan_code, status, expires_at")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // §29, §58 — document « système de progression » (21/09/2026, section A) :
    // jauge de progression vers le niveau suivant, une par pathologie suivie
    // avec un programme validé assigné.
    supabase.from("user_program_assignments").select("pathology, created_at").eq("user_id", user!.id).order("created_at", {
      ascending: false,
    }),
    // Sprint 33 (27/09/2026, réponse de Dr Nikiema, Question 1) : mêmes
    // pathologies en attente d'évaluation qu'affichées dans « Mon programme »
    // — voir le calcul de `pendingEvaluationPathologies` plus bas.
    supabase.from("patient_profiles").select("main_pathologies").eq("user_id", user!.id).maybeSingle(),
    // Sprint 33 (27/09/2026, instruction directe de Dr Nikiema) : « en cas de
    // séance non réalisée liée à une douleur élevée ou à un autre critère, ce
    // critère doit s'afficher sur le tableau de bord jusqu'à la prochaine
    // tentative » — voir le calcul de `pendingPreAlertReminders` plus bas.
    supabase
      .from("session_pre_alert_cancellations")
      .select("pathology, created_at, douleur_avant, gonflement_articulaire, fievre, symptome_inhabituel")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(50),
    // « jusqu'à la prochaine tentative » : une tentative plus récente que la
    // dernière annulation (poursuivie ou non) efface le rappel — voir plus bas.
    supabase
      .from("sessions")
      .select("pathology, started_at")
      .eq("user_id", user!.id)
      .order("started_at", { ascending: false })
      .limit(50),
  ]);

  const now = new Date();
  const isCurrentlyActive = latestSubscription
    ? isSubscriptionCurrentlyActive({ status: latestSubscription.status, expiresAt: latestSubscription.expires_at }, now)
    : false;
  const daysRemaining = latestSubscription
    ? getSubscriptionDaysRemaining(latestSubscription.expires_at, now)
    : null;

  // §29, §58 — document « système de progression » (21/09/2026, section A) :
  // jauge de progression vers le niveau suivant, une par pathologie suivie
  // avec un programme validé assigné. Même logique que
  // `GET /api/statistics/progression` (apps/web/src/app/api/statistics/
  // progression/route.ts), dupliquée ici plutôt que fetchée en client pour
  // rester un Server Component pur (pas d'aller-retour réseau depuis le
  // navigateur pour l'écran d'accueil). `assignments` est chargé plus haut,
  // en parallèle des 3 autres requêtes indépendantes (correctif Sprint 33).
  const assignedPathologies = Array.from(new Set((assignments ?? []).map((row) => row.pathology)));
  const progressionResults = (
    await Promise.all(assignedPathologies.map((pathology) => computePathologyProgressionResult(supabase, user!.id, pathology)))
  ).filter((r): r is NonNullable<typeof r> => r !== null);

  // Sprint 33 (27/09/2026, réponse de Dr Nikiema, Question 1) : mêmes
  // pathologies en attente d'évaluation qu'affichées dans « Mon programme »
  // (apps/web/src/app/(dashboard)/programme/page.tsx) — pathologies cochées
  // dans le profil sans encore aucune ligne dans `user_program_assignments`.
  const assignedPathologySet = new Set(assignedPathologies);
  const pendingEvaluationPathologies = ((profile?.main_pathologies ?? []) as PathologyCode[]).filter(
    (code) => !assignedPathologySet.has(code)
  );

  // Sprint 33 (27/09/2026, instruction directe de Dr Nikiema) : « en cas de
  // séance non réalisée liée à une douleur élevée ou à un autre critère, ce
  // critère doit s'afficher sur le tableau de bord jusqu'à la prochaine
  // tentative de réalisation de séance. Et si [...] le patient ne présente
  // pas de critères qui l'empêchent de le faire, alors le tableau doit être
  // normal. » Pour chaque pathologie, on ne garde que la dernière annulation
  // (`preAlertCancellations` est trié du plus récent au plus ancien) ; le
  // rappel disparaît dès qu'une séance a été démarrée après cette annulation
  // (dans `sessions`, qu'elle ait été poursuivie malgré l'avertissement ou
  // non — toute nouvelle tentative « résout » le rappel, seul son résultat
  // futur compte, pas la tentative annulée).
  const latestCancellationByPathology = new Map<string, (typeof preAlertCancellations)[number]>();
  for (const row of preAlertCancellations ?? []) {
    if (!latestCancellationByPathology.has(row.pathology)) {
      latestCancellationByPathology.set(row.pathology, row);
    }
  }
  const latestSessionStartedAtByPathology = new Map<string, string>();
  for (const row of recentSessionsForAlert ?? []) {
    if (!latestSessionStartedAtByPathology.has(row.pathology)) {
      latestSessionStartedAtByPathology.set(row.pathology, row.started_at);
    }
  }
  const pendingPreAlertReminders = Array.from(latestCancellationByPathology.entries())
    .filter(([pathology, cancellation]) => {
      const latestAttempt = latestSessionStartedAtByPathology.get(pathology);
      return !latestAttempt || new Date(latestAttempt) <= new Date(cancellation.created_at);
    })
    .map(([pathology, cancellation]) => ({
      pathology: pathology as PathologyCode,
      reasons: describeSessionPreAlertSignals({
        douleurAvant: cancellation.douleur_avant,
        gonflementArticulaire: cancellation.gonflement_articulaire,
        fievre: cancellation.fievre,
        symptomeInhabituel: cancellation.symptome_inhabituel,
      }),
    }));

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
      {pendingEvaluationPathologies.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-orange-300 bg-orange-50 p-4">
          <p className="font-medium text-orange-900">Pathologie(s) en attente d&apos;évaluation</p>
          <p className="text-sm text-orange-800">
            Ces pathologies sont cochées dans votre profil mais n&apos;ont pas encore été évaluées.
          </p>
          <ul className="flex flex-col gap-2">
            {pendingEvaluationPathologies.map((code) => (
              <li key={code} className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-orange-900">{PATHOLOGY_LABELS_FR[code]}</span>
                <Link
                  href={`/evaluation?pathology=${code}`}
                  className="shrink-0 rounded-lg bg-orange-700 px-3 py-1.5 text-xs font-medium text-white"
                >
                  Faire l&apos;évaluation
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {pendingPreAlertReminders.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-red-300 bg-red-50 p-4">
          <p className="font-medium text-red-900">Séance non réalisée — signal à surveiller</p>
          <p className="text-sm text-red-800">
            La dernière fois, vous avez choisi de ne pas faire la séance suite à un avertissement.
            Ce rappel disparaîtra dès votre prochaine tentative si aucun signe ne l&apos;empêche.
          </p>
          <ul className="flex flex-col gap-1">
            {pendingPreAlertReminders.map(({ pathology, reasons }) => (
              <li key={pathology} className="text-sm text-red-900">
                <span className="font-medium">{PATHOLOGY_LABELS_FR[pathology]}</span>
                {reasons.length > 0 ? ` — ${reasons.join(", ")}` : null}
              </li>
            ))}
          </ul>
        </div>
      )}
      <PlannedSessionCard />
      <ProgressionGaugeCard results={progressionResults} />
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
      {/* Onglet dédié (22/09/2026, message direct de Dr Nikiema : « pas
          suffisamment mise en évidence ») — auparavant seulement un lien
          texte discret en bas de la page /seance, désormais son propre
          bouton au même niveau que « Démarrer une séance » sur le tableau
          de bord. */}
      <Link
        href="/seance/declarer"
        className="rounded-xl border border-primary-300 px-5 py-3 text-center font-medium text-primary-700"
      >
        Déclarer une séance faite hors de l&apos;application
      </Link>
      <Link
        href="/activite"
        className="rounded-xl border border-primary-300 px-5 py-3 text-center font-medium text-primary-700"
      >
        Activité physique (chronomètre, marche)
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
      <Link
        href="/a-propos"
        className="rounded-xl border border-primary-300 px-5 py-3 text-center font-medium text-primary-700"
      >
        À propos de l&apos;application
      </Link>
      <p className="text-sm text-primary-500">
        L'attribution automatique de programme est en attente de validation médicale (niveaux,
        seuils, contenu) — voir « Mon programme » pour le détail par pathologie. Une séance peut
        déjà être démarrée pour enregistrer votre ressenti, même sans programme validé.
      </p>
      <LogoutButton className="mt-2" />
    </main>
  );
}
