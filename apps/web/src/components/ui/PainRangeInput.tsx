"use client";

/**
 * Curseur de douleur (0-10) dont la couleur passe du vert (aucune douleur) au
 * rouge (douleur maximale) — demande directe de Dr Nikiema (24/09/2026) :
 * « je souhaite que la barre d'évaluation de la douleur change de couleur en
 * fonction du niveau de la douleur en passant du vert vers le rouge ».
 *
 * Repose sur la propriété CSS standard `accent-color` (teinte du curseur et
 * de la portion remplie du track dans les navigateurs qui la supportent —
 * Chrome/Edge/Firefox récents), sans dépendance supplémentaire ni
 * bibliothèque de slider personnalisée.
 *
 * Volontairement réservé aux curseurs de DOULEUR (`SessionFlow.tsx`,
 * `DeclareSessionFlow.tsx` — douleurAvant/douleurApres) : la demande de
 * Dr Nikiema porte explicitement sur « la barre d'évaluation de la
 * douleur », pas sur les curseurs de fatigue (`fatigueAvant`/`fatigueApres`)
 * ni sur les échelles génériques de `AssessmentFlow.tsx` (`scale_0_10`),
 * qui restent donc inchangés.
 */
export function painLevelColor(value: number, min = 0, max = 10): string {
  const ratio = max === min ? 0 : Math.min(1, Math.max(0, (value - min) / (max - min)));
  // 120° = vert, 0° = rouge en HSL — interpolation directe sur la teinte.
  const hue = 120 - ratio * 120;
  return `hsl(${hue}, 75%, 45%)`;
}

interface PainRangeInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  id?: string;
  className?: string;
}

export function PainRangeInput({ value, onChange, min = 0, max = 10, id, className }: PainRangeInputProps) {
  return (
    <input
      id={id}
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={className}
      style={{ accentColor: painLevelColor(value, min, max) }}
    />
  );
}
