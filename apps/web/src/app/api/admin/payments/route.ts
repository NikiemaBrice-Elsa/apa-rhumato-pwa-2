import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/serviceRole";

/** §42, §47 : file de paiements à réconcilier manuellement (voir PATCH
 * .../[id] pour la confirmation, qui active la souscription liée). */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createSupabaseServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  // Astuce d'embed explicite `users!payments_user_id_fkey(...)` indispensable
  // ici : `payments` porte DEUX clés étrangères vers `users` (`user_id` et
  // `recorded_by`, migration 0011), ce qui rend l'embed automatique
  // `users(...)` ambigu pour PostgREST (erreur « more than one relationship
  // was found »). Cette route échouait donc silencieusement en production
  // (§erreur découverte le 09/09/2026 : les paiements en attente
  // n'apparaissaient jamais dans « Paiements à vérifier », alors que les
  // lignes existaient bien dans `payments` — seule la requête d'affichage
  // était cassée). `subscriptions` n'a qu'une seule FK vers `users`, donc sa
  // route admin équivalente n'a jamais eu ce problème.
  let query = supabase
    .from("payments")
    .select("*, users!payments_user_id_fkey(first_name, last_name, email)")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ payments: data ?? [] });
}
