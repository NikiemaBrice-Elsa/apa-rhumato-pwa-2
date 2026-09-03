import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/serviceRole";

/**
 * §42 « gestion utilisateurs ». Liste nominative (contrairement au tableau
 * de bord, §64, qui reste agrégé/anonymisé) — nécessaire à l'administration
 * de compte elle-même. Aucune donnée de santé (mesures, séances, réponses
 * d'évaluation) n'est renvoyée par cette route : seulement l'identité et le
 * statut de compte (§45 : principe du moindre privilège).
 */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createSupabaseServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const limit = Math.min(Number(searchParams.get("limit") ?? 100) || 100, 200);

  let query = supabase
    .from("users")
    .select("id, first_name, last_name, email, phone, role, status, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (q) {
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: data ?? [] });
}
