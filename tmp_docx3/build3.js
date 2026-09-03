const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak,
  Table, TableRow, TableCell, WidthType, ShadingType, VerticalAlign, BorderStyle,
} = require("docx");

const data = JSON.parse(fs.readFileSync("exercises_data.json", "utf8"));

const TEAL = "265961";
const TODO_COLOR = "B71C1C";

function isTodo(t) {
  return typeof t === "string" && t.startsWith("TODO_MEDICAL_VALIDATION");
}

function label(text) {
  return new TextRun({ text, bold: true, size: 20 });
}

function fieldParagraph(labelText, value) {
  if (!value) return null;
  const todo = isTodo(value);
  return new Paragraph({
    spacing: { after: 120 },
    children: [
      label(labelText + " — "),
      new TextRun({ text: value, size: 20, color: todo ? TODO_COLOR : undefined, italics: todo }),
    ],
  });
}

function heading(text, level) {
  return new Paragraph({ heading: level, spacing: { before: 200, after: 100 }, children: [new TextRun({ text })] });
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 100 },
    children: [new TextRun({ text, italics: opts.italics, bold: opts.bold, size: opts.size || 20, color: opts.color })],
  });
}

function bullet(text) {
  return new Paragraph({ bullet: { level: 0 }, spacing: { after: 70 }, children: [new TextRun({ text, size: 20 })] });
}

function decisionBox() {
  return new Table({
    width: { size: 9350, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: TEAL },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: TEAL },
      left: { style: BorderStyle.SINGLE, size: 4, color: TEAL },
      right: { style: BorderStyle.SINGLE, size: 4, color: TEAL },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: TEAL },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: TEAL },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 9350, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: "EAF2F1", color: "auto" },
            margins: { top: 120, bottom: 120, left: 150, right: 150 },
            children: [
              new Paragraph({ children: [new TextRun({ text: "Votre décision", bold: true, size: 21 })], spacing: { after: 100 } }),
              new Paragraph({
                spacing: { after: 100 },
                children: [new TextRun({ text: "Statut retenu (entourer ou écrire) :  draft   /   pending_validation   /   validated   /   retiré", size: 20 })],
              }),
              new Paragraph({
                spacing: { after: 60 },
                children: [new TextRun({ text: "Modifications ou compléments à apporter avant validation :", size: 20 })],
              }),
              new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: " ", size: 20 })], border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "999999" } } }),
              new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: " ", size: 20 })], border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "999999" } } }),
              new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: " ", size: 20 })], border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "999999" } } }),
            ],
          }),
        ],
      }),
    ],
  });
}

const children = [];

children.push(
  new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: "Relecture des 8 exercices brouillon" })] }),
  para("Bibliothèque d'exercices — 23/08/2026, pour votre validation", { italics: true }),
  para(""),
  para(
    "Ces 8 exercices ont été rédigés au Sprint 5bis/5ter (19/08/2026) à partir des références déjà citées au §81, et sont désormais chargés en base (infra/db/seed/0010_..._20260819.sql), consultables et modifiables dans /admin/exercices. Ils sont tous au statut pending_validation : aucun n'est visible des patients tant que vous ne le validez pas explicitement."
  ),
  para(
    "Deux notes ont été mises à jour depuis leur première rédaction (23/08/2026) : Hoffmann et al. 2023 (exercices 6 et 7, ostéoporose) et ASAS-EULAR 2022 (exercice 8, spondyloarthrite axiale) étaient inaccessibles lors de la première recherche — leur texte intégral a pu être vérifié depuis, le contenu ci-dessous reflète cette mise à jour."
  ),
  para("Le texte en rouge/italique (TODO_MEDICAL_VALIDATION) signale une information qu'aucune des références consultées ne fournit — à votre charge.", { color: TODO_COLOR }),
  para(""),
  new Paragraph({ children: [new PageBreak()] })
);

data.forEach((ex, idx) => {
  children.push(heading(`Exercice ${idx + 1} — ${ex.name}`, HeadingLevel.HEADING_1));
  children.push(
    para(
      `Pathologie(s) : ${ex.pathologies_label}   |   Catégorie : ${ex.category}   |   Objectifs : ${ex.objectives_label}   |   Matériel : ${ex.equipment_required || "aucun"}`,
      { italics: true, size: 18 }
    )
  );
  children.push(para(""));
  const f = fieldParagraph;
  const paras = [
    f("Description courte", ex.short_description),
    f("Description détaillée", ex.detailed_description),
    f("Intensité", ex.intensity),
    f("Progression", ex.progression),
    f("Régression", ex.regression),
    f("Contre-indications", ex.contraindications),
    f("Précautions", ex.precautions),
    f("Critères d'arrêt", ex.stop_criteria),
    f("Muscles ciblés", ex.target_muscles),
    f("Références (DOI)", ex.scientific_references),
  ].filter(Boolean);
  paras.forEach((p) => children.push(p));
  children.push(para(""));
  children.push(decisionBox());
  children.push(new Paragraph({ children: [new PageBreak()] }));
});
if (children[children.length - 1] instanceof Paragraph) children.pop();

const doc = new Document({
  sections: [
    {
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 720, bottom: 720, left: 900, right: 900 } } },
      children,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("RELECTURE_EXERCICES_20260823.docx", buf);
  console.log("done");
});
