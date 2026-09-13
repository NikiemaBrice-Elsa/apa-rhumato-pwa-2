import { describe, expect, it } from "vitest";
import { isProfessionalRole, canTransitionProfessionalLinkStatus } from "../professional";

describe("isProfessionalRole (§41)", () => {
  it("reconnaît uniquement le rôle 'professional'", () => {
    expect(isProfessionalRole("professional")).toBe(true);
    expect(isProfessionalRole("patient")).toBe(false);
    expect(isProfessionalRole("admin")).toBe(false);
    expect(isProfessionalRole(null)).toBe(false);
    expect(isProfessionalRole(undefined)).toBe(false);
  });
});

describe("canTransitionProfessionalLinkStatus (§41, §46 — toujours initié par le patient)", () => {
  it("le patient peut inviter (via création, pas transition) puis révoquer", () => {
    expect(canTransitionProfessionalLinkStatus("pending", "revoked", "patient")).toBe(true);
    expect(canTransitionProfessionalLinkStatus("authorized", "revoked", "patient")).toBe(true);
  });

  it("le patient peut réinviter après une révocation", () => {
    expect(canTransitionProfessionalLinkStatus("revoked", "pending", "patient")).toBe(true);
  });

  it("le patient ne peut JAMAIS s'auto-autoriser lui-même", () => {
    expect(canTransitionProfessionalLinkStatus("pending", "authorized", "patient")).toBe(false);
  });

  it("le professionnel peut accepter ou décliner une invitation", () => {
    expect(canTransitionProfessionalLinkStatus("pending", "authorized", "professional")).toBe(true);
    expect(canTransitionProfessionalLinkStatus("pending", "revoked", "professional")).toBe(true);
  });

  it("le professionnel peut se retirer d'un accès déjà autorisé", () => {
    expect(canTransitionProfessionalLinkStatus("authorized", "revoked", "professional")).toBe(true);
  });

  it("le professionnel ne peut JAMAIS réinviter lui-même après une révocation", () => {
    expect(canTransitionProfessionalLinkStatus("revoked", "pending", "professional")).toBe(false);
  });

  it("aucune transition n'est permise depuis un état terminal non prévu", () => {
    expect(canTransitionProfessionalLinkStatus("revoked", "authorized", "patient")).toBe(false);
    expect(canTransitionProfessionalLinkStatus("revoked", "authorized", "professional")).toBe(false);
  });
});
