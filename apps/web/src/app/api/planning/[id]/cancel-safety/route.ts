import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Annulation d'une séance planifiée « pour raison de sécurité » (réf. B13,
 * 31/08/2026 — un des 5 statuts qu'il distingue : commencée / partielle /
 * complète / reportée / annulée-sécurité). Action strictement VOLONTAIRE du
 * patient — aucun déclenchement automatique (même principe que la bascule
 * de niveau de progression, Sprint 18 : §57, §59, §78, ne jamais décider à
 * sa place). Aucun motif structuré n'est demandé ici : Dr Nikiema n'a fourni
 * aucune taxonomie de motifs à ce jour, se contenter du statut lui-même.
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  const { data: existing, error: fetchError } = await supabase
    .from("planned_sessions")
    .select("id, status")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ message: fetchError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ message: "Séance planifiée introuvable." }, { status: 404 });
  }
  if (existing.status !== "due") {
    return NextResponse.json({ message: "Cette séance planifiée ne peut plus être annulée." }, { status: 409 });
  }

  const { error } = await supabase
    .from("planned_sessions")
    .update({ status: "cancelled_safety", updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ plannedSessionId: params.id, status: "cancelled_safety" });
}
