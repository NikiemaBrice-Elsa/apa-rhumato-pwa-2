import type { PathologyCode } from "@apa/domain";

/**
 * Écran pédagogique « quels exercices pour quelle pathologie » (infographie
 * validée par Dr Nikiema, 22/09/2026) affiché une fois après l'évaluation
 * initiale / attribution du programme (AssessmentFlow) — réponse du
 * 23/09/2026 : « montré une fois, comme écran pédagogique ». Séparément, la
 * même image (via ExerciseTypePreview) est réaffichée à CHAQUE démarrage de
 * séance (SessionFlow) : ce fichier ne concerne QUE le rappel « déjà vu »
 * côté évaluation, jamais le déclenchement de l'affichage côté séance.
 *
 * Le patient n'ayant pas explicitement précisé « une fois » = une fois pour
 * toute l'application ou une fois par pathologie, on retient ici l'option la
 * plus défendable (une fois par pathologie, puisque chaque pathologie a ses
 * propres images) — voir docs/DECISIONS.md pour la mention de cette
 * hypothèse, à confirmer par Dr Nikiema si besoin.
 *
 * Stockage local uniquement (localStorage) : un simple rappel d'affichage,
 * pas une donnée médicale, donc pas de synchronisation serveur nécessaire.
 */
const STORAGE_KEY = "apa_exercise_type_education_seen_v1";

function readSeenSet(): Set<PathologyCode> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed as PathologyCode[]) : new Set();
  } catch {
    return new Set();
  }
}

function writeSeenSet(seen: Set<PathologyCode>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(seen)));
  } catch {
    // localStorage indisponible (navigation privée, quota…) — on n'affichera
    // simplement l'écran pédagogique qu'à nouveau plus tard, pas bloquant.
  }
}

export function hasSeenExerciseTypeEducation(pathology: PathologyCode): boolean {
  return readSeenSet().has(pathology);
}

export function markExerciseTypeEducationSeen(pathology: PathologyCode): void {
  const seen = readSeenSet();
  seen.add(pathology);
  writeSeenSet(seen);
}
