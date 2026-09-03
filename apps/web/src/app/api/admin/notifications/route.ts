import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/serviceRole";

/**
 * §42 « gestion notifications ». Contrairement aux autres sections
 * (pathologies/exercices/programmes/règles), le CONTENU des notifications
 * n'est pas éditable en base : les messages sont générés par des fonctions
 * pures versionnées dans le code (`packages/domain/src/notifications.ts`,
 * Sprint 11), pas par des lignes de données — « gestion » se limite donc
 * ici à la SUPERVISION (volumes envoyés, répartition par type) plutôt qu'à
 * une édition de contenu, ce qui est documenté explicitement plutôt que
 * simulé par un faux écran d'édition.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createSupabaseServiceRoleClient();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();

  const { data, error } = await supabase
    .from("notifications")
    .select("notification_type, read, created_at")
    .gte("created_at", since);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const byType = new Map<string, { total: number; read: number }>();
  for (const row of rows) {
    const entry = byType.get(row.notification_type) ?? { total: 0, read: 0 };
    entry.total += 1;
    if (row.read) entry.read += 1;
    byType.set(row.notification_type, entry);
  }

  return NextResponse.json({
    windowDays: 30,
    totalSent: rows.length,
    totalRead: rows.filter((r) => r.read).length,
    byType: Array.from(byType.entries()).map(([notificationType, counts]) => ({ notificationType, ...counts })),
  });
}
