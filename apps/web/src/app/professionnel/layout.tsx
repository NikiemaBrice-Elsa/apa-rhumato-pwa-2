import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/auth/LogoutButton";

/**
 * §41, §46, Sprint 23 (13/09/2026) : porte d'entrée serveur de l'espace
 * professionnel de santé. Le middleware exige déjà une session pour tout
 * `/professionnel` mais ne connaît pas le RÔLE (edge runtime, sans accès
 * direct à `users`) — vérifié ici EN PLUS du contrôle refait sur chaque
 * route API (`requireProfessional`) : même défense en profondeur que
 * l'espace admin (apps/web/src/app/admin/layout.tsx).
 */
export default async function ProfessionnelLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion?redirectTo=/professionnel");
  }

  const { data: profile } = await supabase.from("users").select("role, status").eq("id", user.id).maybeSingle();

  if (!profile || profile.role !== "professional" || profile.status !== "active") {
    redirect("/tableau-de-bord");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-10">
      <h1 className="text-xl font-semibold text-primary-900">Espace professionnel de santé</h1>
      <main className="flex-1">{children}</main>
      <p className="text-sm text-primary-500">
        Vous consultez ici uniquement les patients qui vous ont explicitement autorisé (§41). Chaque
        consultation de rapport est journalisée.
      </p>
      <LogoutButton />
    </div>
  );
}
