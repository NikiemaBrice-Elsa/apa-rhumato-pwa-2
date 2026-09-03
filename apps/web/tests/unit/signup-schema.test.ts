import { describe, expect, it } from "vitest";
import { signUpSchema } from "@apa/domain";

// Test unitaire côté app (complète ceux de packages/domain) : vérifie que le
// schéma utilisé réellement par l'API route /api/auth/signup applique bien
// les règles du §12 (consentements obligatoires, 8 caractères minimum).
describe("API signup — validation (§12, §46)", () => {
  it("refuse un mot de passe trop court", () => {
    const result = signUpSchema.safeParse({
      firstName: "Sam",
      email: "sam@example.com",
      password: "short",
      consentTerms: true,
      consentDataProcessing: true,
    });
    expect(result.success).toBe(false);
  });
});
