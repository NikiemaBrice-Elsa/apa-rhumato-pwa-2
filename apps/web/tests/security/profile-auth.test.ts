import { describe, expect, it, vi } from "vitest";

// `cookies()` de next/headers exige un contexte de requête Next.js réel,
// absent de l'environnement de test unitaire. On le simule ici avec un
// magasin de cookies vide (= aucune session), ce qui correspond exactement
// au scénario testé : un appel non authentifié.
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: () => undefined,
    set: () => {},
  }),
}));

const { GET: getProfile } = await import("@/app/api/profile/route");

/**
 * Test sécurité (§55) — squelette. Vérifie qu'un accès non authentifié au
 * profil est bien rejeté (401), conformément au §46 : « ne jamais faire
 * confiance uniquement aux contrôles frontend » — le contrôle doit être
 * serveur, sur toute route sensible.
 */
describe("GET /api/profile — accès non autorisé", () => {
  it("renvoie 401 sans session authentifiée", async () => {
    const response = await getProfile();
    expect(response.status).toBe(401);
  });
});
