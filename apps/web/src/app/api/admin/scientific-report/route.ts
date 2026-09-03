import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/serviceRole";

/**
 * §65 « Rapport scientifique interne » : « L'administration doit permettre
 * de connaître : quelle règle médicale a été utilisée, quelle version,
 * quelle référence scientifique, quelle date de validation. » — lecture
 * seule, jointure directe entre `clinical_rules` et `scientific_references`,
 * sans aucun calcul supplémentaire (§57 : ne rien inventer, se contenter de
 * restituer ce qui est réellement enregistré).
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("clinical_rules")
    .select(
      "rule_id, pathology, severity, action, version, active, validated_by, validated_date, created_at, updated_at, scientific_references(id, title, authors, organization, doi, evidence_level, year)"
    )
    .order("pathology")
    .order("rule_id");

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ rules: data ?? [] });
}
