/**
 * Petit graphique d'évolution en SVG, sans dépendance externe (§33 « Afficher
 * des courbes », §34-36 « graphique »). Purement présentationnel : ne fait
 * aucune interprétation clinique des valeurs affichées (§34, §35 — jamais un
 * diagnostic).
 */
interface Point {
  label: string;
  value: number;
}

export function MiniLineChart({ points, unit }: { points: Point[]; unit?: string }) {
  if (points.length === 0) {
    return <p className="text-sm text-primary-500">Aucune donnée enregistrée pour l'instant.</p>;
  }

  const width = 320;
  const height = 120;
  const padding = 24;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = points.length === 1 ? width / 2 : padding + (i / (points.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((p.value - min) / range) * (height - 2 * padding);
    return { x, y, ...p };
  });

  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

  return (
    <div className="flex flex-col gap-1">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Graphique d'évolution">
        <path d={path} fill="none" stroke="currentColor" strokeWidth={2} className="text-primary-700" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={3} className="fill-primary-700" />
        ))}
      </svg>
      <div className="flex justify-between text-xs text-primary-500">
        <span>{points[0].label}</span>
        <span>
          Dernière valeur : {points[points.length - 1].value}
          {unit ?? ""}
        </span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  );
}
