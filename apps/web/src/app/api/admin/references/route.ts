import { NextResponse } from "next/server";
import { scientificReferenceUpsertSchema } from "@apa/domain";
import { requireAdmin } from "@/lib/adminAuth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/serviceRole";
import { recordAuditLog } from "@/lib/auditLog";

/** §32, §42 « gestion références scientifiques ». */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.from("scientific_references").select("*").order("year", { ascending: false });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ references: data ?? [] });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null);
  const parsed = scientificReferenceUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Champs invalides.", issues: parsed.error.issues }, { status: 422 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const input = parsed.data;

  const { data, error } = await supabase
    .from("scientific_references")
    .insert({
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
      last_checked: input.lastChecked || new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  await recordAuditLog(supabase, {
    actorUserId: admin.adminUserId,
    action: "admin_create_scientific_reference",
    entityType: "scientific_references",
    entityId: data.id,
    metadata: { input },
  });

  return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
}
