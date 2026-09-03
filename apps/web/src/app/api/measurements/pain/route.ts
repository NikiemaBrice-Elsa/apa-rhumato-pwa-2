import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Suivi de la douleur (§34) — Sprint 8.
 *
 * Contrairement au poids/tour de taille/tension/glycémie, la douleur n'a
 * PAS de table dédiée : elle est déjà capturée à chaque séance
 * (`sessions.douleur_avant`/`douleur_apres`, Sprint 7). La dupliquer dans
 * `measurements` créerait deux sources de vérité pour la même donnée. Cette
 * route se contente donc de relire l'historique déjà stocké, dans l'ordre
 * chronologique, pour affichage en graphique (§34 : « Ne pas interpréter
 * automatiquement une variation isolée comme une amélioration ou une
 * aggravation définitive » — aucune interprétation n'est faite ici, seules
 * les valeurs brutes sont renvoyées).
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
    .from("sessions")
    .select("id, pathology, started_at, douleur_avant, douleur_apres")
    .eq("user_id", user.id)
    .not("douleur_avant", "is", null)
    .order("started_at", { ascending: true })
    .limit(200);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ painHistory: data });
}
