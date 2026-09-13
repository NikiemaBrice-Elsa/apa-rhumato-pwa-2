import { NextResponse } from "next/server";
import { reportRequestSchema, type PathologyCode } from "@apa/domain";
import { buildPatientReportPdf } from "@apa/pdf-report";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildPatientReportData, resolveReportPeriod } from "@/lib/patientReport";

/**
 * Rapport PDF (§40, §71) — Sprint 10.
 *
 * Rassemble uniquement des données déjà enregistrées et calculées par les
 * sprints précédents (séances Sprint 7, mesures Sprint 8, adhésion Sprint 9)
 * — aucun calcul médical n'a lieu ici. Le rendu lui-même est délégué à
 * `@apa/pdf-report`, qui garantit l'avertissement médical obligatoire (§40)
 * dans toutes les configurations (voir ses tests dédiés).
 *
 * Rassemblage des données extrait vers `@/lib/patientReport`
 * (`buildPatientReportData`) au Sprint 23 (13/09/2026) pour être réutilisé
 * tel quel par l'espace professionnel de santé (§41,
 * `/api/professionnel/patients/[patientId]/report`) — cette route reste
 * strictement scopée à l'utilisateur authentifié lui-même (§46 : jamais d'ID
 * patient accepté depuis le client ici).
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
  const { from, to } = resolveReportPeriod(parsed.data.from, parsed.data.to);

  const reportData = await buildPatientReportData(supabase, user.id, pathology as PathologyCode, from, to, userNote);
  const pdfBuffer = await buildPatientReportPdf(reportData);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rapport-apa-${pathology.toLowerCase()}.pdf"`,
    },
  });
}
