import { NextResponse } from "next/server";
import { adminUserStatusSchema, adminUserRoleSchema, canAdminSetUserStatus, buildAuditDiff, type UserStatus } from "@apa/domain";
import { requireAdmin } from "@/lib/adminAuth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/serviceRole";
import { recordAuditLog } from "@/lib/auditLog";

/**
 * §42 « gestion utilisateurs », §45 (journalisation), §46 (contrôle des
 * permissions côté serveur). Deux actions distinctes possibles dans le même
 * corps de requête — statut de compte et rôle — chacune validée et
 * journalisée séparément pour que l'audit reste précis sur ce qui a changé.
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: existing, error: fetchError } = await supabase
    .from("users")
    .select("id, role, status")
    .eq("id", params.id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ message: fetchError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ message: "Utilisateur introuvable." }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};

  if ("status" in body) {
    const parsed = adminUserStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Statut invalide.", issues: parsed.error.issues }, { status: 422 });
    }
    if (!canAdminSetUserStatus(existing.status as UserStatus, parsed.data.status)) {
      return NextResponse.json(
        { message: `Transition de statut non autorisée : ${existing.status} -> ${parsed.data.status}.` },
        { status: 422 }
      );
    }
    updates.status = parsed.data.status;
  }

  if ("role" in body) {
    const parsed = adminUserRoleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Rôle invalide.", issues: parsed.error.issues }, { status: 422 });
    }
    // §46 : un administrateur ne peut pas se retirer lui-même son propre
    // rôle admin par erreur depuis cet écran (aucun autre garde-fou
    // n'existe pour ré-accorder ce rôle une fois retiré par soi-même).
    if (params.id === admin.adminUserId && parsed.data.role !== "admin") {
      return NextResponse.json({ message: "Vous ne pouvez pas retirer votre propre rôle administrateur." }, { status: 422 });
    }
    updates.role = parsed.data.role;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: "Aucune modification à appliquer." }, { status: 400 });
  }

  const { error: updateError } = await supabase.from("users").update(updates).eq("id", params.id);
  if (updateError) {
    return NextResponse.json({ message: updateError.message }, { status: 500 });
  }

  const diff = buildAuditDiff(existing, { ...existing, ...updates });
  await recordAuditLog(supabase, {
    actorUserId: admin.adminUserId,
    action: "admin_update_user",
    entityType: "users",
    entityId: params.id,
    metadata: { diff },
  });

  return NextResponse.json({ ok: true });
}
