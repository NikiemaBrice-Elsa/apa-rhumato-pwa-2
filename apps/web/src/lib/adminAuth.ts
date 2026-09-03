import { NextResponse } from "next/server";
import { isAdminRole } from "@apa/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Contrôle d'accès de l'espace administrateur (§42, §46 — Sprint 13).
 *
 * §46 : « ne jamais faire confiance uniquement aux contrôles frontend » —
 * TOUTE route `/api/admin/*` doit appeler cette fonction en tout premier,
 * avant la moindre lecture/écriture via le client service_role. Le rôle est
 * lu via le client Supabase normal (clé anon + session utilisateur), qui ne
 * peut lire QUE la propre ligne `users` de l'appelant (RLS
 * `users_select_own`, migration 0002) : impossible d'usurper le rôle d'un
 * tiers par ce chemin, même en cas de bug ailleurs dans cette fonction.
 */
export type RequireAdminResult =
  | { ok: true; adminUserId: string }
  | { ok: false; response: NextResponse };

export async function requireAdmin(): Promise<RequireAdminResult> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, response: NextResponse.json({ message: "Non authentifié." }, { status: 401 }) };
  }

  const { data: profile, error } = await supabase
    .from("users")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return { ok: false, response: NextResponse.json({ message: error.message }, { status: 500 }) };
  }

  if (!profile || !isAdminRole(profile.role) || profile.status !== "active") {
    // Message volontairement générique (§45 : pas d'information exploitable
    // pour un attaquant sur l'existence ou le rôle exact du compte).
    return { ok: false, response: NextResponse.json({ message: "Accès refusé." }, { status: 403 }) };
  }

  return { ok: true, adminUserId: user.id };
}
