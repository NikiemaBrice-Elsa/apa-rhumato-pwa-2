import { OfflineBanner } from "@/components/OfflineBanner";

/**
 * Layout partagé de l'espace connecté (§54, Sprint 12) : affiche
 * l'indicateur hors connexion/synchronisation au-dessus de chaque page,
 * sans dupliquer son montage dans chaque `page.tsx`.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mx-auto max-w-md px-6 pt-4">
        <OfflineBanner />
      </div>
      {children}
    </>
  );
}
