import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/serviceRole";

/**
 * §45 « journalisation des actions sensibles ». Lecture seule, paginée,
 * filtrable par type d'entité — c'est la contrepartie visible de chaque
 * écriture administrative de ce sprint (voir `recordAuditLog`,
 * apps/web/src/lib/auditLog.ts, appelé par toutes les routes ci-dessus).
 * Aucune policy RLS publique n'existe sur `audit_logs` (migration
 * 0001/0002) : seule cette route, protégée par `requireAdmin`, peut y
 * accéder.
 */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createSupabaseServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType");
  const limit = Math.min(Number(searchParams.get("limit") ?? 50) || 50, 200);

  let query = supabase
    .from("audit_logs")
    .select("id, user_id, action, entity_type, entity_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (entityType) {
    query = query.eq("entity_type", entityType);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ logs: data ?? [] });
}
