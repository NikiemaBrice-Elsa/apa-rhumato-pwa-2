import { NextResponse } from "next/server";
import { scientificReferenceUpsertSchema, buildAuditDiff } from "@apa/domain";
import { requireAdmin } from "@/lib/adminAuth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/serviceRole";
import { recordAuditLog } from "@/lib/auditLog";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null);
  const parsed = scientificReferenceUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Champs invalides.", issues: parsed.error.issues }, { status: 422 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: existing, error: fetchError } = await supabase
    .from("scientific_references")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ message: fetchError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ message: "Référence introuvable." }, { status: 404 });
  }

  const input = parsed.data;
  const updates = {
    title: input.title,
    authors: input.authors,
    journal: input.journal || null,
    year: input.year,
    doi: input.doi || null,
    url: input.url || null,
    organization: input.organization,
    pathologies: input.pathologies,
    recommendation_summary: input.recommendationSummary,
    evidence_level: input.evidenceLevel || null,
    last_checked: input.lastChecked || existing.last_checked,
  };

  const { error: updateError } = await supabase.from("scientific_references").update(updates).eq("id", params.id);
  if (updateError) {
    return NextResponse.json({ message: updateError.message }, { status: 500 });
  }

  const diff = buildAuditDiff(existing, { ...existing, ...updates });
  await recordAuditLog(supabase, {
    actorUserId: admin.adminUserId,
    action: "admin_update_scientific_reference",
    entityType: "scientific_references",
    entityId: params.id,
    metadata: { diff },
  });

  return NextResponse.json({ ok: true });
}
