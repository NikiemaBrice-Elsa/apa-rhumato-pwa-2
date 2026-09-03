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

  let query = supabase
    .from("payments")
    .select("*, users(first_name, last_name, email)")
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
