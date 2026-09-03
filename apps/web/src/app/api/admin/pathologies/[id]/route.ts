import { NextResponse } from "next/server";
import { buildAuditDiff } from "@apa/domain";
import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/serviceRole";
import { recordAuditLog } from "@/lib/auditLog";

/** Contenu éditable d'une pathologie existante (voir route.ts pour ce qui
 * n'est délibérément pas éditable — le `code` lui-même). */
const pathologyPatchSchema = z.object({
  nameFr: z.string().trim().min(1).optional(),
  description: z.string().max(2000).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null);
  const parsed = pathologyPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Champs invalides.", issues: parsed.error.issues }, { status: 422 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: existing, error: fetchError } = await supabase
    .from("pathologies")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ message: fetchError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ message: "Pathologie introuvable." }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.nameFr !== undefined) updates.name_fr = parsed.data.nameFr;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.active !== undefined) updates.active = parsed.data.active;

  const { error: updateError } = await supabase.from("pathologies").update(updates).eq("id", params.id);
  if (updateError) {
    return NextResponse.json({ message: updateError.message }, { status: 500 });
  }

  const diff = buildAuditDiff(existing, { ...existing, ...updates });
  await recordAuditLog(supabase, {
    actorUserId: admin.adminUserId,
    action: "admin_update_pathology",
    entityType: "pathologies",
    entityId: params.id,
    metadata: { diff },
  });

  return NextResponse.json({ ok: true });
}
