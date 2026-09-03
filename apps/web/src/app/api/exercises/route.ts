import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Bibliothèque d'exercices (§25, §26) — lecture seule pour la V1 (l'écriture
 * est réservée à l'espace administrateur, Sprint 13, via service_role).
 *
 * Aucun filtre supplémentaire n'est nécessaire ici pour exclure les
 * exercices non validés : la policy RLS `exercise_library_read_validated_only`
 * (migration 0005) empêche déjà toute lecture d'une ligne dont
 * `medical_validation_status` n'est pas 'validated', quelle que soit la
 * requête envoyée. C'est une défense en profondeur volontaire (§57, §59) :
 * même un bug dans cette route ne peut pas exposer un exercice non validé.
 */
export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const pathology = searchParams.get("pathology");

  let query = supabase
    .from("exercise_library")
    .select(
      "exercise_id, name, short_description, category, difficulty, equipment_required, thumbnail_url, exercise_pathologies(pathology_code)"
    )
    .order("name");

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const exercises = (data ?? []).filter((row) => {
    if (!pathology) return true;
    const pathologies = (row as { exercise_pathologies?: { pathology_code: string }[] }).exercise_pathologies ?? [];
    return pathologies.some((p) => p.pathology_code === pathology);
  });

  return NextResponse.json({ exercises });
}
