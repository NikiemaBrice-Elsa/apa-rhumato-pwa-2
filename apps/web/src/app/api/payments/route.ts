import { NextResponse } from "next/server";
import { paymentClaimSchema } from "@apa/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * §47 : le patient déclare avoir réglé sa souscription (référence de
 * transaction Mobile Money/Orange Money/Moov Money, ou autre) — cette route
 * ne vérifie RIEN auprès d'une passerelle (aucune n'est intégrée, voir
 * packages/payment-service) : elle enregistre la déclaration à l'état
 * `pending`, pour vérification humaine par un administrateur. Ni le statut
 * ni la souscription ne sont activés ici (§46).
 */
export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ payments: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = paymentClaimSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Champs invalides.", issues: parsed.error.issues }, { status: 422 });
  }

  const input = parsed.data;

  // La souscription visée doit appartenir à l'appelant et être en attente —
  // impossible de déclarer un paiement pour la souscription de quelqu'un
  // d'autre, ou pour une souscription déjà tranchée (§46).
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("id, status, user_id")
    .eq("id", input.subscriptionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!subscription) {
    return NextResponse.json({ message: "Souscription introuvable." }, { status: 404 });
  }
  if (subscription.status !== "pending") {
    return NextResponse.json({ message: "Cette souscription n'est plus en attente de paiement." }, { status: 422 });
  }

  const { data, error } = await supabase
    .from("payments")
    .insert({
      user_id: user.id,
      subscription_id: input.subscriptionId,
      provider: input.provider,
      amount: input.amount,
      currency: input.currency,
      external_reference: input.externalReference,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ payment: data }, { status: 201 });
}
