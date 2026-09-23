"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PATHOLOGY_CODES,
  PATHOLOGY_LABELS_FR,
  SCREENING_ITEMS_BY_PATHOLOGY,
  SAFETY_STATUS_LABELS_FR,
  type PathologyCode,
  type SafetyStatus,
} from "@apa/domain";
import { Button } from "@/components/ui/Button";
import { ExerciseTypePreview } from "@/components/exercises/ExerciseTypePreview";
import { hasSeenExerciseTypeEducation, markExerciseTypeEducationSeen } from "@/lib/exerciseTypeEducation";

type Step = "pathology" | "screening" | "result" | "education";

/**
 * Un programme est considéré « attribué » (donc pertinent d'afficher
 * l'écran pédagogique « quels exercices pour quelle pathologie ») pour les
 * statuts vert et orange, seuls statuts où le patient obtient effectivement
 * un programme (voir `ruleImplemented`/messages ci-dessous et le moteur de
 * règles, packages/rules-engine) — pas pour rouge ni pending_validation.
 */
function programWasAssigned(status: SafetyStatus): boolean {
  return status === "vert" || status === "orange";
}

type ResponseValue = boolean | number | string;

interface AssessmentResult {
  status: SafetyStatus;
  message: string;
  triggeredFlags: string[];
  ruleImplemented: boolean;
}

const STATUS_STYLES: Record<SafetyStatus, string> = {
  vert: "bg-green-50 border-green-300 text-green-900",
  orange: "bg-orange-50 border-orange-300 text-orange-900",
  rouge: "bg-red-50 border-red-300 text-red-900",
  pending_validation: "bg-primary-50 border-primary-300 text-primary-900",
};

export function AssessmentFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("pathology");
  const [pathology, setPathology] = useState<PathologyCode | null>(null);
  const [responses, setResponses] = useState<Record<string, ResponseValue>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssessmentResult | null>(null);

  const items = useMemo(() => (pathology ? SCREENING_ITEMS_BY_PATHOLOGY[pathology] : []), [pathology]);

  function selectPathology(code: PathologyCode) {
    setPathology(code);
    setResponses({});
    setStep("screening");
  }

  function updateResponse(code: string, value: ResponseValue) {
    setResponses((prev) => ({ ...prev, [code]: value }));
  }

  async function submitScreening() {
    if (!pathology) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathology, responses }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message ?? "Une erreur est survenue.");
        return;
      }

      setResult({
        status: data.status,
        message: data.message,
        triggeredFlags: data.triggeredFlags ?? [],
        ruleImplemented: data.ruleImplemented,
      });
      setStep("result");
    } catch {
      setError("Une erreur est survenue. Vous pouvez réessayer.");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "pathology") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-primary-700">Quelle est votre principale situation de santé&nbsp;?</p>
        {PATHOLOGY_CODES.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => selectPathology(code)}
            className="rounded-xl border border-primary-300 bg-white px-4 py-3 text-left font-medium text-primary-900 hover:border-primary-500"
          >
            {PATHOLOGY_LABELS_FR[code]}
          </button>
        ))}
      </div>
    );
  }

  if (step === "screening" && pathology) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-primary-500">
          Situation sélectionnée : <strong>{PATHOLOGY_LABELS_FR[pathology]}</strong>
        </p>
        <p className="text-primary-700">
          Avant toute proposition d'exercices, quelques questions de sécurité.
        </p>

        {items.map((item) => (
          <div key={item.code} className="flex flex-col gap-1">
            <label className="font-medium text-primary-900">{item.label}</label>
            {item.type === "boolean" ? (
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name={item.code}
                    onChange={() => updateResponse(item.code, true)}
                  />
                  Oui
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name={item.code}
                    defaultChecked
                    onChange={() => updateResponse(item.code, false)}
                  />
                  Non
                </label>
              </div>
            ) : item.type === "scale_0_10" ? (
              <input
                type="range"
                min={0}
                max={10}
                defaultValue={0}
                className="w-full"
                onChange={(e) => updateResponse(item.code, Number(e.target.value))}
              />
            ) : item.type === "select" && item.options ? (
              <div className="flex flex-col gap-2 text-sm">
                {item.options.map((option) => (
                  <label key={option.value} className="flex items-start gap-2">
                    <input
                      type="radio"
                      name={item.code}
                      onChange={() => updateResponse(item.code, option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            ) : (
              <input
                type="text"
                className="input"
                onChange={(e) => updateResponse(item.code, e.target.value)}
              />
            )}
          </div>
        ))}

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <Button type="button" onClick={submitScreening} disabled={submitting}>
          {submitting ? "Analyse…" : "Continuer"}
        </Button>
      </div>
    );
  }

  if (step === "result" && result && pathology) {
    // Réponse de Dr Nikiema du 23/09/2026 : l'écran « quels exercices pour
    // quelle pathologie » doit apparaître une fois, comme écran pédagogique,
    // juste après l'évaluation initiale / attribution du programme — donc
    // uniquement quand un programme a bien été attribué (vert/orange) et pas
    // déjà vu pour cette pathologie (apps/web/src/lib/exerciseTypeEducation.ts).
    const showEducationNext = programWasAssigned(result.status) && !hasSeenExerciseTypeEducation(pathology);

    return (
      <div className="flex flex-col gap-4">
        <div className={`flex flex-col gap-3 rounded-xl border p-4 ${STATUS_STYLES[result.status]}`}>
          <h2 className="font-semibold">{SAFETY_STATUS_LABELS_FR[result.status]}</h2>
          <p>{result.message}</p>
          {!result.ruleImplemented && (
            <p className="text-sm opacity-80">
              Cette situation nécessite encore une validation par le concepteur médical avant qu'un
              programme automatique ne puisse être proposé.
            </p>
          )}
        </div>
        <Button
          type="button"
          onClick={() => {
            if (showEducationNext) {
              setStep("education");
            } else {
              router.push("/tableau-de-bord");
            }
          }}
        >
          Continuer
        </Button>
      </div>
    );
  }

  if (step === "education" && pathology) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-primary-700">
          Voici le type d'exercices adaptés à votre situation de santé. Vous retrouverez cet écran à
          chaque séance pour choisir entre aérobie et renforcement musculaire.
        </p>
        <ExerciseTypePreview pathology={pathology} />
        <Button
          type="button"
          onClick={() => {
            markExerciseTypeEducationSeen(pathology);
            router.push("/tableau-de-bord");
          }}
        >
          Continuer
        </Button>
      </div>
    );
  }

  return null;
}
