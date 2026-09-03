import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * §45 (« journalisation des actions sensibles »), §65 (rapport scientifique
 * interne) — Sprint 13. Écrit toujours via le client service_role :
 * `audit_logs` n'a aucune policy RLS select/insert publique (migration
 * 0001/0002) — c'est volontaire, ces journaux ne sont lisibles que par
 * l'espace admin. La décision de CE QUI est journalisé (le diff) est pure
 * et testée séparément, voir `buildAuditDiff` dans `packages/domain/src/admin.ts`.
 *
 * §79 : « Ne jamais cacher une erreur. » Corrigé au Sprint 15 : le client
 * Supabase ne lève pas d'exception sur une erreur d'insertion (il renvoie
 * `{ data: null, error }`) — un bug de ce fichier (voir migration 0012)
 * faisait échouer silencieusement la journalisation pour plusieurs routes
 * admin sensibles (règles cliniques, pathologies, plans d'abonnement) sans
 * que personne ne s'en aperçoive. Le champ `error` est désormais TOUJOURS
 * inspecté : une erreur de journalisation ne bloque pas l'action
 * administrative elle-même (l'écriture principale a déjà réussi à ce stade,
 * et la priorité §78 place la fiabilité technique de l'action au-dessus de
 * sa traçabilité), mais elle est explicitement signalée via `console.error`
 * plutôt que silencieusement ignorée.
 */
export async function recordAuditLog(
  serviceRoleClient: SupabaseClient,
  entry: {
    actorUserId: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await serviceRoleClient.from("audit_logs").insert({
    user_id: entry.actorUserId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    metadata: entry.metadata ?? {},
  });

  if (error) {
    // Ne jamais laisser passer silencieusement (§79) : l'action admin
    // elle-même a déjà réussi (recordAuditLog est toujours appelé après
    // l'écriture principale), donc on ne la fait pas échouer a posteriori,
    // mais l'incident doit rester visible dans les journaux serveur.
    console.error("[recordAuditLog] échec de journalisation d'audit :", {
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      error: error.message,
    });
  }
}
