import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/serviceRole";

/**
 * §42 « gestion abonnements », §48 : les 3 plans (free/premium_monthly/
 * premium_yearly) sont un ensemble FERMÉ (contrainte CHECK, migration
 * 0011) — comme les 6 pathologies (§7), on ne "crée" pas de plan ici, on
 * ajuste le tarif/les instructions/l'activation d'un plan existant (voir
 * PATCH /api/admin/subscription-plans/[planCode]).
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.from("subscription_plans").select("*").order("plan_code");

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ plans: data ?? [] });
}
