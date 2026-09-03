import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Programmes (§67-68) — Sprint 6.
 *
 * Retourne, pour chaque pathologie où l'utilisateur a une évaluation, la
 * DERNIÈRE tentative d'attribution de programme (`user_program_assignments`,
 * historique immuable — §65). Si un `program_id` est présent, le détail du
 * programme n'est renvoyé QUE s'il est `medical_validation_status =
 * 'validated'` : la policy RLS `programs_read_validated_only` (migration
 * 0006) l'empêche déjà, mais la route ne suppose jamais le contraire
 * (défense en profondeur, §57, §59).
 */
export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  const { data: assignments, error } = await supabase
    .from("user_program_assignments")
    .select("id, pathology, program_id, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const latestByPathology = new Map<string, (typeof assignments)[number]>();
  for (const row of assignments ?? []) {
    if (!latestByPathology.has(row.pathology)) {
      latestByPathology.set(row.pathology, row);
    }
  }

  const results = await Promise.all(
    Array.from(latestByPathology.values()).map(async (row) => {
      if (!row.program_id) {
        return { pathology: row.pathology, status: "pending_validation" as const, program: null };
      }

      // Ne renvoyer le détail que si le programme est bien validé (RLS +
      // vérification explicite ici, en défense en profondeur).
      const { data: program } = await supabase
        .from("programs")
        .select("program_id, program_code, profile_level, objective, duration_weeks, frequency_per_week")
        .eq("program_id", row.program_id)
        .eq("medical_validation_status", "validated")
        .maybeSingle();

      return {
        pathology: row.pathology,
        status: program ? ("assigned" as const) : ("pending_validation" as const),
        program,
      };
    })
  );

  return NextResponse.json({ programs: results });
}
