/**
 * Calculs purs liés aux mesures (§35, §38). Aucune interprétation clinique :
 * conformément au §35 et au §38, l'IMC ou une valeur de mesure ne doivent
 * jamais être présentés comme un diagnostic.
 */

/**
 * §35 (poids), §36 (tour de taille), §37 (tension artérielle, sous réserve
 * de `patient_profiles.trackCardioParams`, §13), §38 (glycémie) — Sprint 8.
 * La douleur (§34) n'a volontairement PAS de type ici : elle est déjà
 * capturée par `sessions` (Sprint 7) et `clinical_assessments` (Sprint 3),
 * jamais dupliquée dans `measurements`.
 */
export const MEASUREMENT_TYPES = ["poids", "tour_de_taille", "tension_arterielle", "glycemie"] as const;
export type MeasurementType = (typeof MEASUREMENT_TYPES)[number];

export const MEASUREMENT_TYPE_LABELS_FR: Record<MeasurementType, string> = {
  poids: "Poids",
  tour_de_taille: "Tour de taille",
  tension_arterielle: "Tension artérielle",
  glycemie: "Glycémie",
};

export const GLYCEMIA_UNITS = ["g_l", "mmol_l"] as const;
export type GlycemiaUnit = (typeof GLYCEMIA_UNITS)[number];

/** §37/§38 : introduits par « Permettre éventuellement » dans le cahier des
 * charges — soumis à l'accord explicite `patient_profiles.trackCardioParams`
 * (§13), contrairement au poids/tour de taille toujours autorisés. */
const CARDIO_GATED_MEASUREMENT_TYPES: ReadonlySet<MeasurementType> = new Set(["tension_arterielle", "glycemie"]);

export function requiresCardioOptIn(measurementType: MeasurementType): boolean {
  return CARDIO_GATED_MEASUREMENT_TYPES.has(measurementType);
}

/** Reflète la table `measurements` (Sprint 8) — une ligne par mesure
 * autodéclarée, quel que soit son type ; les champs non pertinents pour un
 * type donné restent `null`. */
export interface Measurement {
  id: string;
  userId: string;
  measurementType: MeasurementType;
  weightKg?: number | null;
  waistCircumferenceCm?: number | null;
  systolicMmhg?: number | null;
  diastolicMmhg?: number | null;
  heartRateBpm?: number | null;
  glycemiaValue?: number | null;
  glycemiaUnit?: GlycemiaUnit | null;
  recordedAt: string;
  createdAt: string;
}

/** IMC = poids (kg) / taille (m)² — §35. */
export function computeBmi(weightKg: number, heightCm: number): number {
  if (weightKg <= 0 || heightCm <= 0) {
    throw new RangeError("weightKg et heightCm doivent être strictement positifs");
  }
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

/** Conversion glycémie g/L -> mmol/L : 1 g/L = 5,5556 mmol/L (§38, valeur imposée par le cahier des charges). */
const G_PER_L_TO_MMOL_PER_L = 5.5556;

export function glycemiaGramsPerLToMmol(gramsPerL: number): number {
  return Math.round(gramsPerL * G_PER_L_TO_MMOL_PER_L * 100) / 100;
}

export function glycemiaMmolToGramsPerL(mmolPerL: number): number {
  return Math.round((mmolPerL / G_PER_L_TO_MMOL_PER_L) * 100) / 100;
}
