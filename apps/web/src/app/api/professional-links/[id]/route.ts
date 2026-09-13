import { NextResponse } from "next/server";
import { professionalLinkStatusSchema, canTransitionProfessionalLinkStatus, type ProfessionalLinkStatus } from "@apa/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * §41, Sprint 23 (13/09/2026) — décision sur un lien EXISTANT : le patient
 * annule/révoque/réinvite, le professionnel accepte/décline/se retire.
 * Reste sur le client normal (RLS `ppl_select_own`/`ppl_update_patient`/
 * `ppl_update_professional`, migration 0021) : lire/modifier SON PROPRE
 * lien ne nécessite aucun privilège élevé, contrairement à la création
 * (voir /api/professional-links, POST). La transition est vérifiée ICI
 * (canTransitionProfessionalLinkStatus) ET par la policy RLS — défense en
 * profondeur, même discipline que l'espace admin.
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
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

  const parsed = professionalLinkStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Statut invalide.", issues: parsed.error.issues }, { status: 422 });
  }

  const { data: existing, error: fetchError } = await supabase
    .from("patient_professional_links")
    .select("id, patient_id, professional_id, status")
    .eq("id", params.id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ message: fetchError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ message: "Lien introuvable." }, { status: 404 });
  }

  const actor = existing.patient_id === user.id ? "patient" : existing.professional_id === user.id ? "professional" : null;
  if (!actor) {
    return NextResponse.json({ message: "Accès refusé." }, { status: 403 });
  }

  if (!canTransitionProfessionalLinkStatus(existing.status as ProfessionalLinkStatus, parsed.data.status, actor)) {
    return NextResponse.json(
      { message: `Transition non autorisée : ${existing.status} -> ${parsed.data.status} (en tant que ${actor}).` },
      { status: 422 }
    );
  }

  const { error: updateError } = await supabase
    .from("patient_professional_links")
    .update({ status: parsed.data.status, decided_at: new Date().toISOString() })
    .eq("id", params.id);

  if (updateError) {
    return NextResponse.json({ message: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
