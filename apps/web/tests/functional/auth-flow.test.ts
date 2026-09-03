import { describe, expect, it } from "vitest";
import { POST as signupHandler } from "@/app/api/auth/signup/route";

/**
 * Test fonctionnel (§55) — squelette. Vérifie que la route rejette une
 * requête sans consentement, sans dépendre d'une vraie base Supabase.
 * Un test d'inscription "de bout en bout" contre une base de test sera
 * ajouté quand l'environnement de recette Supabase sera disponible
 * (cf. docs/DEPLOYMENT.md) — non bloquant pour ce sprint.
 */
describe("POST /api/auth/signup", () => {
  it("rejette une requête sans consentement (§12)", async () => {
    const request = new Request("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Test",
        email: "test@example.com",
        password: "motdepasse123",
        consentTerms: false,
        consentDataProcessing: false,
      }),
    });

    const response = await signupHandler(request);
    expect(response.status).toBe(422);
  });

  it("rejette une requête sans email (V1 requiert un email)", async () => {
    const request = new Request("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Test",
        phone: "+22670000000",
        password: "motdepasse123",
        consentTerms: true,
        consentDataProcessing: true,
      }),
    });

    const response = await signupHandler(request);
    expect(response.status).toBe(422);
  });
});
