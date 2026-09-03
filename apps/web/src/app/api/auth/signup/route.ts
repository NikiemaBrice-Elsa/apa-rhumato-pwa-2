import { NextResponse } from "next/server";
import { signUpSchema } from "@apa/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Création de compte (§12). Validation serveur systématique (§46), même si
 * le formulaire valide déjà côté client — « ne jamais faire confiance
 * uniquement aux contrôles frontend ».
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  const parsed = signUpSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] = issue.message;
    }
    return NextResponse.json(
      { message: "Certains champs sont invalides.", fieldErrors },
      { status: 422 }
    );
  }

  const { firstName, lastName, email, phone, password } = parsed.data;

  if (!email) {
    // Supabase Auth (email/password) est utilisé en Sprint 2 ; l'inscription
    // par téléphone seul (OTP) est une extension possible mais non couverte
    // ici — cf. TODO_MEDICAL_VALIDATION non applicable, simple limitation
    // technique documentée dans docs/DECISIONS.md.
    return NextResponse.json(
      {
        message: "Une adresse email est requise pour créer le compte dans cette version.",
        fieldErrors: { email: "Email requis pour l'inscription (V1)." },
      },
      { status: 422 }
    );
  }

  const supabase = createSupabaseServerClient();

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError || !authData.user) {
    return NextResponse.json(
      { message: authError?.message ?? "Impossible de créer le compte." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const { error: insertError } = await supabase.from("users").insert({
    id: authData.user.id,
    first_name: firstName,
    last_name: lastName ?? null,
    email,
    phone: phone ?? null,
    role: "patient",
    locale: "fr",
    consent_terms_accepted_at: now,
    consent_data_processing_accepted_at: now,
    status: "active",
  });

  if (insertError) {
    return NextResponse.json({ message: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ userId: authData.user.id }, { status: 201 });
}
