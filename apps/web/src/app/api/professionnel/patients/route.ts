import { NextResponse } from "next/server";
import { requireProfessional } from "@/lib/professionalAuth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * §41, Sprint 23 (13/09/2026) — liste des liens (en attente + autorisés) du
 * professionnel connecté. Client normal : la policy `ppl_select_own`
 * (migration 0021) restreint déjà aux lignes où `professional_id = auth.uid()`,
 * et `users_select_linked_party` permet de lire l'identité du patient lié.
 */
export async function GET() {
  const professional = await requireProfessional();
  if (!professional.ok) return professional.response;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("patient_professional_links")
    .select(
      "id, status, requested_at, decided_at, patient:users!patient_professional_links_patient_id_fkey(id, first_name, last_name, email)"
    )
    .eq("professional_id", professional.professionalUserId)
    .order("requested_at", { ascending: false });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ links: data ?? [] });
}
