import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/serviceRole";

/**
 * §42 « gestion abonnements » — devient réel au Sprint 14 (cette route
 * remplace l'écran d'attente posé au Sprint 13, voir docs/DECISIONS.md).
 * Liste nominative des souscriptions (nécessaire à la réconciliation
 * manuelle des paiements), jointe au nom de l'utilisateur pour rester
 * exploitable sans aller-retour supplémentaire.
 */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createSupabaseServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let query = supabase
    .from("subscriptions")
    .select("*, users(first_name, last_name, email)")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ subscriptions: data ?? [] });
}
