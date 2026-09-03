import { getDictionary } from "@/lib/i18n";
import { PatientProfileForm } from "@/components/forms/PatientProfileForm";

export default function ProfilePage() {
  const dict = getDictionary();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-primary-900">{dict.profile.title}</h1>
      <PatientProfileForm />
    </main>
  );
}
