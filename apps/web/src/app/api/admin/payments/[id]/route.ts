import { NextResponse } from "next/server";
import { adminPaymentStatusSchema, computeSubscriptionExpiry, buildAuditDiff, type BillingPeriod } from "@apa/domain";
import { requireAdmin } from "@/lib/adminAuth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/serviceRole";
import { recordAuditLog } from "@/lib/auditLog";

/**
 * §47 : confirmation/rejet d'un paiement déclaré par un patient — l'étape
 * humaine qui remplace l'intégration de passerelle non réalisée (§47 : « ne
 * pas coder un système de paiement fictif »). Confirmer un paiement active
 * AUSSI la souscription liée en un seul geste administrateur (au lieu de
 * deux actions séparées), mais seulement après que l'administrateur a
 * réellement vérifié le transfert Mobile Money — rien n'est automatique
 * avant ce clic humain.
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null);
  const parsed = adminPaymentStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Statut invalide.", issues: parsed.error.issues }, { status: 422 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: existing, error: fetchError } = await supabase.from("payments").select("*").eq("id", params.id).maybeSingle();

  if (fetchError) return NextResponse.json({ message: fetchError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ message: "Paiement introuvable." }, { status: 404 });

  const updates = {
    status: parsed.data.status,
    notes: parsed.data.notes ?? existing.notes,
    recorded_by: admin.adminUserId,
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase.from("payments").update(updates).eq("id", params.id);
  if (updateError) return NextResponse.json({ message: updateError.message }, { status: 500 });

  let subscriptionActivated = false;
  if (parsed.data.status === "confirmed" && existing.subscription_id) {
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("id, plan_code, status")
      .eq("id", existing.subscription_id)
      .maybeSingle();

    if (subscription && subscription.status === "pending") {
      const { data: plan } = await supabase
        .from("subscription_plans")
        .select("billing_period")
        .eq("plan_code", subscription.plan_code)
        .maybeSingle();

      const now = new Date();
      const subscriptionUpdates: Record<string, unknown> = {
        status: "active",
        started_at: now.toISOString(),
        updated_at: now.toISOString(),
      };
      if (plan?.billing_period) {
        subscriptionUpdates.expires_at = computeSubscriptionExpiry(now, plan.billing_period as BillingPeriod).toISOString();
      }

      await supabase.from("subscriptions").update(subscriptionUpdates).eq("id", existing.subscription_id);
      subscriptionActivated = true;

      await recordAuditLog(supabase, {
        actorUserId: admin.adminUserId,
        action: "admin_activate_subscription_via_payment",
        entityType: "subscriptions",
        entityId: existing.subscription_id,
        metadata: { paymentId: params.id },
      });
    }
  }

  const diff = buildAuditDiff(existing, { ...existing, ...updates });
  await recordAuditLog(supabase, {
    actorUserId: admin.adminUserId,
    action: "admin_update_payment_status",
    entityType: "payments",
    entityId: params.id,
    metadata: { diff },
  });

  return NextResponse.json({ ok: true, subscriptionActivated });
}
