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
  physicalActivities: [
    { date: "2026-07-08T08:00:00Z", activityTypeLabel: "Marche", durationLabel: "30 min", distanceLabel: "2.10 km" },
  ],
  observations: [{ date: "2026-07-05T10:00:00Z", text: "Séance bien vécue." }],
  objectives: ["Améliorer la mobilité", "Reprendre progressivement une activité physique"],
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

/**
 * Section « Activités physiques » (Sprint 25/26, 21/09/2026) — ajoutée à la
 * demande explicite de Dr Nikiema, au-delà des dix sections imposées par le
 * §71 d'origine (voir la description ci-dessus). Testée séparément plutôt
 * que d'être ajoutée à la liste "dix sections" pour ne pas réécrire un test
 * qui reste vrai tel quel (les dix sections d'origine sont toujours toutes
 * présentes, celle-ci s'y ajoute).
 */
describe("buildPatientReportPdf — section « Activités physiques » (Sprint 25/26)", () => {
  it("liste chaque activité physique enregistrée (type, durée, distance si présente)", async () => {
    const buffer = await buildPatientReportPdf(BASE_DATA);
    const text = await extractText(buffer);
    expect(text).toContain("Activités physiques");
    expect(text).toMatch(/Marche.*30 min.*2\.10 km/s);
  });

  it("indique explicitement l'absence d'activité plutôt que de ne rien afficher", async () => {
    const empty: PatientReportData = { ...BASE_DATA, physicalActivities: [] };
    const buffer = await buildPatientReportPdf(empty);
    const text = await extractText(buffer);
    expect(text).toMatch(/aucune activité physique/i);
  });
});

/**
 * Section « Objectifs » (Sprint 33, 24/09/2026) — instruction directe de
 * Dr Nikiema : « les objectifs renseignés dans le profil doivent se
 * retrouver sur le rapport PDF ». Testée séparément, même méthode que
 * « Activités physiques » ci-dessus (ajoutée au-delà des dix sections
 * imposées par le §71 d'origine, sans réécrire le test qui les liste).
 */
describe("buildPatientReportPdf — section « Objectifs » (Sprint 33)", () => {
  it("liste chaque objectif renseigné dans le profil", async () => {
    const buffer = await buildPatientReportPdf(BASE_DATA);
    const text = await extractText(buffer);
    expect(text).toContain("Objectifs");
    expect(text).toContain("Améliorer la mobilité");
    expect(text).toContain("Reprendre progressivement une activité physique");
  });

  it("indique explicitement l'absence d'objectif plutôt que de ne rien afficher", async () => {
    const empty: PatientReportData = { ...BASE_DATA, objectives: [] };
    const buffer = await buildPatientReportPdf(empty);
    const text = await extractText(buffer);
    expect(text).toMatch(/aucun objectif/i);
  });
});
