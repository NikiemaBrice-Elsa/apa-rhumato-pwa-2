import { NextResponse } from "next/server";
import { initialAssessmentSchema, classifyInitialProfileLevel } from "@apa/domain";
import {
  evaluateSafetyScreeningFromRules,
  evaluateProgramAssignment,
  SAFETY_SCREENING_ENGINE_VERSION,
  PROGRAM_SELECTION_ENGINE_VERSION,
  MEDICAL_PARAMETER_REQUIRED,
} from "@apa/rules-engine";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadActiveClinicalRules } from "@/lib/clinicalRules";

/**
 * Évaluation initiale + dépistage de sécurité (§14, §15). Le statut
 * vert/orange/rouge/pending_validation est calculé exclusivement par le
 * moteur déterministe @apa/rules-engine à partir des règles stockées dans
 * `clinical_rules` (§30, §31, §43) — jamais côté client, jamais par une IA
 * générative, jamais par une règle codée en dur (§46, §57).
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
  if (!body) {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  const parsed = initialAssessmentSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? "form")] = issue.message;
    }
    return NextResponse.json({ message: "Certains champs sont invalides.", fieldErrors }, { status: 422 });
  }

  const { pathology, responses } = parsed.data;

  const { rules, error: rulesError } = await loadActiveClinicalRules(supabase, pathology);
  if (rulesError) {
    return NextResponse.json({ message: rulesError }, { status: 500 });
  }

  const result = evaluateSafetyScreeningFromRules(pathology, responses, rules);

  const { data, error } = await supabase
    .from("clinical_assessments")
    .insert({
      user_id: user.id,
      pathology,
      assessment_type: "initial",
      responses,
      safety_status: result.status,
      triggered_flags: result.triggeredFlags,
      message: result.message,
      engine_version: SAFETY_SCREENING_ENGINE_VERSION,
    })
    .select("id, safety_status, message, triggered_flags, created_at")
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  // Sprint 6 (§30 exemple 1, §67-68) : tentative de sélection de programme,
  // dans la foulée du dépistage. `safety_status` rejoint les faits sous la
  // clé conventionnelle `screening`, pour qu'une règle `allow_program`
  // puisse exprimer "ET screening = vert" comme dans l'exemple du cahier des
  // charges. Depuis le Sprint 17 (suite 2, 23/08/2026, réponses de
  // Dr Nikiema à QUESTIONS_ALLOW_PROGRAM_20260823.docx), le fait `niveau`
  // est calculé ici via `classifyInitialProfileLevel` (§58) à partir du
  // niveau d'activité physique déclaré à l'inscription et du statut de
  // dépistage — jamais deviné : `null` (donc absent des faits transmis)
  // dès que la classification ne peut pas être établie sans invention,
  // ce qui fait naturellement échouer toute règle `allow_program` et
  // retomber sur `MEDICAL_PARAMETER_REQUIRED` (comportement par défaut
  // sûr, inchangé pour rouge/pending_validation).
  const { data: profile } = await supabase
    .from("patient_profiles")
    .select("physical_activity_level")
    .eq("user_id", user.id)
    .maybeSingle();

  const niveau = classifyInitialProfileLevel(profile?.physical_activity_level ?? null, result.status);

  const { rules: programRules, error: programRulesError } = await loadActiveClinicalRules(supabase, pathology);
  const programResult = programRulesError
    ? { status: MEDICAL_PARAMETER_REQUIRED }
    : evaluateProgramAssignment(
        pathology,
        { ...responses, screening: result.status, ...(niveau ? { niveau } : {}) },
        programRules
      );

  const { error: assignmentError } = await supabase.from("user_program_assignments").insert({
    user_id: user.id,
    assessment_id: data.id,
    pathology,
    program_id: programResult.status === "assigned" ? programResult.programId : null,
    status: programResult.status === "assigned" ? "assigned" : "pending_validation",
    matched_rule_id: programResult.status === "assigned" ? programResult.matchedRuleId ?? null : null,
    engine_version: PROGRAM_SELECTION_ENGINE_VERSION,
  });
  // Une erreur d'écriture de l'historique d'attribution ne doit pas faire
  // échouer l'évaluation de sécurité elle-même (déjà enregistrée ci-dessus) ;
  // elle est simplement reflétée dans la réponse pour rester transparent
  // (§79 : ne jamais cacher une erreur).

  return NextResponse.json(
    {
      assessmentId: data.id,
      status: data.safety_status,
      message: data.message,
      triggeredFlags: data.triggered_flags,
      ruleImplemented: result.ruleImplemented,
      programAssignment: {
        status: programResult.status === "assigned" ? "assigned" : "pending_validation",
        programId: programResult.status === "assigned" ? programResult.programId : null,
        historySaved: !assignmentError,
      },
    },
    { status: 201 }
  );
}

export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("clinical_assessments")
    .select("id, pathology, safety_status, message, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ assessments: data });
}
