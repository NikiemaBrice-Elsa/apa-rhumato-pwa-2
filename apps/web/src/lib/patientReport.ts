import type { SupabaseClient } from "@supabase/supabase-js";
import { sessionDurationMinutes, computeAdherencePercent, glycemiaGramsPerLToMmol, PATHOLOGY_LABELS_FR, type PathologyCode } from "@apa/domain";
import type { PatientReportData } from "@apa/pdf-report";

function formatMeasurement(row: {
  measurement_type: string;
  weight_kg: number | null;
  waist_circumference_cm: number | null;
  systolic_mmhg: number | null;
  diastolic_mmhg: number | null;
  heart_rate_bpm: number | null;
  glycemia_value: number | null;
  glycemia_unit: "g_l" | "mmol_l" | null;
}): { label: string; summary: string } | null {
  switch (row.measurement_type) {
    case "poids":
      return row.weight_kg ? { label: "Poids", summary: `${row.weight_kg} kg` } : null;
    case "tour_de_taille":
      return row.waist_circumference_cm
        ? { label: "Tour de taille", summary: `${row.waist_circumference_cm} cm` }
        : null;
    case "tension_arterielle":
      if (row.systolic_mmhg == null || row.diastolic_mmhg == null) return null;
      return {
        label: "Tension artérielle",
        summary: `${row.systolic_mmhg}/${row.diastolic_mmhg} mmHg${
          row.heart_rate_bpm ? ` (FC ${row.heart_rate_bpm} bpm)` : ""
        }`,
      };
    case "glycemie": {
      if (row.glycemia_value == null || !row.glycemia_unit) return null;
      const otherUnit =
        row.glycemia_unit === "g_l"
          ? `${glycemiaGramsPerLToMmol(row.glycemia_value)} mmol/L`
          : `${row.glycemia_value} g/L`;
      const original = row.glycemia_unit === "g_l" ? `${row.glycemia_value} g/L` : `${row.glycemia_value} mmol/L`;
      return { label: "Glycémie", summary: `${original} (≈ ${otherUnit})` };
    }
    default:
      return null;
  }
}

const DEFAULT_PERIOD_DAYS = 30;

/**
 * Rassemble les données d'un rapport patient (§40, §71) — extrait du Sprint
 * 10 (`/api/reports/pdf`) au Sprint 23 (13/09/2026) pour être réutilisé tel
 * quel par l'espace professionnel de santé (§41) : un professionnel
 * autorisé voit EXACTEMENT le même contenu que le patient génère lui-même,
 * jamais une vue différente ou enrichie. Le SEUL changement entre les deux
 * usages est le client Supabase et le `userId` cible passés en paramètre —
 * l'autorisation (patient = soi-même ; professionnel = lien autorisé) est
 * vérifiée par l'appelant, jamais ici (fonction pure de lecture/formatage).
 */
export async function buildPatientReportData(
  supabase: SupabaseClient,
  userId: string,
  pathology: PathologyCode,
  from: Date,
  to: Date,
  userNote?: string | null
): Promise<PatientReportData> {
  const [{ data: appUser }, { data: sessions }, { data: measurements }, { data: assignment }] = await Promise.all([
    supabase.from("users").select("first_name, last_name").eq("id", userId).maybeSingle(),
    supabase
      .from("sessions")
      .select("status, started_at, completed_at, douleur_avant, douleur_apres, ressenti")
      .eq("user_id", userId)
      .eq("pathology", pathology)
      .gte("started_at", from.toISOString())
      .lte("started_at", to.toISOString()),
    supabase
      .from("measurements")
      .select(
        "measurement_type, recorded_at, weight_kg, waist_circumference_cm, systolic_mmhg, diastolic_mmhg, heart_rate_bpm, glycemia_value, glycemia_unit"
      )
      .eq("user_id", userId)
      .gte("recorded_at", from.toISOString())
      .lte("recorded_at", to.toISOString())
      .order("recorded_at", { ascending: true }),
    supabase
      .from("user_program_assignments")
      .select("program_id")
      .eq("user_id", userId)
      .eq("pathology", pathology)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const allSessions = sessions ?? [];
  const completedSessions = allSessions.filter((s) => s.status === "completed");
  const sessionsCompleted = completedSessions.length;
  const totalActiveMinutes = completedSessions.reduce(
    (sum, s) => sum + (sessionDurationMinutes(s.started_at, s.completed_at) ?? 0),
    0
  );

  let targetSessionsForPeriod: number | null = null;
  if (assignment?.program_id) {
    const { data: program } = await supabase
      .from("programs")
      .select("frequency_per_week")
      .eq("program_id", assignment.program_id)
      .eq("medical_validation_status", "validated")
      .maybeSingle();
    if (program?.frequency_per_week) {
      const periodDays = Math.max(1, (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
      targetSessionsForPeriod = program.frequency_per_week * (periodDays / 7);
    }
  }

  return {
    identity: { firstName: appUser?.first_name ?? "", lastName: appUser?.last_name ?? null },
    pathologyLabel: PATHOLOGY_LABELS_FR[pathology],
    period: { from: from.toISOString(), to: to.toISOString() },
    activity: { sessionsPlanned: null, sessionsCompleted, totalActiveMinutes },
    adherence: { percent: computeAdherencePercent(sessionsCompleted, targetSessionsForPeriod) },
    pain: allSessions
      .filter((s) => s.douleur_avant !== null || s.douleur_apres !== null)
      .map((s) => ({ date: s.started_at, before: s.douleur_avant, after: s.douleur_apres })),
    measurements: (measurements ?? [])
      .map((m) => {
        const formatted = formatMeasurement(m);
        return formatted ? { ...formatted, date: m.recorded_at } : null;
      })
      .filter((m): m is { label: string; summary: string; date: string } => Boolean(m)),
    observations: allSessions
      .filter((s) => s.ressenti && s.ressenti.trim().length > 0)
      .map((s) => ({ date: s.started_at, text: s.ressenti as string })),
    userNote: userNote ?? null,
  };
}

export function resolveReportPeriod(fromInput?: string, toInput?: string): { from: Date; to: Date } {
  const to = toInput ? new Date(toInput) : new Date();
  const from = fromInput ? new Date(fromInput) : new Date(to.getTime() - DEFAULT_PERIOD_DAYS * 24 * 60 * 60 * 1000);
  return { from, to };
}
