import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ReportFlow } from "@/components/forms/ReportFlow";

export default async function RapportPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-12 sm:max-w-lg md:max-w-2xl lg:max-w-3xl xl:max-w-4xl">
      <h1 className="text-2xl font-semibold text-primary-900">Mon rapport</h1>
      <ReportFlow />
    </main>
  );
}
