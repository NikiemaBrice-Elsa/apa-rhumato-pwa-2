"use client";

import { useEffect, useState } from "react";
import { computeBmi } from "@apa/domain";
import { Button } from "@/components/ui/Button";
import { MiniLineChart } from "@/components/ui/MiniLineChart";
import { enqueueOperation } from "@/lib/offlineStorage";

interface ProfileRow {
  height_cm: number | null;
  track_cardio_params: boolean;
}

interface MeasurementRow {
  id: string;
  measurement_type: string;
  weight_kg: number | null;
  waist_circumference_cm: number | null;
  systolic_mmhg: number | null;
  diastolic_mmhg: number | null;
  heart_rate_bpm: number | null;
  glycemia_value: number | null;
  glycemia_unit: "g_l" | "mmol_l" | null;
  recorded_at: string;
}

interface PainPoint {
  id: string;
  pathology: string;
  started_at: string;
  douleur_avant: number | null;
  douleur_apres: number | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

/**
 * Suivi (§33-38) — Sprint 8. Chaque section (douleur, poids, tour de taille,
 * tension, glycémie) affiche l'historique brut sous forme de courbe, sans
 * aucune interprétation automatique (§34) et sans transformer l'IMC en
 * diagnostic (§35). Tension et glycémie ne s'affichent que si l'utilisateur
 * a activé `trackCardioParams` dans son profil (§13, §37, §38).
 */
export function SuiviFlow() {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [pain, setPain] = useState<PainPoint[]>([]);
  const [weight, setWeight] = useState<MeasurementRow[]>([]);
  const [waist, setWaist] = useState<MeasurementRow[]>([]);
  const [bp, setBp] = useState<MeasurementRow[]>([]);
  const [glycemia, setGlycemia] = useState<MeasurementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null);

  async function reloadAll() {
    setLoading(true);
    setError(null);
    try {
      const [profileRes, painRes, weightRes, waistRes, bpRes, glycemiaRes] = await Promise.all([
        fetch("/api/profile"),
        fetch("/api/measurements/pain"),
        fetch("/api/measurements?type=poids"),
        fetch("/api/measurements?type=tour_de_taille"),
        fetch("/api/measurements?type=tension_arterielle"),
        fetch("/api/measurements?type=glycemie"),
      ]);
      const [profileData, painData, weightData, waistData, bpData, glycemiaData] = await Promise.all([
        profileRes.json(),
        painRes.json(),
        weightRes.json(),
        waistRes.json(),
        bpRes.json(),
        glycemiaRes.json(),
      ]);
      setProfile(profileData.profile ?? null);
      setPain(painData.painHistory ?? []);
      setWeight(weightData.measurements ?? []);
      setWaist(waistData.measurements ?? []);
      setBp(bpData.measurements ?? []);
      setGlycemia(glycemiaData.measurements ?? []);
    } catch {
      setError("Impossible de charger votre suivi pour le moment.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reloadAll();
  }, []);

  // Sprint 24 (14/09/2026, Priorité 5 de Feuille_de_route_prioritaire_20260912.docx) :
  // avant ce correctif, une mesure saisie hors connexion échouait simplement
  // (aucun `try`/`catch` autour du `fetch` : une coupure réseau en cours de
  // requête aurait même produit une exception non gérée) — contrairement à
  // la séance (SessionFlow.tsx), qui utilise déjà offlineQueue.ts depuis le
  // Sprint 12. La file elle-même était déjà générique par entité (voir
  // `extractServerId` dans offlineStorage.ts, qui gère déjà la forme
  // `{ measurement: { id } }` renvoyée par `POST /api/measurements` — signe
  // que ce câblage était prévu dès l'origine, seulement jamais fait) ; seul
  // cet écran ne l'utilisait pas encore.
  function queueMeasurement(payload: Record<string, unknown>) {
    enqueueOperation({ id: crypto.randomUUID(), entityType: "measurement", method: "POST", url: "/api/measurements", body: payload });
    setQueuedMessage("Hors connexion : cette mesure sera synchronisée dès que la connexion sera rétablie (elle n'apparaît pas encore dans la courbe ci-dessus).");
  }

  async function addMeasurement(payload: Record<string, unknown>) {
    setError(null);
    setQueuedMessage(null);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      queueMeasurement(payload);
      return;
    }

    try {
      const res = await fetch("/api/measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Une erreur est survenue.");
        return;
      }
      await reloadAll();
    } catch {
      // Échec réseau en cours de requête (pas seulement détecté à l'avance) :
      // même discipline que SessionFlow.tsx, on ne perd pas la saisie.
      queueMeasurement(payload);
    }
  }

  if (loading) {
    return <p className="text-primary-700">Chargement de votre suivi…</p>;
  }

  const latestWeight = weight.length > 0 ? weight[weight.length - 1] : null;
  const bmi =
    latestWeight?.weight_kg && profile?.height_cm ? computeBmi(latestWeight.weight_kg, profile.height_cm) : null;

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {queuedMessage && (
        <p className="rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-700">{queuedMessage}</p>
      )}

      <PainSection points={pain} />

      <WeightSection points={weight} bmi={bmi} onAdd={(weightKg) => addMeasurement({ measurementType: "poids", weightKg })} />

      <WaistSection
        points={waist}
        onAdd={(waistCircumferenceCm) =>
          addMeasurement({ measurementType: "tour_de_taille", waistCircumferenceCm })
        }
      />

      {profile?.track_cardio_params ? (
        <>
          <BloodPressureSection
            points={bp}
            onAdd={(systolicMmhg, diastolicMmhg, heartRateBpm) =>
              addMeasurement({
                measurementType: "tension_arterielle",
                systolicMmhg,
                diastolicMmhg,
                heartRateBpm,
              })
            }
          />
          <GlycemiaSection
            points={glycemia}
            onAdd={(glycemiaValue, glycemiaUnit) =>
              addMeasurement({ measurementType: "glycemie", glycemiaValue, glycemiaUnit })
            }
          />
        </>
      ) : (
        <p className="text-sm text-primary-500">
          Le suivi de la tension artérielle et de la glycémie est désactivé. Vous pouvez l'activer dans votre{" "}
          <a href="/profil" className="underline">
            profil
          </a>{" "}
          (§13, §37, §38).
        </p>
      )}
    </div>
  );
}

function PainSection({ points }: { points: PainPoint[] }) {
  const chartPoints = points.flatMap((p) => {
    const entries = [];
    if (p.douleur_avant !== null) {
      entries.push({ label: `${formatDate(p.started_at)} avant`, value: p.douleur_avant });
    }
    if (p.douleur_apres !== null) {
      entries.push({ label: `${formatDate(p.started_at)} après`, value: p.douleur_apres });
    }
    return entries;
  });

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-primary-900">Douleur (§34)</h2>
      <p className="text-sm text-primary-500">
        Échelle 0 (aucune douleur) à 10 (douleur maximale), avant/après chaque séance.
      </p>
      <MiniLineChart points={chartPoints} unit="/10" />
    </section>
  );
}

function WeightSection({
  points,
  bmi,
  onAdd,
}: {
  points: MeasurementRow[];
  bmi: number | null;
  onAdd: (weightKg: number) => void;
}) {
  const [value, setValue] = useState("");
  const chartPoints = points.map((p) => ({ label: formatDate(p.recorded_at), value: Number(p.weight_kg) }));

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-primary-900">Poids (§35)</h2>
      {bmi && <p className="text-sm text-primary-700">IMC actuel : {bmi} (donnée informative, pas un diagnostic)</p>}
      <MiniLineChart points={chartPoints} unit=" kg" />
      <div className="flex gap-2">
        <input
          type="number"
          step="0.1"
          placeholder="Poids (kg)"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="input"
        />
        <Button
          type="button"
          onClick={() => {
            const n = Number(value);
            if (n > 0) {
              onAdd(n);
              setValue("");
            }
          }}
        >
          Ajouter
        </Button>
      </div>
    </section>
  );
}

function WaistSection({ points, onAdd }: { points: MeasurementRow[]; onAdd: (waistCircumferenceCm: number) => void }) {
  const [value, setValue] = useState("");
  const chartPoints = points.map((p) => ({
    label: formatDate(p.recorded_at),
    value: Number(p.waist_circumference_cm),
  }));

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-primary-900">Tour de taille (§36)</h2>
      <MiniLineChart points={chartPoints} unit=" cm" />
      <div className="flex gap-2">
        <input
          type="number"
          step="0.1"
          placeholder="Tour de taille (cm)"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="input"
        />
        <Button
          type="button"
          onClick={() => {
            const n = Number(value);
            if (n > 0) {
              onAdd(n);
              setValue("");
            }
          }}
        >
          Ajouter
        </Button>
      </div>
    </section>
  );
}

function BloodPressureSection({
  points,
  onAdd,
}: {
  points: MeasurementRow[];
  onAdd: (systolicMmhg: number, diastolicMmhg: number, heartRateBpm?: number) => void;
}) {
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const chartPoints = points.map((p) => ({ label: formatDate(p.recorded_at), value: Number(p.systolic_mmhg) }));

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-primary-900">Tension artérielle (§37)</h2>
      <p className="text-sm text-primary-500">
        Ces données saisies par vous-même ne remplacent pas une mesure médicale professionnelle.
      </p>
      <MiniLineChart points={chartPoints} unit=" mmHg (systolique)" />
      <div className="flex flex-wrap gap-2">
        <input
          type="number"
          placeholder="Systolique"
          value={systolic}
          onChange={(e) => setSystolic(e.target.value)}
          className="input"
        />
        <input
          type="number"
          placeholder="Diastolique"
          value={diastolic}
          onChange={(e) => setDiastolic(e.target.value)}
          className="input"
        />
        <input
          type="number"
          placeholder="Fréquence cardiaque (facultatif)"
          value={heartRate}
          onChange={(e) => setHeartRate(e.target.value)}
          className="input"
        />
        <Button
          type="button"
          onClick={() => {
            const s = Number(systolic);
            const d = Number(diastolic);
            const hr = heartRate ? Number(heartRate) : undefined;
            if (s > 0 && d > 0) {
              onAdd(s, d, hr);
              setSystolic("");
              setDiastolic("");
              setHeartRate("");
            }
          }}
        >
          Ajouter
        </Button>
      </div>
    </section>
  );
}

function GlycemiaSection({
  points,
  onAdd,
}: {
  points: MeasurementRow[];
  onAdd: (glycemiaValue: number, glycemiaUnit: "g_l" | "mmol_l") => void;
}) {
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState<"g_l" | "mmol_l">("g_l");
  const chartPoints = points.map((p) => ({ label: formatDate(p.recorded_at), value: Number(p.glycemia_value) }));

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-primary-900">Glycémie (§38)</h2>
      <MiniLineChart points={chartPoints} unit={unit === "g_l" ? " g/L" : " mmol/L"} />
      <div className="flex gap-2">
        <input
          type="number"
          step="0.01"
          placeholder="Valeur"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="input"
        />
        <select value={unit} onChange={(e) => setUnit(e.target.value as "g_l" | "mmol_l")} className="input">
          <option value="g_l">g/L</option>
          <option value="mmol_l">mmol/L</option>
        </select>
        <Button
          type="button"
          onClick={() => {
            const n = Number(value);
            if (n > 0) {
              onAdd(n, unit);
              setValue("");
            }
          }}
        >
          Ajouter
        </Button>
      </div>
    </section>
  );
}
