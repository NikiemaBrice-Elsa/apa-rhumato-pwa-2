import { NextResponse } from "next/server";
import { reportRequestSchema, type PathologyCode } from "@apa/domain";
import { buildPatientReportPdf } from "@apa/pdf-report";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/serviceRole";
import { buildPatientReportData, resolveReportPeriod } from "@/lib/patientReport";
import { getPremiumStatus } from "@/lib/premiumAccess";
import { recordAuditLog } from "@/lib/auditLog";

/**
 * §48, Sprint 24 (14/09/2026, Q4 « a » validée) : au-delà de ce nombre de
 * rapports PDF générés dans le mois calendaire en cours, un compte GRATUIT
 * doit souscrire à l'abonnement premium pour continuer. Valeur choisie par
 * défaut par Claude faute de chiffre précis dans la proposition validée
 * (qui ne parlait que d'« un nombre limité par mois », voir
 * Propositions_Reformulation_Echelle_Premium_20260913.docx, §3) — Dr Nikiema
 * peut ajuster cette seule constante à tout moment, voir docs/DECISIONS.md.
 */
const FREE_MONTHLY_REPORT_LIMIT = 1;

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
 *
 * Sprint 24 (14/09/2026) : la génération illimitée devient une fonctionnalité
 * premium (Q4 « a »). Le compteur mensuel est lu/écrit dans `audit_logs`
 * (action `patient_generate_report`) via le client service_role — cette
 * table n'a aucune policy RLS de lecture publique (§45), donc le comptage ne
 * peut pas passer par le client normal de l'utilisateur.
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

  const serviceRole = createSupabaseServiceRoleClient();
  const { isPremium } = await getPremiumStatus(supabase, user.id);

  if (!isPremium) {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const { count, error: countError } = await serviceRole
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("action", "patient_generate_report")
      .gte("created_at", monthStart.toISOString());

    if (countError) {
      return NextResponse.json({ message: countError.message }, { status: 500 });
    }

    if ((count ?? 0) >= FREE_MONTHLY_REPORT_LIMIT) {
      return NextResponse.json(
        {
          message: `Vous avez atteint la limite de ${FREE_MONTHLY_REPORT_LIMIT} rapport(s) PDF ce mois-ci pour un compte gratuit. Passez à l'abonnement premium pour une génération illimitée.`,
          premiumRequired: true,
        },
        { status: 402 }
      );
    }
  }

  const reportData = await buildPatientReportData(supabase, user.id, pathology as PathologyCode, from, to, userNote);
  const pdfBuffer = await buildPatientReportPdf(reportData);

  await recordAuditLog(serviceRole, {
    actorUserId: user.id,
    action: "patient_generate_report",
    entityType: "users",
    entityId: user.id,
    metadata: { pathology, from, to },
  });

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rapport-apa-${pathology.toLowerCase()}.pdf"`,
    },
  });
}
