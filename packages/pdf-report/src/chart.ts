/**
 * Sprint 36 (03/10/2026, instruction directe de Dr Nikiema après relecture
 * d'un rapport généré) : « dans le rapport généré je ne vois pas de courbe
 * ni pour la douleur ni pour les autres paramètres, pourtant ils doivent
 * apparaître » — le Sprint 35 avait ajouté les courbes à deux séries dans
 * l'application (`MultiLineChart.tsx`) mais jamais dans le rapport PDF
 * lui-même (`report.ts` ne faisait qu'afficher du texte). Ce module porte
 * exactement la même logique visuelle que `MultiLineChart.tsx`
 * (apps/web/src/components/ui/MultiLineChart.tsx) dans l'API de dessin
 * vectoriel de pdfkit plutôt qu'en SVG : mêmes couleurs fixes par série,
 * même légende toujours présente à partir de deux séries, même règle de
 * « trou » sur une valeur `null` plutôt que de l'interpoler ou de la
 * fabriquer (§57, §59).
 *
 * La géométrie pure (segments, étendue des valeurs) est séparée du dessin
 * pdfkit pour rester testable sans avoir à générer un PDF (voir
 * `__tests__/chart.test.ts`) — même esprit que le reste de ce paquet, qui
 * ne fait aucun calcul médical.
 */

/** Bleu `primary-700` (apps/web/tailwind.config.ts) — première série, déjà
 * utilisé partout dans l'app. */
export const CHART_COLOR_PRIMARY = "#1e4e9e";
/** Sarcelle `teal-600` — seconde série, choisie et validée au Sprint 35 avec
 * le script de la skill `dataviz` (séparabilité daltonisme/vision normale),
 * distincte des couleurs de statut déjà utilisées ailleurs dans l'app. */
export const CHART_COLOR_SECONDARY = "#0d9488";
/** Bleu `primary-500` — texte d'accompagnement (dates, dernière valeur,
 * message d'absence de donnée), jamais utilisé comme couleur de série. */
const TEXT_MUTED_COLOR = "#2e6fd6";

export interface PdfChartSeries {
  name: string;
  /** Même longueur que `xLabels` ; `null` = pas de valeur à ce point. */
  values: (number | null)[];
  color: string;
}

export interface PdfChartPoint {
  x: number;
  y: number;
}

/**
 * Découpe une série en segments contigus, en coupant la ligne à chaque
 * valeur `null` plutôt que de relier deux points qui n'ont rien à voir
 * (§57, §59 : ne jamais deviner une valeur non enregistrée) — identique à
 * la logique de `MultiLineChart.tsx`. Fonction pure, testée indépendamment
 * du rendu pdfkit.
 */
export function buildChartSegments(
  values: (number | null)[],
  xFor: (i: number) => number,
  yFor: (v: number) => number
): PdfChartPoint[][] {
  const segments: PdfChartPoint[][] = [];
  let current: PdfChartPoint[] = [];
  values.forEach((v, i) => {
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
  return segments;
}

/**
 * Étendue (min/max/range) d'un ensemble de valeurs, avec un plancher à 1
 * pour éviter une division par zéro quand toutes les valeurs sont égales
 * (ex. une seule mesure, ou plusieurs mesures identiques) — identique à
 * `MultiLineChart.tsx`.
 */
export function computeValueRange(values: number[]): { min: number; max: number; range: number } {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max, range: max - min || 1 };
}

/** Vrai si au moins une série a au moins une valeur non nulle. */
export function hasAnyChartData(series: Pick<PdfChartSeries, "values">[]): boolean {
  return series.some((s) => s.values.some((v) => v !== null));
}

const PLOT_HEIGHT = 110;
const PLOT_PADDING = 16;
/** Hauteur maximale réservée (zone de tracé + légende + ligne de dates) pour
 * la décision de saut de page ci-dessous — volontairement généreuse. */
const RESERVED_HEIGHT = PLOT_HEIGHT + 45;

/**
 * Dessine un graphique multi-séries directement dans le document pdfkit en
 * cours (API vectorielle native, aucune dépendance supplémentaire), avance
 * `doc.y` d'autant, et saute de page AVANT de commencer si la place
 * restante ne suffit pas (jamais un graphique coupé entre deux pages).
 *
 * Purement présentationnel, comme `MultiLineChart.tsx` : aucune
 * interprétation clinique des valeurs affichées (§34, §35 — jamais un
 * diagnostic).
 */
export function drawMultiLineChart(
  doc: PDFKit.PDFDocument,
  opts: { xLabels: string[]; series: PdfChartSeries[]; unit?: string }
): void {
  const { xLabels, series, unit } = opts;
  const plotWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  if (doc.y + RESERVED_HEIGHT > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }

  if (xLabels.length === 0 || !hasAnyChartData(series)) {
    doc.fontSize(10).fillColor(TEXT_MUTED_COLOR).text("Aucune donnée enregistrée pour l'instant.");
    doc.fillColor("#000000").fontSize(11);
    doc.moveDown(0.3);
    return;
  }

  const left = doc.page.margins.left;
  const top = doc.y;

  function xFor(i: number): number {
    return xLabels.length === 1
      ? left + plotWidth / 2
      : left + PLOT_PADDING + (i / (xLabels.length - 1)) * (plotWidth - 2 * PLOT_PADDING);
  }

  const allValues = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const { min, range } = computeValueRange(allValues);
  function yFor(v: number): number {
    return top + PLOT_HEIGHT - PLOT_PADDING - ((v - min) / range) * (PLOT_HEIGHT - 2 * PLOT_PADDING);
  }

  // Tracé des lignes + points, une série à la fois (couleur fixe, jamais
  // réattribuée ni cyclique — voir CHART_COLOR_PRIMARY/SECONDARY ci-dessus).
  doc.save();
  for (const s of series) {
    const segments = buildChartSegments(s.values, xFor, yFor);
    doc.lineWidth(2).lineCap("round").strokeColor(s.color);
    for (const segment of segments) {
      if (segment.length < 2) continue;
      doc.moveTo(segment[0].x, segment[0].y);
      for (let i = 1; i < segment.length; i++) doc.lineTo(segment[i].x, segment[i].y);
      doc.stroke();
    }
    s.values.forEach((v, i) => {
      if (v === null) return;
      doc.circle(xFor(i), yFor(v), 2.5).fill(s.color);
    });
  }
  doc.restore();

  doc.y = top + PLOT_HEIGHT + 6;

  // Légende : toujours présente à partir de deux séries (une seule série
  // n'en a pas besoin, le titre de la sous-section la nomme déjà — même
  // règle que `MultiLineChart.tsx` / skill dataviz). Couleur portée par le
  // nom lui-même, jamais par la seule couleur (texte toujours lisible même
  // en niveaux de gris).
  if (series.length > 1) {
    doc.fontSize(9);
    series.forEach((s, i) => {
      const isLast = i === series.length - 1;
      doc.fillColor(s.color).text(s.name, { continued: !isLast });
      if (!isLast) doc.fillColor("#444444").text("   ", { continued: true });
    });
    doc.fillColor("#000000");
  }

  // Dates de début/fin + dernière valeur connue par série — même convention
  // que `MultiLineChart.tsx` (texte neutre, pas de couleur par série ici).
  const lastValuesText = series
    .map((s) => {
      const lastValue = [...s.values].reverse().find((v) => v !== null);
      return lastValue === undefined ? null : `${s.name} : ${lastValue}${unit ?? ""}`;
    })
    .filter((v): v is string => Boolean(v))
    .join(" · ");
  doc.fontSize(9).fillColor(TEXT_MUTED_COLOR);
  doc.text(`${xLabels[0]}   ${lastValuesText}   ${xLabels[xLabels.length - 1]}`);
  doc.fillColor("#000000").fontSize(11);
  doc.moveDown(0.5);
}
