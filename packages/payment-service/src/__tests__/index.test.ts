import { describe, expect, it } from "vitest";
import { getPaymentService, listAvailablePaymentProviders, PaymentProviderNotImplementedError } from "../index";

/**
 * §47 : « Ne pas coder un système de paiement fictif. » Ces tests vérifient
 * précisément l'INVERSE d'un test de succès habituel : chaque fournisseur
 * doit échouer explicitement, jamais simuler un paiement réussi. C'est le
 * garde-fou de sécurité/honnêteté de ce sprint, même esprit que les tests
 * "no-invented-*" des sprints précédents (ex. screening-no-invented-green).
 */
describe("getPaymentService — aucun fournisseur réel n'est implémenté", () => {
  it.each(listAvailablePaymentProviders())("%s : initiatePayment échoue explicitement", async (provider) => {
    const service = getPaymentService(provider);
    await expect(
      service.initiatePayment({ userId: "u1", amount: 2000, currency: "XOF", planCode: "premium_monthly" })
    ).rejects.toBeInstanceOf(PaymentProviderNotImplementedError);
  });

  it.each(listAvailablePaymentProviders())("%s : getPaymentStatus échoue explicitement", async (provider) => {
    const service = getPaymentService(provider);
    await expect(service.getPaymentStatus("payment-1")).rejects.toBeInstanceOf(PaymentProviderNotImplementedError);
  });

  it("liste exactement les trois fournisseurs prévus par §47", () => {
    expect(listAvailablePaymentProviders().sort()).toEqual(["mobile_money", "moov_money", "orange_money"]);
  });
});
