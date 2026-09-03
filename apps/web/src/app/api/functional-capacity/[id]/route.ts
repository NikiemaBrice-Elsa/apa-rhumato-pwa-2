import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Suppression d'une évaluation de capacité fonctionnelle (§33, Sprint 18) —
 * correction d'une saisie erronée par l'utilisateur, même principe que
 * `apps/web/src/app/api/measurements/[id]/route.ts` : une auto-évaluation
 * n'a pas de valeur de traçabilité clinique immuable, son propriétaire peut
 * la corriger (policy RLS `functional_capacity_delete_own`, migration 0015 —
 * la suppression en cascade retire aussi ses `psfs_activities`).
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
    .from("functional_capacity_assessments")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ message: "Évaluation introuvable." }, { status: 404 });
  }

  const { error } = await supabase.from("functional_capacity_assessments").delete().eq("id", params.id).eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
