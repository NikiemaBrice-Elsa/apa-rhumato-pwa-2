import { NextResponse } from "next/server";
import { z } from "zod";
import { PATHOLOGY_CODES } from "@apa/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { computePathologyProgressionResult, PROGRESSION_ENGINE_VERSION } from "@/lib/progression";

const progressRequestSchema = z.object({ pathology: z.enum(PATHOLOGY_CODES) });

/**
 * §29, §58, §70 — réponse Q4 de `QUESTIONS_PROGRESSION_REGRESSION_
 * 20260823.docx` : « ne modifie jamais automatiquement le programme du
 * patient » — toute bascule de niveau reste une action VOLONTAIRE du
 * patient, déclenchée depuis l'écran « Mes statistiques » (bouton visible
 * uniquement quand `GET /api/statistics/progression` a renvoyé
 * `decision: "progress"`).
 *
 * §46 : ne jamais faire confiance à une décision envoyée par le client —
 * cette route recalcule intégralement la décision côté serveur
 * (`computePathologyProgressionResult`, identique à la route de lecture)
 * avant d'agir. `user_program_assignments` est une table IMMUABLE (§65,
 * migration 0006, aucune policy update/delete) : une bascule de niveau
 * INSÈRE une nouvelle ligne, ne modifie jamais la précédente.
 */
export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = progressRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Pathologie invalide." }, { status: 422 });
  }

  const { pathology } = parsed.data;

  const result = await computePathologyProgressionResult(supabase, user.id, pathology);

  if (!result) {
    return NextResponse.json(
      { message: "Aucun programme validé n'est actuellement assigné pour cette pathologie." },
      { status: 409 }
    );
  }

  if (result.decision !== "progress" || !result.canProgressToLevel) {
    return NextResponse.json(
      {
        message:
          result.decision === "progress"
            ? "Vous êtes déjà au niveau le plus avancé pour cette pathologie."
            : "La progression n'est pas recommandée pour le moment au vu de vos dernières séances.",
        decision: result.decision,
      },
      { status: 409 }
    );
  }

  const { data: nextProgram, error: nextProgramError } = await supabase
    .from("programs")
    .select("program_id, program_code")
    .eq("pathology", pathology)
    .eq("profile_level", result.canProgressToLevel)
    .eq("medical_validation_status", "validated")
    .maybeSingle();

  if (nextProgramError) {
    return NextResponse.json({ message: nextProgramError.message }, { status: 500 });
  }

  if (!nextProgram) {
    // Aucun programme validé pour le niveau supérieur : ne rien inventer,
    // ne rien insérer (§57, §59).
    return NextResponse.json(
      { message: "MEDICAL_PARAMETER_REQUIRED : aucun programme validé n'existe pour le niveau supérieur." },
      { status: 409 }
    );
  }

  const { data: newAssignment, error: insertError } = await supabase
    .from("user_program_assignments")
    .insert({
      user_id: user.id,
      pathology,
      program_id: nextProgram.program_id,
      status: "assigned",
      matched_rule_id: result.matchedRuleId ?? null,
      engine_version: PROGRESSION_ENGINE_VERSION,
    })
    .select("id, pathology, program_id, status, created_at")
    .single();

  if (insertError) {
    return NextResponse.json({ message: insertError.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      assignment: newAssignment,
      newProfileLevel: result.canProgressToLevel,
      programCode: nextProgram.program_code,
    },
    { status: 201 }
  );
}
