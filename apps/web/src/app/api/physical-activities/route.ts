import { NextResponse } from "next/server";
import { physicalActivitySchema } from "@apa/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Historique des activités physiques (chronomètre + marche/vélo GPS,
 * Sprint 25) — Sprint 26 (21/09/2026), demande de Dr Nikiema.
 *
 * Même structure que `/api/measurements` (Sprint 8) : donnée autodéclarée
 * par le patient, aucune décision clinique n'en dépend (§57, §59). Le
 * client (`ActiviteFlow.tsx`) passe déjà la durée/distance calculées
 * localement (compte à rebours ou suivi GPS) — cette route valide et
 * enregistre tel quel, sans recalcul.
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

  const parsed = physicalActivitySchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? "form")] = issue.message;
    }
    return NextResponse.json({ message: "Certains champs sont invalides.", fieldErrors }, { status: 422 });
  }

  const input = parsed.data;

  const { data, error } = await supabase
    .from("physical_activities")
    .insert({
      user_id: user.id,
      activity_type: input.activityType,
      duration_seconds: input.durationSeconds,
      distance_meters: input.distanceMeters ?? null,
      started_at: input.startedAt,
      completed_at: input.completedAt,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ activity: data }, { status: 201 });
}

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50;

  const { data, error } = await supabase
    .from("physical_activities")
    .select("*")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ activities: data });
}
