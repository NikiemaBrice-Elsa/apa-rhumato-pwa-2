import { NextResponse } from "next/server";
import { subscriptionRequestSchema } from "@apa/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * §47, §48 : le patient demande à passer sur un plan premium. Crée
 * uniquement une ligne `pending` (imposé aussi par la policy RLS
 * `subscriptions_insert_own_pending`, migration 0011 — défense en
 * profondeur) : cette route ne débite rien, ne contacte aucune passerelle,
 * elle enregistre une INTENTION. L'activation réelle attend la
 * confirmation d'un paiement par un administrateur (§46 : jamais un statut
 * sensible décidé côté client).
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
  const parsed = subscriptionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Plan invalide.", issues: parsed.error.issues }, { status: 422 });
  }

  // Évite d'accumuler des demandes en double pour le même plan : une
  // demande déjà en attente est réutilisée plutôt que dupliquée.
  const { data: existingPending } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .eq("plan_code", parsed.data.planCode)
    .eq("status", "pending")
    .maybeSingle();

  if (existingPending) {
    return NextResponse.json({ subscription: existingPending });
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .insert({ user_id: user.id, plan_code: parsed.data.planCode, status: "pending" })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ subscription: data }, { status: 201 });
}
