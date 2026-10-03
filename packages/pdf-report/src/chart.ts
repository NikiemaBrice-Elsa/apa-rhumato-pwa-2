/**
 * Sprint 36 (03/10/2026, instruction directe de Dr Nikiema après relecture
 * d'un rapport généré) : « dans le rapport généré je ne vois pas de courbe
 * ni pour la douleur ni pour les autres paramètres, pourtant ils doivent
 * apparaître » — le Sprint 35 avait ajouté les courbes à deux séries dans
 * l'application (`MultiLineChart.tsx`) mais jamais dans le rapport PDF
 * lui-même (`report.ts` ne faisait qu'afficher du texte). Ce module porte
 * la même logique visuelle que `MultiLineChart.tsx`
 * (apps/web/src/components/ui/MultiLineChart.tsx) dans l'API de dessin
 * vectoriel de pdfkit plutôt qu'en SVG : mêmes couleurs fixes par série,
 * même légende toujours présente à partir de deux séries.
 *
 * Sprint 38 (05/10/2026, instruction directe de Dr Nikiema après relecture
 * du rapport douleur avant/après en production) : « La courbe d'évolution
 * de la douleur doit comporter deux tracés [...] Joindre les valeurs sur
 * les points des tracés. » Deux changements par rapport au Sprint 36 :
 * (1) une série relie désormais directement ses points réellement
 * enregistrés, SANS couper la ligne sur les dates où seule l'AUTRE série a
 * une valeur (ex. douleur « après » non recueillie pour une séance qui a
 * seulement une douleur « avant ») — l'ancienne règle de « trou » sur
 * chaque `null`, pensée pour une grandeur mesurée isolément dans le temps
 * (poids, tension...), fragmentait au contraire une paire avant/après liée
 * à un même événement en une multitude de segments illisibles dès que l'un
 * des deux n'était pas toujours renseigné. Aucune valeur n'est pour autant
 * inventée (§57, §59) : seuls des points RÉELLEMENT enregistrés sont
 * tracés et reliés entre eux — relier deux points connus à travers une date
 * sans donnée est une convention de lecture usuelle (tout graphique en
 * courbes le fait dès qu'une mesure manque), jamais une valeur fabriquée
 * aux points intermédiaires, qui eux restent vides. (2) la valeur de chaque
 * point est désormais affichée à côté de lui (pas seulement dans la ligne
 * récapitulative en bas du graphique), pour rester lisible même si les
 * traces se croisent ou se superposent.
 *
 * La géométrie pure (points par série, étendue des valeurs) est séparée du
 * dessin pdfkit pour rester testable sans avoir à générer un PDF (voir
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
  /** Même longueur que `xLabels` ; `null` = pas de valeur enregistrée à ce
   * point précis pour CETTE série (une autre série peut très bien avoir une
   * valeur à la même position — voir le Sprint 38 en tête de fichier). */
  values: (number | null)[];
  color: string;
}

/** Un point RÉELLEMENT enregistré d'une série, déjà converti en coordonnées
 * de dessin — jamais un point fabriqué pour combler une absence de donnée
 * (§57, §59). */
export interface PdfChartPlottedPoint {
  x: number;
  y: number;
  value: number;
}

/**
 * Ne garde que les valeurs réellement enregistrées d'une série (filtre les
 * `null`) et les convertit en points de dessin — une série se trace donc en
 * reliant directement ses propres points connus, sans jamais s'interrompre
 * à cause d'une autre série ni fabriquer de valeur manquante (Sprint 38,
 * voir le commentaire en tête de fichier). Fonction pure, testée
 * indépendamment du rendu pdfkit.
 */
export function buildSeriesPoints(
  values: (number | null)[],
  xFor: (i: number) => number,
  yFor: (v: number) => number
): PdfChartPlottedPoint[] {
  const points: PdfChartPlottedPoint[] = [];
  values.forEach((v, i) => {
    if (v === null) return;
    points.push({ x: xFor(i), y: yFor(v), value: v });
  });
  return points;
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
/** Décalage vertical de l'étiquette de valeur par rapport au point : la
 * première série s'affiche au-dessus, la seconde en dessous, pour limiter
 * les collisions quand les deux séries partagent une même date (ex. douleur
 * avant/après d'une même séance) — Sprint 38. */
const VALUE_LABEL_OFFSET_ABOVE = -9;
const VALUE_LABEL_OFFSET_BELOW = 4;

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

  // Tracé des lignes + points + étiquette de valeur, une série à la fois
  // (couleur fixe, jamais réattribuée ni cyclique — voir
  // CHART_COLOR_PRIMARY/SECONDARY ci-dessus). Chaque série relie directement
  // SES points réellement enregistrés (Sprint 38) : pas d'interruption à
  // cause d'une date où seule l'autre série a une valeur.
  doc.save();
  series.forEach((s, seriesIndex) => {
    const points = buildSeriesPoints(s.values, xFor, yFor);
    if (points.length >= 2) {
      doc.lineWidth(2).lineCap("round").strokeColor(s.color);
      doc.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) doc.lineTo(points[i].x, points[i].y);
      doc.stroke();
    }
    for (const p of points) {
      doc.circle(p.x, p.y, 2.5).fill(s.color);
    }

    // Étiquette de valeur à côté de chaque point (Sprint 38 : « joindre les
    // valeurs sur les points des tracés ») — au-dessus pour la première
    // série, en dessous pour la seconde, afin de limiter les collisions
    // quand les deux séries partagent une même date.
    const labelOffsetY = seriesIndex === 0 ? VALUE_LABEL_OFFSET_ABOVE : VALUE_LABEL_OFFSET_BELOW;
    doc.fontSize(7).fillColor(s.color);
    for (const p of points) {
      doc.text(String(p.value), p.x - 6, p.y + labelOffsetY, { lineBreak: false });
    }
  });
  doc.restore();
  doc.fillColor("#000000").fontSize(11);

  // `doc.text(str, x, y, …)` en position explicite (ci-dessus, pour chaque
  // étiquette) laisse le curseur de texte flottant (`doc.x`/`doc.y`) là où
  // cette dernière étiquette a été posée — `doc.save()`/`doc.restore()` ne
  // couvre PAS ce curseur (seulement les couleurs/épaisseurs de trait, voir
  // la remarque déjà faite pour le logo plus haut dans ce fichier). Sans
  // cette réinitialisation explicite des DEUX coordonnées, tout le texte
  // normal qui suit (sections « Mesures », « Courbes de suivi »...) hérite
  // d'un `doc.x` resté quelque part au milieu du graphique et se retrouve
  // enveloppé sur une largeur minuscule, mot par mot — bogue réel détecté
  // par Dr Nikiema en production (Sprint 38) : le texte des sections
  // suivantes apparaissait haché en fragments de quelques lettres.
  doc.x = left;
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
