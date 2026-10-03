import { describe, expect, it } from "vitest";
import { PDFParse } from "pdf-parse";
import { buildPatientReportPdf, MEDICAL_DISCLAIMER, type PatientReportData } from "../report";

const BASE_DATA: PatientReportData = {
  identity: { firstName: "Aïcha", lastName: "T." },
  pathologyLabel: "Arthrose du genou",
  period: { from: "2026-07-01T00:00:00Z", to: "2026-07-31T23:59:59Z" },
  activity: { sessionsPlanned: null, sessionsCompleted: 3, totalActiveMinutes: 45 },
  adherence: { percent: null },
  pain: [
    { date: "2026-07-05T10:00:00Z", before: 4, after: 2 },
    { date: "2026-07-12T10:00:00Z", before: 5, after: 3 },
  ],
  measurements: [{ label: "Poids", date: "2026-07-10T10:00:00Z", summary: "72.5 kg" }],
  weightSeries: [
    { date: "2026-07-03T10:00:00Z", value: 73 },
    { date: "2026-07-10T10:00:00Z", value: 72.5 },
  ],
  waistSeries: [
    { date: "2026-07-03T10:00:00Z", value: 98 },
    { date: "2026-07-10T10:00:00Z", value: 97 },
  ],
  bloodPressureSeries: [
    { date: "2026-07-04T08:00:00Z", systolic: 128, diastolic: 82 },
    { date: "2026-07-11T08:00:00Z", systolic: 122, diastolic: 78 },
  ],
  glycemiaSeriesGramsPerL: [
    { date: "2026-07-06T08:00:00Z", valueGramsPerL: 1.05 },
    { date: "2026-07-13T08:00:00Z", valueGramsPerL: 0.98 },
  ],
  physicalActivities: [
    { date: "2026-07-08T08:00:00Z", activityTypeLabel: "Marche", durationLabel: "30 min", distanceLabel: "2.10 km" },
  ],
  physicalActivityWeeklyAverageHours: 0.5,
  observations: [{ date: "2026-07-05T10:00:00Z", text: "Séance bien vécue." }],
  objectives: ["Améliorer la mobilité", "Reprendre progressivement une activité physique"],
  preAlertCancellations: [{ date: "2026-07-12T09:00:00Z", reasons: ["douleur élevée (8/10)", "fièvre"] }],
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
 * Moyenne hebdomadaire d'activité physique (Sprint 35, 30/09/2026) —
 * instruction directe de Dr Nikiema : « une moyenne de la durée des
 * activités physiques réalisées sous forme de nombre d'heures par
 * semaine ». Valeur déjà calculée en amont (voir
 * `computeAveragePhysicalActivityHoursPerWeek`, `@apa/domain`) ; ce module
 * se contente de l'afficher, y compris quand elle vaut 0 ou est `null`.
 */
describe("buildPatientReportPdf — moyenne hebdomadaire d'activité physique (Sprint 35)", () => {
  it("affiche la moyenne hebdomadaire en heures/semaine", async () => {
    const buffer = await buildPatientReportPdf(BASE_DATA);
    const text = await extractText(buffer);
    expect(text).toMatch(/0\.5 h\/semaine/);
  });

  it("affiche 0 h/semaine plutôt que de l'omettre quand la moyenne est nulle", async () => {
    const zero: PatientReportData = { ...BASE_DATA, physicalActivityWeeklyAverageHours: 0 };
    const buffer = await buildPatientReportPdf(zero);
    const text = await extractText(buffer);
    expect(text).toMatch(/0 h\/semaine/);
  });

  it("indique explicitement l'indisponibilité plutôt que d'inventer une valeur si la période est invalide", async () => {
    const invalid: PatientReportData = { ...BASE_DATA, physicalActivityWeeklyAverageHours: null };
    const buffer = await buildPatientReportPdf(invalid);
    const text = await extractText(buffer);
    expect(text).toMatch(/non disponible \(période invalide\)/i);
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

/**
 * Section « Séances non réalisées (avertissement de sécurité) » (Sprint 34,
 * 30/09/2026) — instruction directe de Dr Nikiema : « les séances non
 * réalisées liées à un ou plusieurs critères donnés doivent apparaître sur
 * le rapport PDF avec les critères en question y compris la date ». Testée
 * séparément, même méthode que « Activités physiques »/« Objectifs »
 * ci-dessus (ajoutée au-delà des dix sections imposées par le §71 d'origine).
 */
describe("buildPatientReportPdf — section « Séances non réalisées (avertissement de sécurité) » (Sprint 34)", () => {
  it("liste chaque séance annulée avec sa date et ses critères", async () => {
    const buffer = await buildPatientReportPdf(BASE_DATA);
    const text = await extractText(buffer);
    expect(text).toContain("Séances non réalisées (avertissement de sécurité)");
    expect(text).toMatch(/12\/07\/2026.*douleur élevée \(8\/10\).*fièvre/s);
  });

  it("indique explicitement l'absence de séance annulée plutôt que de ne rien afficher", async () => {
    const empty: PatientReportData = { ...BASE_DATA, preAlertCancellations: [] };
    const buffer = await buildPatientReportPdf(empty);
    const text = await extractText(buffer);
    expect(text).toMatch(/aucune séance non réalisée/i);
  });
});

/**
 * Courbes dans le rapport PDF (Sprint 36, 03/10/2026, instruction directe de
 * Dr Nikiema après relecture d'un rapport généré : « dans le rapport généré
 * je ne vois pas de courbe ni pour la douleur ni pour les autres paramètres,
 * pourtant ils doivent apparaître »). `pdf-parse` n'extrait que le texte, pas
 * les tracés vectoriels eux-mêmes (voir `chart.test.ts` pour la géométrie
 * pure) : ces tests vérifient donc ce qui doit apparaître EN TEXTE autour de
 * chaque courbe (titre de sous-section, légende, dernière valeur avec son
 * unité, dates de repère, message explicite si aucune donnée) — un indice
 * fiable que le bon graphique a bien été dessiné au bon endroit, sans pour
 * autant remplacer une relecture visuelle du PDF.
 */
describe("buildPatientReportPdf — courbes (Sprint 36)", () => {
  it("affiche la légende et la dernière valeur de la courbe douleur (avant/après)", async () => {
    const buffer = await buildPatientReportPdf(BASE_DATA);
    const text = await extractText(buffer);
    expect(text).toContain("Avant");
    expect(text).toContain("Après");
    expect(text).toMatch(/Avant : 5\/10/);
    expect(text).toMatch(/Après : 3\/10/);
  });

  it("n'affiche pas de courbe douleur quand il n'y a aucune donnée (déjà couvert par le message textuel)", async () => {
    const empty: PatientReportData = { ...BASE_DATA, pain: [] };
    const buffer = await buildPatientReportPdf(empty);
    const text = await extractText(buffer);
    expect(text).toMatch(/aucune donnée de douleur/i);
    expect(text).not.toMatch(/aucune donnée enregistrée pour l'instant/i);
  });

  it("affiche la section « Courbes de suivi » avec ses quatre sous-sections", async () => {
    const buffer = await buildPatientReportPdf(BASE_DATA);
    const text = await extractText(buffer);
    expect(text).toContain("Courbes de suivi (tension, glycémie, poids, tour de taille)");
    expect(text).toContain("Tension artérielle");
    expect(text).toContain("Glycémie");
    expect(text).toContain("Poids");
    expect(text).toContain("Tour de taille");
  });

  it("affiche la légende systolique/diastolique et les dernières valeurs en mmHg", async () => {
    const buffer = await buildPatientReportPdf(BASE_DATA);
    const text = await extractText(buffer);
    expect(text).toContain("Systolique");
    expect(text).toContain("Diastolique");
    expect(text).toMatch(/Systolique : 122 mmHg/);
    expect(text).toMatch(/Diastolique : 78 mmHg/);
  });

  it("affiche la dernière valeur de glycémie en g/L (série déjà normalisée par l'appelant)", async () => {
    const buffer = await buildPatientReportPdf(BASE_DATA);
    const text = await extractText(buffer);
    expect(text).toMatch(/Glycémie : 0\.98 g\/L/);
  });

  it("affiche la dernière valeur de poids et de tour de taille avec leur unité", async () => {
    const buffer = await buildPatientReportPdf(BASE_DATA);
    const text = await extractText(buffer);
    expect(text).toMatch(/Poids : 72\.5 kg/);
    expect(text).toMatch(/Tour de taille : 97 cm/);
  });

  it("indique explicitement l'absence de donnée par paramètre, indépendamment des autres", async () => {
    const partial: PatientReportData = {
      ...BASE_DATA,
      bloodPressureSeries: [],
      glycemiaSeriesGramsPerL: [],
    };
    const buffer = await buildPatientReportPdf(partial);
    const text = await extractText(buffer);
    expect(text).toMatch(/aucune mesure de tension enregistrée/i);
    expect(text).toMatch(/aucune mesure de glycémie enregistrée/i);
    // Poids et tour de taille, eux, ont toujours des données dans ce cas : la
    // courbe doit donc bien s'afficher (dernière valeur toujours présente).
    expect(text).toMatch(/Poids : 72\.5 kg/);
    expect(text).toMatch(/Tour de taille : 97 cm/);
  });

  it("indique explicitement l'absence de donnée pour les quatre paramètres à la fois", async () => {
    const empty: PatientReportData = {
      ...BASE_DATA,
      weightSeries: [],
      waistSeries: [],
      bloodPressureSeries: [],
      glycemiaSeriesGramsPerL: [],
    };
    const buffer = await buildPatientReportPdf(empty);
    const text = await extractText(buffer);
    expect(text).toMatch(/aucune mesure de tension enregistrée/i);
    expect(text).toMatch(/aucune mesure de glycémie enregistrée/i);
    expect(text).toMatch(/aucune mesure de poids enregistrée/i);
    expect(text).toMatch(/aucune mesure de tour de taille enregistrée/i);
  });

  it("produit toujours un buffer PDF valide, courbes incluses", async () => {
    const buffer = await buildPatientReportPdf(BASE_DATA);
    expect(buffer.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });
});
