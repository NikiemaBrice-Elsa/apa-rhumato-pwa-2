import Link from "next/link";
import { SUBSCRIPTION_PLAN_LABELS_FR, type SubscriptionPlanCode, type SubscriptionStatus } from "@apa/domain";

export interface SubscriptionStatusCardProps {
  planCode: SubscriptionPlanCode | null;
  status: SubscriptionStatus | null;
  isCurrentlyActive: boolean;
  /** Jours restants avant expiration (arrondi au jour supérieur), ou `null`
   * s'il n'y a pas de date d'expiration applicable. Calculé par l'appelant
   * via `getSubscriptionDaysRemaining` (packages/domain), à partir de
   * `new Date()` — jamais recalculé ici, pour rester un composant purement
   * d'affichage. */
  daysRemaining: number | null;
  expiresAt: string | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Carte « Mon abonnement » du tableau de bord (§47, §48) — demande du Dr
 * Nikiema du 09/09/2026 : afficher la durée restante de l'abonnement
 * directement sur le tableau de bord, avec une alerte visuelle (léger
 * clignotement) à 10 jours ou moins de l'échéance, pour inciter au
 * renouvellement avant l'expiration effective.
 *
 * Purement présentationnel : ne recalcule ni le statut ni le nombre de
 * jours restants — les deux sont fournis par l'appelant (tableau de bord,
 * composant serveur) à partir des données réelles de `subscriptions`,
 * jamais déduits ou inventés ici (§57, §59).
 */
export function SubscriptionStatusCard({
  planCode,
  status,
  isCurrentlyActive,
  daysRemaining,
  expiresAt,
}: SubscriptionStatusCardProps) {
  const planLabel = planCode ? SUBSCRIPTION_PLAN_LABELS_FR[planCode] : SUBSCRIPTION_PLAN_LABELS_FR.free;

  // Aucune souscription premium jamais demandée : plan gratuit par défaut.
  if (!status || planCode === "free") {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-primary-200 bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-primary-500">Mon abonnement</p>
        <p className="font-medium text-primary-900">{SUBSCRIPTION_PLAN_LABELS_FR.free}</p>
        <Link href="/abonnement" className="text-sm font-medium text-primary-700 underline">
          Découvrir les offres Premium
        </Link>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-primary-300 bg-primary-50 p-4">
        <p className="text-xs uppercase tracking-wide text-primary-500">Mon abonnement</p>
        <p className="font-medium text-primary-900">{planLabel} — en attente de vérification</p>
        <p className="text-sm text-primary-700">
          Votre déclaration de paiement est en cours de vérification par l&apos;équipe. Vous serez averti dès que
          votre abonnement sera activé.
        </p>
        <Link href="/abonnement" className="text-sm font-medium text-primary-700 underline">
          Voir le détail
        </Link>
      </div>
    );
  }

  const expired = status === "expired" || status === "canceled" || (status === "active" && !isCurrentlyActive);

  if (expired) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-red-300 bg-red-50 p-4">
        <p className="text-xs uppercase tracking-wide text-red-600">Mon abonnement</p>
        <p className="font-medium text-red-800">
          {planLabel} — {status === "canceled" ? "annulé" : "expiré"}
        </p>
        <p className="text-sm text-red-700">
          Votre abonnement Premium n&apos;est plus actif. Renouvelez-le pour retrouver l&apos;accès complet.
        </p>
        <Link
          href="/abonnement"
          className="w-fit rounded-lg bg-primary-700 px-4 py-2 text-sm font-medium text-white"
        >
          Renouveler mon abonnement
        </Link>
      </div>
    );
  }

  // Abonnement actif, avec ou sans date d'expiration connue.
  const soonExpiring = daysRemaining !== null && daysRemaining <= 10;

  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border p-4 transition-colors ${
        soonExpiring
          ? "animate-subscription-blink border-orange-400"
          : "border-primary-200 bg-white"
      }`}
    >
      <p className={`text-xs uppercase tracking-wide ${soonExpiring ? "text-orange-700" : "text-primary-500"}`}>
        Mon abonnement
      </p>
      <p className={`font-medium ${soonExpiring ? "text-orange-900" : "text-primary-900"}`}>
        {planLabel} — actif
      </p>
      {expiresAt && daysRemaining !== null ? (
        <p className={`text-sm ${soonExpiring ? "text-orange-800" : "text-primary-700"}`}>
          {soonExpiring
            ? `⚠ Expire dans ${daysRemaining} jour${daysRemaining > 1 ? "s" : ""} (le ${formatDate(expiresAt)})`
            : `Expire le ${formatDate(expiresAt)} (dans ${daysRemaining} jours)`}
        </p>
      ) : (
        <p className="text-sm text-primary-700">Aucune date d&apos;expiration définie.</p>
      )}
      {soonExpiring && (
        <Link
          href="/abonnement"
          className="w-fit rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white"
        >
          Renouveler dès maintenant
        </Link>
      )}
    </div>
  );
}
