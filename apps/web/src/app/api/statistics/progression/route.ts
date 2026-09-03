import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { computePathologyProgressionResult, PROGRESSION_ENGINE_VERSION } from "@/lib/progression";

/**
 * §29, §58, §70 : recommandation de progression/régression, par pathologie
 * — Sprint 18 (31/08/2026), câblage de `evaluateProgressionDecision` suite
 * aux réponses de Dr Nikiema à `QUESTIONS_PROGRESSION_REGRESSION_
 * 20260823.docx`.
 *
 * AFFICHAGE INFORMATIF UNIQUEMENT (réponse Q4 : « ne modifie jamais
 * automatiquement le programme du patient »). Cette route ne modifie rien ;
 * une bascule de niveau reste une action volontaire du patient, effectuée
 * via `POST /api/programs/progress`, qui recalcule cette même décision
 * côté serveur avant d'agir (jamais de confiance dans une valeur envoyée
 * par le client, §46) — logique commune factorisée dans
 * `@/lib/progression`.
 *
 * Ne renvoie une entrée que pour les pathologies où l'utilisateur a un
 * programme VALIDÉ actuellement assigné (`user_program_assignments`,
 * dernière ligne, `status = 'assigned'`) — sans programme assigné, aucune
 * notion de « niveau actuel » n'existe, donc aucune décision de
 * progression ne peut être évaluée.
 */
export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  const { data: assignments, error: assignmentsError } = await supabase
    .from("user_program_assignments")
    .select("pathology, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (assignmentsError) {
    return NextResponse.json({ message: assignmentsError.message }, { status: 500 });
  }

  const pathologies = Array.from(new Set((assignments ?? []).map((row) => row.pathology)));

  const results = await Promise.all(
    pathologies.map((pathology) => computePathologyProgressionResult(supabase, user.id, pathology))
  );

  return NextResponse.json({
    progression: results.filter((r): r is NonNullable<typeof r> => r !== null),
    engineVersion: PROGRESSION_ENGINE_VERSION,
  });
}
