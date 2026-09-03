import { NextResponse } from "next/server";
import { clinicalRuleUpsertSchema, clinicalRuleActiveSchema, isValidRuleCondition, bumpMinorVersion, buildAuditDiff } from "@apa/domain";
import { requireAdmin } from "@/lib/adminAuth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/serviceRole";
import { recordAuditLog } from "@/lib/auditLog";

/**
 * §31, §43, §66 : deux natures de modification, jamais confondues dans
 * l'audit :
 * - une simple bascule `active` (on/off) est administrative, ne touche pas
 *   au CONTENU scientifique de la règle, donc ne fait PAS avancer la
 *   version ;
 * - une modification de contenu (condition, message, sévérité, action,
 *   référence…) incrémente TOUJOURS la version mineure (§43 : « lorsqu'une
 *   recommandation scientifique change, il doit être possible de modifier
 *   les règles sans réécrire toute l'application » — et sans jamais perdre
 *   la trace du changement, §66 : « ne jamais modifier silencieusement »).
 * `rule_id` est la clé primaire (texte) : `params.id` la référence
 * directement, contrairement aux autres entités (uuid).
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
    .from("clinical_rules")
    .select("*")
    .eq("rule_id", params.id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ message: fetchError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ message: "Règle introuvable." }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  let action = "admin_update_clinical_rule_content";

  if ("active" in body) {
    const parsed = clinicalRuleActiveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Valeur 'active' invalide.", issues: parsed.error.issues }, { status: 422 });
    }
    updates.active = parsed.data.active;
    action = parsed.data.active ? "admin_activate_clinical_rule" : "admin_deactivate_clinical_rule";
  } else {
    const parsed = clinicalRuleUpsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Champs invalides.", issues: parsed.error.issues }, { status: 422 });
    }
    const input = parsed.data;
    if (!isValidRuleCondition(input.condition)) {
      return NextResponse.json(
        { message: "Condition invalide : vérifiez la structure JSON (field/operator/value ou all/any)." },
        { status: 422 }
      );
    }
    updates.pathology = input.pathology;
    updates.condition = input.condition;
    updates.severity = input.severity;
    updates.action = input.action;
    updates.message = input.message;
    updates.reference_id = input.referenceId || null;
    updates.program_id = input.programId || null;
    updates.progression_decision = input.progressionDecision || null;
    updates.validated_by = input.validatedBy || null;
    updates.validated_date = input.validatedDate || null;
    // §43 : toute modification de contenu incrémente la version mineure.
    try {
      updates.version = bumpMinorVersion(existing.version);
    } catch (versionError) {
      return NextResponse.json({ message: (versionError as Error).message }, { status: 422 });
    }
  }

  updates.updated_at = new Date().toISOString();

  const { error: updateError } = await supabase.from("clinical_rules").update(updates).eq("rule_id", params.id);
  if (updateError) {
    return NextResponse.json({ message: updateError.message }, { status: 500 });
  }

  const diff = buildAuditDiff(existing, { ...existing, ...updates });
  await recordAuditLog(supabase, {
    actorUserId: admin.adminUserId,
    action,
    entityType: "clinical_rules",
    entityId: params.id,
    metadata: { diff },
  });

  return NextResponse.json({ ok: true });
}
