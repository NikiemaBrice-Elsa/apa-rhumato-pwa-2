"use client";

import { useEffect, useState } from "react";
import { PATHOLOGY_CODES, PATHOLOGY_LABELS_FR } from "@apa/domain";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

const SEVERITIES = ["info", "warning", "critical"] as const;
const ACTIONS = ["allow_program", "require_precaution", "medical_referral", "adjust_progression", "stop_program"] as const;
const PROGRESSION_DECISIONS = ["", "progress", "maintain", "reduce", "suspend"] as const;

interface RuleRow {
  rule_id: string;
  pathology: string;
  condition: unknown;
  severity: (typeof SEVERITIES)[number];
  action: (typeof ACTIONS)[number];
  message: string;
  reference_id: string | null;
  program_id: string | null;
  progression_decision: string | null;
  active: boolean;
  version: string;
  validated_by: string | null;
  validated_date: string | null;
}

function emptyForm() {
  return {
    ruleId: "",
    pathology: PATHOLOGY_CODES[0],
    condition: '{\n  "field": "",\n  "operator": "equals",\n  "value": true\n}',
    severity: SEVERITIES[0] as (typeof SEVERITIES)[number],
    action: ACTIONS[0] as (typeof ACTIONS)[number],
    message: "",
    referenceId: "",
    programId: "",
    progressionDecision: "" as (typeof PROGRESSION_DECISIONS)[number],
    validatedBy: "",
    validatedDate: "",
  };
}

function toFormValues(r: RuleRow) {
  return {
    ruleId: r.rule_id,
    pathology: r.pathology,
    condition: JSON.stringify(r.condition, null, 2),
    severity: r.severity,
    action: r.action,
    message: r.message,
    referenceId: r.reference_id ?? "",
    programId: r.program_id ?? "",
    progressionDecision: (r.progression_decision ?? "") as (typeof PROGRESSION_DECISIONS)[number],
    validatedBy: r.validated_by ?? "",
    validatedDate: r.validated_date ?? "",
  };
}

/** §30, §31, §42, §43 « gestion règles médicales ». */
export function AdminClinicalRules() {
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reload() {
    const res = await fetch("/api/admin/clinical-rules");
    const data = await res.json();
    if (res.ok) {
      setRules(data.rules ?? []);
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

  function startEdit(r: RuleRow) {
    setForm(toFormValues(r) as any);
    setEditingId(r.rule_id);
  }

  async function submit() {
    setSaving(true);
    setError(null);

    let condition: unknown;
    try {
      condition = JSON.parse(form.condition);
    } catch {
      setError("La condition n'est pas un JSON valide.");
      setSaving(false);
      return;
    }

    // `progressionDecision` est un enum côté schéma (packages/domain) : une
    // chaîne vide ("aucune décision") doit devenir `undefined`, pas une
    // valeur d'enum invalide (le cas par défaut/vide reste possible pour
    // toute règle qui n'est pas `adjust_progression`).
    const payload = { ...form, condition, progressionDecision: form.progressionDecision || undefined };
    const url = editingId === "new" ? "/api/admin/clinical-rules" : `/api/admin/clinical-rules/${editingId}`;
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

  async function setActive(ruleId: string, active: boolean) {
    setBusyId(ruleId);
    const res = await fetch(`/api/admin/clinical-rules/${ruleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
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
          + Nouvelle règle
        </Button>
      )}

      {editingId !== null && (
        <div className="flex flex-col gap-3 rounded-xl border border-primary-300 bg-white p-4">
          <Field label="Identifiant de règle" htmlFor="rule-id" hint={editingId !== "new" ? "Non modifiable après création." : "ex. OA_GENOU_SEPTIC_001"}>
            <input
              id="rule-id"
              disabled={editingId !== "new"}
              className="w-full rounded border border-primary-300 px-3 py-2 disabled:bg-primary-50"
              value={form.ruleId}
              onChange={(e) => setForm({ ...form, ruleId: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Pathologie" htmlFor="rule-pathology">
              <select id="rule-pathology" className="w-full rounded border border-primary-300 px-3 py-2" value={form.pathology} onChange={(e) => setForm({ ...form, pathology: e.target.value as any })}>
                {PATHOLOGY_CODES.map((c) => (
                  <option key={c} value={c}>
                    {PATHOLOGY_LABELS_FR[c]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sévérité" htmlFor="rule-severity">
              <select id="rule-severity" className="w-full rounded border border-primary-300 px-3 py-2" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as any })}>
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Action" htmlFor="rule-action">
              <select id="rule-action" className="w-full rounded border border-primary-300 px-3 py-2" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value as any })}>
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Condition (JSON)" htmlFor="rule-condition" hint='Ex. {"field":"age","operator":"gte","value":65} ou {"all":[...]}/{"any":[...]}'>
            <textarea
              id="rule-condition"
              rows={6}
              className="w-full rounded border border-primary-300 px-3 py-2 font-mono text-sm"
              value={form.condition}
              onChange={(e) => setForm({ ...form, condition: e.target.value })}
            />
          </Field>
          <Field label="Message" htmlFor="rule-message">
            <textarea id="rule-message" rows={2} className="w-full rounded border border-primary-300 px-3 py-2" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ID référence scientifique" htmlFor="rule-ref">
              <input id="rule-ref" className="w-full rounded border border-primary-300 px-3 py-2" value={form.referenceId} onChange={(e) => setForm({ ...form, referenceId: e.target.value })} />
            </Field>
            <Field label="ID programme (si allow_program)" htmlFor="rule-program">
              <input id="rule-program" className="w-full rounded border border-primary-300 px-3 py-2" value={form.programId} onChange={(e) => setForm({ ...form, programId: e.target.value })} />
            </Field>
            <Field label="Décision de progression (si adjust_progression)" htmlFor="rule-progression-decision">
              <select
                id="rule-progression-decision"
                className="w-full rounded border border-primary-300 px-3 py-2"
                value={form.progressionDecision}
                onChange={(e) => setForm({ ...form, progressionDecision: e.target.value as (typeof PROGRESSION_DECISIONS)[number] })}
              >
                {PROGRESSION_DECISIONS.map((d) => (
                  <option key={d} value={d}>
                    {d === "" ? "— aucune —" : d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Validé par" htmlFor="rule-validated-by">
              <input id="rule-validated-by" className="w-full rounded border border-primary-300 px-3 py-2" value={form.validatedBy} onChange={(e) => setForm({ ...form, validatedBy: e.target.value })} />
            </Field>
            <Field label="Date de validation" htmlFor="rule-validated-date">
              <input id="rule-validated-date" type="date" className="w-full rounded border border-primary-300 px-3 py-2" value={form.validatedDate} onChange={(e) => setForm({ ...form, validatedDate: e.target.value })} />
            </Field>
          </div>

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
        {rules.map((r) => (
          <div key={r.rule_id} className="rounded-xl border border-primary-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-sm font-medium text-primary-900">{r.rule_id}</p>
                <p className="text-xs text-primary-500">
                  {PATHOLOGY_LABELS_FR[r.pathology as keyof typeof PATHOLOGY_LABELS_FR] ?? r.pathology} · {r.action}
                  {r.action === "adjust_progression" && (r.progression_decision ? ` (${r.progression_decision})` : " (aucune décision — ignorée)")} · {r.severity} · {r.version} ·{" "}
                  <span className={r.active ? "font-medium text-primary-700" : "font-medium text-red-600"}>{r.active ? "Active" : "Inactive"}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" className="w-auto px-3 py-1 text-xs" onClick={() => startEdit(r)}>
                  Modifier
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-auto px-3 py-1 text-xs"
                  disabled={busyId === r.rule_id}
                  onClick={() => setActive(r.rule_id, !r.active)}
                >
                  {r.active ? "Désactiver" : "Activer"}
                </Button>
              </div>
            </div>
            <p className="mt-1 text-sm text-primary-700">{r.message}</p>
          </div>
        ))}
        {rules.length === 0 && <p className="text-sm text-primary-500">Aucune règle enregistrée.</p>}
      </div>
    </div>
  );
}
