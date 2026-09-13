import { NextResponse } from "next/server";
import { PATHOLOGY_CODES, type PathologyCode } from "@apa/domain";
import { buildPatientReportPdf } from "@apa/pdf-report";
import { requireProfessional } from "@/lib/professionalAuth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/serviceRole";
import { recordAuditLog } from "@/lib/auditLog";
import { buildPatientReportData, resolveReportPeriod } from "@/lib/patientReport";

/**
 * §41, §45, §46, Sprint 23 (13/09/2026) — rapport PDF d'un patient, consulté
 * par un professionnel de santé autorisé. Réutilise EXACTEMENT
 * `buildPatientReportData` (extrait de /api/reports/pdf) : le professionnel
 * voit le même contenu que le patient génère lui-même, jamais une vue
 * différente. Chaque consultation est journalisée (§45).
 */
export async function GET(request: Request, { params }: { params: { patientId: string } }) {
  const professional = await requireProfessional();
  if (!professional.ok) return professional.response;

  const { searchParams } = new URL(request.url);
  const pathologyParam = searchParams.get("pathology");
  if (!pathologyParam || !(PATHOLOGY_CODES as readonly string[]).includes(pathologyParam)) {
    return NextResponse.json({ message: "Pathologie invalide ou manquante." }, { status: 422 });
  }
  const pathology = pathologyParam as PathologyCode;
  const { from, to } = resolveReportPeriod(searchParams.get("from") ?? undefined, searchParams.get("to") ?? undefined);

  // Vérifie l'autorisation via le client NORMAL (RLS `ppl_select_own`,
  // migration 0021) : le professionnel ne peut voir QUE ses propres liens —
  // impossible de sonder l'existence d'un lien pour un autre professionnel
  // par ce chemin, la requête elle-même est déjà filtrée par RLS.
  const supabase = createSupabaseServerClient();
  const { data: link, error: linkError } = await supabase
    .from("patient_professional_links")
    .select("status")
    .eq("patient_id", params.patientId)
    .eq("professional_id", professional.professionalUserId)
    .maybeSingle();

  if (linkError) {
    return NextResponse.json({ message: linkError.message }, { status: 500 });
  }
  if (!link || link.status !== "authorized") {
    // §45 : message générique, ne confirme pas si un lien existe (pending/revoked) ou non.
    return NextResponse.json(
      { message: "Accès refusé : ce patient ne vous a pas (ou plus) autorisé à consulter son rapport." },
      { status: 403 }
    );
  }

  // Lecture des données du rapport via service_role : aucune policy RLS
  // supplémentaire n'a été ajoutée sur `sessions`/`measurements`/`programs`
  // pour l'espace professionnel — volontairement, pour ne pas multiplier les
  // policies à auditer sur des tables cliniques déjà strictement
  // "propriétaire" (RLS `auth.uid() = user_id`). L'autorisation vient
  // d'être vérifiée juste au-dessus, PAR RLS, avant ce contournement — même
  // discipline que l'espace admin (`requireAdmin` + service_role,
  // apps/web/src/lib/adminAuth.ts).
  const serviceRole = createSupabaseServiceRoleClient();
  const reportData = await buildPatientReportData(serviceRole, params.patientId, pathology, from, to);
  const pdfBuffer = await buildPatientReportPdf(reportData);

  await recordAuditLog(serviceRole, {
    actorUserId: professional.professionalUserId,
    action: "professional_view_report",
    entityType: "users",
    entityId: params.patientId,
    metadata: { pathology, from: from.toISOString(), to: to.toISOString() },
  });

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rapport-apa-${pathology.toLowerCase()}.pdf"`,
    },
  });
}
