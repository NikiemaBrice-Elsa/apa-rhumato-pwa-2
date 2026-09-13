import { NextResponse } from "next/server";
import { isProfessionalRole } from "@apa/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Contrôle d'accès de l'espace professionnel de santé (§41, §46) — Sprint 23
 * (13/09/2026). Même discipline exacte que `requireAdmin`
 * (apps/web/src/lib/adminAuth.ts) : TOUTE route `/api/professionnel/*` doit
 * l'appeler en tout premier. Le rôle est lu via le client Supabase normal
 * (clé anon + session), qui ne peut lire QUE la propre ligne `users` de
 * l'appelant (RLS `users_select_own`) — impossible d'usurper le rôle d'un
 * tiers par ce chemin.
 */
export type RequireProfessionalResult =
  | { ok: true; professionalUserId: string }
  | { ok: false; response: NextResponse };

export async function requireProfessional(): Promise<RequireProfessionalResult> {
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

  if (!profile || !isProfessionalRole(profile.role) || profile.status !== "active") {
    // Message volontairement générique (§45), même choix que requireAdmin.
    return { ok: false, response: NextResponse.json({ message: "Accès refusé." }, { status: 403 }) };
  }

  return { ok: true, professionalUserId: user.id };
}
