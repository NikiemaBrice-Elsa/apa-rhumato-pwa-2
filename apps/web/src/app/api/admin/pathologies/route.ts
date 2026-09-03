import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/serviceRole";

/**
 * §42 « gestion pathologies ». Lecture seule côté liste : contrairement aux
 * exercices/programmes/règles, les 6 pathologies de la V1 sont un ensemble
 * FERMÉ (§7 : « aucune pathologie supplémentaire ne doit être ajoutée sans
 * validation ») référencé par des enums en dur dans tout le code (profil,
 * évaluation, séances…) — en ajouter une ici sans étendre ces enums
 * casserait l'application. L'admin peut donc modifier le libellé/la
 * description/l'activation d'une pathologie existante (PATCH
 * /api/admin/pathologies/[id]), mais pas en créer une nouvelle depuis cet
 * écran : ce serait un changement de périmètre applicatif, pas une simple
 * donnée de contenu.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.from("pathologies").select("*").order("code");

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ pathologies: data ?? [] });
}
