import { OfflineBanner } from "@/components/OfflineBanner";
import { BackLink } from "@/components/dashboard/BackLink";

/**
 * Layout partagé de l'espace connecté (§54, Sprint 12) : affiche
 * l'indicateur hors connexion/synchronisation au-dessus de chaque page,
 * sans dupliquer son montage dans chaque `page.tsx`. Affiche aussi le lien
 * de retour vers le tableau de bord (retour recette du 07/09/2026).
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mx-auto max-w-md px-6 pt-4 sm:max-w-lg md:max-w-2xl lg:max-w-3xl xl:max-w-4xl">
        <BackLink />
        <OfflineBanner />
      </div>
      {children}
    </>
  );
}
