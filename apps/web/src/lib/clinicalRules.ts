import type { ClinicalRule } from "@apa/domain";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

/** Ligne brute de la table `clinical_rules` (snake_case, tel que retourné par Supabase). */
interface ClinicalRuleRow {
  rule_id: string;
  pathology: string;
  condition: unknown;
  severity: string;
  action: string;
  message: string;
  reference_id: string | null;
  program_id: string | null;
  progression_decision: string | null;
  active: boolean;
  version: string;
  validated_by: string | null;
  validated_date: string | null;
}

function mapRow(row: ClinicalRuleRow): ClinicalRule {
  return {
    ruleId: row.rule_id,
    pathology: row.pathology as ClinicalRule["pathology"],
    condition: row.condition as ClinicalRule["condition"],
    severity: row.severity as ClinicalRule["severity"],
    action: row.action as ClinicalRule["action"],
    message: row.message,
    referenceId: row.reference_id,
    programId: row.program_id,
    progressionDecision: row.progression_decision as ClinicalRule["progressionDecision"],
    active: row.active,
    version: row.version,
    validatedBy: row.validated_by,
    validatedDate: row.validated_date,
  };
}

/** Charge les règles actives pour une pathologie depuis `clinical_rules`
 * (§31). Aucune règle n'est codée en dur côté application (§30, §43). */
export async function loadActiveClinicalRules(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  pathology: string
): Promise<{ rules: ClinicalRule[]; error?: string }> {
  const { data, error } = await supabase
    .from("clinical_rules")
    .select("*")
    .eq("pathology", pathology)
    .eq("active", true);

  if (error) {
    return { rules: [], error: error.message };
  }

  return { rules: (data ?? []).map(mapRow) };
}
