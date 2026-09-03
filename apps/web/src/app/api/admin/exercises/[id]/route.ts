import { NextResponse } from "next/server";
import { exerciseUpsertSchema, exerciseStatusSchema, canTransitionValidationStatus, buildAuditDiff, type MedicalValidationStatus } from "@apa/domain";
import { requireAdmin } from "@/lib/adminAuth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/serviceRole";
import { recordAuditLog } from "@/lib/auditLog";
import { linkExerciseRelations } from "@/lib/adminExerciseRelations";

/**
 * §25-27, §42, §57, §59 : édition du contenu ET/OU transition de statut de
 * validation médicale d'un exercice, selon ce que le corps de la requête
 * contient. Les deux sont journalisées (§45) ; seule la transition de
 * statut est contrainte par `canTransitionValidationStatus` — modifier le
 * contenu d'un exercice DÉJÀ validé reste possible (ex. corriger une faute
 * de frappe) mais n'est pas empêché ici : un futur renforcement pourrait
 * exiger un repassage en `pending_validation` après toute modification de
 * contenu d'un exercice validé, non implémenté pour l'instant (à discuter
 * avec le concepteur médical).
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
    .from("exercise_library")
    .select("*")
    .eq("exercise_id", params.id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ message: fetchError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ message: "Exercice introuvable." }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  let relationsInput: { pathologies: string[]; objectives: string[]; scientificReferenceIds: string[] } | null = null;

  if ("medicalValidationStatus" in body) {
    const parsed = exerciseStatusSchema.safeParse(body);
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
    const parsed = exerciseUpsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Champs invalides.", issues: parsed.error.issues }, { status: 422 });
    }
    const input = parsed.data;
    updates.name = input.name;
    updates.short_description = input.shortDescription;
    updates.detailed_description = input.detailedDescription || null;
    updates.category = input.category;
    updates.phase = input.phase || null;
    updates.difficulty = input.difficulty || null;
    updates.starting_position = input.startingPosition || null;
    updates.execution_steps = input.executionSteps || null;
    updates.breathing_instruction = input.breathingInstruction || null;
    updates.duration_seconds = input.durationSeconds ?? null;
    updates.repetitions = input.repetitions ?? null;
    updates.sets = input.sets ?? null;
    updates.rest_time_seconds = input.restTimeSeconds ?? null;
    updates.frequency = input.frequency || null;
    updates.intensity = input.intensity || null;
    updates.progression = input.progression || null;
    updates.regression = input.regression || null;
    updates.contraindications = input.contraindications || null;
    updates.precautions = input.precautions || null;
    updates.stop_criteria = input.stopCriteria || null;
    updates.target_muscles = input.targetMuscles || null;
    updates.equipment_required = input.equipmentRequired;
    updates.video_url = input.videoUrl || null;
    updates.audio_url = input.audioUrl || null;
    updates.thumbnail_url = input.thumbnailUrl || null;
    updates.last_reviewed = new Date().toISOString().slice(0, 10);
    relationsInput = { pathologies: input.pathologies, objectives: input.objectives, scientificReferenceIds: input.scientificReferenceIds };
  }

  updates.updated_at = new Date().toISOString();

  const { error: updateError } = await supabase.from("exercise_library").update(updates).eq("exercise_id", params.id);
  if (updateError) {
    return NextResponse.json({ message: updateError.message }, { status: 500 });
  }

  if (relationsInput) {
    await linkExerciseRelations(supabase, params.id, relationsInput);
  }

  const diff = buildAuditDiff(existing, { ...existing, ...updates });
  await recordAuditLog(supabase, {
    actorUserId: admin.adminUserId,
    action: "medicalValidationStatus" in body ? "admin_update_exercise_status" : "admin_update_exercise_content",
    entityType: "exercise_library",
    entityId: params.id,
    metadata: { diff },
  });

  return NextResponse.json({ ok: true });
}
