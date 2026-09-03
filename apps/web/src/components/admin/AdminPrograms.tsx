"use client";

import { useEffect, useState } from "react";
import {
  PATHOLOGY_CODES,
  PATHOLOGY_LABELS_FR,
  PROFILE_LEVELS,
  PROFILE_LEVEL_LABELS_FR,
  canTransitionValidationStatus,
  type MedicalValidationStatus,
} from "@apa/domain";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

interface ProgramRow {
  program_id: string;
  program_code: string;
  pathology: string;
  profile_level: string;
  objective: string | null;
  duration_weeks: number | null;
  frequency_per_week: number | null;
  intensity: string | null;
  aerobic_component: string | null;
  strength_component: string | null;
  mobility_component: string | null;
  balance_component: string | null;
  functional_component: string | null;
  progression_rule: string | null;
  regression_rule: string | null;
  safety_rules: string | null;
  version: string;
  medical_validation_status: MedicalValidationStatus;
  program_exercises: Array<{ exercise_id: string; order_index: number }>;
  program_references: Array<{ reference_id: string }>;
}

interface ExerciseOption {
  exercise_id: string;
  name: string;
}

const STATUS_LABELS_FR: Record<MedicalValidationStatus, string> = {
  draft: "Brouillon",
  pending_validation: "Soumis à relecture",
  validated: "Validé",
};

function emptyForm() {
  return {
    programCode: "",
    pathology: PATHOLOGY_CODES[0],
    profileLevel: PROFILE_LEVELS[0],
    objective: "",
    durationWeeks: "",
    frequencyPerWeek: "",
    intensity: "",
    aerobicComponent: "",
    strengthComponent: "",
    mobilityComponent: "",
    balanceComponent: "",
    functionalComponent: "",
    progressionRule: "",
    regressionRule: "",
    safetyRules: "",
    exerciseIds: [] as string[],
    scientificReferenceIds: "",
  };
}

function toFormValues(p: ProgramRow) {
  return {
    programCode: p.program_code,
    pathology: p.pathology,
    profileLevel: p.profile_level,
    objective: p.objective ?? "",
    durationWeeks: p.duration_weeks?.toString() ?? "",
    frequencyPerWeek: p.frequency_per_week?.toString() ?? "",
    intensity: p.intensity ?? "",
    aerobicComponent: p.aerobic_component ?? "",
    strengthComponent: p.strength_component ?? "",
    mobilityComponent: p.mobility_component ?? "",
    balanceComponent: p.balance_component ?? "",
    functionalComponent: p.functional_component ?? "",
    progressionRule: p.progression_rule ?? "",
    regressionRule: p.regression_rule ?? "",
    safetyRules: p.safety_rules ?? "",
    exerciseIds: [...(p.program_exercises ?? [])].sort((a, b) => a.order_index - b.order_index).map((e) => e.exercise_id),
    scientificReferenceIds: (p.program_references ?? []).map((r) => r.reference_id).join(", "),
  };
}

/** §29-30, §67-68, §42 « gestion programmes ». */
export function AdminPrograms() {
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseOption[]>([]);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reload() {
    const [programsRes, exercisesRes] = await Promise.all([fetch("/api/admin/programs"), fetch("/api/admin/exercises")]);
    const programsData = await programsRes.json();
    const exercisesData = await exercisesRes.json();
    if (programsRes.ok) {
      setPrograms(programsData.programs ?? []);
    } else {
      setError(programsData.message ?? "Une erreur est survenue.");
    }
    if (exercisesRes.ok) {
      setExerciseOptions((exercisesData.exercises ?? []).map((e: any) => ({ exercise_id: e.exercise_id, name: e.name })));
    }
  }

  useEffect(() => {
    reload();
  }, []);

  function startCreate() {
    setForm(emptyForm());
    setEditingId("new");
  }

  function startEdit(p: ProgramRow) {
    setForm(toFormValues(p) as any);
    setEditingId(p.program_id);
  }

  async function submit() {
    setSaving(true);
    setError(null);
    const payload = {
      ...form,
      durationWeeks: form.durationWeeks ? Number(form.durationWeeks) : undefined,
      frequencyPerWeek: form.frequencyPerWeek ? Number(form.frequencyPerWeek) : undefined,
      scientificReferenceIds: form.scientificReferenceIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    const url = editingId === "new" ? "/api/admin/programs" : `/api/admin/programs/${editingId}`;
    const method = editingId === "new" ? "POST" : "PATCH";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? "Une erreur est survenue.");
      setSaving(false);
      return;
    }
    setEditingId(null);
    await reload();
    setSaving(false);
  }

  async function setStatus(id: string, status: MedicalValidationStatus) {
    setBusyId(id);
    const res = await fetch(`/api/admin/programs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ medicalValidationStatus: status }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.message ?? "Une erreur est survenue.");
    await reload();
    setBusyId(null);
  }

  function toggleExercise(id: string) {
    setForm((f) => ({
      ...f,
      exerciseIds: f.exerciseIds.includes(id) ? f.exerciseIds.filter((x) => x !== id) : [...f.exerciseIds, id],
    }));
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {editingId === null && (
        <Button type="button" className="w-auto px-4 py-2" onClick={startCreate}>
          + Nouveau programme
        </Button>
      )}

      {editingId !== null && (
        <div className="flex flex-col gap-3 rounded-xl border border-primary-300 bg-white p-4">
          <Field label="Code programme" htmlFor="pr-code" hint="ex. OA_GENOU_DEBUTANT_01">
            <input id="pr-code" className="w-full rounded border border-primary-300 px-3 py-2" value={form.programCode} onChange={(e) => setForm({ ...form, programCode: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pathologie" htmlFor="pr-pathology">
              <select id="pr-pathology" className="w-full rounded border border-primary-300 px-3 py-2" value={form.pathology} onChange={(e) => setForm({ ...form, pathology: e.target.value as any })}>
                {PATHOLOGY_CODES.map((c) => (
                  <option key={c} value={c}>
                    {PATHOLOGY_LABELS_FR[c]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Niveau" htmlFor="pr-level">
              <select id="pr-level" className="w-full rounded border border-primary-300 px-3 py-2" value={form.profileLevel} onChange={(e) => setForm({ ...form, profileLevel: e.target.value as any })}>
                {PROFILE_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {PROFILE_LEVEL_LABELS_FR[l]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Objectif" htmlFor="pr-objective">
            <input id="pr-objective" className="w-full rounded border border-primary-300 px-3 py-2" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Durée (semaines)" htmlFor="pr-duration" hint="TODO_MEDICAL_VALIDATION si vide">
              <input id="pr-duration" type="number" className="w-full rounded border border-primary-300 px-3 py-2" value={form.durationWeeks} onChange={(e) => setForm({ ...form, durationWeeks: e.target.value })} />
            </Field>
            <Field label="Fréquence/semaine" htmlFor="pr-frequency" hint="TODO_MEDICAL_VALIDATION si vide">
              <input id="pr-frequency" type="number" className="w-full rounded border border-primary-300 px-3 py-2" value={form.frequencyPerWeek} onChange={(e) => setForm({ ...form, frequencyPerWeek: e.target.value })} />
            </Field>
            <Field label="Intensité" htmlFor="pr-intensity" hint="TODO_MEDICAL_VALIDATION si vide">
              <input id="pr-intensity" className="w-full rounded border border-primary-300 px-3 py-2" value={form.intensity} onChange={(e) => setForm({ ...form, intensity: e.target.value })} />
            </Field>
          </div>
          <Field label="Composante aérobique" htmlFor="pr-aerobic">
            <textarea id="pr-aerobic" rows={2} className="w-full rounded border border-primary-300 px-3 py-2" value={form.aerobicComponent} onChange={(e) => setForm({ ...form, aerobicComponent: e.target.value })} />
          </Field>
          <Field label="Composante renforcement" htmlFor="pr-strength">
            <textarea id="pr-strength" rows={2} className="w-full rounded border border-primary-300 px-3 py-2" value={form.strengthComponent} onChange={(e) => setForm({ ...form, strengthComponent: e.target.value })} />
          </Field>
          <Field label="Composante mobilité" htmlFor="pr-mobility">
            <textarea id="pr-mobility" rows={2} className="w-full rounded border border-primary-300 px-3 py-2" value={form.mobilityComponent} onChange={(e) => setForm({ ...form, mobilityComponent: e.target.value })} />
          </Field>
          <Field label="Composante équilibre" htmlFor="pr-balance">
            <textarea id="pr-balance" rows={2} className="w-full rounded border border-primary-300 px-3 py-2" value={form.balanceComponent} onChange={(e) => setForm({ ...form, balanceComponent: e.target.value })} />
          </Field>
          <Field label="Composante fonctionnelle" htmlFor="pr-functional">
            <textarea id="pr-functional" rows={2} className="w-full rounded border border-primary-300 px-3 py-2" value={form.functionalComponent} onChange={(e) => setForm({ ...form, functionalComponent: e.target.value })} />
          </Field>
          <Field label="Règle de progression" htmlFor="pr-progression-rule">
            <textarea id="pr-progression-rule" rows={2} className="w-full rounded border border-primary-300 px-3 py-2" value={form.progressionRule} onChange={(e) => setForm({ ...form, progressionRule: e.target.value })} />
          </Field>
          <Field label="Règle de régression" htmlFor="pr-regression-rule">
            <textarea id="pr-regression-rule" rows={2} className="w-full rounded border border-primary-300 px-3 py-2" value={form.regressionRule} onChange={(e) => setForm({ ...form, regressionRule: e.target.value })} />
          </Field>
          <Field label="Règles de sécurité" htmlFor="pr-safety">
            <textarea id="pr-safety" rows={2} className="w-full rounded border border-primary-300 px-3 py-2" value={form.safetyRules} onChange={(e) => setForm({ ...form, safetyRules: e.target.value })} />
          </Field>

          <fieldset>
            <legend className="text-sm font-medium text-primary-900">Exercices du programme</legend>
            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto pt-1 text-sm">
              {exerciseOptions.length === 0 && <p className="text-primary-500">Aucun exercice créé pour l'instant (voir l'écran Exercices).</p>}
              {exerciseOptions.map((opt) => (
                <label key={opt.exercise_id} className="flex items-center gap-2">
                  <input type="checkbox" checked={form.exerciseIds.includes(opt.exercise_id)} onChange={() => toggleExercise(opt.exercise_id)} />
                  {opt.name}
                </label>
              ))}
            </div>
          </fieldset>

          <Field label="Références scientifiques" htmlFor="pr-refs" hint="Identifiants séparés par des virgules">
            <input id="pr-refs" className="w-full rounded border border-primary-300 px-3 py-2" value={form.scientificReferenceIds} onChange={(e) => setForm({ ...form, scientificReferenceIds: e.target.value })} />
          </Field>

          <div className="flex gap-2">
            <Button type="button" className="w-auto px-4 py-2" disabled={saving} onClick={submit}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
            <Button type="button" variant="secondary" className="w-auto px-4 py-2" onClick={() => setEditingId(null)}>
              Annuler
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {programs.map((p) => (
          <div key={p.program_id} className="rounded-xl border border-primary-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-primary-900">{p.program_code}</p>
                <p className="text-xs text-primary-500">
                  {PATHOLOGY_LABELS_FR[p.pathology as keyof typeof PATHOLOGY_LABELS_FR] ?? p.pathology} · {p.version} · {STATUS_LABELS_FR[p.medical_validation_status]}
                </p>
              </div>
              <Button type="button" variant="secondary" className="w-auto px-3 py-1 text-xs" onClick={() => startEdit(p)}>
                Modifier
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["draft", "pending_validation", "validated"] as MedicalValidationStatus[])
                .filter((target) => target !== p.medical_validation_status && canTransitionValidationStatus(p.medical_validation_status, target))
                .map((target) => (
                  <Button
                    key={target}
                    type="button"
                    variant="secondary"
                    className="w-auto px-3 py-1 text-xs"
                    disabled={busyId === p.program_id}
                    onClick={() => setStatus(p.program_id, target)}
                  >
                    {target === "validated" ? "Valider" : target === "pending_validation" ? "Soumettre à relecture" : "Repasser en brouillon"}
                  </Button>
                ))}
            </div>
          </div>
        ))}
        {programs.length === 0 && <p className="text-sm text-primary-500">Aucun programme.</p>}
      </div>
    </div>
  );
}
