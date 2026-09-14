import Link from "next/link";
import { getDictionary } from "@/lib/i18n";
import { PatientProfileForm } from "@/components/forms/PatientProfileForm";
import { OfflineBanner } from "@/components/OfflineBanner";

export default function ProfilePage() {
  const dict = getDictionary();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-primary-900">{dict.profile.title}</h1>
      {/* Sprint 24 (14/09/2026) : le formulaire peut désormais être rempli
          hors connexion (voir PatientProfileForm.tsx) — l'indicateur permet
          de voir que l'enregistrement est bien en attente de synchronisation,
          plutôt que de laisser croire qu'il a été perdu. */}
      <OfflineBanner />
      <PatientProfileForm />
      {/* Sprint 24 : cette page sert aussi bien à l'inscription qu'à une
          modification ultérieure (voir "Mon profil" sur le tableau de bord) —
          un lien retour évite une impasse pour ce second cas. */}
      <Link href="/tableau-de-bord" className="text-center text-sm text-primary-700 underline">
        Retour au tableau de bord
      </Link>
    </main>
  );
}
