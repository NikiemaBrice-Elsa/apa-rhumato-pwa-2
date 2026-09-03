import { describe, expect, it } from "vitest";
import { isSubscriptionCurrentlyActive, computeSubscriptionExpiry, isValidPlanPricing } from "../subscriptions";

describe("isSubscriptionCurrentlyActive (§48)", () => {
  const now = new Date("2026-08-20T12:00:00Z");

  it("est active sans date d'expiration tant que le statut est 'active'", () => {
    expect(isSubscriptionCurrentlyActive({ status: "active", expiresAt: null }, now)).toBe(true);
  });

  it("est active si l'expiration est dans le futur", () => {
    expect(isSubscriptionCurrentlyActive({ status: "active", expiresAt: "2026-09-01T00:00:00Z" }, now)).toBe(true);
  });

  it("n'est plus active si l'expiration est passée, même avec statut 'active'", () => {
    expect(isSubscriptionCurrentlyActive({ status: "active", expiresAt: "2026-01-01T00:00:00Z" }, now)).toBe(false);
  });

  it("n'est jamais active pour un statut pending/expired/canceled, quelle que soit l'expiration", () => {
    expect(isSubscriptionCurrentlyActive({ status: "pending", expiresAt: null }, now)).toBe(false);
    expect(isSubscriptionCurrentlyActive({ status: "expired", expiresAt: "2027-01-01T00:00:00Z" }, now)).toBe(false);
    expect(isSubscriptionCurrentlyActive({ status: "canceled", expiresAt: "2027-01-01T00:00:00Z" }, now)).toBe(false);
  });
});

describe("computeSubscriptionExpiry", () => {
  it("ajoute un mois pour une périodicité mensuelle", () => {
    const start = new Date("2026-08-20T10:00:00Z");
    const expiry = computeSubscriptionExpiry(start, "monthly");
    expect(expiry.toISOString()).toBe("2026-09-20T10:00:00.000Z");
  });

  it("ajoute un an pour une périodicité annuelle", () => {
    const start = new Date("2026-08-20T10:00:00Z");
    const expiry = computeSubscriptionExpiry(start, "yearly");
    expect(expiry.toISOString()).toBe("2027-08-20T10:00:00.000Z");
  });

  it("ne mute pas la date de départ passée en paramètre", () => {
    const start = new Date("2026-08-20T10:00:00Z");
    const originalTime = start.getTime();
    computeSubscriptionExpiry(start, "monthly");
    expect(start.getTime()).toBe(originalTime);
  });
});

describe("isValidPlanPricing (§48)", () => {
  it("accepte le plan gratuit sans prix ni périodicité", () => {
    expect(isValidPlanPricing({ planCode: "free", priceAmount: null, billingPeriod: null })).toBe(true);
  });

  it("refuse un plan gratuit avec un prix", () => {
    expect(isValidPlanPricing({ planCode: "free", priceAmount: 2000, billingPeriod: null })).toBe(false);
  });

  it("accepte un plan premium avec prix positif et périodicité", () => {
    expect(isValidPlanPricing({ planCode: "premium_monthly", priceAmount: 2000, billingPeriod: "monthly" })).toBe(true);
  });

  it("refuse un plan premium sans prix, avec un prix nul ou négatif, ou sans périodicité", () => {
    expect(isValidPlanPricing({ planCode: "premium_monthly", priceAmount: null, billingPeriod: "monthly" })).toBe(false);
    expect(isValidPlanPricing({ planCode: "premium_monthly", priceAmount: 0, billingPeriod: "monthly" })).toBe(false);
    expect(isValidPlanPricing({ planCode: "premium_monthly", priceAmount: -100, billingPeriod: "monthly" })).toBe(false);
    expect(isValidPlanPricing({ planCode: "premium_yearly", priceAmount: 10000, billingPeriod: null })).toBe(false);
  });
});
