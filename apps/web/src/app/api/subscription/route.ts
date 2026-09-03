import { NextResponse } from "next/server";
import { isSubscriptionCurrentlyActive } from "@apa/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * §47, §48 : abonnement du patient connecté. Renvoie la dernière
 * souscription connue (le cas normal : une seule active/pending à la fois,
 * mais rien n'empêche un historique) ainsi que les plans publics actifs
 * pour construire l'écran « Mon abonnement ». `isCurrentlyActive` est
 * recalculé ici plutôt que stocké : une expiration dépassée ne doit jamais
 * dépendre d'une tâche de fond qui aurait pu ne pas tourner (§57 discipline
 * étendue : ne rien supposer, vérifier à la demande).
 */
export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  const [{ data: subscriptions, error: subError }, { data: plans, error: plansError }] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("subscription_plans").select("*").eq("active", true).order("plan_code"),
  ]);

  if (subError) return NextResponse.json({ message: subError.message }, { status: 500 });
  if (plansError) return NextResponse.json({ message: plansError.message }, { status: 500 });

  const latest = subscriptions?.[0] ?? null;
  const now = new Date();

  return NextResponse.json({
    subscription: latest,
    isCurrentlyActive: latest ? isSubscriptionCurrentlyActive({ status: latest.status, expiresAt: latest.expires_at }, now) : false,
    history: subscriptions ?? [],
    plans: plans ?? [],
  });
}
