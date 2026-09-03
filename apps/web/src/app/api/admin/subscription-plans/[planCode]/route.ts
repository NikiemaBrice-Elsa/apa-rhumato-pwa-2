import { NextResponse } from "next/server";
import { adminSubscriptionPlanUpsertSchema, isValidPlanPricing, buildAuditDiff } from "@apa/domain";
import { requireAdmin } from "@/lib/adminAuth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/serviceRole";
import { recordAuditLog } from "@/lib/auditLog";

/** §48 : tarif configurable, jamais codé en dur — cette route EST le point
 * d'entrée qui rend §48 réel. `isValidPlanPricing` (packages/domain)
 * empêche d'enregistrer un plan gratuit payant ou un plan premium sans
 * prix/périodicité. */
export async function PATCH(request: Request, { params }: { params: { planCode: string } }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null);
  const parsed = adminSubscriptionPlanUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Champs invalides.", issues: parsed.error.issues }, { status: 422 });
  }

  const input = parsed.data;
  if (input.planCode !== params.planCode) {
    return NextResponse.json({ message: "Le code de plan ne correspond pas à l'URL." }, { status: 422 });
  }
  if (!isValidPlanPricing(input)) {
    return NextResponse.json(
      { message: "Tarification incohérente : le plan gratuit ne doit porter ni prix ni périodicité ; un plan premium doit avoir un prix positif et une périodicité." },
      { status: 422 }
    );
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: existing, error: fetchError } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("plan_code", params.planCode)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ message: fetchError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ message: "Plan introuvable." }, { status: 404 });

  const updates = {
    name_fr: input.nameFr,
    price_amount: input.priceAmount,
    price_currency: input.priceCurrency,
    billing_period: input.billingPeriod,
    payment_instructions_fr: input.paymentInstructionsFr || null,
    active: input.active,
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase.from("subscription_plans").update(updates).eq("plan_code", params.planCode);
  if (updateError) return NextResponse.json({ message: updateError.message }, { status: 500 });

  const diff = buildAuditDiff(existing, { ...existing, ...updates });
  await recordAuditLog(supabase, {
    actorUserId: admin.adminUserId,
    action: "admin_update_subscription_plan",
    entityType: "subscription_plans",
    entityId: params.planCode,
    metadata: { diff },
  });

  return NextResponse.json({ ok: true });
}
