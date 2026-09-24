import PDFDocument from "pdfkit";
import { LOGO_PNG_BASE64 } from "./assets/logo";

/**
 * Génération du rapport utilisateur (§40 « Rapport PDF », §71 « Rapport
 * utilisateur ») — Sprint 10.
 *
 * Ce module ne fait AUCUN calcul médical : toutes les valeurs (adhésion,
 * historique douleur/mesures) sont calculées en amont (packages/domain,
 * Sprint 8/9) et simplement mises en forme ici. Deux champs du §40/§71 n'ont
 * volontairement pas de valeur numérique/calculée :
 * - « séances prévues » : aucun moteur de planification n'existe (voir
 *   docs/MEDICAL_VALIDATION_NEEDED.md, Sprint 9) — `sessionsPlanned` reste
 *   `null` et le rapport l'indique explicitement plutôt que de l'omettre ou
 *   d'inventer un nombre.
 * - « progression fonctionnelle » : aucune métrique n'est définie par le
 *   concepteur médical (§33, §58) — `functionalProgressionNote` est un texte
 *   fixe d'attente, jamais un indicateur inventé.
 *
 * L'avertissement médical imposé par le §40 est repris VERBATIM (aucune
 * reformulation) et affiché deux fois (en tête et en pied de rapport) pour
 * qu'il reste visible même si le rapport s'étend sur plusieurs pages (§57,
 * §59 : la sécurité prime sur la mise en forme).
 */

export const MEDICAL_DISCLAIMER =
  "Ce rapport est un outil de suivi numérique et ne remplace pas une évaluation médicale.";

export interface ReportIdentity {
  firstName: string;
  lastName?: string | null;
}

export interface ReportPeriod {
  from: string;
  to: string;
}

export interface ReportActivity {
  /** Toujours `null` tant qu'aucun moteur de planification n'existe (Sprint 9). */
  sessionsPlanned: number | null;
  sessionsCompleted: number;
  totalActiveMinutes: number;
}

export interface ReportAdherence {
  /** `null` tant qu'aucun programme validé avec fréquence cible n'est attribué (§57, §59). */
  percent: number | null;
}

export interface ReportPainPoint {
  date: string;
  before: number | null;
  after: number | null;
}

export interface ReportMeasurementPoint {
  /** Libellé déjà formaté (ex. « 72.5 kg », « 120/80 mmHg »), pas de logique ici. */
  label: string;
  date: string;
  summary: string;
}

export interface ReportObservation {
  date: string;
  text: string;
}

/**
 * Une activité physique enregistrée via le chronomètre ou le suivi de
 * marche/vélo GPS (Sprint 25) — ajoutée au rapport à la demande explicite de
 * Dr Nikiema le 21/09/2026 (Sprint 26), en plus des dix sections imposées
 * par le §71 d'origine. Libellés déjà formatés (type, durée, distance) : ce
 * module ne fait aucun calcul, voir `@/lib/patientReport.ts`.
 */
export interface ReportPhysicalActivityPoint {
  date: string;
  activityTypeLabel: string;
  durationLabel: string;
  distanceLabel?: string | null;
}

export interface PatientReportData {
  identity: ReportIdentity;
  pathologyLabel: string;
  period: ReportPeriod;
  activity: ReportActivity;
  adherence: ReportAdherence;
  pain: ReportPainPoint[];
  measurements: ReportMeasurementPoint[];
  physicalActivities: ReportPhysicalActivityPoint[];
  observations: ReportObservation[];
  /** Sprint 33 (24/09/2026, instruction directe de Dr Nikiema) : objectifs
   * déclarés par le patient dans son profil (`patient_profiles.objectives`,
   * déjà traduits en libellés français par l'appelant — voir
   * `apps/web/src/lib/patientReport.ts`), jamais recalculés ni interprétés
   * ici. */
  objectives: string[];
  userNote?: string | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(1);
  doc.fontSize(14).fillColor("#1e4e9e").text(title, { underline: true });
  doc.fontSize(11).fillColor("#000000");
  doc.moveDown(0.3);
}

function disclaimerBlock(doc: PDFKit.PDFDocument) {
  doc
    .fontSize(10)
    .fillColor("#7a0d0d")
    .rect(doc.x, doc.y, doc.page.width - doc.page.margins.left - doc.page.margins.right, 30)
    .stroke();
  doc.moveDown(0.3);
  doc.text(MEDICAL_DISCLAIMER, { align: "center" });
  doc.fillColor("#000000").fontSize(11);
  doc.moveDown(0.5);
}

export function buildPatientReportPdf(data: PatientReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const fullName = [data.identity.firstName, data.identity.lastName].filter(Boolean).join(" ");

    // Logo (retour recette du 07/09/2026 : « à afficher partout, y compris
    // sur les rapports PDF »), centré en tête de document. Position/y fixés
    // explicitement après l'image : pdfkit n'avance pas toujours le curseur
    // de la même façon selon qu'on lui donne des coordonnées explicites.
    const logoBuffer = Buffer.from(LOGO_PNG_BASE64, "base64");
    const logoSize = 60;
    const logoTop = doc.y;
    const logoX = (doc.page.width - logoSize) / 2;
    doc.image(logoBuffer, logoX, logoTop, { width: logoSize, height: logoSize });
    doc.y = logoTop + logoSize + 10;

    // Titre.
    doc.fontSize(18).fillColor("#1e4e9e").text("Rapport de suivi APA", { align: "center" });
    doc.moveDown(0.5);
    disclaimerBlock(doc);

    // Profil (§71).
    sectionTitle(doc, "Profil");
    doc.text(`Nom : ${fullName || "Non renseigné"}`);

    // Objectifs (Sprint 33, 24/09/2026, instruction directe de Dr Nikiema :
    // « les objectifs renseignés dans le profil doivent se retrouver sur le
    // rapport PDF »). Libellés déjà formatés par l'appelant, jamais une
    // interprétation ajoutée ici.
    sectionTitle(doc, "Objectifs");
    if (data.objectives.length === 0) {
      doc.text("Aucun objectif renseigné dans le profil.");
    } else {
      for (const objective of data.objectives) {
        doc.text(`• ${objective}`);
      }
    }

    // Pathologie sélectionnée (§71).
    sectionTitle(doc, "Pathologie sélectionnée");
    doc.text(data.pathologyLabel);

    // Période (§71).
    sectionTitle(doc, "Période");
    doc.text(`Du ${formatDate(data.period.from)} au ${formatDate(data.period.to)}`);

    // Activité (§71) = séances prévues/réalisées du §40.
    sectionTitle(doc, "Activité");
    doc.text(
      `Séances prévues : ${
        data.activity.sessionsPlanned === null
          ? "non disponible (aucune planification automatique n'est encore implémentée)"
          : data.activity.sessionsPlanned
      }`
    );
    doc.text(`Séances réalisées : ${data.activity.sessionsCompleted}`);
    doc.text(`Minutes d'activité : ${data.activity.totalActiveMinutes}`);

    // Adhésion (§71).
    sectionTitle(doc, "Adhésion");
    doc.text(
      data.adherence.percent === null
        ? "Non calculable pour l'instant : aucun programme validé médicalement avec une fréquence cible n'est encore attribué."
        : `${data.adherence.percent}%`
    );

    // Douleur (§71) = évolution de la douleur du §40.
    sectionTitle(doc, "Douleur");
    if (data.pain.length === 0) {
      doc.text("Aucune donnée de douleur enregistrée sur cette période.");
    } else {
      for (const point of data.pain) {
        doc.text(
          `${formatDate(point.date)} — avant : ${point.before ?? "—"}/10, après : ${point.after ?? "—"}/10`
        );
      }
    }

    // Mesures (§71) = évolution du poids + autres paramètres du §40.
    sectionTitle(doc, "Mesures");
    if (data.measurements.length === 0) {
      doc.text("Aucune mesure enregistrée sur cette période.");
    } else {
      for (const m of data.measurements) {
        doc.text(`${formatDate(m.date)} — ${m.label} : ${m.summary}`);
      }
    }

    // Activités physiques (chronomètre, marche/vélo GPS — Sprint 25/26,
    // ajout demandé par Dr Nikiema le 21/09/2026, au-delà des dix sections
    // imposées par le §71 d'origine).
    sectionTitle(doc, "Activités physiques");
    if (data.physicalActivities.length === 0) {
      doc.text("Aucune activité physique enregistrée via le chronomètre ou le suivi de marche/vélo sur cette période.");
    } else {
      for (const activity of data.physicalActivities) {
        doc.text(
          `${formatDate(activity.date)} — ${activity.activityTypeLabel} : ${activity.durationLabel}` +
            (activity.distanceLabel ? ` (${activity.distanceLabel})` : "")
        );
      }
    }

    // Progression (§71) = progression fonctionnelle du §40.
    sectionTitle(doc, "Progression");
    doc.text(
      "Aucune mesure de capacité fonctionnelle n'est encore définie par le concepteur médical : cette " +
        "section sera complétée dès qu'un indicateur précis (test, échelle) sera validé."
    );

    // Observations (§71) = observations de l'utilisateur du §40.
    sectionTitle(doc, "Observations");
    if (data.observations.length === 0 && !data.userNote) {
      doc.text("Aucune observation enregistrée sur cette période.");
    } else {
      for (const obs of data.observations) {
        doc.text(`${formatDate(obs.date)} — « ${obs.text} »`);
      }
      if (data.userNote) {
        doc.moveDown(0.3);
        doc.text(`Note ajoutée à la génération du rapport : « ${data.userNote} »`);
      }
    }

    // Avertissement médical (§71), répété en pied de rapport (§40).
    doc.moveDown(1);
    disclaimerBlock(doc);

    doc.end();
  });
}
