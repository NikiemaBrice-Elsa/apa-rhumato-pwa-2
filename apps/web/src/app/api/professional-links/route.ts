import { NextResponse } from "next/server";
import { professionalLinkInviteSchema } from "@apa/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/serviceRole";
import { getPremiumStatus } from "@/lib/premiumAccess";

/**
 * §41, Sprint 23 (13/09/2026) — invitations professionnel de santé, CÔTÉ
 * PATIENT. Toujours initiée par le patient (jamais par le professionnel,
 * §46 — voir migration 0021).
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
    .from("patient_professional_links")
    .select(
      "id, status, requested_at, decided_at, professional:users!patient_professional_links_professional_id_fkey(first_name, last_name, email)"
    )
    .eq("patient_id", user.id)
    .order("requested_at", { ascending: false });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ links: data ?? [] });
}

/**
 * Création d'une invitation. Passe par le client SERVICE_ROLE : contrairement
 * à la lecture/mise à jour d'un lien déjà existant (routes GET et
 * PATCH /api/professional-links/[id], qui restent sur le client normal et
 * les policies RLS `ppl_select_own`/`ppl_update_patient`), la recherche du
 * professionnel par email nécessite de lire une ligne `users` qu'AUCUN lien
 * ne relie encore au patient — la policy `users_select_linked_party`
 * (migration 0021) ne peut donc pas encore s'appliquer à ce stade précis.
 * Le contrôle d'accès réel reste ici, en code applicatif, avant toute
 * écriture (§46) : seul l'utilisateur authentifié peut inviter, et
 * uniquement en son propre nom (`patient_id` n'est jamais accepté du client).
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

  const parsed = professionalLinkInviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Email invalide.", issues: parsed.error.issues }, { status: 422 });
  }

  // §48, Sprint 24 (14/09/2026, Q4 « a » validée) : inviter un professionnel
  // de santé est réservé aux comptes premium actifs — voir
  // apps/web/src/lib/premiumAccess.ts. Ne bloque QUE la création d'une
  // nouvelle invitation : un lien déjà `authorized` avant ce verrouillage
  // (ou pendant une période d'essai passée) reste consultable normalement
  // via GET/PATCH, qui restent inchangés.
  const { isPremium } = await getPremiumStatus(supabase, user.id);
  if (!isPremium) {
    return NextResponse.json(
      {
        message: "L'espace professionnel de santé (partage de votre suivi avec un professionnel) est réservé à l'abonnement premium.",
        premiumRequired: true,
      },
      { status: 402 }
    );
  }

  const serviceRole = createSupabaseServiceRoleClient();

  // Recherche insensible à la casse (22/09/2026) : `professionalEmail` est
  // désormais normalisé en minuscules côté schéma (validation.ts), mais des
  // comptes professionnels créés directement par l'administrateur (hors
  // formulaire d'inscription, avant ce correctif) peuvent avoir un email
  // stocké avec une casse différente — une comparaison exacte (`.eq`) les
  // rendait introuvables pour un patient tapant la même adresse en
  // minuscules, alors même que le compte existe bien. `ilike` sans jocker
  // fait une comparaison exacte insensible à la casse ; `%`/`_` sont
  // échappés pour ne jamais être interprétés comme des jokers SQL.
  const escapedEmail = parsed.data.professionalEmail.replace(/[%_]/g, (char) => `\\${char}`);
  const { data: professional, error: lookupError } = await serviceRole
    .from("users")
    .select("id, role, status")
    .ilike("email", escapedEmail)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ message: lookupError.message }, { status: 500 });
  }

  // Message volontairement générique (§45) : ne confirme ni n'infirme
  // l'existence d'un compte à cet email, seulement l'issue de l'invitation.
  const genericNotFound = NextResponse.json(
    {
      message:
        "Aucun compte professionnel actif ne correspond à cet email. Vérifiez l'adresse, ou demandez à votre professionnel de santé de se rapprocher de l'administrateur pour créer son compte.",
    },
    { status: 422 }
  );

  if (!professional || professional.role !== "professional" || professional.status !== "active") {
    return genericNotFound;
  }

  if (professional.id === user.id) {
    return NextResponse.json({ message: "Vous ne pouvez pas vous inviter vous-même." }, { status: 422 });
  }

  const { data: existing, error: existingError } = await serviceRole
    .from("patient_professional_links")
    .select("id, status")
    .eq("patient_id", user.id)
    .eq("professional_id", professional.id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ message: existingError.message }, { status: 500 });
  }

  if (existing) {
    if (existing.status !== "revoked") {
      return NextResponse.json(
        {
          message:
            existing.status === "pending"
              ? "Une invitation est déjà en attente pour ce professionnel."
              : "Ce professionnel a déjà accès à votre suivi.",
        },
        { status: 422 }
      );
    }
    // Réinvitation après une révocation (§41 : le patient réinvite lui-même).
    const { error: updateError } = await serviceRole
      .from("patient_professional_links")
      .update({ status: "pending", requested_at: new Date().toISOString(), decided_at: null })
      .eq("id", existing.id);
    if (updateError) {
      return NextResponse.json({ message: updateError.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: existing.id });
  }

  const { data: inserted, error: insertError } = await serviceRole
    .from("patient_professional_links")
    .insert({ patient_id: user.id, professional_id: professional.id, status: "pending" })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ message: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: inserted.id });
}
