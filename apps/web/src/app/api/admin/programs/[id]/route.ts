import { NextResponse } from "next/server";
import { programUpsertSchema, programStatusSchema, canTransitionValidationStatus, buildAuditDiff, type MedicalValidationStatus } from "@apa/domain";
import { requireAdmin } from "@/lib/adminAuth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/serviceRole";
import { recordAuditLog } from "@/lib/auditLog";
import { linkProgramRelations } from "@/lib/adminProgramRelations";

/** Édition de contenu ET/OU transition de statut, même logique que
 * l'exercice équivalent (voir api/admin/exercises/[id]/route.ts). */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: existing, error: fetchError } = await supabase
    .from("programs")
    .select("*")
    .eq("program_id", params.id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ message: fetchError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ message: "Programme introuvable." }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  let relationsInput: { exerciseIds: string[]; scientificReferenceIds: string[] } | null = null;

  if ("medicalValidationStatus" in body) {
    const parsed = programStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Statut invalide.", issues: parsed.error.issues }, { status: 422 });
    }
    if (!canTransitionValidationStatus(existing.medical_validation_status as MedicalValidationStatus, parsed.data.medicalValidationStatus)) {
      return NextResponse.json(
        { message: `Transition non autorisée : ${existing.medical_validation_status} -> ${parsed.data.medicalValidationStatus}.` },
        { status: 422 }
      );
    }
    updates.medical_validation_status = parsed.data.medicalValidationStatus;
  } else {
    const parsed = programUpsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Champs invalides.", issues: parsed.error.issues }, { status: 422 });
    }
    const input = parsed.data;
    updates.program_code = input.programCode;
    updates.pathology = input.pathology;
    updates.profile_level = input.profileLevel;
    updates.objective = input.objective || null;
    updates.duration_weeks = input.durationWeeks ?? null;
    updates.frequency_per_week = input.frequencyPerWeek ?? null;
    updates.intensity = input.intensity || null;
    updates.aerobic_component = input.aerobicComponent || null;
    updates.strength_component = input.strengthComponent || null;
    updates.mobility_component = input.mobilityComponent || null;
    updates.balance_component = input.balanceComponent || null;
    updates.functional_component = input.functionalComponent || null;
    updates.progression_rule = input.progressionRule || null;
    updates.regression_rule = input.regressionRule || null;
    updates.safety_rules = input.safetyRules || null;
    relationsInput = { exerciseIds: input.exerciseIds, scientificReferenceIds: input.scientificReferenceIds };
  }

  updates.updated_at = new Date().toISOString();

  const { error: updateError } = await supabase.from("programs").update(updates).eq("program_id", params.id);
  if (updateError) {
    return NextResponse.json({ message: updateError.message }, { status: 500 });
  }

  if (relationsInput) {
    await linkProgramRelations(supabase, params.id, relationsInput);
  }

  const diff = buildAuditDiff(existing, { ...existing, ...updates });
  await recordAuditLog(supabase, {
    actorUserId: admin.adminUserId,
    action: "medicalValidationStatus" in body ? "admin_update_program_status" : "admin_update_program_content",
    entityType: "programs",
    entityId: params.id,
    metadata: { diff },
  });

  return NextResponse.json({ ok: true });
}
