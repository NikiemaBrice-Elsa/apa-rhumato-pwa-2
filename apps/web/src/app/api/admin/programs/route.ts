import { NextResponse } from "next/server";
import { programUpsertSchema } from "@apa/domain";
import { requireAdmin } from "@/lib/adminAuth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/serviceRole";
import { recordAuditLog } from "@/lib/auditLog";
import { linkProgramRelations } from "@/lib/adminProgramRelations";

/** §29-30, §67-68, §42 « gestion programmes » — même logique que les
 * exercices (Sprint 5) : tous les statuts sont visibles ici, la publication
 * (`validated`) est une action séparée (§57, §59). */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("programs")
    .select("*, program_exercises(exercise_id, order_index), program_references(reference_id)")
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ programs: data ?? [] });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null);
  const parsed = programUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Champs invalides.", issues: parsed.error.issues }, { status: 422 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const input = parsed.data;

  const { data, error } = await supabase
    .from("programs")
    .insert({
      program_code: input.programCode,
      pathology: input.pathology,
      profile_level: input.profileLevel,
      objective: input.objective || null,
      duration_weeks: input.durationWeeks ?? null,
      frequency_per_week: input.frequencyPerWeek ?? null,
      intensity: input.intensity || null,
      aerobic_component: input.aerobicComponent || null,
      strength_component: input.strengthComponent || null,
      mobility_component: input.mobilityComponent || null,
      balance_component: input.balanceComponent || null,
      functional_component: input.functionalComponent || null,
      progression_rule: input.progressionRule || null,
      regression_rule: input.regressionRule || null,
      safety_rules: input.safetyRules || null,
      version: "V1.0",
      medical_validation_status: "draft",
    })
    .select("program_id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ message: "Ce code de programme existe déjà." }, { status: 409 });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  await linkProgramRelations(supabase, data.program_id, input);

  await recordAuditLog(supabase, {
    actorUserId: admin.adminUserId,
    action: "admin_create_program",
    entityType: "programs",
    entityId: data.program_id,
    metadata: { input },
  });

  return NextResponse.json({ ok: true, programId: data.program_id }, { status: 201 });
}
