import { NextResponse } from "next/server";
import { patientProfileSchema, computeBmi } from "@apa/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Profil patient (§13). Lecture/écriture toujours scopées à l'utilisateur
 * authentifié — jamais d'ID patient accepté depuis le client (§46). */

export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("patient_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}

export async function PUT(request: Request) {
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

  const parsed = patientProfileSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? "form")] = issue.message;
    }
    return NextResponse.json({ message: "Certains champs sont invalides.", fieldErrors }, { status: 422 });
  }

  const input = parsed.data;
  // IMC recalculé côté serveur (§35) — jamais interprété comme un diagnostic.
  const bmi = input.heightCm && input.weightKg ? computeBmi(input.weightKg, input.heightCm) : null;

  const { error } = await supabase.from("patient_profiles").upsert(
    {
      user_id: user.id,
      height_cm: input.heightCm ?? null,
      weight_kg: input.weightKg ?? null,
      bmi,
      waist_circumference_cm: input.waistCircumferenceCm ?? null,
      physical_activity_level: input.physicalActivityLevel ?? null,
      main_pathology: input.mainPathology ?? null,
      objectives: input.objectives,
      functional_limitations: input.functionalLimitations ?? null,
      pain_baseline: input.painBaseline ?? null,
      fatigue_baseline: input.fatigueBaseline ?? null,
      track_cardio_params: input.trackCardioParams,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, bmi });
}
