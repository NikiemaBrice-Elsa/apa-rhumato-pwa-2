const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, ShadingType, AlignmentType, BorderStyle, PageOrientation, PageBreak,
  VerticalAlign, convertInchesToTwip,
} = require("docx");

const TEAL = "265961";
const LIGHT = "EAF2F1";

const PATHOLOGIES = [
  ["LOMBALGIE_COMMUNE", "Lombalgie commune / lombosciatique commune"],
  ["ARTHROSE_GENOU", "Arthrose du genou"],
  ["ARTHROSE_HANCHE", "Arthrose de hanche"],
  ["POLYARTHRITE_RHUMATOIDE", "Polyarthrite rhumatoïde"],
  ["SPONDYLOARTHRITE_AXIALE", "Spondyloarthrite axiale"],
  ["OSTEOPOROSE", "Ostéoporose"],
];

const LEVELS = ["Débutant", "Intermédiaire", "Avancé"];

function cell(text, { header = false, width, bold = false, shading = null, align = AlignmentType.LEFT } = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: shading ? { type: ShadingType.CLEAR, fill: shading, color: "auto" } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [
      new Paragraph({
        alignment: align,
        children: [
          new TextRun({
            text,
            bold: header || bold,
            color: header ? "FFFFFF" : undefined,
            size: 16,
          }),
        ],
      }),
    ],
  });
}

function headerRow(headers, widths) {
  return new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => cell(h, { header: true, width: widths[i], shading: TEAL })),
  });
}

function makeTable(headers, widths, rows) {
  return new Table({
    width: { size: 14400, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      headerRow(headers, widths),
      ...rows.map(
        (r) =>
          new TableRow({
            children: r.map((v, i) =>
              cell(v.text, { width: widths[i], shading: v.shading, bold: v.bold })
            ),
          })
      ),
    ],
  });
}

function heading(text, level) {
  return new Paragraph({ heading: level, spacing: { before: 240, after: 120 }, children: [new TextRun({ text })] });
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, italics: opts.italics, bold: opts.bold, size: opts.size || 20 })],
  });
}

function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, size: 20 })],
  });
}

const children = [];

children.push(
  new Paragraph({
    heading: HeadingLevel.TITLE,
    children: [new TextRun({ text: "Contenu des programmes (FITT-VP)" })],
  }),
  para("Questions par pathologie et par niveau — 23/08/2026", { italics: true }),
  para(""),
  para(
    "Ce document remplace le gabarit Excel « gabarit_programmes_apa_rhumato.xlsx » transmis précédemment : à partir de maintenant, tout ce qui relève de votre décision (contenu clinique, validation, choix narratifs) vous sera transmis sous cette forme — un document Word en questions/réponses — plutôt qu'un fichier Excel."
  ),
  para(
    "Objet (§29, §30, §67, §68 du cahier des charges) : la table « programs » est prête techniquement mais entièrement vide. Chaque combinaison pathologie × niveau (débutant/intermédiaire/avancé) a besoin d'une fiche FITT-VP complète pour qu'un programme réel puisse un jour être proposé à un patient. Rien n'est inventé en attendant (§57, §59) : aucune valeur numérique de dosage n'est pré-remplie ci-dessous."
  ),
  heading("Rappel de vos réponses déjà données", HeadingLevel.HEADING_2),
  bullet(
    "B4 — matrice décisionnelle narrative pour l'attribution : le statut de dépistage (vert/orange) est le premier filtre, le niveau initial fixe la dose de départ, la douleur module ensuite l'accès et l'adaptation. Ce document porte sur le CONTENU des programmes eux-mêmes ; la traduction de B4 en règles d'attribution viendra une fois ce document rempli."
  ),
  bullet(
    "B5 — chaque combinaison pathologie + niveau doit avoir une fiche FITT-VP complète : c'est l'objet des colonnes ci-dessous (Fréquence, Intensité, Temps/durée, Type, Volume, Progression)."
  ),
  bullet(
    "B6 — intensité cible : Borg CR10 ou Borg 6-20 en mesure principale, complétée par la fréquence cardiaque et le « talk test » quand pertinent/disponible ; la FC max seule ne doit jamais être utilisée comme critère unique."
  ),
  bullet(
    "B9 — critères de régression par défaut (déjà répondus, applicables à toute combinaison sauf précision contraire) : aggravation de la douleur au-delà de 24h, symptômes répétés, gonflement/raideur nouveaux, baisse fonctionnelle, fatigue excessive ou incapacité à réaliser l'exercice — un signal isolé et résolutif reste une simple alerte, pas une régression automatique. Vous pouvez écrire « Par défaut (B9) » dans la colonne Régression si rien de spécifique n'est nécessaire pour une combinaison donnée."
  ),
  heading("Comment répondre", HeadingLevel.HEADING_2),
  bullet("Une combinaison pathologie × niveau par ligne. Laissez une ligne quasiment vide si elle n'a pas lieu d'exister en V1."),
  bullet("« Objectif principal » : un objectif du cahier des charges (§22), en texte libre — ex. « Améliorer la mobilité »."),
  bullet("« Références » : uniquement des DOI déjà présents dans la base documentaire, ou laissez vide."),
  bullet(
    "Les exercices précis de chaque programme ne sont volontairement pas demandés ici : cette étape viendra une fois la bibliothèque d'exercices validée (relecture en cours dans /admin/exercices)."
  ),
  new Paragraph({ children: [new PageBreak()] })
);

for (const [code, label] of PATHOLOGIES) {
  children.push(heading(`Pathologie : ${label}`, HeadingLevel.HEADING_1));
  children.push(para(`Code : ${code}`, { italics: true, size: 18 }));
  children.push(para("Merci de compléter les paramètres suivants pour les 3 niveaux."));

  const rowsA1 = LEVELS.map((lvl) => [
    { text: lvl, bold: true },
    { text: "" },
    { text: "" },
    { text: "" },
    { text: "" },
  ]);
  children.push(
    para("Dosage global", { bold: true, size: 18 }),
    makeTable(
      ["Niveau", "Objectif principal", "Durée (sem.)", "Fréquence (/sem.)", "Intensité cible"],
      [1600, 3200, 2200, 2200, 5200],
      rowsA1
    )
  );

  children.push(para(""));

  const rowsA2 = LEVELS.map((lvl) => [
    { text: lvl, bold: true },
    { text: "" },
    { text: "" },
    { text: "" },
    { text: "" },
    { text: "" },
  ]);
  children.push(
    para("Composantes FITT-VP", { bold: true, size: 18 }),
    makeTable(
      ["Niveau", "Aérobique", "Renforcement", "Mobilité", "Équilibre", "Fonctionnel"],
      [1600, 2560, 2560, 2560, 2560, 2560],
      rowsA2
    )
  );

  children.push(para(""));

  const rowsB = LEVELS.map((lvl) => [
    { text: lvl, bold: true },
    { text: "" },
    { text: "" },
    { text: "" },
    { text: "" },
  ]);
  children.push(
    para("Progression, régression, sécurité, références", { bold: true, size: 18 }),
    makeTable(
      ["Niveau", "Progression", "Régression", "Sécurité", "Références (DOI)"],
      [1600, 3200, 3200, 3200, 3200],
      rowsB
    )
  );

  children.push(new Paragraph({ children: [new PageBreak()] }));
}

// Remove trailing page break
if (children[children.length - 1] instanceof Paragraph) {
  children.pop();
}

const doc = new Document({
  sections: [
    {
      properties: {
        page: {
          size: { width: 15840, height: 12240 },
          margin: { top: 720, bottom: 720, left: 720, right: 720 },
        },
      },
      children,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("QUESTIONS_PROGRAMMES_FITTVP_20260823.docx", buf);
  console.log("done");
});
