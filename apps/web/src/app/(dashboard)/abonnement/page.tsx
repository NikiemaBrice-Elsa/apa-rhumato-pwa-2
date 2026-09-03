import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SubscriptionFlow } from "@/components/forms/SubscriptionFlow";

/** §47, §48 : écran « Mon abonnement ». */
export default async function AbonnementPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-primary-900">Mon abonnement</h1>
      <SubscriptionFlow />
    </main>
  );
}
