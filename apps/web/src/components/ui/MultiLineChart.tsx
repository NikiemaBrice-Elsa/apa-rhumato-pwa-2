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
 * Sprint 38 (05/10/2026, instruction directe de Dr Nikiema après relecture
 * en production) : « La courbe d'évolution de la douleur doit comporter deux
 * tracés [...] Joindre les valeurs sur les points des tracés. » Avant ce
 * correctif, une valeur `null` « trouait » la ligne à sa position (pensé
 * pour une grandeur mesurée isolément dans le temps, ex. le poids) — mais
 * pour une paire avant/après liée à un même événement, où l'un des deux
 * n'est pas toujours renseigné, cette règle fragmentait les deux séries en
 * une multitude de petits segments illisibles plutôt que de montrer deux
 * tracés clairs. Désormais, chaque série relie directement SES points
 * réellement enregistrés, sans s'interrompre à cause d'une date où seule
 * l'autre série a une valeur. Aucune valeur n'est pour autant inventée
 * (§57, §59) : seuls des points RÉELLEMENT enregistrés sont tracés et
 * reliés — relier deux points connus à travers une date sans donnée est une
 * convention de lecture usuelle (tout graphique en courbes le fait dès
 * qu'une mesure manque), jamais une valeur fabriquée aux points
 * intermédiaires, qui eux restent vides. La valeur de chaque point est en
 * outre désormais affichée à côté de lui (pas seulement dans la ligne
 * récapitulative du bas), pour rester lisible même si les traces se
 * croisent.
 */
export interface MultiLineSeries {
  name: string;
  /** Même longueur que `xLabels` ; `null` = pas de valeur enregistrée à ce
   * point précis pour CETTE série (une autre série peut très bien avoir une
   * valeur à la même position — voir le Sprint 38 ci-dessus). */
  values: (number | null)[];
  colorClassName: "text-primary-700" | "text-teal-600";
}

/** Décalage vertical de l'étiquette de valeur par rapport au point : la
 * première série s'affiche au-dessus, la seconde en dessous, pour limiter
 * les collisions quand les deux séries partagent une même date (ex. douleur
 * avant/après d'une même séance) — Sprint 38. */
const VALUE_LABEL_OFFSET_ABOVE = -6;
const VALUE_LABEL_OFFSET_BELOW = 14;

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
        {series.map((s, seriesIndex) => {
          // Chaque série relie directement ses propres points réellement
          // enregistrés (Sprint 38) : les valeurs null sont simplement
          // omises, jamais interpolées ni fabriquées (§57, §59).
          const points = s.values
            .map((v, i) => (v === null ? null : { x: xFor(i), y: yFor(v), value: v }))
            .filter((p): p is { x: number; y: number; value: number } => p !== null);

          const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
          const labelDy = seriesIndex === 0 ? VALUE_LABEL_OFFSET_ABOVE : VALUE_LABEL_OFFSET_BELOW;

          return (
            <g key={s.name} className={s.colorClassName}>
              {points.length >= 2 && (
                <path d={path} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
              )}
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3} fill="currentColor" />
              ))}
              {/* Valeur affichée à côté de chaque point (Sprint 38 : « joindre
                  les valeurs sur les points des tracés »), au-dessus pour la
                  première série et en dessous pour la seconde afin de
                  limiter les collisions. */}
              {points.map((p, i) => (
                <text
                  key={`label-${i}`}
                  x={p.x}
                  y={p.y + labelDy}
                  textAnchor="middle"
                  fontSize={9}
                  fill="currentColor"
                >
                  {p.value}
                </text>
              ))}
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
