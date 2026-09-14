import type { SupabaseClient } from "@supabase/supabase-js";
import { hasActivePremiumSubscription, type SubscriptionPlanCode, type SubscriptionStatus } from "@apa/domain";

/**
 * §48, Sprint 24 (14/09/2026) : point de vérité UNIQUE pour savoir si un
 * patient a un accès premium actif, réutilisé par les 4 fonctionnalités
 * verrouillées le même jour (Question 4 « a » du document
 * Propositions_Reformulation_Echelle_Premium_20260913.docx) : espace
 * professionnel de santé, rapport PDF illimité, historique complet des
 * statistiques, coach vocal audio complet.
 *
 * Reprend exactement la requête déjà utilisée par
 * `apps/web/src/app/(dashboard)/tableau-de-bord/page.tsx` et
 * `apps/web/src/app/api/subscription/route.ts` (dernière souscription par
 * date de création décroissante) plutôt que de faire confiance à un état mis
 * en cache — même discipline (« ne rien supposer, vérifier à la demande »).
 * Utilise le client Supabase PASSÉ EN PARAMÈTRE (normal ou service_role
 * selon l'appelant) : cette fonction ne décide jamais elle-même du niveau
 * d'accès à la base, elle ne fait que lire `subscriptions` et interpréter le
 * résultat.
 */
export async function getPremiumStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<{ isPremium: boolean; planCode: SubscriptionPlanCode | null; status: SubscriptionStatus | null }> {
  const { data } = await supabase
    .from("subscriptions")
    .select("plan_code, status, expires_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return { isPremium: false, planCode: null, status: null };
  }

  const isPremium = hasActivePremiumSubscription(
    { planCode: data.plan_code as SubscriptionPlanCode, status: data.status as SubscriptionStatus, expiresAt: data.expires_at },
    new Date()
  );

  return { isPremium, planCode: data.plan_code as SubscriptionPlanCode, status: data.status as SubscriptionStatus };
}
