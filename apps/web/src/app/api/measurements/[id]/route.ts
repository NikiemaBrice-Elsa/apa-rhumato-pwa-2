import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Suppression d'une mesure (§35-38, Sprint 8) — correction d'une saisie
 * erronée par l'utilisateur (faute de frappe sur son propre poids, par
 * exemple). Contrairement à `clinical_assessments`/`sessions`, une mesure
 * autodéclarée n'a pas de valeur de traçabilité clinique en soi : elle peut
 * être supprimée par son propriétaire (policy RLS `measurements_delete_own`,
 * migration 0008).
 */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  const { data: existing } = await supabase
    .from("measurements")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ message: "Mesure introuvable." }, { status: 404 });
  }

  const { error } = await supabase.from("measurements").delete().eq("id", params.id).eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
