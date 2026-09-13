"use client";

import { useState, type FormEvent } from "react";
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

const dict = getDictionary();

export function PatientProfileForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [bmiPreview, setBmiPreview] = useState<number | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setFormError(null);

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
      mainPathology: String(formData.get("mainPathology") || "") || undefined,
      objectives: formData.getAll("objectives").map(String),
      painBaseline: num("painBaseline"),
      fatigueBaseline: num("fatigueBaseline"),
      trackCardioParams: formData.get("trackCardioParams") === "on",
      reminderTime: String(formData.get("reminderTime") || "09:00"),
    };

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
      router.push("/evaluation");
    } catch {
      setFormError(dict.common.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <Field label={dict.profile.height} htmlFor="heightCm">
          <input id="heightCm" name="heightCm" type="number" min={0} max={260} className="input" />
        </Field>
        <Field label={dict.profile.weight} htmlFor="weightKg">
          <input id="weightKg" name="weightKg" type="number" min={0} max={400} className="input" />
        </Field>
      </div>

      <Field label={dict.profile.waist} htmlFor="waistCircumferenceCm">
        <input id="waistCircumferenceCm" name="waistCircumferenceCm" type="number" min={0} max={300} className="input" />
      </Field>

      <Field label={dict.profile.activityLevel} htmlFor="physicalActivityLevel">
        <select id="physicalActivityLevel" name="physicalActivityLevel" className="input" defaultValue="">
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

      <Field label={dict.profile.mainPathology} htmlFor="mainPathology" error={errors.mainPathology}>
        <select id="mainPathology" name="mainPathology" className="input" defaultValue="">
          <option value="" disabled>
            Sélectionner…
          </option>
          {PATHOLOGY_CODES.map((code) => (
            <option key={code} value={code}>
              {PATHOLOGY_LABELS_FR[code]}
            </option>
          ))}
        </select>
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium text-primary-900">{dict.profile.objectives}</legend>
        {OBJECTIVE_CODES.map((code) => (
          <label key={code} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="objectives" value={code} />
            {OBJECTIVE_LABELS_FR[code]}
          </label>
        ))}
      </fieldset>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="trackCardioParams" className="mt-1" />
        <span>Je souhaite aussi suivre ma tension artérielle et/ou ma glycémie.</span>
      </label>

      <Field label="Heure de mon rappel quotidien" htmlFor="reminderTime" error={errors.reminderTime}>
        <input id="reminderTime" name="reminderTime" type="time" defaultValue="09:00" className="input" />
      </Field>
      <p className="-mt-2 text-sm text-primary-500">
        L'heure à laquelle vous préférez recevoir le rappel de votre séance du jour, si elle n'est pas encore faite.
      </p>

      {formError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {formError}
        </p>
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
