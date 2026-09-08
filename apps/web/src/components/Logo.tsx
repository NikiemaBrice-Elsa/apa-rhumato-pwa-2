import Image from "next/image";

/**
 * Logo APAS Rhumato (retour recette du 07/09/2026) — affiché de façon
 * cohérente dans toute l'application. Fichier source : public/brand/.
 */
export function Logo({ size = 72, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src="/brand/logo-apas-rhumato.png"
      alt="APAS Rhumato"
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}
