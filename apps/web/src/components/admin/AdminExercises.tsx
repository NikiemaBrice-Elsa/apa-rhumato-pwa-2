"use client";

import { useEffect, useState } from "react";
import {
  EXERCISE_CATEGORIES,
  EXERCISE_CATEGORY_LABELS_FR,
  EXERCISE_PHASES,
  EXERCISE_PHASE_LABELS_FR,
  EQUIPMENT_ITEMS,
  EQUIPMENT_LABELS_FR,
  PATHOLOGY_CODES,
  PATHOLOGY_LABELS_FR,
  OBJECTIVE_CODES,
  OBJECTIVE_LABELS_FR,
  canTransitionValidationStatus,
  type MedicalValidationStatus,
} from "@apa/domain";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

interface ExerciseRow {
  exercise_id: string;
  name: string;
  short_description: string;
  detailed_description: string | null;
  category: string;
  phase: string | null;
  difficulty: string | null;
  starting_position: string | null;
  execution_steps: string | null;
  breathing_instruction: string | null;
  duration_seconds: number | null;
  repetitions: number | null;
  sets: number | null;
  rest_time_seconds: number | null;
  frequency: string | null;
  intensity: string | null;
  progression: string | null;
  regression: string | null;
  contraindications: string | null;
  precautions: string | null;
  stop_criteria: string | null;
  target_muscles: string | null;
  equipment_required: string[];
  video_url: string | null;
  audio_url: string | null;
  thumbnail_url: string | null;
  medical_validation_status: MedicalValidationStatus;
  exercise_pathologies: Array<{ pathology_code: string }>;
  exercise_objectives: Array<{ objective_code: string }>;
  exercise_references: Array<{ reference_id: string }>;
}

const STATUS_LABELS_FR: Record<MedicalValidationStatus, string> = {
  draft: "Brouillon",
  pending_validation: "Soumis à relecture",
  validated: "Validé",
};

function emptyForm() {
  return {
    name: "",
    shortDescription: "",
    detailedDescription: "",
    category: EXERCISE_CATEGORIES[0],
    phase: "" as string,
    difficulty: "",
    startingPosition: "",
    executionSteps: "",
    breathingInstruction: "",
    durationSeconds: "",
    repetitions: "",
    sets: "",
    restTimeSeconds: "",
    frequency: "",
    intensity: "",
    progression: "",
    regression: "",
    contraindications: "",
    precautions: "",
    stopCriteria: "",
    targetMuscles: "",
    equipmentRequired: [] as string[],
    videoUrl: "",
    audioUrl: "",
    thumbnailUrl: "",
    pathologies: [] as string[],
    objectives: [] as string[],
    scientificReferenceIds: "",
  };
}

function toFormValues(e: ExerciseRow) {
  return {
    name: e.name,
    shortDescription: e.short_description,
    detailedDescription: e.detailed_description ?? "",
    category: e.category,
    phase: e.phase ?? "",
    difficulty: e.difficulty ?? "",
    startingPosition: e.starting_position ?? "",
    executionSteps: e.execution_steps ?? "",
    breathingInstruction: e.breathing_instruction ?? "",
    durationSeconds: e.duration_seconds?.toString() ?? "",
    repetitions: e.repetitions?.toString() ?? "",
    sets: e.sets?.toString() ?? "",
    restTimeSeconds: e.rest_time_seconds?.toString() ?? "",
    frequency: e.frequency ?? "",
    intensity: e.intensity ?? "",
    progression: e.progression ?? "",
    regression: e.regression ?? "",
    contraindications: e.contraindications ?? "",
    precautions: e.precautions ?? "",
    stopCriteria: e.stop_criteria ?? "",
    targetMuscles: e.target_muscles ?? "",
    equipmentRequired: e.equipment_required ?? [],
    videoUrl: e.video_url ?? "",
    audioUrl: e.audio_url ?? "",
    thumbnailUrl: e.thumbnail_url ?? "",
    pathologies: (e.exercise_pathologies ?? []).map((p) => p.pathology_code),
    objectives: (e.exercise_objectives ?? []).map((o) => o.objective_code),
    scientificReferenceIds: (e.exercise_references ?? []).map((r) => r.reference_id).join(", "),
  };
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** §25-27, §42 « gestion exercices ». */
export function AdminExercises() {
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reload() {
    const res = await fetch("/api/admin/exercises");
    const data = await res.json();
    if (res.ok) {
      setExercises(data.exercises ?? []);
    } else {
      setError(data.message ?? "Une erreur est survenue.");
    }
  }

  useEffect(() => {
    reload();
  }, []);

  function startCreate() {
    setForm(emptyForm());
    setEditingId("new");
  }

  function startEdit(e: ExerciseRow) {
    setForm(toFormValues(e) as any);
    setEditingId(e.exercise_id);
  }

  async function submit() {
    setSaving(true);
    setError(null);
    const payload = {
      ...form,
      // "" ("non classé") doit devenir undefined, pas une valeur d'enum invalide.
      phase: form.phase || undefined,
      durationSeconds: form.durationSeconds ? Number(form.durationSeconds) : undefined,
      repetitions: form.repetitions ? Number(form.repetitions) : undefined,
      sets: form.sets ? Number(form.sets) : undefined,
      restTimeSeconds: form.restTimeSeconds ? Number(form.restTimeSeconds) : undefined,
      scientificReferenceIds: form.scientificReferenceIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    const url = editingId === "new" ? "/api/admin/exercises" : `/api/admin/exercises/${editingId}`;
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
    const res = await fetch(`/api/admin/exercises/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ medicalValidationStatus: status }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.message ?? "Une erreur est survenue.");
    await reload();
    setBusyId(null);
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
          + Nouvel exercice
        </Button>
      )}

      {editingId !== null && (
        <div className="flex flex-col gap-3 rounded-xl border border-primary-300 bg-white p-4">
          <Field label="Nom" htmlFor="ex-name">
            <input id="ex-name" className="w-full rounded border border-primary-300 px-3 py-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Description courte" htmlFor="ex-short">
            <input id="ex-short" className="w-full rounded border border-primary-300 px-3 py-2" value={form.shortDescription} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Catégorie" htmlFor="ex-category">
              <select id="ex-category" className="w-full rounded border border-primary-300 px-3 py-2" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as any })}>
                {EXERCISE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {EXERCISE_CATEGORY_LABELS_FR[c]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Phase de séance (§28, réf. B8)" htmlFor="ex-phase" hint="Laisser « non classé » tant que ce n'est pas confirmé — jamais deviné.">
              <select id="ex-phase" className="w-full rounded border border-primary-300 px-3 py-2" value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })}>
                <option value="">— non classé —</option>
                {EXERCISE_PHASES.map((p) => (
                  <option key={p} value={p}>
                    {EXERCISE_PHASE_LABELS_FR[p]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-primary-900">Pathologies concernées</legend>
            <div className="flex flex-wrap gap-3 pt-1 text-sm">
              {PATHOLOGY_CODES.map((code) => (
                <label key={code} className="flex items-center gap-1">
                  <input type="checkbox" checked={form.pathologies.includes(code)} onChange={() => setForm({ ...form, pathologies: toggle(form.pathologies, code) })} />
                  {PATHOLOGY_LABELS_FR[code]}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-primary-900">Objectifs</legend>
            <div className="flex flex-wrap gap-3 pt-1 text-sm">
              {OBJECTIVE_CODES.map((code) => (
                <label key={code} className="flex items-center gap-1">
                  <input type="checkbox" checked={form.objectives.includes(code)} onChange={() => setForm({ ...form, objectives: toggle(form.objectives, code) })} />
                  {OBJECTIVE_LABELS_FR[code]}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-primary-900">Matériel nécessaire</legend>
            <div className="flex flex-wrap gap-3 pt-1 text-sm">
              {EQUIPMENT_ITEMS.map((item) => (
                <label key={item} className="flex items-center gap-1">
                  <input type="checkbox" checked={form.equipmentRequired.includes(item)} onChange={() => setForm({ ...form, equipmentRequired: toggle(form.equipmentRequired, item) })} />
                  {EQUIPMENT_LABELS_FR[item]}
                </label>
              ))}
            </div>
          </fieldset>

          <Field label="Description détaillée" htmlFor="ex-detailed">
            <textarea id="ex-detailed" rows={2} className="w-full rounded border border-primary-300 px-3 py-2" value={form.detailedDescription} onChange={(e) => setForm({ ...form, detailedDescription: e.target.value })} />
          </Field>
          <Field label="Position de départ" htmlFor="ex-position">
            <textarea id="ex-position" rows={2} className="w-full rounded border border-primary-300 px-3 py-2" value={form.startingPosition} onChange={(e) => setForm({ ...form, startingPosition: e.target.value })} />
          </Field>
          <Field label="Étapes d'exécution" htmlFor="ex-steps">
            <textarea id="ex-steps" rows={3} className="w-full rounded border border-primary-300 px-3 py-2" value={form.executionSteps} onChange={(e) => setForm({ ...form, executionSteps: e.target.value })} />
          </Field>
          <Field label="Consigne de respiration" htmlFor="ex-breathing">
            <input id="ex-breathing" className="w-full rounded border border-primary-300 px-3 py-2" value={form.breathingInstruction} onChange={(e) => setForm({ ...form, breathingInstruction: e.target.value })} />
          </Field>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Durée (s)" htmlFor="ex-duration">
              <input id="ex-duration" type="number" className="w-full rounded border border-primary-300 px-3 py-2" value={form.durationSeconds} onChange={(e) => setForm({ ...form, durationSeconds: e.target.value })} />
            </Field>
            <Field label="Répétitions" htmlFor="ex-reps">
              <input id="ex-reps" type="number" className="w-full rounded border border-primary-300 px-3 py-2" value={form.repetitions} onChange={(e) => setForm({ ...form, repetitions: e.target.value })} />
            </Field>
            <Field label="Séries" htmlFor="ex-sets">
              <input id="ex-sets" type="number" className="w-full rounded border border-primary-300 px-3 py-2" value={form.sets} onChange={(e) => setForm({ ...form, sets: e.target.value })} />
            </Field>
            <Field label="Repos (s)" htmlFor="ex-rest">
              <input id="ex-rest" type="number" className="w-full rounded border border-primary-300 px-3 py-2" value={form.restTimeSeconds} onChange={(e) => setForm({ ...form, restTimeSeconds: e.target.value })} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Fréquence" htmlFor="ex-frequency" hint="TODO_MEDICAL_VALIDATION si non défini">
              <input id="ex-frequency" className="w-full rounded border border-primary-300 px-3 py-2" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} />
            </Field>
            <Field label="Intensité" htmlFor="ex-intensity" hint="TODO_MEDICAL_VALIDATION si non défini">
              <input id="ex-intensity" className="w-full rounded border border-primary-300 px-3 py-2" value={form.intensity} onChange={(e) => setForm({ ...form, intensity: e.target.value })} />
            </Field>
          </div>

          <Field label="Progression" htmlFor="ex-progression">
            <textarea id="ex-progression" rows={2} className="w-full rounded border border-primary-300 px-3 py-2" value={form.progression} onChange={(e) => setForm({ ...form, progression: e.target.value })} />
          </Field>
          <Field label="Régression" htmlFor="ex-regression">
            <textarea id="ex-regression" rows={2} className="w-full rounded border border-primary-300 px-3 py-2" value={form.regression} onChange={(e) => setForm({ ...form, regression: e.target.value })} />
          </Field>
          <Field label="Contre-indications" htmlFor="ex-contra">
            <textarea id="ex-contra" rows={2} className="w-full rounded border border-primary-300 px-3 py-2" value={form.contraindications} onChange={(e) => setForm({ ...form, contraindications: e.target.value })} />
          </Field>
          <Field label="Précautions" htmlFor="ex-precautions">
            <textarea id="ex-precautions" rows={2} className="w-full rounded border border-primary-300 px-3 py-2" value={form.precautions} onChange={(e) => setForm({ ...form, precautions: e.target.value })} />
          </Field>
          <Field label="Critères d'arrêt" htmlFor="ex-stop">
            <textarea id="ex-stop" rows={2} className="w-full rounded border border-primary-300 px-3 py-2" value={form.stopCriteria} onChange={(e) => setForm({ ...form, stopCriteria: e.target.value })} />
          </Field>
          <Field label="Muscles ciblés" htmlFor="ex-muscles">
            <input id="ex-muscles" className="w-full rounded border border-primary-300 px-3 py-2" value={form.targetMuscles} onChange={(e) => setForm({ ...form, targetMuscles: e.target.value })} />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="URL vidéo" htmlFor="ex-video">
              <input id="ex-video" className="w-full rounded border border-primary-300 px-3 py-2" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} />
            </Field>
            <Field label="URL audio" htmlFor="ex-audio">
              <input id="ex-audio" className="w-full rounded border border-primary-300 px-3 py-2" value={form.audioUrl} onChange={(e) => setForm({ ...form, audioUrl: e.target.value })} />
            </Field>
            <Field label="URL vignette" htmlFor="ex-thumb">
              <input id="ex-thumb" className="w-full rounded border border-primary-300 px-3 py-2" value={form.thumbnailUrl} onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })} />
            </Field>
          </div>

          <Field label="Références scientifiques" htmlFor="ex-refs" hint="Identifiants séparés par des virgules (voir l'écran Références)">
            <input id="ex-refs" className="w-full rounded border border-primary-300 px-3 py-2" value={form.scientificReferenceIds} onChange={(e) => setForm({ ...form, scientificReferenceIds: e.target.value })} />
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
        {exercises.map((e) => (
          <div key={e.exercise_id} className="rounded-xl border border-primary-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-primary-900">{e.name}</p>
                <p className="text-xs text-primary-500">
                  {EXERCISE_CATEGORY_LABELS_FR[e.category as keyof typeof EXERCISE_CATEGORY_LABELS_FR] ?? e.category} ·{" "}
                  {e.phase ? EXERCISE_PHASE_LABELS_FR[e.phase as keyof typeof EXERCISE_PHASE_LABELS_FR] ?? e.phase : "non classé"} ·{" "}
                  {STATUS_LABELS_FR[e.medical_validation_status]}
                </p>
              </div>
              <Button type="button" variant="secondary" className="w-auto px-3 py-1 text-xs" onClick={() => startEdit(e)}>
                Modifier
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["draft", "pending_validation", "validated"] as MedicalValidationStatus[])
                .filter((target) => target !== e.medical_validation_status && canTransitionValidationStatus(e.medical_validation_status, target))
                .map((target) => (
                  <Button
                    key={target}
                    type="button"
                    variant="secondary"
                    className="w-auto px-3 py-1 text-xs"
                    disabled={busyId === e.exercise_id}
                    onClick={() => setStatus(e.exercise_id, target)}
                  >
                    {target === "validated" ? "Valider" : target === "pending_validation" ? "Soumettre à relecture" : "Repasser en brouillon"}
                  </Button>
                ))}
            </div>
          </div>
        ))}
        {exercises.length === 0 && <p className="text-sm text-primary-500">Aucun exercice.</p>}
      </div>
    </div>
  );
}
