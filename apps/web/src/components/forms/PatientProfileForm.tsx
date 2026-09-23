"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  PATHOLOGY_CODES,
  PATHOLOGY_LABELS_FR,
  OBJECTIVE_CODES,
  OBJECTIVE_LABELS_FR,
  ACTIVITY_LEVELS,
} from "@apa/domain";
import { getDictionary } from "@/lib/i18n";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { enqueueOperation } from "@/lib/offlineStorage";

const dict = getDictionary();

/** Forme brute renvoyée par `GET /api/profile` (colonnes `patient_profiles`). */
type ExistingProfile = {
  height_cm: number | null;
  weight_kg: number | null;
  waist_circumference_cm: number | null;
  physical_activity_level: number | null;
  // Sprint 32 (23/09/2026) : tableau depuis le remplacement de
  // `main_pathology` (une seule pathologie) par `main_pathologies`
  // (plusieurs) — instruction directe de Dr Nikiema.
  main_pathologies: string[] | null;
  objectives: string[] | null;
  track_cardio_params: boolean | null;
  reminder_time: string | null;
} | null;

export function PatientProfileForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [bmiPreview, setBmiPreview] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sprint 24 : cette page sert à la fois pour l'inscription (première visite,
  // aucun profil en base) et pour une modification ultérieure depuis le
  // tableau de bord ("Mon profil"). Comme `PUT /api/profile` remplace tout le
  // profil (upsert complet, pas une fusion partielle — voir
  // apps/web/src/app/api/profile/route.ts), un formulaire vierge resterait
  // dangereux à réutiliser : soumettre un profil déjà rempli sans le
  // pré-remplir effacerait silencieusement taille/poids/pathologie/objectifs
  // déjà enregistrés. On charge donc le profil existant avant d'afficher le
  // formulaire, et on ne redirige vers /evaluation (parcours d'inscription)
  // que s'il n'existait aucun profil avant cette visite.
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [existingProfile, setExistingProfile] = useState<ExistingProfile>(null);
  const [hadProfile, setHadProfile] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadExistingProfile() {
      try {
        const res = await fetch("/api/profile");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.profile) {
            setExistingProfile(data.profile);
            setHadProfile(true);
          }
        }
      } catch {
        // Hors connexion ou erreur réseau : le formulaire reste vierge,
        // comme avant Sprint 24 (dégradation sans bloquer l'inscription).
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    }
    loadExistingProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setFormError(null);
    setSuccessMessage(null);

    const formData = new FormData(event.currentTarget);
    const num = (name: string) => {
      const v = formData.get(name);
      return v ? Number(v) : undefined;
    };

    const payload = {
      heightCm: num("heightCm"),
      weightKg: num("weightKg"),
      waistCircumferenceCm: num("waistCircumferenceCm"),
      physicalActivityLevel: num("physicalActivityLevel"),
      // Sprint 32 (23/09/2026, instruction directe de Dr Nikiema) : choix
      // multiple désormais possible — même technique que `objectives`
      // juste en dessous (cases à cocher, `formData.getAll`).
      mainPathologies: formData.getAll("mainPathologies").map(String),
      objectives: formData.getAll("objectives").map(String),
      painBaseline: num("painBaseline"),
      fatigueBaseline: num("fatigueBaseline"),
      trackCardioParams: formData.get("trackCardioParams") === "on",
      reminderTime: String(formData.get("reminderTime") || "09:00"),
    };

    // Sprint 24 (14/09/2026, Priorité 5 de Feuille_de_route_prioritaire_20260912.docx) :
    // avant ce correctif, une modification de profil hors connexion échouait
    // simplement (§54 demande explicitement une mise en file, pas un échec
    // silencieux) — contrairement à la séance (SessionFlow.tsx), qui utilise
    // déjà offlineQueue.ts depuis le Sprint 12. La file elle-même était déjà
    // générique par entité ; seul ce formulaire ne l'utilisait pas encore.
    // `PUT /api/profile` étant un upsert complet (jamais une fusion), une
    // nouvelle soumission avant synchronisation remplace simplement la
    // précédente dans la file — comportement correct pour ce type d'écriture,
    // aucune logique de dépendance (`dependsOnOperationId`) n'est nécessaire.
    function queueProfileUpdate() {
      enqueueOperation({ id: crypto.randomUUID(), entityType: "profile", method: "PUT", url: "/api/profile", body: payload });
      if (hadProfile) {
        setSuccessMessage("Hors connexion : vos informations seront synchronisées dès que la connexion sera rétablie.");
      } else {
        // Parcours d'inscription (§10) : ne jamais bloquer sur une coupure
        // réseau. AssessmentFlow.tsx ne dépend pas d'un profil déjà persisté
        // en base (il lit sa propre pathologie choisie par l'utilisateur), la
        // suite du parcours peut donc continuer normalement.
        router.push("/evaluation");
      }
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      queueProfileUpdate();
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.fieldErrors) setErrors(data.fieldErrors);
        setFormError(data.message ?? dict.common.genericError);
        return;
      }

      setBmiPreview(data.bmi ?? null);
      if (hadProfile) {
        // Modification depuis le tableau de bord : on reste sur place, on ne
        // relance pas le parcours d'inscription.
        setSuccessMessage("Vos informations ont été mises à jour.");
      } else {
        router.push("/evaluation");
      }
    } catch {
      // Échec réseau en cours de requête (pas seulement détecté à l'avance) :
      // même discipline que SessionFlow.tsx, on ne perd pas la saisie.
      queueProfileUpdate();
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingProfile) {
    return <p className="text-primary-500">{dict.common.loading}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <Field label={dict.profile.height} htmlFor="heightCm">
          <input
            id="heightCm"
            name="heightCm"
            type="number"
            min={0}
            max={260}
            defaultValue={existingProfile?.height_cm ?? undefined}
            className="input"
          />
        </Field>
        <Field label={dict.profile.weight} htmlFor="weightKg">
          <input
            id="weightKg"
            name="weightKg"
            type="number"
            min={0}
            max={400}
            defaultValue={existingProfile?.weight_kg ?? undefined}
            className="input"
          />
        </Field>
      </div>

      <Field label={dict.profile.waist} htmlFor="waistCircumferenceCm">
        <input
          id="waistCircumferenceCm"
          name="waistCircumferenceCm"
          type="number"
          min={0}
          max={300}
          defaultValue={existingProfile?.waist_circumference_cm ?? undefined}
          className="input"
        />
      </Field>

      <Field label={dict.profile.activityLevel} htmlFor="physicalActivityLevel">
        <select
          id="physicalActivityLevel"
          name="physicalActivityLevel"
          className="input"
          defaultValue={existingProfile?.physical_activity_level != null ? String(existingProfile.physical_activity_level) : ""}
        >
          <option value="" disabled>
            {dict.common.optional}
          </option>
          {ACTIVITY_LEVELS.map((level) => (
            <option key={level.value} value={level.value}>
              {level.label}
            </option>
          ))}
        </select>
      </Field>

      {/* Sprint 32 (23/09/2026, instruction directe de Dr Nikiema : « dans le
          profil on ne peut pas choisir plusieurs pathologies actuellement.
          Il faut modifier pour qu'un choix multiple soit possible ») —
          remplace le menu déroulant à choix unique par des cases à cocher,
          même schéma que le fieldset « objectifs » juste en dessous. */}
      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium text-primary-900">{dict.profile.mainPathology}</legend>
        {PATHOLOGY_CODES.map((code) => (
          <label key={code} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="mainPathologies"
              value={code}
              defaultChecked={existingProfile?.main_pathologies?.includes(code) ?? false}
            />
            {PATHOLOGY_LABELS_FR[code]}
          </label>
        ))}
        {errors.mainPathologies && (
          <p role="alert" className="text-sm text-red-700">
            {errors.mainPathologies}
          </p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium text-primary-900">{dict.profile.objectives}</legend>
        {OBJECTIVE_CODES.map((code) => (
          <label key={code} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="objectives"
              value={code}
              defaultChecked={existingProfile?.objectives?.includes(code) ?? false}
            />
            {OBJECTIVE_LABELS_FR[code]}
          </label>
        ))}
      </fieldset>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="trackCardioParams"
          defaultChecked={existingProfile?.track_cardio_params ?? false}
          className="mt-1"
        />
        <span>Je souhaite aussi suivre ma tension artérielle et/ou ma glycémie.</span>
      </label>

      <Field label="Heure de mon rappel quotidien" htmlFor="reminderTime" error={errors.reminderTime}>
        <input
          id="reminderTime"
          name="reminderTime"
          type="time"
          defaultValue={existingProfile?.reminder_time ?? "09:00"}
          className="input"
        />
      </Field>
      <p className="-mt-2 text-sm text-primary-500">
        L'heure à laquelle vous préférez recevoir le rappel de votre séance du jour, si elle n'est pas encore faite.
      </p>

      {formError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {formError}
        </p>
      )}

      {successMessage && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{successMessage}</p>
      )}

      <p className="text-sm text-primary-500">{dict.profile.disclaimer}</p>

      <Button type="submit" disabled={submitting}>
        {submitting ? dict.common.loading : dict.profile.save}
      </Button>

      {bmiPreview !== null && (
        <p className="text-sm text-primary-700">
          {dict.profile.bmi} : {bmiPreview}
        </p>
      )}
    </form>
  );
}
