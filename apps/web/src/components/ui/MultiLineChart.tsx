/**
 * Sprint 35 (30/09/2026, instruction directe de Dr Nikiema) : « on aura deux
 * courbes, deux lignes sur la même courbe. Une courbe pour douleur avant et
 * une courbe pour douleur après » — variante de `MiniLineChart.tsx` (§33
 * « Afficher des courbes », §34-36 « graphique ») capable d'afficher
 * plusieurs séries sur un même graphique partageant le même axe des abscisses
 * (ex. douleur avant/après, tension systolique/diastolique). Purement
 * présentationnel : aucune interprétation clinique des valeurs affichées
 * (§34, §35 — jamais un diagnostic), exactement comme `MiniLineChart`.
 *
 * Couleurs fixes par série (jamais réattribuées selon un filtre, jamais
 * cycliques) : bleu `primary-700` (déjà utilisé partout dans l'app) pour la
 * première série, sarcelle `teal-600` pour la seconde — paire distincte des
 * couleurs de statut déjà utilisées ailleurs (orange = attention, rouge =
 * alerte, vert = progression), validée séparabilité daltonisme/vision normale
 * (voir la review associée à ce sprint).
 *
 * Une valeur `null` dans une série "troue" la ligne à cette position plutôt
 * que de l'interpoler ou de la fabriquer (§57, §59 : ne jamais deviner une
 * valeur non enregistrée).
 */
export interface MultiLineSeries {
  name: string;
  /** Même longueur que `xLabels` ; `null` = pas de valeur à ce point. */
  values: (number | null)[];
  colorClassName: "text-primary-700" | "text-teal-600";
}

export function MultiLineChart({
  xLabels,
  series,
  unit,
}: {
  xLabels: string[];
  series: MultiLineSeries[];
  unit?: string;
}) {
  const hasAnyData = series.some((s) => s.values.some((v) => v !== null));

  if (xLabels.length === 0 || !hasAnyData) {
    return <p className="text-sm text-primary-500">Aucune donnée enregistrée pour l'instant.</p>;
  }

  const width = 320;
  const height = 120;
  const padding = 24;

  const allValues = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  function xFor(i: number) {
    return xLabels.length === 1 ? width / 2 : padding + (i / (xLabels.length - 1)) * (width - 2 * padding);
  }
  function yFor(v: number) {
    return height - padding - ((v - min) / range) * (height - 2 * padding);
  }

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={`Graphique d'évolution : ${series.map((s) => s.name).join(", ")}`}
      >
        {series.map((s) => {
          // Une valeur manquante coupe la ligne en plusieurs segments plutôt
          // que de relier deux points qui n'ont rien à voir (§57, §59).
          const segments: { x: number; y: number }[][] = [];
          let current: { x: number; y: number }[] = [];
          s.values.forEach((v, i) => {
            if (v === null) {
              if (current.length > 0) {
                segments.push(current);
                current = [];
              }
              return;
            }
            current.push({ x: xFor(i), y: yFor(v) });
          });
          if (current.length > 0) segments.push(current);

          return (
            <g key={s.name} className={s.colorClassName}>
              {segments.map((seg, si) => (
                <path
                  key={si}
                  d={seg.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ")}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              ))}
              {s.values.map((v, i) =>
                v === null ? null : <circle key={i} cx={xFor(i)} cy={yFor(v)} r={3} fill="currentColor" />
              )}
            </g>
          );
        })}
      </svg>

      {/* Légende : toujours présente à partir de 2 séries (identité jamais
          portée par la seule couleur) — voir la skill dataviz. */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-primary-700">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-full bg-current ${s.colorClassName}`} />
            {s.name}
          </span>
        ))}
      </div>

      <div className="flex justify-between text-xs text-primary-500">
        <span>{xLabels[0]}</span>
        <span>
          {series
            .map((s) => {
              const lastValue = [...s.values].reverse().find((v) => v !== null);
              return lastValue === undefined ? null : `${s.name} : ${lastValue}${unit ?? ""}`;
            })
            .filter(Boolean)
            .join(" · ")}
        </span>
        <span>{xLabels[xLabels.length - 1]}</span>
      </div>
    </div>
  );
}
