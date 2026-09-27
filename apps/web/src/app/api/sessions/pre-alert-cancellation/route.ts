import { NextResponse } from "next/server";
import { sessionPreAlertCancellationSchema } from "@apa/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Sprint 33 (27/09/2026, instruction directe de Dr Nikiema, suite à
 * l'avertissement avant séance du même jour) : appelée quand le patient voit
 * l'avertissement (`shouldWarnBeforeSession`, packages/domain/src/sessions.ts)
 * et choisit « Annuler » — aucune séance n'est créée dans `sessions`, cette
 * route enregistre uniquement l'événement pour que le tableau de bord puisse
 * en garder le rappel jusqu'à la prochaine tentative (voir
 * `infra/db/migrations/0026_session_pre_alert_cancellations.sql`). Jamais un
 * contrôle bloquant côté serveur : le choix du patient a déjà eu lieu côté
 * client avant cet appel, exactement comme `POST /api/sessions`.
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
  if (!body) {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  const parsed = sessionPreAlertCancellationSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? "form")] = issue.message;
    }
    return NextResponse.json({ message: "Certains champs sont invalides.", fieldErrors }, { status: 422 });
  }

  const { pathology, douleurAvant, gonflementArticulaire, fievre, symptomeInhabituel } = parsed.data;

  const { data, error } = await supabase
    .from("session_pre_alert_cancellations")
    .insert({
      user_id: user.id,
      pathology,
      douleur_avant: douleurAvant ?? null,
      gonflement_articulaire: gonflementArticulaire,
      fievre,
      symptome_inhabituel: symptomeInhabituel,
    })
    .select("id, created_at")
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, createdAt: data.created_at }, { status: 201 });
}
