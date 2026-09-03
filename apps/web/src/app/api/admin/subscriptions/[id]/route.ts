import { NextResponse } from "next/server";
import { adminSubscriptionStatusSchema, computeSubscriptionExpiry, buildAuditDiff, type BillingPeriod } from "@apa/domain";
import { requireAdmin } from "@/lib/adminAuth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/serviceRole";
import { recordAuditLog } from "@/lib/auditLog";

/**
 * §47, §48 : seule voie par laquelle une souscription passe de `pending` à
 * `active` (ou à `expired`/`canceled`) — jamais le patient lui-même (aucune
 * policy RLS ne le permettrait de toute façon, migration 0011). Activer une
 * souscription calcule automatiquement `expires_at` à partir de la
 * périodicité du plan (`computeSubscriptionExpiry`, pur et testé) : un
 * administrateur n'a pas à calculer une date à la main.
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null);
  const parsed = adminSubscriptionStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Statut invalide.", issues: parsed.error.issues }, { status: 422 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: existing, error: fetchError } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ message: fetchError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ message: "Souscription introuvable." }, { status: 404 });

  const updates: Record<string, unknown> = { status: parsed.data.status, updated_at: new Date().toISOString() };

  if (parsed.data.status === "active") {
    const { data: plan } = await supabase
      .from("subscription_plans")
      .select("billing_period")
      .eq("plan_code", existing.plan_code)
      .maybeSingle();

    const now = new Date();
    updates.started_at = now.toISOString();
    if (plan?.billing_period) {
      updates.expires_at = computeSubscriptionExpiry(now, plan.billing_period as BillingPeriod).toISOString();
    }
  }

  const { error: updateError } = await supabase.from("subscriptions").update(updates).eq("id", params.id);
  if (updateError) return NextResponse.json({ message: updateError.message }, { status: 500 });

  const diff = buildAuditDiff(existing, { ...existing, ...updates });
  await recordAuditLog(supabase, {
    actorUserId: admin.adminUserId,
    action: "admin_update_subscription_status",
    entityType: "subscriptions",
    entityId: params.id,
    metadata: { diff },
  });

  return NextResponse.json({ ok: true });
}
