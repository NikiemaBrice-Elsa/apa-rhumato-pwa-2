"use client";

import { useEffect, useState } from "react";
import {
  SUBSCRIPTION_PLAN_LABELS_FR,
  PAYMENT_PROVIDER_LABELS_FR,
  PAYMENT_PROVIDERS,
  type SubscriptionPlanCode,
  type PaymentProviderCode,
} from "@apa/domain";
import { Button } from "@/components/ui/Button";

interface PlanRow {
  plan_code: SubscriptionPlanCode;
  name_fr: string;
  price_amount: number | null;
  price_currency: string;
  billing_period: "monthly" | "yearly" | null;
  payment_instructions_fr: string | null;
  active: boolean;
}

interface SubscriptionRow {
  id: string;
  plan_code: SubscriptionPlanCode;
  status: "pending" | "active" | "expired" | "canceled";
  started_at: string | null;
  expires_at: string | null;
  created_at: string;
}

interface PaymentRow {
  id: string;
  subscription_id: string | null;
  provider: PaymentProviderCode;
  amount: number;
  currency: string;
  status: "pending" | "confirmed" | "failed" | "refunded";
  external_reference: string | null;
  created_at: string;
}

function formatPrice(amount: number, currency: string) {
  return `${amount.toLocaleString("fr-FR")} ${currency}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const STATUS_LABELS_FR: Record<SubscriptionRow["status"], string> = {
  pending: "En attente de paiement",
  active: "Actif",
  expired: "Expiré",
  canceled: "Annulé",
};

const PAYMENT_STATUS_LABELS_FR: Record<PaymentRow["status"], string> = {
  pending: "En attente de vérification",
  confirmed: "Confirmé",
  failed: "Échoué",
  refunded: "Remboursé",
};

/**
 * Écran « Mon abonnement » (§47, §48) — Sprint 14.
 *
 * Le mécanisme réel du V1 n'appelle AUCUNE passerelle de paiement (§47) : le
 * patient (1) choisit un plan premium → crée une souscription `pending`,
 * (2) effectue lui-même le transfert Mobile Money en suivant les
 * instructions du plan, (3) déclare la référence de transaction obtenue,
 * (4) attend la confirmation manuelle d'un administrateur. Rien n'est activé
 * automatiquement à aucune étape côté client.
 */
export function SubscriptionFlow() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [isCurrentlyActive, setIsCurrentlyActive] = useState(false);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState<SubscriptionPlanCode | null>(null);

  const [claimProvider, setClaimProvider] = useState<PaymentProviderCode>("orange_money");
  const [claimReference, setClaimReference] = useState("");
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState(false);

  async function reload() {
    const [subRes, payRes] = await Promise.all([fetch("/api/subscription"), fetch("/api/payments")]);
    const subData = await subRes.json();
    const payData = await payRes.json();

    if (!subRes.ok) {
      setError(subData.message ?? "Une erreur est survenue.");
      return;
    }
    if (!payRes.ok) {
      setError(payData.message ?? "Une erreur est survenue.");
      return;
    }

    setPlans(subData.plans ?? []);
    setSubscription(subData.subscription ?? null);
    setIsCurrentlyActive(Boolean(subData.isCurrentlyActive));
    setPayments(payData.payments ?? []);
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      setError(null);
      try {
        await reload();
      } catch {
        setError("Impossible de charger votre abonnement pour le moment.");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  async function requestPlan(planCode: SubscriptionPlanCode) {
    setRequesting(planCode);
    setError(null);
    try {
      const res = await fetch("/api/subscription/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Impossible d'enregistrer votre demande.");
        return;
      }
      await reload();
    } finally {
      setRequesting(null);
    }
  }

  async function submitClaim(e: React.FormEvent) {
    e.preventDefault();
    if (!subscription) return;
    setClaimSubmitting(true);
    setClaimError(null);
    setClaimSuccess(false);

    const plan = plans.find((p) => p.plan_code === subscription.plan_code);
    if (!plan || plan.price_amount === null) {
      setClaimError("Le montant de ce plan n'est pas disponible pour le moment.");
      setClaimSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId: subscription.id,
          provider: claimProvider,
          amount: plan.price_amount,
          currency: plan.price_currency,
          externalReference: claimReference,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setClaimError(data.message ?? "Impossible d'enregistrer votre paiement.");
        return;
      }
      setClaimReference("");
      setClaimSuccess(true);
      await reload();
    } finally {
      setClaimSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-primary-700">Chargement de votre abonnement…</p>;
  }

  if (error) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </p>
    );
  }

  const currentPlan = subscription ? plans.find((p) => p.plan_code === subscription.plan_code) : null;
  const pendingPaymentForCurrentSubscription = subscription
    ? payments.find((p) => p.subscription_id === subscription.id && p.status === "pending")
    : undefined;
  const canDeclarePayment = subscription && subscription.status === "pending" && !pendingPaymentForCurrentSubscription;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-primary-200 bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-primary-500">Statut actuel</p>
        {subscription ? (
          <>
            <p className="text-lg font-semibold text-primary-900">
              {SUBSCRIPTION_PLAN_LABELS_FR[subscription.plan_code]} — {STATUS_LABELS_FR[subscription.status]}
            </p>
            {subscription.expires_at && (
              <p className="text-sm text-primary-600">Expire le {formatDate(subscription.expires_at)}</p>
            )}
            {!isCurrentlyActive && subscription.status === "active" && (
              <p className="mt-1 text-sm text-amber-700">Votre abonnement premium a expiré.</p>
            )}
          </>
        ) : (
          <p className="text-lg font-semibold text-primary-900">{SUBSCRIPTION_PLAN_LABELS_FR.free}</p>
        )}
      </section>

      {subscription?.status === "pending" && currentPlan && (
        <section className="rounded-xl border border-primary-300 bg-primary-50 p-4">
          <p className="font-medium text-primary-900">Paiement en attente</p>
          <p className="mt-1 text-sm text-primary-700">
            Montant : {currentPlan.price_amount !== null ? formatPrice(currentPlan.price_amount, currentPlan.price_currency) : "—"}
          </p>
          {currentPlan.payment_instructions_fr ? (
            <p className="mt-2 whitespace-pre-line text-sm text-primary-800">{currentPlan.payment_instructions_fr}</p>
          ) : (
            <p className="mt-2 text-sm text-primary-600">
              Les instructions de paiement ne sont pas encore configurées pour ce plan. Contactez l'équipe pour finaliser
              votre abonnement.
            </p>
          )}

          {pendingPaymentForCurrentSubscription ? (
            <p className="mt-3 text-sm text-primary-700">
              Votre déclaration de paiement du {formatDate(pendingPaymentForCurrentSubscription.created_at)} est en cours
              de vérification par un administrateur.
            </p>
          ) : (
            canDeclarePayment && (
              <form onSubmit={submitClaim} className="mt-4 flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-sm text-primary-800">
                  Opérateur utilisé
                  <select
                    value={claimProvider}
                    onChange={(e) => setClaimProvider(e.target.value as PaymentProviderCode)}
                    className="rounded-lg border border-primary-300 px-3 py-2"
                  >
                    {PAYMENT_PROVIDERS.filter((p) => p !== "manual").map((p) => (
                      <option key={p} value={p}>
                        {PAYMENT_PROVIDER_LABELS_FR[p]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-primary-800">
                  Référence de la transaction
                  <input
                    type="text"
                    required
                    value={claimReference}
                    onChange={(e) => setClaimReference(e.target.value)}
                    placeholder="Ex. TX123456"
                    className="rounded-lg border border-primary-300 px-3 py-2"
                  />
                </label>
                {claimError && (
                  <p role="alert" className="text-sm text-red-700">
                    {claimError}
                  </p>
                )}
                {claimSuccess && <p className="text-sm text-green-700">Déclaration enregistrée, merci.</p>}
                <Button type="submit" disabled={claimSubmitting}>
                  {claimSubmitting ? "Envoi…" : "J'ai payé — déclarer la transaction"}
                </Button>
              </form>
            )
          )}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <p className="text-sm font-medium text-primary-900">Plans disponibles</p>
        {plans
          .filter((p) => p.plan_code !== "free")
          .map((plan) => (
            <div key={plan.plan_code} className="rounded-xl border border-primary-200 bg-white p-4">
              <p className="font-medium text-primary-900">{plan.name_fr}</p>
              <p className="text-sm text-primary-600">
                {plan.price_amount !== null ? formatPrice(plan.price_amount, plan.price_currency) : "—"}
                {plan.billing_period === "monthly" ? " / mois" : plan.billing_period === "yearly" ? " / an" : ""}
              </p>
              <Button
                type="button"
                className="mt-2"
                disabled={requesting === plan.plan_code || subscription?.plan_code === plan.plan_code}
                onClick={() => requestPlan(plan.plan_code)}
              >
                {subscription?.plan_code === plan.plan_code
                  ? "Déjà demandé"
                  : requesting === plan.plan_code
                    ? "Envoi…"
                    : "Choisir ce plan"}
              </Button>
            </div>
          ))}
      </section>

      {payments.length > 0 && (
        <section className="flex flex-col gap-2">
          <p className="text-sm font-medium text-primary-900">Historique des paiements déclarés</p>
          <ul className="flex flex-col gap-2">
            {payments.map((p) => (
              <li key={p.id} className="rounded-lg border border-primary-200 bg-white p-3 text-sm text-primary-700">
                {formatDate(p.created_at)} · {PAYMENT_PROVIDER_LABELS_FR[p.provider]} · {formatPrice(p.amount, p.currency)} ·{" "}
                {PAYMENT_STATUS_LABELS_FR[p.status]}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
