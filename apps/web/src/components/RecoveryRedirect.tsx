"use client";

import { useEffect } from "react";

/**
 * Filet de sécurité (recette du 08/09/2026) : un lien de réinitialisation de
 * mot de passe envoyé manuellement depuis le tableau de bord Supabase (ex.
 * bouton « Send password recovery ») ne peut pas cibler une page précise —
 * il redirige toujours vers l'« URL du site » globale, c'est-à-dire la page
 * d'accueil, avec les jetons dans le fragment d'URL (#access_token=…&type=
 * recovery, ou #error=…&error_code=otp_expired si le lien est expiré).
 * Sans ce composant, l'utilisateur atterrit sur la page d'accueil normale
 * sans aucun moyen de choisir un nouveau mot de passe (c'est exactement ce
 * qui s'est produit lors de la recette). Monté une seule fois dans le layout
 * racine, il détecte ce fragment sur n'importe quelle page et redirige vers
 * /nouveau-mot-de-passe, qui sait le traiter.
 */
export function RecoveryRedirect() {
  useEffect(() => {
    if (window.location.pathname === "/nouveau-mot-de-passe") return;

    const hash = window.location.hash;
    const isRecoveryLink = hash.includes("type=recovery") || hash.includes("error_code=otp_expired");

    if (isRecoveryLink) {
      window.location.replace(`/nouveau-mot-de-passe${hash}`);
    }
  }, []);

  return null;
}
