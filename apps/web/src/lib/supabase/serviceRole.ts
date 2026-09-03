import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase avec la clé `service_role` (§42, §45, §46 — Sprint 13).
 * Cette clé CONTOURNE toutes les policies RLS : elle ne doit JAMAIS être
 * utilisée sans avoir d'abord vérifié explicitement, côté serveur, que
 * l'appelant est un administrateur authentifié (voir `requireAdmin` dans
 * `apps/web/src/lib/adminAuth.ts`, appelé systématiquement AVANT toute
 * utilisation de ce client). Jamais importée depuis un composant client.
 */
export function createSupabaseServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY manquante : l'espace administrateur nécessite cette variable d'environnement (voir infra/env/.env.example et docs/DEPLOYMENT.md)."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
