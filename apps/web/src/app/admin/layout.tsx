import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin/AdminNav";

/**
 * §42, §46 (Sprint 13) : porte d'entrée serveur de l'espace administrateur.
 * Le middleware (middleware.ts) exige déjà une session pour tout `/admin`,
 * mais ne connaît pas le RÔLE (il tourne en edge runtime, sans accès direct
 * à la table `users`) — cette vérification fine est donc faite ici, à
 * chaque navigation, EN PLUS du contrôle refait sur chaque route API
 * (`requireAdmin`, apps/web/src/lib/adminAuth.ts) : défense en profondeur,
 * même principe que RLS + route API partout ailleurs dans ce projet. Un
 * utilisateur non-admin est redirigé silencieusement (§45 : pas d'indice
 * exploitable sur l'existence d'un espace admin).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion?redirectTo=/admin");
  }

  const { data: profile } = await supabase.from("users").select("role, status").eq("id", user.id).maybeSingle();

  if (!profile || profile.role !== "admin" || profile.status !== "active") {
    redirect("/tableau-de-bord");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-10 lg:flex-row">
      <AdminNav />
      <main className="flex-1">{children}</main>
    </div>
  );
}
