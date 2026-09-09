/**
 * §47 (PaymentService), §48 (modèle économique initial) — Sprint 14.
 *
 * Logique PURE uniquement (types, dérivations, validations de cohérence) —
 * aucun accès réseau/DB ici. §47 : « Ne pas coder un système de paiement
 * fictif » — ce fichier ne simule donc AUCUN paiement réussi ; il décrit
 * seulement la FORME des données (`subscriptions`, `payments`, migration
 * 0011) et des règles de cohérence testables (une souscription est-elle
 * active, un plan est-il correctement tarifé…). Le mécanisme réel de
 * paiement du V1 (soumission d'une référence de transaction Mobile
 * Money/Orange Money/Moov Money, puis confirmation manuelle par un
 * administrateur) est documenté dans docs/DECISIONS.md — il n'appelle
 * aucune passerelle externe, donc il n'y a rien à abstraire ici derrière
 * `PaymentService` (voir packages/payment-service, qui documente au
 * contraire les intégrations FUTURES prévues par §47).
 */

/** §48 : plan gratuit + deux périodicités premium. Les codes sont figés
 * dans l'application ; les PRIX ne le sont pas — voir `SubscriptionPlan`,
 * dont les valeurs viennent toujours de la table `subscription_plans`
 * (§48 : « Ces prix sont des paramètres configurables et non des valeurs
 * codées en dur »), jamais d'une constante applicative. */
export const SUBSCRIPTION_PLAN_CODES = ["free", "premium_monthly", "premium_yearly"] as const;
export type SubscriptionPlanCode = (typeof SUBSCRIPTION_PLAN_CODES)[number];

/** Tarifs mis à jour le 09/09/2026 à la demande du Dr Nikiema : mensuel à
 * 5000 FCFA, et le plan `premium_yearly` redéfini en offre trimestrielle à
 * 10000 FCFA. Le code `premium_yearly` est conservé tel quel (identifiant
 * technique/clé primaire en base, jamais montré au patient) plutôt que
 * renommé, pour ne pas risquer de casser les souscriptions déjà créées qui
 * y font référence — seuls le libellé, le prix et la périodicité changent
 * (voir migration 0018). */
export const SUBSCRIPTION_PLAN_LABELS_FR: Record<SubscriptionPlanCode, string> = {
  free: "Gratuit",
  premium_monthly: "Premium (mensuel)",
  premium_yearly: "Premium (trimestriel)",
};

export const SUBSCRIPTION_STATUSES = ["pending", "active", "expired", "canceled"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const BILLING_PERIODS = ["monthly", "quarterly", "yearly"] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

/** §47 : « Mobile Money, Orange Money, Moov Money, autre fournisseur
 * approprié » — plus `manual`, pour un règlement enregistré directement par
 * un administrateur (espèces, virement…) sans rail mobile money. */
export const PAYMENT_PROVIDERS = ["orange_money", "moov_money", "mobile_money", "manual"] as const;
export type PaymentProviderCode = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_PROVIDER_LABELS_FR: Record<PaymentProviderCode, string> = {
  orange_money: "Orange Money",
  moov_money: "Moov Money",
  mobile_money: "Mobile Money (autre opérateur)",
  manual: "Autre / enregistré manuellement",
};

export const PAYMENT_STATUSES = ["pending", "confirmed", "failed", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Reflète `subscription_plans` (migration 0011). */
export interface SubscriptionPlan {
  planCode: SubscriptionPlanCode;
  nameFr: string;
  priceAmount: number | null; // null uniquement pour 'free'
  priceCurrency: string;
  billingPeriod: BillingPeriod | null; // null uniquement pour 'free'
  paymentInstructionsFr: string | null;
  active: boolean;
}

/** Reflète `subscriptions` (migration 0011). */
export interface Subscription {
  id: string;
  userId: string;
  planCode: SubscriptionPlanCode;
  status: SubscriptionStatus;
  startedAt?: string | null;
  expiresAt?: string | null;
}

/** Reflète `payments` (migration 0011). */
export interface Payment {
  id: string;
  userId: string;
  subscriptionId?: string | null;
  provider: PaymentProviderCode;
  amount: number;
  currency: string;
  status: PaymentStatus;
  externalReference?: string | null;
}

/**
 * Une souscription est active si et seulement si son statut est `active` ET
 * (aucune date d'expiration, ou expiration dans le futur). Jamais déduit
 * autrement — même discipline que §57/§59 appliquée à une donnée produit :
 * pas d'inférence à partir d'un paiement isolé, seulement ce que
 * `subscriptions.status` enregistre explicitement (mis à jour uniquement
 * par un administrateur, voir docs/DECISIONS.md).
 */
export function isSubscriptionCurrentlyActive(
  subscription: Pick<Subscription, "status" | "expiresAt">,
  now: Date
): boolean {
  if (subscription.status !== "active") return false;
  if (!subscription.expiresAt) return true;
  return new Date(subscription.expiresAt).getTime() > now.getTime();
}

/** Calcule une date d'expiration à partir d'un point de départ et d'une
 * périodicité — fonction pure (le point de départ est un paramètre
 * explicite, jamais `new Date()` interne), utilisée par l'administrateur au
 * moment d'activer une souscription après confirmation de paiement. */
export function computeSubscriptionExpiry(startedAt: Date, billingPeriod: BillingPeriod): Date {
  const expiry = new Date(startedAt.getTime());
  if (billingPeriod === "monthly") {
    expiry.setMonth(expiry.getMonth() + 1);
  } else if (billingPeriod === "quarterly") {
    expiry.setMonth(expiry.getMonth() + 3);
  } else {
    expiry.setFullYear(expiry.getFullYear() + 1);
  }
  return expiry;
}

/**
 * Nombre de jours entiers restant avant `expiresAt` (arrondi au jour
 * supérieur — un abonnement qui expire dans 9h30 doit afficher « 1 jour »,
 * pas « 0 »). Retourne `null` en l'absence de date d'expiration (abonnement
 * gratuit, ou premium sans expiration définie). Une valeur négative ou nulle
 * signifie que l'abonnement est déjà expiré. Fonction pure — `now` est un
 * paramètre explicite (même discipline que `computeSubscriptionExpiry`),
 * jamais `new Date()` interne, pour rester testable.
 */
export function getSubscriptionDaysRemaining(expiresAt: string | null | undefined, now: Date): number | null {
  if (!expiresAt) return null;
  const diffMs = new Date(expiresAt).getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * §48 : cohérence tarifaire d'un plan — le plan `free` ne doit jamais
 * porter de prix ni de périodicité ; un plan premium doit toujours porter
 * un prix strictement positif ET une périodicité. Utilisé côté administration
 * pour rejeter une configuration de plan incohérente à la saisie plutôt que
 * de découvrir le problème au moment de facturer un patient.
 */
export function isValidPlanPricing(
  plan: Pick<SubscriptionPlan, "planCode" | "priceAmount" | "billingPeriod">
): boolean {
  if (plan.planCode === "free") {
    return plan.priceAmount === null && plan.billingPeriod === null;
  }
  return typeof plan.priceAmount === "number" && plan.priceAmount > 0 && plan.billingPeriod !== null;
}
