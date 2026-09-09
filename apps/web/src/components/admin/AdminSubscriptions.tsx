"use client";

import { useEffect, useState } from "react";
import {
  PAYMENT_PROVIDER_LABELS_FR,
  SUBSCRIPTION_PLAN_LABELS_FR,
  type SubscriptionPlanCode,
  type PaymentProviderCode,
} from "@apa/domain";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

interface PlanRow {
  plan_code: SubscriptionPlanCode;
  name_fr: string;
  price_amount: number | null;
  price_currency: string;
  billing_period: "monthly" | "quarterly" | "yearly" | null;
  payment_instructions_fr: string | null;
  active: boolean;
}

interface UserRef {
  first_name: string;
  last_name: string;
  email: string;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  plan_code: SubscriptionPlanCode;
  status: "pending" | "active" | "expired" | "canceled";
  started_at: string | null;
  expires_at: string | null;
  created_at: string;
  users: UserRef | null;
}

interface PaymentRow {
  id: string;
  user_id: string;
  subscription_id: string | null;
  provider: PaymentProviderCode;
  amount: number;
  currency: string;
  status: "pending" | "confirmed" | "failed" | "refunded";
  external_reference: string | null;
  created_at: string;
  users: UserRef | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function userLabel(u: UserRef | null) {
  if (!u) return "Utilisateur inconnu";
  return `${u.first_name} ${u.last_name} (${u.email})`;
}

const SUBSCRIPTION_STATUS_LABELS_FR: Record<SubscriptionRow["status"], string> = {
  pending: "En attente de paiement",
  active: "Actif",
  expired: "Expiré",
  canceled: "Annulé",
};

function planFormFromRow(p: PlanRow) {
  return {
    planCode: p.plan_code,
    nameFr: p.name_fr,
    priceAmount: p.price_amount !== null ? String(p.price_amount) : "",
    priceCurrency: p.price_currency,
    billingPeriod: p.billing_period ?? "",
    paymentInstructionsFr: p.payment_instructions_fr ?? "",
    active: p.active,
  };
}

/**
 * §42 « gestion abonnements », §47, §48 — Sprint 14. Trois blocs : édition
 * des plans (tarif/instructions, jamais codés en dur — §48), file des
 * paiements déclarés à réconcilier manuellement (§47 : la seule façon
 * qu'une souscription devienne `active`), et liste des souscriptions.
 */
export function AdminSubscriptions() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [editingPlan, setEditingPlan] = useState<SubscriptionPlanCode | null>(null);
  const [planForm, setPlanForm] = useState<ReturnType<typeof planFormFromRow> | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);

  const [paymentFilter, setPaymentFilter] = useState<"pending" | "all">("pending");
  const [payingId, setPayingId] = useState<string | null>(null);

  async function reloadPlans() {
    const res = await fetch("/api/admin/subscription-plans");
    const data = await res.json();
    if (res.ok) {
      setPlans(data.plans ?? []);
      setError(null);
    } else setError(data.message ?? "Une erreur est survenue.");
  }

  async function reloadSubscriptions() {
    const res = await fetch("/api/admin/subscriptions");
    const data = await res.json();
    if (res.ok) {
      setSubscriptions(data.subscriptions ?? []);
      setError(null);
    } else setError(data.message ?? "Une erreur est survenue.");
  }

  async function reloadPayments() {
    const url = paymentFilter === "pending" ? "/api/admin/payments?status=pending" : "/api/admin/payments";
    const res = await fetch(url);
    const data = await res.json();
    if (res.ok) {
      setPayments(data.payments ?? []);
      setError(null);
    } else setError(data.message ?? "Une erreur est survenue.");
  }

  useEffect(() => {
    reloadPlans();
    reloadSubscriptions();
  }, []);

  useEffect(() => {
    reloadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentFilter]);

  function startEditPlan(p: PlanRow) {
    setEditingPlan(p.plan_code);
    setPlanForm(planFormFromRow(p));
  }

  async function savePlan() {
    if (!editingPlan || !planForm) return;
    setSavingPlan(true);
    setError(null);
    const payload = {
      planCode: planForm.planCode,
      nameFr: planForm.nameFr,
      priceAmount: planForm.priceAmount.trim() === "" ? null : Number(planForm.priceAmount),
      priceCurrency: planForm.priceCurrency,
      billingPeriod: planForm.billingPeriod === "" ? null : planForm.billingPeriod,
      paymentInstructionsFr: planForm.paymentInstructionsFr,
      active: planForm.active,
    };
    const res = await fetch(`/api/admin/subscription-plans/${editingPlan}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? "Une erreur est survenue.");
      setSavingPlan(false);
      return;
    }
    setEditingPlan(null);
    setPlanForm(null);
    await reloadPlans();
    setSavingPlan(false);
  }

  async function confirmPayment(id: string, status: "confirmed" | "failed" | "refunded") {
    setPayingId(id);
    setError(null);
    const res = await fetch(`/api/admin/payments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? "Une erreur est survenue.");
      setPayingId(null);
      return;
    }
    await Promise.all([reloadPayments(), reloadSubscriptions()]);
    setPayingId(null);
  }

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-primary-900">Plans (§48)</h2>
        {plans.map((p) => (
          <div key={p.plan_code} className="rounded-xl border border-primary-200 bg-white p-4">
            {editingPlan === p.plan_code && planForm ? (
              <div className="flex flex-col gap-3">
                <Field label="Nom" htmlFor={`plan-name-${p.plan_code}`}>
                  <input
                    id={`plan-name-${p.plan_code}`}
                    className="w-full rounded border border-primary-300 px-3 py-2"
                    value={planForm.nameFr}
                    onChange={(e) => setPlanForm({ ...planForm, nameFr: e.target.value })}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Prix" htmlFor={`plan-price-${p.plan_code}`} hint="Laisser vide pour le plan gratuit">
                    <input
                      id={`plan-price-${p.plan_code}`}
                      type="number"
                      className="w-full rounded border border-primary-300 px-3 py-2"
                      value={planForm.priceAmount}
                      onChange={(e) => setPlanForm({ ...planForm, priceAmount: e.target.value })}
                    />
                  </Field>
                  <Field label="Devise" htmlFor={`plan-currency-${p.plan_code}`}>
                    <input
                      id={`plan-currency-${p.plan_code}`}
                      className="w-full rounded border border-primary-300 px-3 py-2"
                      value={planForm.priceCurrency}
                      onChange={(e) => setPlanForm({ ...planForm, priceCurrency: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label="Périodicité" htmlFor={`plan-period-${p.plan_code}`}>
                  <select
                    id={`plan-period-${p.plan_code}`}
                    className="w-full rounded border border-primary-300 px-3 py-2"
                    value={planForm.billingPeriod}
                    onChange={(e) =>
                      setPlanForm({ ...planForm, billingPeriod: e.target.value as "" | "monthly" | "quarterly" | "yearly" })
                    }
                  >
                    <option value="">— (plan gratuit)</option>
                    <option value="monthly">Mensuelle</option>
                    <option value="quarterly">Trimestrielle</option>
                    <option value="yearly">Annuelle</option>
                  </select>
                </Field>
                <Field
                  label="Instructions de paiement"
                  htmlFor={`plan-instructions-${p.plan_code}`}
                  hint="Numéro Mobile Money / Orange Money / Moov Money à afficher au patient — laisser vide tant que non configuré (§47 : ne jamais inventer ce numéro)"
                >
                  <textarea
                    id={`plan-instructions-${p.plan_code}`}
                    rows={3}
                    className="w-full rounded border border-primary-300 px-3 py-2"
                    value={planForm.paymentInstructionsFr}
                    onChange={(e) => setPlanForm({ ...planForm, paymentInstructionsFr: e.target.value })}
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm text-primary-800">
                  <input
                    type="checkbox"
                    checked={planForm.active}
                    onChange={(e) => setPlanForm({ ...planForm, active: e.target.checked })}
                  />
                  Plan actif (visible des patients)
                </label>
                <div className="flex gap-2">
                  <Button type="button" className="w-auto px-4 py-2" disabled={savingPlan} onClick={savePlan}>
                    {savingPlan ? "Enregistrement…" : "Enregistrer"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-auto px-4 py-2"
                    onClick={() => {
                      setEditingPlan(null);
                      setPlanForm(null);
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-primary-900">{p.name_fr}</p>
                  <p className="text-xs text-primary-500">
                    {p.price_amount !== null ? `${p.price_amount} ${p.price_currency}` : "Gratuit"}
                    {p.billing_period
                      ? ` / ${
                          p.billing_period === "monthly" ? "mois" : p.billing_period === "quarterly" ? "trimestre" : "an"
                        }`
                      : ""}{" "}
                    · {p.active ? "actif" : "inactif"}
                    {!p.payment_instructions_fr && p.plan_code !== "free" && " · ⚠ instructions non configurées"}
                  </p>
                </div>
                <Button type="button" variant="secondary" className="w-auto px-3 py-1 text-xs" onClick={() => startEditPlan(p)}>
                  Modifier
                </Button>
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border-2 border-primary-500 bg-primary-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-primary-900">
              Paiements à vérifier (§47){" "}
              {payments.filter((p) => p.status === "pending").length > 0 && (
                <span className="ml-1 rounded-full bg-orange-500 px-2 py-0.5 text-xs font-semibold text-white">
                  {payments.filter((p) => p.status === "pending").length}
                </span>
              )}
            </h2>
            <p className="text-xs text-primary-600">
              C&apos;est ICI qu&apos;un paiement déclaré par un patient se confirme — la confirmation active
              automatiquement son abonnement (aucune action supplémentaire à faire dans « Souscriptions » ci-dessous).
            </p>
          </div>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as "pending" | "all")}
            className="rounded border border-primary-300 px-2 py-1 text-sm"
          >
            <option value="pending">En attente</option>
            <option value="all">Tous</option>
          </select>
        </div>
        {payments.length === 0 && (
          <p className="text-sm text-primary-500">
            Aucun paiement à afficher pour l&apos;instant. Un paiement apparaît ici dès qu&apos;un patient déclare
            avoir effectué son transfert Mobile Money (référence de transaction saisie depuis son écran « Mon
            abonnement ») — pas au moment où il choisit simplement un plan.
          </p>
        )}
        {payments.map((p) => (
          <div key={p.id} className="rounded-xl border border-primary-200 bg-white p-4">
            <p className="font-medium text-primary-900">
              {userLabel(p.users)} — {p.amount} {p.currency} via {PAYMENT_PROVIDER_LABELS_FR[p.provider]}
            </p>
            <p className="text-xs text-primary-500">
              Numéro utilisé pour la transaction : <span className="font-medium">{p.external_reference ?? "—"}</span>{" "}
              · Déclaré le {formatDate(p.created_at)} · Statut : {p.status}
            </p>
            {p.status === "pending" && (
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  className="w-auto px-4 py-2"
                  disabled={payingId === p.id}
                  onClick={() => confirmPayment(p.id, "confirmed")}
                >
                  Confirmer le paiement (active l&apos;abonnement)
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-auto px-4 py-2"
                  disabled={payingId === p.id}
                  onClick={() => confirmPayment(p.id, "failed")}
                >
                  Rejeter
                </Button>
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-primary-900">Souscriptions</h2>
        <p className="text-xs text-primary-500">
          Liste de suivi uniquement — aucune action possible ici. Pour activer une souscription « en attente de
          paiement », utilisez la section « Paiements à vérifier » ci-dessus.
        </p>
        {subscriptions.length === 0 && <p className="text-sm text-primary-500">Aucune souscription enregistrée.</p>}
        {subscriptions.map((s) => {
          const linkedPayment = payments.find((p) => p.subscription_id === s.id && p.status === "pending");
          return (
            <div key={s.id} className="rounded-xl border border-primary-200 bg-white p-3 text-sm text-primary-700">
              <p>
                {userLabel(s.users)} · {SUBSCRIPTION_PLAN_LABELS_FR[s.plan_code] ?? s.plan_code} ·{" "}
                {SUBSCRIPTION_STATUS_LABELS_FR[s.status]}
                {s.expires_at ? ` · expire le ${formatDate(s.expires_at)}` : ""}
              </p>
              {s.status === "pending" && (
                <p className="mt-1 text-xs text-primary-500">
                  {linkedPayment
                    ? "→ Un paiement est déclaré pour cette souscription : voir « Paiements à vérifier » ci-dessus pour l'activer."
                    : "Aucun paiement déclaré pour l'instant par le patient — rien à faire tant qu'il n'a pas soumis sa référence de transaction."}
                </p>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
