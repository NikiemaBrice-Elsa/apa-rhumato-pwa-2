import { NextResponse } from "next/server";
import {
  reportRequestSchema,
  sessionDurationMinutes,
  computeAdherencePercent,
  glycemiaGramsPerLToMmol,
  PATHOLOGY_LABELS_FR,
  type PathologyCode,
} from "@apa/domain";
import { buildPatientReportPdf, type PatientReportData } from "@apa/pdf-report";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DEFAULT_PERIOD_DAYS = 30;

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
          : `${row.glycemia_value} g/L`; // valeur déjà en mmol/L, conversion inverse non nécessaire à l'affichage
      const original = row.glycemia_unit === "g_l" ? `${row.glycemia_value} g/L` : `${row.glycemia_value} mmol/L`;
      return { label: "Glycémie", summary: `${original} (≈ ${otherUnit})` };
    }
    default:
      return null;
  }
}

/**
 * Rapport PDF (§40, §71) — Sprint 10.
 *
 * Rassemble uniquement des données déjà enregistrées et calculées par les
 * sprints précédents (séances Sprint 7, mesures Sprint 8, adhésion Sprint 9)
 * — aucun calcul médical n'a lieu ici. Le rendu lui-même est délégué à
 * `@apa/pdf-report`, qui garantit l'avertissement médical obligatoire (§40)
 * dans toutes les configurations (voir ses tests dédiés).
 */
export async function POST(request: Request) {
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

  const parsed = reportRequestSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? "form")] = issue.message;
    }
    return NextResponse.json({ message: "Certains champs sont invalides.", fieldErrors }, { status: 422 });
  }

  const { pathology, userNote } = parsed.data;
  const to = parsed.data.to ? new Date(parsed.data.to) : new Date();
  const from = parsed.data.from
    ? new Date(parsed.data.from)
    : new Date(to.getTime() - DEFAULT_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  const [{ data: appUser }, { data: sessions }, { data: measurements }, { data: assignment }] = await Promise.all([
    supabase.from("users").select("first_name, last_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("sessions")
      .select("status, started_at, completed_at, douleur_avant, douleur_apres, ressenti")
      .eq("user_id", user.id)
      .eq("pathology", pathology)
      .gte("started_at", from.toISOString())
      .lte("started_at", to.toISOString()),
    supabase
      .from("measurements")
      .select(
        "measurement_type, recorded_at, weight_kg, waist_circumference_cm, systolic_mmhg, diastolic_mmhg, heart_rate_bpm, glycemia_value, glycemia_unit"
      )
      .eq("user_id", user.id)
      .gte("recorded_at", from.toISOString())
      .lte("recorded_at", to.toISOString())
      .order("recorded_at", { ascending: true }),
    supabase
      .from("user_program_assignments")
      .select("program_id")
      .eq("user_id", user.id)
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

  const reportData: PatientReportData = {
    identity: { firstName: appUser?.first_name ?? "", lastName: appUser?.last_name ?? null },
    pathologyLabel: PATHOLOGY_LABELS_FR[pathology as PathologyCode],
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

  const pdfBuffer = await buildPatientReportPdf(reportData);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rapport-apa-${pathology.toLowerCase()}.pdf"`,
    },
  });
}
