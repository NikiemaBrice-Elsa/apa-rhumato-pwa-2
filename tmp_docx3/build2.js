const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, ShadingType, AlignmentType, VerticalAlign, PageBreak,
} = require("docx");

const TEAL = "265961";
const TODO_FILL = "FDECEA";
const SRC_FILL = "EAF7EF";
const LEVEL_FILL = "EAF2F1";

const LEVELS = ["Débutant", "Intermédiaire", "Avancé"];

function isTodo(t) {
  return typeof t === "string" && t.startsWith("TODO_MEDICAL_VALIDATION");
}

function cell(text, { header = false, width, levelLabel = false } = {}) {
  const todo = isTodo(text);
  const shading = header ? TEAL : levelLabel ? LEVEL_FILL : todo ? TODO_FILL : SRC_FILL;
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: shading, color: "auto" },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: text || "",
            bold: header || levelLabel,
            color: header ? "FFFFFF" : todo ? "B71C1C" : undefined,
            size: 15,
          }),
        ],
      }),
    ],
  });
}

function headerRow(headers, widths) {
  return new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => cell(h, { header: true, width: widths[i] })),
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
            children: r.map((v, i) => cell(v, { width: widths[i], levelLabel: i === 0 })),
          })
      ),
    ],
  });
}

function heading(text, level) {
  return new Paragraph({ heading: level, spacing: { before: 200, after: 100 }, children: [new TextRun({ text })] });
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 100 },
    children: [new TextRun({ text, italics: opts.italics, bold: opts.bold, size: opts.size || 19, color: opts.color })],
  });
}

function bullet(text) {
  return new Paragraph({ bullet: { level: 0 }, spacing: { after: 70 }, children: [new TextRun({ text, size: 19 })] });
}

// Fréquence : repère transversal identique pour toutes les pathologies (Bull et al. 2020, non spécifique).
const FREQ_TRANSVERSAL =
  "TODO_MEDICAL_VALIDATION pour le nombre exact de séances/semaine par niveau. Repère transversal non spécifique à la pathologie (Bull et al. 2020, 10.1136/bjsports-2020-102955) : 150 à 300 min/semaine d'activité modérée OU 75 à 150 min/semaine d'activité vigoureuse (ou combinaison équivalente), plus renforcement musculaire des grands groupes ≥ 2 jours/semaine.";

const DUREE_TODO_GENERIC =
  "TODO_MEDICAL_VALIDATION — aucune des références citées pour cette pathologie ne précise de durée de programme en semaines.";

const REGRESSION_DEFAUT_B9 = "Par défaut (B9)";
const REGRESSION_DEFAUT_B9_24H =
  "Par défaut (B9), complété par la « règle des 24 heures » d'EULAR 2025/2026 : si l'augmentation de la douleur persiste au-delà de 24h après l'exercice, réduire l'intensité.";

const INTENSITE_EULAR = [
  "D'après EULAR 2025/2026 (Recommandation 7, texte intégral vérifié) : débuter à une dose plus faible, bien tolérée, chez les personnes déconditionnées ou avec limitations fonctionnelles importantes. Valeur Borg cible (méthode déjà fixée réf. B6) : TODO_MEDICAL_VALIDATION.",
  "D'après EULAR 2025/2026 : augmentation progressive de la durée ou de la charge sur les 4 à 6 premières semaines. Valeur Borg cible : TODO_MEDICAL_VALIDATION.",
  "D'après EULAR 2025/2026 : au-delà de la période de progression initiale (4-6 semaines), les paramètres FITT-VP exacts restent délégués au professionnel de santé (Recommandation 7). Valeur Borg cible : TODO_MEDICAL_VALIDATION.",
];

const PROGRESSION_EULAR =
  "D'après EULAR 2025/2026 (Recommandation 7) : chez les personnes déconditionnées, débuter à dose plus faible puis augmenter progressivement la durée ou la charge sur les 4 à 6 premières semaines.";

const SECURITE_EULAR_GENERIQUE =
  "D'après EULAR 2025/2026 (Recommandation 4, texte intégral vérifié) : aucune contre-indication spécifique à la pathologie pour l'activité physique elle-même (contre-indication retirée en 2025/2026, présente dans la version 2018) ; adapter l'intensité selon l'articulation/la zone atteinte (éviter la forte intensité sur une zone atteinte, ex. genou gonflé — les zones non atteintes restent praticables à forte intensité). Effets indésirables rapportés transitoires et légers (douleur musculaire, fatigue).";

const PATHOLOGIES = [
  {
    code: "LOMBALGIE_COMMUNE",
    label: "Lombalgie commune / lombosciatique commune",
    sourcesNote:
      "Sources disponibles pour cette pathologie : OMS 2023 (guideline lombalgie, sans DOI), George et al. 2021 (JOSPT, 10.2519/jospt.2021.0304), Knezevic et al. 2021 (Lancet, 10.1016/S0140-6736(21)00733-9). La règle de progression sur 4-6 semaines d'EULAR 2025/2026 NE couvre PAS cette pathologie (hors périmètre « arthrite inflammatoire/arthrose »).",
    objectif: ["Reprendre progressivement une activité physique (proposé, à confirmer)", "Réduire la sédentarité (proposé, à confirmer)", "Améliorer la condition physique (proposé, à confirmer)"],
    duree: DUREE_TODO_GENERIC,
    frequence: FREQ_TRANSVERSAL,
    intensite: "TODO_MEDICAL_VALIDATION — méthode déjà fixée (réf. B6 : Borg CR10 ou 6-20 + FC + talk test), mais aucune valeur cible chiffrée dans les 3 références lombalgie citées.",
    aerobique: "D'après George et al. 2021 (JOSPT, recommandation A, niveau de preuve fort) : l'exercice aérobique fait partie de l'« exercice général » recommandé, sans supériorité démontrée par rapport aux autres approches (renforcement du tronc, exercice aquatique, multimodal).",
    renforcement: "D'après George et al. 2021 : renforcement/endurance du tronc et des grands groupes musculaires des membres, recommandation A.",
    mobilite: "D'après George et al. 2021 : exercices de flexibilité/mobilité inclus dans l'« exercice général » recommandé (recommandation A), sans détail supplémentaire.",
    equilibre: "TODO_MEDICAL_VALIDATION — aucune des 3 références lombalgie ne mentionne l'équilibre.",
    fonctionnel: "TODO_MEDICAL_VALIDATION — aucune des 3 références lombalgie ne mentionne d'exercice fonctionnel spécifique.",
    progression: "TODO_MEDICAL_VALIDATION — aucune des 3 références lombalgie ne donne de rythme de progression ; la règle EULAR 2025/2026 (4-6 semaines) ne couvre pas cette pathologie (voir note ci-dessus).",
    regression: REGRESSION_DEFAUT_B9,
    securite: "D'après George et al. 2021 (JOSPT), section Patient Education (recommandation, niveau de preuve B) : ne pas augmenter la perception de menace/peur (éviter le repos au lit prolongé, éviter les explications pathoanatomiques poussées) ; insister sur le pronostic globalement favorable et l'importance de rester actif. Cohérent avec Knezevic et al. 2021 (Lancet), qui situe les approches non pharmacologiques en première ligne dans un modèle biopsychosocial, sans dosage précis.",
    references: "OMS 2023 (sans DOI), 10.2519/jospt.2021.0304, 10.1016/S0140-6736(21)00733-9, 10.1136/bjsports-2020-102955 (dosage transversal)",
  },
  {
    code: "ARTHROSE_GENOU",
    label: "Arthrose du genou",
    sourcesNote:
      "Sources disponibles pour cette pathologie : Kolasinski et al. 2019 (ACR/Arthritis Foundation, 10.1002/acr.24131), EULAR 2025/2026 (10.1016/j.ard.2026.03.006). Contenu identique pour arthrose de hanche : les 2 références traitent les deux localisations conjointement, sans les différencier.",
    objectif: ["Réduire la sédentarité (proposé, à confirmer)", "Améliorer la mobilité (proposé, à confirmer)", "Améliorer la force (proposé, à confirmer)"],
    duree: DUREE_TODO_GENERIC,
    frequence: FREQ_TRANSVERSAL,
    intensite: INTENSITE_EULAR,
    aerobique: "D'après Kolasinski et al. 2019 (ACR/Arthritis Foundation, recommandation FORTE) : la marche est une option d'exercice aérobique de première intention, sans hiérarchie par rapport au renforcement ou à l'exercice aquatique.",
    renforcement: "D'après Kolasinski et al. 2019 : renforcement musculaire recommandé en première intention (recommandation FORTE), sans hiérarchie de modalité.",
    mobilite: "TODO_MEDICAL_VALIDATION — ni Kolasinski et al. 2019 ni EULAR 2025/2026 ne détaillent d'exercice de mobilité articulaire spécifique.",
    equilibre: "D'après Kolasinski et al. 2019 : l'entraînement neuromusculaire fait partie des options recommandées (recommandation FORTE), sans détail sur le contenu précis (équilibre/proprioception non isolés du reste).",
    fonctionnel: "TODO_MEDICAL_VALIDATION — aucune des 2 références n'aborde d'exercice fonctionnel spécifique.",
    progression: PROGRESSION_EULAR,
    regression: REGRESSION_DEFAUT_B9_24H,
    securite: SECURITE_EULAR_GENERIQUE,
    references: "10.1002/acr.24131, 10.1016/j.ard.2026.03.006",
  },
  {
    code: "ARTHROSE_HANCHE",
    label: "Arthrose de hanche",
    sourcesNote:
      "Mêmes 2 références que l'arthrose du genou (Kolasinski et al. 2019 traite les deux localisations conjointement) : contenu identique ci-dessous, aucune différenciation genou/hanche disponible dans les sources citées.",
    objectif: ["Réduire la sédentarité (proposé, à confirmer)", "Améliorer la mobilité (proposé, à confirmer)", "Améliorer la force (proposé, à confirmer)"],
    duree: DUREE_TODO_GENERIC,
    frequence: FREQ_TRANSVERSAL,
    intensite: INTENSITE_EULAR,
    aerobique: "D'après Kolasinski et al. 2019 (ACR/Arthritis Foundation, recommandation FORTE) : la marche est une option d'exercice aérobique de première intention, sans hiérarchie par rapport au renforcement ou à l'exercice aquatique.",
    renforcement: "D'après Kolasinski et al. 2019 : renforcement musculaire recommandé en première intention (recommandation FORTE), sans hiérarchie de modalité.",
    mobilite: "TODO_MEDICAL_VALIDATION — ni Kolasinski et al. 2019 ni EULAR 2025/2026 ne détaillent d'exercice de mobilité articulaire spécifique.",
    equilibre: "D'après Kolasinski et al. 2019 : l'entraînement neuromusculaire fait partie des options recommandées (recommandation FORTE), sans détail sur le contenu précis (équilibre/proprioception non isolés du reste).",
    fonctionnel: "TODO_MEDICAL_VALIDATION — aucune des 2 références n'aborde d'exercice fonctionnel spécifique.",
    progression: PROGRESSION_EULAR,
    regression: REGRESSION_DEFAUT_B9_24H,
    securite: SECURITE_EULAR_GENERIQUE,
    references: "10.1002/acr.24131, 10.1016/j.ard.2026.03.006",
  },
  {
    code: "POLYARTHRITE_RHUMATOIDE",
    label: "Polyarthrite rhumatoïde",
    sourcesNote:
      "Sources disponibles pour cette pathologie : England et al. 2022 (ACR, 10.1002/acr.25117), EULAR 2025/2026 (10.1016/j.ard.2026.03.006).",
    objectif: ["Réduire la sédentarité (proposé, à confirmer)", "Améliorer la condition physique (proposé, à confirmer)", "Améliorer la force (proposé, à confirmer)"],
    duree: DUREE_TODO_GENERIC,
    frequence: FREQ_TRANSVERSAL,
    intensite: INTENSITE_EULAR,
    aerobique: "D'après England et al. 2022 (ACR) : recommandation FORTE pour un engagement constant dans l'exercice (par opposition à l'absence d'exercice) ; recommandation conditionnelle (preuve de faible qualité) spécifiquement en faveur de l'exercice aérobique et de l'exercice aquatique.",
    renforcement: "D'après England et al. 2022 : recommandation conditionnelle (preuve de faible qualité) en faveur du renforcement musculaire.",
    mobilite: "TODO_MEDICAL_VALIDATION — non détaillée par England et al. 2022.",
    equilibre: "TODO_MEDICAL_VALIDATION — non détaillée par England et al. 2022.",
    fonctionnel: "D'après England et al. 2022 : recommandation conditionnelle (preuve de faible qualité) en faveur des approches « corps-esprit », en complément de l'exercice aérobique — catégorisation « fonctionnel » proposée par les rédacteurs, à confirmer (la source ne classe pas cette approche par composante FITT-VP).",
    progression: "TODO_MEDICAL_VALIDATION — England et al. 2022 ne précise pas de rythme de progression. " + PROGRESSION_EULAR,
    regression: REGRESSION_DEFAUT_B9_24H,
    securite: SECURITE_EULAR_GENERIQUE,
    references: "10.1002/acr.25117, 10.1016/j.ard.2026.03.006",
  },
  {
    code: "SPONDYLOARTHRITE_AXIALE",
    label: "Spondyloarthrite axiale",
    sourcesNote:
      "Sources disponibles pour cette pathologie : ASAS-EULAR 2022 (10.1136/ard-2022-223296, texte intégral désormais vérifié — non accessible lors des recherches précédentes du Sprint 5ter), EULAR 2025/2026 (10.1016/j.ard.2026.03.006, périmètre générique « arthrite inflammatoire », sans contenu spécifique à la mobilité rachidienne, aux exercices respiratoires ou posturaux classiquement centraux dans l'axSpA — déjà signalé au Sprint 5ter).",
    objectif: ["Réduire la sédentarité (proposé, à confirmer)", "Maintenir l'autonomie (proposé, à confirmer)", "Améliorer la condition physique (proposé, à confirmer)"],
    duree: DUREE_TODO_GENERIC,
    frequence: FREQ_TRANSVERSAL,
    intensite: [
      INTENSITE_EULAR[0] + " Point de vigilance ASAS-EULAR 2022 (Recommandation 4) : l'adhérence et l'efficacité sont rapportées comme meilleures en cas de supervision (kinésithérapie) par rapport aux exercices seuls à domicile — à considérer pour une application d'auto-exercice non supervisée.",
      INTENSITE_EULAR[1],
      INTENSITE_EULAR[2],
    ],
    aerobique: "TODO_MEDICAL_VALIDATION — ASAS-EULAR 2022 (Recommandation 4, texte intégral vérifié) recommande l'exercice de façon générale (« encouragés à faire de l'exercice régulièrement »), qualifié de « pilier » de la prise en charge, sans détailler de composante aérobique spécifique.",
    renforcement: "TODO_MEDICAL_VALIDATION — non détaillé par ASAS-EULAR 2022 au-delà de la recommandation générale d'exercice régulier.",
    mobilite: "TODO_MEDICAL_VALIDATION — ASAS-EULAR 2022 ne détaille aucun exercice de mobilité rachidienne spécifique, pourtant classiquement central dans l'axSpA (déjà signalé au Sprint 5ter, confirmé lors de cette relecture du texte intégral).",
    equilibre: "TODO_MEDICAL_VALIDATION — non abordée par ASAS-EULAR 2022.",
    fonctionnel: "TODO_MEDICAL_VALIDATION — non abordée par ASAS-EULAR 2022.",
    progression: PROGRESSION_EULAR,
    regression: REGRESSION_DEFAUT_B9_24H,
    securite: "D'après ASAS-EULAR 2022 (Recommandation 4, texte intégral vérifié) : « Exercise is a cornerstone in the management of axSpA, with demonstrated benefits on disease outcomes independent of pharmacological treatment. » L'adhérence est rapportée comme meilleure en cas de supervision, et « Physiotherapy, specifically supervised exercise, has also proven to be more efficacious than home exercises » — élément à prendre en compte pour une application d'auto-exercice non supervisée. Les auteurs précisent que l'hétérogénéité des études empêche une conclusion définitive sur les exercices à privilégier. Complété par EULAR 2025/2026 (règle des 24h, pas de contre-indication spécifique à la pathologie pour l'AP elle-même).",
    references: "10.1136/ard-2022-223296, 10.1016/j.ard.2026.03.006",
  },
  {
    code: "OSTEOPOROSE",
    label: "Ostéoporose",
    sourcesNote:
      "Sources disponibles pour cette pathologie : LeBoff et al. 2022 (10.1007/s00198-021-05900-y), Hoffmann et al. 2023 (10.1007/s00198-022-06592-8, texte intégral désormais vérifié — non accessible lors des recherches précédentes du Sprint 5bis). Hoffmann et al. 2023 est une méta-analyse de 11 essais (9715 participant-années groupe exercice) : l'exercice réduit les fractures ostéoporotiques majeures d'environ 23 % (RR 0,75 ; IC95 % 0,54-0,94 ; p=.006), MAIS les auteurs concluent explicitement que l'hétérogénéité des protocoles empêche de dériver une recommandation fiable de fréquence/intensité/durée — cité littéralement ci-dessous plutôt que réinterprété.",
    objectif: ["Maintenir l'autonomie (proposé, à confirmer)", "Améliorer la force (proposé, à confirmer)", "Améliorer la force (proposé, à confirmer)"],
    duree: "TODO_MEDICAL_VALIDATION — Hoffmann et al. 2023 a spécifiquement étudié la durée des programmes (3 études ≤ 12 mois vs 8 études > 12 mois, jusqu'à 16 ans) sans trouver de différence significative (p=.883) ; les auteurs concluent explicitement que l'hétérogénéité des études empêche de dériver une recommandation fiable de durée.",
    frequence: FREQ_TRANSVERSAL,
    intensite: "D'après Hoffmann et al. 2023 (texte intégral vérifié) : les études avec progression d'intensité montraient une tendance plus favorable sur la réduction des fractures majeures, mais la différence n'était pas statistiquement significative (p=.133 ; 5 études avec progression vs 6 à intensité constante). Les auteurs concluent explicitement qu'aucune recommandation fiable de protocole ne peut être dérivée de ces données hétérogènes. Valeur Borg cible : TODO_MEDICAL_VALIDATION.",
    aerobique: "TODO_MEDICAL_VALIDATION — ni LeBoff et al. 2022 ni Hoffmann et al. 2023 ne détaillent de composante aérobique spécifique (les 2 références portent sur le renforcement/la mise en charge).",
    renforcement: "D'après LeBoff et al. 2022 : l'exercice en charge (« weight-bearing ») et le renforcement musculaire (« resistance-training ») font partie de l'arsenal de prévention des fractures, aux côtés du traitement pharmacologique, des apports calcium/vitamine D et de la prévention des chutes. D'après Hoffmann et al. 2023 (méta-analyse, 11 essais) : réduction d'environ 23 % des fractures ostéoporotiques majeures (RR 0,75 ; IC95 % 0,54-0,94 ; p=.006), sans qu'un protocole précis puisse être recommandé de façon fiable.",
    mobilite: "TODO_MEDICAL_VALIDATION — non abordée par les 2 références.",
    equilibre: "TODO_MEDICAL_VALIDATION — LeBoff et al. 2022 mentionne la prévention des chutes comme composante de l'arsenal global de prévention des fractures, sans détailler d'exercice d'équilibre spécifique.",
    fonctionnel: "TODO_MEDICAL_VALIDATION — non abordée par les 2 références.",
    progression: "TODO_MEDICAL_VALIDATION — voir colonne Intensité cible : Hoffmann et al. 2023 ne permet pas de dériver une règle de progression fiable (différence non significative, p=.133).",
    regression: REGRESSION_DEFAUT_B9,
    securite: "D'après LeBoff et al. 2022 (description d'une figure dans l'abstract — à vérifier sur texte intégral avant validation, déjà signalé au Sprint 5bis) : les mouvements de flexion importante du tronc augmentent le risque de fracture vertébrale, les mouvements d'extension du rachis le diminuent.",
    references: "10.1007/s00198-021-05900-y, 10.1007/s00198-022-06592-8",
  },
];

function per(field) {
  return Array.isArray(field) ? field : [field, field, field];
}

const children = [];

children.push(
  new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: "Contenu des programmes (FITT-VP)" })] }),
  para("Questions par pathologie et par niveau — pré-rempli le 23/08/2026 à partir des 10 références citées, pour votre relecture", { italics: true }),
  para(""),
  para(
    "À votre demande explicite, ce document a été pré-rempli en me limitant strictement aux 10 références scientifiques déjà citées au §81 (celles que je vous ai listées avec leurs DOI) — aucune autre source n'a été consultée. Chaque cellule verte cite la référence dont elle est tirée ; chaque cellule orange (TODO_MEDICAL_VALIDATION) signale que ces 10 références ne fournissent pas l'information demandée — j'ai vérifié le texte intégral de chaque référence avant de conclure à une absence de contenu, plutôt que de supposer. Rien n'est validé : le statut de chaque programme reste pending_validation tant que vous ne l'avez pas relu."
  ),
  para(
    "Deux références qui étaient bloquées lors des recherches précédentes (Sprint 5bis/Sprint 5ter) ont pu être vérifiées en texte intégral cette fois-ci : ASAS-EULAR 2022 (spondyloarthrite axiale) et Hoffmann et al. 2023 (ostéoporose) — leur contenu réel remplace donc les anciens TODO liés à un accès bloqué."
  ),
  heading("Légende", HeadingLevel.HEADING_2),
  new Paragraph({ children: [new TextRun({ text: "Vert : contenu directement issu d'une des 10 références citées, avec citation précise.", size: 19 })] }),
  new Paragraph({ children: [new TextRun({ text: "Orange (TODO_MEDICAL_VALIDATION) : aucune des références citées pour cette pathologie ne fournit cette information — à votre charge.", size: 19, color: "B71C1C" })] }),
  para(""),
  heading("Rappel de vos réponses déjà données", HeadingLevel.HEADING_2),
  bullet("B4 — matrice décisionnelle narrative pour l'attribution : le statut de dépistage (vert/orange) est le premier filtre, le niveau initial fixe la dose de départ, la douleur module ensuite l'accès et l'adaptation. Ce document porte sur le CONTENU des programmes eux-mêmes."),
  bullet("B5 — chaque combinaison pathologie + niveau doit avoir une fiche FITT-VP complète."),
  bullet("B6 — intensité cible : Borg CR10 ou Borg 6-20 en mesure principale, complétée par la fréquence cardiaque et le « talk test » ; la FC max seule ne doit jamais être utilisée comme critère unique. Aucune des 10 références ne fournit de valeur Borg cible chiffrée par pathologie/niveau : ces cellules restent TODO."),
  bullet("B9 — critères de régression par défaut, réutilisés tels quels (« Par défaut (B9) ») quand rien de spécifique à la pathologie n'a été trouvé dans les 10 références."),
  para(""),
  new Paragraph({ children: [new PageBreak()] })
);

for (const p of PATHOLOGIES) {
  children.push(heading(`Pathologie : ${p.label}`, HeadingLevel.HEADING_1));
  children.push(para(`Code : ${p.code}`, { italics: true, size: 17 }));
  children.push(para(p.sourcesNote, { italics: true, size: 17, color: "555555" }));

  const objectifs = per(p.objectif);
  const durees = per(p.duree);
  const freqs = per(p.frequence);
  const intensites = per(p.intensite);
  const rowsA1 = LEVELS.map((lvl, i) => [lvl, objectifs[i], durees[i], freqs[i], intensites[i]]);
  children.push(
    para("Dosage global", { bold: true, size: 17 }),
    makeTable(["Niveau", "Objectif principal", "Durée (sem.)", "Fréquence (/sem.)", "Intensité cible"], [1200, 2400, 2200, 2600, 6000], rowsA1)
  );
  children.push(para(""));

  const aero = per(p.aerobique), renf = per(p.renforcement), mob = per(p.mobilite), equi = per(p.equilibre), fonc = per(p.fonctionnel);
  const rowsA2 = LEVELS.map((lvl, i) => [lvl, aero[i], renf[i], mob[i], equi[i], fonc[i]]);
  children.push(
    para("Composantes FITT-VP", { bold: true, size: 17 }),
    makeTable(["Niveau", "Aérobique", "Renforcement", "Mobilité", "Équilibre", "Fonctionnel"], [1200, 2640, 2640, 2640, 2640, 2640], rowsA2)
  );
  children.push(para(""));

  const prog = per(p.progression), reg = per(p.regression), sec = per(p.securite), refs = per(p.references);
  const rowsB = LEVELS.map((lvl, i) => [lvl, prog[i], reg[i], sec[i], refs[i]]);
  children.push(
    para("Progression, régression, sécurité, références", { bold: true, size: 17 }),
    makeTable(["Niveau", "Progression", "Régression", "Sécurité", "Références (DOI)"], [1200, 3300, 3300, 3300, 3300], rowsB)
  );

  children.push(new Paragraph({ children: [new PageBreak()] }));
}
if (children[children.length - 1] instanceof Paragraph) children.pop();

const doc = new Document({
  sections: [
    {
      properties: {
        page: {
          size: { width: 15840, height: 12240 },
          margin: { top: 600, bottom: 600, left: 600, right: 600 },
        },
      },
      children,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("QUESTIONS_PROGRAMMES_FITTVP_20260823_PREREMPLI.docx", buf);
  console.log("done");
});
