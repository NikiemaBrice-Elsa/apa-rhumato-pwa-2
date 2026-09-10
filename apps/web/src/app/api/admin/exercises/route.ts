import { NextResponse } from "next/server";
import { exerciseUpsertSchema } from "@apa/domain";
import { requireAdmin } from "@/lib/adminAuth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/serviceRole";
import { recordAuditLog } from "@/lib/auditLog";
import { linkExerciseRelations } from "@/lib/adminExerciseRelations";

/**
 * §25-27, §42 « gestion exercices ». Contrairement à GET /api/exercises
 * (côté patient, réservé aux exercices `validated`, Sprint 5), cette route
 * renvoie TOUS les statuts — c'est précisément l'écran qui permet de faire
 * progresser un exercice de `draft` à `validated` (§57, §59).
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("exercise_library")
    .select("*, exercise_pathologies(pathology_code), exercise_objectives(objective_code), exercise_references(reference_id)")
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ exercises: data ?? [] });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null);
  const parsed = exerciseUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Champs invalides.", issues: parsed.error.issues }, { status: 422 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const input = parsed.data;

  // §57/§59 : un exercice nouvellement créé démarre TOUJOURS en `draft`,
  // jamais directement visible des patients — la publication est une
  // action séparée et délibérée (PATCH .../status, voir [id]/route.ts).
  const { data, error } = await supabase
    .from("exercise_library")
    .insert({
      name: input.name,
      short_description: input.shortDescription,
      detailed_description: input.detailedDescription || null,
      category: input.category,
      phase: input.phase || null,
      difficulty: input.difficulty || null,
      starting_position: input.startingPosition || null,
      execution_steps: input.executionSteps || null,
      breathing_instruction: input.breathingInstruction || null,
      duration_seconds: input.durationSeconds ?? null,
      repetitions: input.repetitions ?? null,
      sets: input.sets ?? null,
      rest_time_seconds: input.restTimeSeconds ?? null,
      frequency: input.frequency || null,
      intensity: input.intensity || null,
      progression: input.progression || null,
      regression: input.regression || null,
      contraindications: input.contraindications || null,
      precautions: input.precautions || null,
      stop_criteria: input.stopCriteria || null,
      target_muscles: input.targetMuscles || null,
      equipment_required: input.equipmentRequired,
      video_url: input.videoUrl || null,
      audio_preparation_url: input.audioPreparationUrl || null,
      audio_exercise_url: input.audioExerciseUrl || null,
      thumbnail_url: input.thumbnailUrl || null,
      medical_validation_status: "draft",
    })
    .select("exercise_id")
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  await linkExerciseRelations(supabase, data.exercise_id, input);

  await recordAuditLog(supabase, {
    actorUserId: admin.adminUserId,
    action: "admin_create_exercise",
    entityType: "exercise_library",
    entityId: data.exercise_id,
    metadata: { input },
  });

  return NextResponse.json({ ok: true, exerciseId: data.exercise_id }, { status: 201 });
}
