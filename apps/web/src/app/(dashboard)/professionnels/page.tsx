import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProfessionalLinksFlow } from "@/components/forms/ProfessionalLinksFlow";

export default async function ProfessionnelsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-primary-900">Mes professionnels de santé (§41)</h1>
      <ProfessionalLinksFlow />
    </main>
  );
}
