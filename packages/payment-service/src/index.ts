/**
 * Abstraction de paiement (§47 du cahier des charges) — Sprint 14.
 *
 * §47 : « Prévoir une architecture permettant l'intégration ultérieure de
 * paiements adaptés au contexte burkinabè. Ne pas coder un système de
 * paiement fictif. Le paiement doit être abstrait derrière un service :
 * PaymentService, afin de pouvoir connecter ultérieurement : Mobile Money,
 * Orange Money, Moov Money, autre fournisseur approprié. »
 *
 * Ce fichier fait EXACTEMENT ça, ni plus ni moins : il définit l'interface
 * `PaymentService` et un point d'entrée par fournisseur (`getPaymentService`),
 * mais AUCUNE des trois implémentations n'appelle une vraie passerelle —
 * aucune clé API Orange Money/Moov Money n'a été fournie à ce projet, et en
 * inventer l'intégration serait exactement le « système de paiement fictif »
 * que le §47 interdit. Chaque implémentation lève donc explicitement
 * `PaymentProviderNotImplementedError` plutôt que de simuler un succès.
 *
 * Le mécanisme de paiement RÉELLEMENT fonctionnel du V1 (soumission d'une
 * référence de transaction par le patient, confirmation manuelle par un
 * administrateur dans `/admin/abonnements`) ne passe PAS par ce fichier :
 * il ne contacte aucune passerelle externe, donc il n'y a rien à abstraire
 * derrière `PaymentService` pour lui — voir `apps/web/src/app/api/payments`
 * et `docs/DECISIONS.md` (section Sprint 14) pour le détail de ce choix.
 */

export interface PaymentInitiationResult {
  paymentId: string;
  /** URL vers laquelle rediriger l'utilisateur pour finaliser le paiement
   * sur une vraie passerelle hébergée — n'existe que pour un fournisseur
   * réellement intégré. */
  redirectUrl?: string;
}

export interface PaymentService {
  readonly provider: string;

  initiatePayment(params: {
    userId: string;
    amount: number;
    currency: string;
    planCode: string;
  }): Promise<PaymentInitiationResult>;

  getPaymentStatus(paymentId: string): Promise<"pending" | "succeeded" | "failed" | "refunded">;
}

export class PaymentProviderNotImplementedError extends Error {
  constructor(provider: string) {
    super(
      `Le fournisseur de paiement "${provider}" n'est pas encore intégré (§47 : architecture prévue, intégration réelle non réalisée faute d'accès fournisseur). Utilisez le flux de réconciliation manuelle (voir apps/web/src/app/api/payments) en attendant.`
    );
    this.name = "PaymentProviderNotImplementedError";
  }
}

function notImplementedProvider(provider: string): PaymentService {
  return {
    provider,
    async initiatePayment() {
      throw new PaymentProviderNotImplementedError(provider);
    },
    async getPaymentStatus() {
      throw new PaymentProviderNotImplementedError(provider);
    },
  };
}

/** Fournisseurs prévus par §47, tous non implémentés en V1 (voir
 * l'avertissement en tête de fichier) — les slots existent pour que le
 * futur travail d'intégration se limite à remplacer une implémentation
 * dans ce registre, sans toucher au reste de l'application. */
const PROVIDERS = ["orange_money", "moov_money", "mobile_money"] as const;
export type PaymentProviderId = (typeof PROVIDERS)[number];

const registry: Record<PaymentProviderId, () => PaymentService> = {
  orange_money: () => notImplementedProvider("orange_money"),
  moov_money: () => notImplementedProvider("moov_money"),
  mobile_money: () => notImplementedProvider("mobile_money"),
};

export function getPaymentService(provider: PaymentProviderId): PaymentService {
  const factory = registry[provider];
  if (!factory) {
    throw new PaymentProviderNotImplementedError(provider);
  }
  return factory();
}

export function listAvailablePaymentProviders(): PaymentProviderId[] {
  return [...PROVIDERS];
}
