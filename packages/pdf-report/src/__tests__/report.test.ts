import { describe, expect, it } from "vitest";
import { PDFParse } from "pdf-parse";
import { buildPatientReportPdf, MEDICAL_DISCLAIMER, type PatientReportData } from "../report";

const BASE_DATA: PatientReportData = {
  identity: { firstName: "Aïcha", lastName: "T." },
  pathologyLabel: "Arthrose du genou",
  period: { from: "2026-07-01T00:00:00Z", to: "2026-07-31T23:59:59Z" },
  activity: { sessionsPlanned: null, sessionsCompleted: 3, totalActiveMinutes: 45 },
  adherence: { percent: null },
  pain: [{ date: "2026-07-05T10:00:00Z", before: 4, after: 2 }],
  measurements: [{ label: "Poids", date: "2026-07-10T10:00:00Z", summary: "72.5 kg" }],
  observations: [{ date: "2026-07-05T10:00:00Z", text: "Séance bien vécue." }],
  userNote: null,
};

async function extractText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

/**
 * Test sécurité (§55, §40 « Le rapport doit clairement indiquer… »), Sprint 10.
 * Garde-fou : l'avertissement médical verbatim doit TOUJOURS être présent
 * dans le PDF généré, quelles que soient les données du rapport (y compris
 * un rapport minimal sans aucune donnée de suivi). Casse intentionnellement
 * si quelqu'un modifie un jour le texte ou l'omet.
 */
describe("buildPatientReportPdf — avertissement médical (§40, §57, §59)", () => {
  it("contient l'avertissement médical verbatim", async () => {
    const buffer = await buildPatientReportPdf(BASE_DATA);
    const text = await extractText(buffer);
    expect(text).toContain(MEDICAL_DISCLAIMER);
  });

  it("contient l'avertissement même pour un rapport sans aucune donnée", async () => {
    const empty: PatientReportData = {
      ...BASE_DATA,
      activity: { sessionsPlanned: null, sessionsCompleted: 0, totalActiveMinutes: 0 },
      pain: [],
      measurements: [],
      observations: [],
    };
    const buffer = await buildPatientReportPdf(empty);
    const text = await extractText(buffer);
    expect(text).toContain(MEDICAL_DISCLAIMER);
  });

  it("indique explicitement l'absence de séances prévues plutôt que d'inventer un nombre", async () => {
    const buffer = await buildPatientReportPdf(BASE_DATA);
    const text = await extractText(buffer);
    expect(text).toMatch(/non disponible/i);
  });

  it("n'affiche jamais un pourcentage d'adhésion quand percent est null", async () => {
    const buffer = await buildPatientReportPdf(BASE_DATA);
    const text = await extractText(buffer);
    expect(text).toMatch(/non calculable/i);
  });
});

describe("buildPatientReportPdf — contenu des sections (§71)", () => {
  it("reprend les dix sections imposées par le §71", async () => {
    const buffer = await buildPatientReportPdf(BASE_DATA);
    const text = await extractText(buffer);
    for (const section of [
      "Profil",
      "Pathologie sélectionnée",
      "Période",
      "Activité",
      "Adhésion",
      "Douleur",
      "Mesures",
      "Progression",
      "Observations",
    ]) {
      expect(text).toContain(section);
    }
  });

  it("produit un buffer PDF valide (en-tête %PDF)", async () => {
    const buffer = await buildPatientReportPdf(BASE_DATA);
    expect(buffer.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });
});
