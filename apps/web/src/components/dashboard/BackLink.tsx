"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const HUB_PATH = "/tableau-de-bord";

/**
 * Lien de retour vers le tableau de bord (retour recette du 07/09/2026 :
 * « pas de bouton retour après avoir cliqué sur un onglet »). Masqué sur le
 * tableau de bord lui-même, affiché sur toutes les autres pages de l'espace
 * connecté.
 */
export function BackLink() {
  const pathname = usePathname();
  if (!pathname || pathname === HUB_PATH) {
    return null;
  }

  return (
    <Link
      href={HUB_PATH}
      className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:text-primary-900"
    >
      <span aria-hidden="true">←</span> Retour au tableau de bord
    </Link>
  );
}
