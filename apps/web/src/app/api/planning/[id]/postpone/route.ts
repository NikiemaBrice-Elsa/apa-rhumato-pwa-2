import { NextResponse } from "next/server";
import { postponePlannedSessionSchema } from "@apa/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Réf. B11 (31/08/2026) : « report possible sans pénalisation ». Déplace
 * `planned_for` vers une date strictement future — jamais une nouvelle
 * ligne créée (§65 : traçabilité, `original_planned_for` conserve la toute
 * première date planifiée). Aucune limite numérique de report n'a été
 * chiffrée par Dr Nikiema ; la seule contrainte imposée ici est purement
 * technique (date future, pas de collision avec une autre séance déjà
 * planifiée le même jour pour cette pathologie).
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = postponePlannedSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Date invalide." }, { status: 422 });
  }

  const today = new Date().toISOString().slice(0, 10);
  if (parsed.data.newDate <= today) {
    return NextResponse.json({ message: "La nouvelle date doit être dans le futur." }, { status: 422 });
  }

  const { data: existing, error: fetchError } = await supabase
    .from("planned_sessions")
    .select("id, status, planned_for, original_planned_for")
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
    return NextResponse.json({ message: "Cette séance planifiée ne peut plus être reportée." }, { status: 409 });
  }

  const { data: updated, error } = await supabase
    .from("planned_sessions")
    .update({
      planned_for: parsed.data.newDate,
      original_planned_for: existing.original_planned_for ?? existing.planned_for,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select("id, planned_for, original_planned_for")
    .single();

  if (error) {
    // Contrainte unique (user_id, pathology, planned_for) : une séance est
    // déjà planifiée à cette date pour cette pathologie.
    return NextResponse.json(
      { message: "Une séance est déjà planifiée à cette date pour cette situation de santé." },
      { status: 409 }
    );
  }

  return NextResponse.json({ plannedSessionId: updated.id, plannedFor: updated.planned_for });
}
