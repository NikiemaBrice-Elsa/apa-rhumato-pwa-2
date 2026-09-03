import { describe, expect, it } from "vitest";
import { computeAdherencePercent } from "@apa/domain";

/**
 * Test sécurité (§55), Sprint 9. Garde-fou : `computeAdherencePercent` ne
 * doit JAMAIS renvoyer une valeur numérique en l'absence d'une fréquence
 * cible réelle (c'est-à-dire tant qu'aucun programme validé médicalement
 * n'est attribué à l'utilisateur, §29, §57, §59). Casse intentionnellement
 * si quelqu'un ajoute un jour une valeur par défaut (0 %, estimation, etc.)
 * à la place de `null`.
 */
describe("Garde-fou : pas de taux d'adhésion inventé sans fréquence cible validée", () => {
  it("aucune fréquence cible -> null, quel que soit le nombre de séances réalisées", () => {
    for (const sessionsCompleted of [0, 1, 5, 100]) {
      expect(computeAdherencePercent(sessionsCompleted, null)).toBeNull();
      expect(computeAdherencePercent(sessionsCompleted, undefined)).toBeNull();
    }
  });

  it("fréquence cible à zéro ou négative -> null (jamais une division par une valeur non sourcée)", () => {
    expect(computeAdherencePercent(3, 0)).toBeNull();
    expect(computeAdherencePercent(3, -1)).toBeNull();
  });
});
