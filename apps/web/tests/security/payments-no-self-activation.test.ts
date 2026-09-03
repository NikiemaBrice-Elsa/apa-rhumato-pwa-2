import { describe, expect, it } from "vitest";
import { subscriptionRequestSchema, paymentClaimSchema } from "@apa/domain";

/**
 * §46, §47 — même famille de garde-fou que la faille RLS corrigée au
 * Sprint 13 (migration 0010) : un patient ne doit JAMAIS pouvoir faire
 * passer une souscription ou un paiement à un statut "actif"/"confirmé"
 * par lui-même. Les schémas patient-facing (`subscriptionRequestSchema`,
 * `paymentClaimSchema`) n'exposent structurellement aucun champ `status` —
 * ce test casse intentionnellement si quelqu'un en ajoutait un par erreur,
 * ce qui rouvrirait la même classe de vulnérabilité côté abonnements.
 */
describe("subscriptionRequestSchema — aucun champ de statut exposé au patient", () => {
  it("ignore un champ 'status' injecté dans la requête", () => {
    const parsed = subscriptionRequestSchema.parse({ planCode: "premium_monthly", status: "active" } as unknown);
    expect(parsed).toEqual({ planCode: "premium_monthly" });
    expect("status" in parsed).toBe(false);
  });
});

describe("paymentClaimSchema — aucun champ de statut exposé au patient", () => {
  it("ignore un champ 'status' injecté dans la requête", () => {
    const parsed = paymentClaimSchema.parse({
      subscriptionId: "sub-1",
      provider: "orange_money",
      amount: 2000,
      currency: "XOF",
      externalReference: "TX123",
      status: "confirmed",
    } as unknown);
    expect("status" in parsed).toBe(false);
  });
});
