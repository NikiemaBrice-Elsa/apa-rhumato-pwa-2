import { NextResponse } from "next/server";
import { measurementSchema, requiresCardioOptIn } from "@apa/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Suivi (§35 poids, §36 tour de taille, §37 tension, §38 glycémie) — Sprint 8.
 *
 * §37 et §38 sont introduits par « Permettre éventuellement » dans le cahier
 * des charges : ce caractère optionnel est déjà modélisé depuis le Sprint 2
 * par `patient_profiles.track_cardio_params` (§13, coché à l'inscription).
 * Cette route refuse donc explicitement une saisie de tension/glycémie tant
 * que l'utilisateur n'a pas activé ce suivi dans son profil — défense en
 * profondeur en plus du fait que l'UI ne doit pas proposer ces champs par
 * défaut (§46 : ne jamais faire confiance uniquement aux contrôles frontend).
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

  const parsed = measurementSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? "form")] = issue.message;
    }
    return NextResponse.json({ message: "Certains champs sont invalides.", fieldErrors }, { status: 422 });
  }

  const input = parsed.data;

  if (requiresCardioOptIn(input.measurementType)) {
    const { data: profile } = await supabase
      .from("patient_profiles")
      .select("track_cardio_params")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.track_cardio_params) {
      return NextResponse.json(
        { message: "Le suivi de la tension/glycémie n'est pas activé dans votre profil (§13)." },
        { status: 403 }
      );
    }
  }

  const { data, error } = await supabase
    .from("measurements")
    .insert({
      user_id: user.id,
      measurement_type: input.measurementType,
      weight_kg: input.measurementType === "poids" ? input.weightKg : null,
      waist_circumference_cm: input.measurementType === "tour_de_taille" ? input.waistCircumferenceCm : null,
      systolic_mmhg: input.measurementType === "tension_arterielle" ? input.systolicMmhg : null,
      diastolic_mmhg: input.measurementType === "tension_arterielle" ? input.diastolicMmhg : null,
      heart_rate_bpm: input.measurementType === "tension_arterielle" ? input.heartRateBpm ?? null : null,
      glycemia_value: input.measurementType === "glycemie" ? input.glycemiaValue : null,
      glycemia_unit: input.measurementType === "glycemie" ? input.glycemiaUnit : null,
      recorded_at: input.recordedAt ?? new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ measurement: data }, { status: 201 });
}

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  let query = supabase
    .from("measurements")
    .select("*")
    .eq("user_id", user.id)
    .order("recorded_at", { ascending: true })
    .limit(200);

  if (type) {
    query = query.eq("measurement_type", type);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ measurements: data });
}
