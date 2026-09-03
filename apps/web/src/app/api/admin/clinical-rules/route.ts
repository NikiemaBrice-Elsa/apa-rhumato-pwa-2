import { NextResponse } from "next/server";
import { clinicalRuleUpsertSchema, isValidRuleCondition } from "@apa/domain";
import { requireAdmin } from "@/lib/adminAuth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/serviceRole";
import { recordAuditLog } from "@/lib/auditLog";

/**
 * §30, §31, §42 « gestion règles médicales », §43 « versionning
 * scientifique ». C'est ICI, concrètement, que le concepteur médical (Dr
 * Nikiema) active une règle proposée par le code avec `active=false` (ex.
 * les red flags "suspicion d'arthrite septique" du Sprint 6bis, sourcées
 * mais volontairement désactivées jusqu'à validation, §57/§59) : cette
 * route ne fait qu'appliquer une décision humaine explicite, jamais une
 * activation automatique.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.from("clinical_rules").select("*").order("pathology").order("rule_id");

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ rules: data ?? [] });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null);
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

  const supabase = createSupabaseServiceRoleClient();

  // §57/§59 : toute nouvelle règle démarre INACTIVE, même créée par un
  // administrateur — l'activation est une seconde action délibérée (PATCH
  // .../[id] avec { active: true }), jamais automatique à la création.
  const { error } = await supabase.from("clinical_rules").insert({
    rule_id: input.ruleId,
    pathology: input.pathology,
    condition: input.condition,
    severity: input.severity,
    action: input.action,
    message: input.message,
    reference_id: input.referenceId || null,
    program_id: input.programId || null,
    progression_decision: input.progressionDecision || null,
    active: false,
    version: "V1.0",
    validated_by: input.validatedBy || null,
    validated_date: input.validatedDate || null,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ message: "Cet identifiant de règle existe déjà." }, { status: 409 });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  await recordAuditLog(supabase, {
    actorUserId: admin.adminUserId,
    action: "admin_create_clinical_rule",
    entityType: "clinical_rules",
    entityId: input.ruleId,
    metadata: { input },
  });

  return NextResponse.json({ ok: true, ruleId: input.ruleId }, { status: 201 });
}
