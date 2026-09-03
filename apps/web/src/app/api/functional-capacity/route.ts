import { NextResponse } from "next/server";
import { functionalCapacityAssessmentSchema } from "@apa/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Capacité fonctionnelle (§33, réf. B10, 20/08/2026) — Sprint 18.
 *
 * PSFS (`instrument: "psfs"`) est une saisie patient complète : l'assessment
 * et ses 3-5 activités sont insérés en deux temps, comme
 * `apps/web/src/app/api/sessions/route.ts` insère `session_exercises` après
 * `sessions` — une erreur sur les activités ne doit pas faire perdre
 * l'assessment déjà créé (§79 : transparence plutôt qu'échec silencieux).
 *
 * PROMIS (`instrument: "promis_pf_cat"`) n'accepte que l'enregistrement d'un
 * score déjà obtenu ailleurs — voir le commentaire de tête de
 * `packages/domain/src/functionalCapacity.ts` pour la raison (§57, §59).
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

  const parsed = functionalCapacityAssessmentSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? "form")] = issue.message;
    }
    return NextResponse.json({ message: "Certains champs sont invalides.", fieldErrors }, { status: 422 });
  }

  const input = parsed.data;

  const { data: assessment, error } = await supabase
    .from("functional_capacity_assessments")
    .insert({
      user_id: user.id,
      instrument: input.instrument,
      promis_t_score: input.instrument === "promis_pf_cat" ? input.promisTScore : null,
      promis_standard_error: input.instrument === "promis_pf_cat" ? input.promisStandardError ?? null : null,
      assessed_at: input.assessedAt ?? new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  let activities: unknown[] = [];
  if (input.instrument === "psfs") {
    const { data: inserted, error: activitiesError } = await supabase
      .from("psfs_activities")
      .insert(
        input.activities.map((activity, index) => ({
          assessment_id: assessment.id,
          activity_label: activity.activityLabel,
          difficulty_score: activity.difficultyScore,
          order_index: index,
        }))
      )
      .select("*");
    if (!activitiesError) {
      activities = inserted ?? [];
    }
  }

  return NextResponse.json({ assessment, activities }, { status: 201 });
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
    .from("functional_capacity_assessments")
    .select("*, psfs_activities(*)")
    .eq("user_id", user.id)
    .order("assessed_at", { ascending: true })
    .limit(100);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ assessments: data ?? [] });
}
