const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, ShadingType, AlignmentType, VerticalAlign, PageBreak,
} = require("docx");

const TEAL = "265961";
const PROP_FILL = "E3F2FD";
const PROP_COLOR = "1565C0";
const SRC_FILL = "EAF7EF";
const LEVEL_FILL = "EAF2F1";

const LEVELS = ["Débutant", "Intermédiaire", "Avancé"];

function isProp(t) {
  return typeof t === "string" && t.startsWith("PROPOSITION");
}

function cell(text, { header = false, width, levelLabel = false } = {}) {
  const prop = isProp(text);
  const shading = header ? TEAL : levelLabel ? LEVEL_FILL : prop ? PROP_FILL : SRC_FILL;
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
            color: header ? "FFFFFF" : prop ? PROP_COLOR : undefined,
            italics: prop,
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

// ---- Repères génériques (proposition), documentés une fois ----
const P = (s) => "PROPOSITION (hors des 10 références citées, repères génériques d'exercice thérapeutique — à valider) — " + s;

const FREQ_TRANSVERSAL_SRC =
  "Repère transversal non spécifique à la pathologie (Bull et al. 2020, 10.1136/bjsports-2020-102955) : 150 à 300 min/semaine d'activité modérée OU 75 à 150 min/semaine d'activité vigoureuse (ou combinaison équivalente), plus renforcement musculaire des grands groupes ≥ 2 jours/semaine. ";

const FREQ_PROPOSAL = [
  P(FREQ_TRANSVERSAL_SRC + "Traduction proposée en séances/semaine, en cohérence avec ce volume : 2 à 3 séances/semaine (jours non consécutifs pour le renforcement)."),
  P(FREQ_TRANSVERSAL_SRC + "Traduction proposée : 3 à 4 séances/semaine."),
  P(FREQ_TRANSVERSAL_SRC + "Traduction proposée : 4 à 5 séances/semaine, réparties pour respecter 48h entre 2 sollicitations du même groupe musculaire en renforcement."),
];

const DUREE_PROPOSAL_STD =
  P("Phase initiale de 8 semaines (fenêtre usuelle d'un premier cycle de réadaptation), avec réévaluation clinique avant reconduction, changement de niveau ou ajustement.");
const DUREE_PROPOSAL_INTERMEDIAIRE = P("8 à 12 semaines, réévaluation clinique à l'issue.");
const DUREE_PROPOSAL_AVANCE = P("Programme continu par cycles de 8 à 12 semaines, avec réévaluation à chaque cycle plutôt qu'une durée fixe unique.");

function borgProposal(level, note) {
  const table = {
    0: "intensité légère, Borg CR10 ≈ 2-3 (ou Borg 6-20 ≈ 10-11) : effort perceptible mais confortable, talk test largement positif (parle sans difficulté).",
    1: "intensité modérée, Borg CR10 ≈ 3-4 (ou Borg 6-20 ≈ 12-13) : talk test positif (parle mais ne chante pas).",
    2: "intensité modérée à modérément soutenue, Borg CR10 ≈ 4-5 (ou Borg 6-20 ≈ 13-14), sans dépasser ce palier par prudence en pathologie rhumatologique ; talk test à la limite (phrases courtes).",
  };
  return P(`Valeur cible proposée (méthode déjà fixée réf. B6) : ${table[level]}${note ? " " + note : ""}`);
}

const PROGRESSION_STD = P(
  "Règle de progression usuelle en réadaptation : augmenter le volume (durée ou charge), pas l'intensité et le volume en même temps, de 5 à 10 % par semaine si bonne tolérance (pas d'aggravation de la douleur au-delà de 24h, pas de nouveau signal d'alerte) ; réévaluer tous les 15 jours plutôt qu'à chaque séance."
);
const PROGRESSION_STD_EULAR = (eularText) =>
  eularText + " " + P("Au-delà des 4 à 6 premières semaines (EULAR 2025/2026), progression usuelle proposée : +5 à 10 % du volume par semaine si bonne tolérance, réévaluation tous les 15 jours.");

const REGRESSION_DEFAUT_B9 = "Par défaut (B9)";
const REGRESSION_DEFAUT_B9_24H =
  "Par défaut (B9), complété par la « règle des 24 heures » d'EULAR 2025/2026 : si l'augmentation de la douleur persiste au-delà de 24h après l'exercice, réduire l'intensité.";

const INTENSITE_EULAR = [
  "D'après EULAR 2025/2026 (Recommandation 7, texte intégral vérifié) : débuter à une dose plus faible, bien tolérée, chez les personnes déconditionnées ou avec limitations fonctionnelles importantes. " + borgProposal(0),
  "D'après EULAR 2025/2026 : augmentation progressive de la durée ou de la charge sur les 4 à 6 premières semaines. " + borgProposal(1),
  "D'après EULAR 2025/2026 : au-delà de la période de progression initiale (4-6 semaines), les paramètres FITT-VP exacts restent délégués au professionnel de santé (Recommandation 7). " + borgProposal(2),
];

const PROGRESSION_EULAR =
  "D'après EULAR 2025/2026 (Recommandation 7) : chez les personnes déconditionnées, débuter à dose plus faible puis augmenter progressivement la durée ou la charge sur les 4 à 6 premières semaines. " +
  P("Au-delà, progression usuelle : +5 à 10 % du volume par semaine si bonne tolérance, réévaluation tous les 15 jours.");

const SECURITE_EULAR_GENERIQUE =
  "D'après EULAR 2025/2026 (Recommandation 4, texte intégral vérifié) : aucune contre-indication spécifique à la pathologie pour l'activité physique elle-même (contre-indication retirée en 2025/2026, présente dans la version 2018) ; adapter l'intensité selon l'articulation/la zone atteinte (éviter la forte intensité sur une zone atteinte, ex. genou gonflé — les zones non atteintes restent praticables à forte intensité). Effets indésirables rapportés transitoires et légers (douleur musculaire, fatigue).";

const PATHOLOGIES = [
  {
    code: "LOMBALGIE_COMMUNE",
    label: "Lombalgie commune / lombosciatique commune",
    sourcesNote:
      "Sources disponibles : OMS 2023 (guideline lombalgie, sans DOI), George et al. 2021 (JOSPT, 10.2519/jospt.2021.0304), Knezevic et al. 2021 (Lancet, 10.1016/S0140-6736(21)00733-9). La règle de progression 4-6 semaines d'EULAR 2025/2026 NE couvre PAS cette pathologie. Cellules bleues : propositions de l'assistant sur repères génériques d'exercice thérapeutique (ACSM, Borg), hors des 10 références — à valider.",
    objectif: ["Reprendre progressivement une activité physique (proposé, à confirmer)", "Réduire la sédentarité (proposé, à confirmer)", "Améliorer la condition physique (proposé, à confirmer)"],
    duree: [DUREE_PROPOSAL_STD, DUREE_PROPOSAL_INTERMEDIAIRE, DUREE_PROPOSAL_AVANCE],
    frequence: FREQ_PROPOSAL,
    intensite: [
      borgProposal(0, "Marche continue 10 à 15 minutes en une fois."),
      borgProposal(1, "Marche continue 20 à 25 minutes, ou fractionnée équivalente."),
      borgProposal(2, "Marche continue 25 à 35 minutes ; ne pas dépasser ce palier d'intensité pour cette pathologie (absence de risque cardiovasculaire spécifique documenté dans les 3 références, mais absence aussi de justification à aller au-delà)."),
    ],
    aerobique: "D'après George et al. 2021 (JOSPT, recommandation A, niveau de preuve fort) : l'exercice aérobique fait partie de l'« exercice général » recommandé, sans supériorité démontrée par rapport aux autres approches (renforcement du tronc, exercice aquatique, multimodal).",
    renforcement: "D'après George et al. 2021 : renforcement/endurance du tronc et des grands groupes musculaires des membres, recommandation A. " + P("Modalité usuelle proposée : 2 à 3 séries de 8 à 12 répétitions, 1 à 2 minutes de repos entre séries, sans matériel ou avec élastique/poids du corps."),
    mobilite: "D'après George et al. 2021 : exercices de flexibilité/mobilité inclus dans l'« exercice général » recommandé (recommandation A), sans détail supplémentaire. " + P("Contenu usuel proposé : mobilité active du rachis lombaire et des hanches (flexion/extension/rotation douces dans l'amplitude non douloureuse), 5 à 10 minutes en échauffement."),
    equilibre: P("Non spécifique à la lombalgie dans les 3 références, mais intégré par prudence générale (prévention de chute, population souvent sédentaire) : 5 à 10 minutes d'exercices d'équilibre simple (appui unipodal tenu, transferts d'appui), 2 fois par semaine."),
    fonctionnel: "D'après George et al. 2021 (principe « rester actif », recommandation A) : " + P("réintroduction progressive de gestes du quotidien (se pencher, porter une charge légère) selon tolérance, en fin de programme."),
    progression: PROGRESSION_STD,
    regression: REGRESSION_DEFAUT_B9,
    securite: "D'après George et al. 2021 (JOSPT), section Patient Education (recommandation, niveau de preuve B) : ne pas augmenter la perception de menace/peur (éviter le repos au lit prolongé, éviter les explications pathoanatomiques poussées) ; insister sur le pronostic globalement favorable et l'importance de rester actif. Cohérent avec Knezevic et al. 2021 (Lancet), qui situe les approches non pharmacologiques en première ligne dans un modèle biopsychosocial, sans dosage précis. " + P("Critère d'arrêt usuel proposé : douleur > 6/10 en cours d'exercice, douleur irradiante nouvelle ou aggravée, essoufflement empêchant de parler."),
    references: "OMS 2023 (sans DOI), 10.2519/jospt.2021.0304, 10.1016/S0140-6736(21)00733-9, 10.1136/bjsports-2020-102955 (dosage transversal)",
  },
  {
    code: "ARTHROSE_GENOU",
    label: "Arthrose du genou",
    sourcesNote:
      "Sources disponibles : Kolasinski et al. 2019 (ACR/Arthritis Foundation, 10.1002/acr.24131), EULAR 2025/2026 (10.1016/j.ard.2026.03.006). Identique pour l'arthrose de hanche : les 2 références traitent les deux localisations conjointement.",
    objectif: ["Réduire la sédentarité (proposé, à confirmer)", "Améliorer la mobilité (proposé, à confirmer)", "Améliorer la force (proposé, à confirmer)"],
    duree: [DUREE_PROPOSAL_STD, DUREE_PROPOSAL_INTERMEDIAIRE, DUREE_PROPOSAL_AVANCE],
    frequence: FREQ_PROPOSAL,
    intensite: INTENSITE_EULAR,
    aerobique: "D'après Kolasinski et al. 2019 (ACR/Arthritis Foundation, recommandation FORTE) : la marche est une option d'exercice aérobique de première intention, sans hiérarchie par rapport au renforcement ou à l'exercice aquatique. " + P("Modalité usuelle proposée : marche 15 à 30 minutes selon niveau, ou vélo stationnaire à faible résistance si douleur à la marche."),
    renforcement: "D'après Kolasinski et al. 2019 : renforcement musculaire recommandé en première intention (recommandation FORTE), sans hiérarchie de modalité. " + P("Modalité usuelle proposée : quadriceps/fessiers/ischio-jambiers, 2 à 3 séries de 8 à 12 répétitions, chaise/poids du corps, 1 à 2 minutes de repos entre séries."),
    mobilite: P("Ni Kolasinski et al. 2019 ni EULAR 2025/2026 ne détaillent d'exercice de mobilité spécifique. Contenu usuel proposé : mobilisation active du genou en amplitude non douloureuse (flexion/extension assise), 5 à 10 minutes en échauffement."),
    equilibre: "D'après Kolasinski et al. 2019 : l'entraînement neuromusculaire fait partie des options recommandées (recommandation FORTE), sans détail sur le contenu précis. " + P("Contenu usuel proposé : appui unipodal tenu (avec appui de sécurité type chaise/mur), transferts d'appui, 5 à 10 minutes, 2 fois par semaine."),
    fonctionnel: P("Non détaillé par les 2 références. Contenu usuel proposé : lever de chaise, montée/descente de marche, selon tolérance, introduits en phase intermédiaire/avancée."),
    progression: PROGRESSION_EULAR,
    regression: REGRESSION_DEFAUT_B9_24H,
    securite: SECURITE_EULAR_GENERIQUE + " " + P("Critère d'arrêt usuel proposé : douleur articulaire > 5-6/10 en cours d'exercice, gonflement articulaire aigu nouveau."),
    references: "10.1002/acr.24131, 10.1016/j.ard.2026.03.006",
  },
  {
    code: "ARTHROSE_HANCHE",
    label: "Arthrose de hanche",
    sourcesNote:
      "Mêmes 2 références que l'arthrose du genou (Kolasinski et al. 2019 traite les deux localisations conjointement) : contenu identique ci-dessous.",
    objectif: ["Réduire la sédentarité (proposé, à confirmer)", "Améliorer la mobilité (proposé, à confirmer)", "Améliorer la force (proposé, à confirmer)"],
    duree: [DUREE_PROPOSAL_STD, DUREE_PROPOSAL_INTERMEDIAIRE, DUREE_PROPOSAL_AVANCE],
    frequence: FREQ_PROPOSAL,
    intensite: INTENSITE_EULAR,
    aerobique: "D'après Kolasinski et al. 2019 (ACR/Arthritis Foundation, recommandation FORTE) : la marche est une option d'exercice aérobique de première intention, sans hiérarchie par rapport au renforcement ou à l'exercice aquatique. " + P("Modalité usuelle proposée : marche 15 à 30 minutes selon niveau, ou vélo stationnaire à faible résistance si douleur à la marche."),
    renforcement: "D'après Kolasinski et al. 2019 : renforcement musculaire recommandé en première intention (recommandation FORTE), sans hiérarchie de modalité. " + P("Modalité usuelle proposée : fessiers/abducteurs de hanche/quadriceps, 2 à 3 séries de 8 à 12 répétitions, chaise/poids du corps, 1 à 2 minutes de repos entre séries."),
    mobilite: P("Ni Kolasinski et al. 2019 ni EULAR 2025/2026 ne détaillent d'exercice de mobilité spécifique. Contenu usuel proposé : mobilisation active de la hanche en amplitude non douloureuse, 5 à 10 minutes en échauffement."),
    equilibre: "D'après Kolasinski et al. 2019 : l'entraînement neuromusculaire fait partie des options recommandées (recommandation FORTE), sans détail sur le contenu précis. " + P("Contenu usuel proposé : appui unipodal tenu (avec appui de sécurité), transferts d'appui, 5 à 10 minutes, 2 fois par semaine."),
    fonctionnel: P("Non détaillé par les 2 références. Contenu usuel proposé : lever de chaise, montée/descente de marche, selon tolérance, introduits en phase intermédiaire/avancée."),
    progression: PROGRESSION_EULAR,
    regression: REGRESSION_DEFAUT_B9_24H,
    securite: SECURITE_EULAR_GENERIQUE + " " + P("Critère d'arrêt usuel proposé : douleur articulaire > 5-6/10 en cours d'exercice, gonflement articulaire aigu nouveau."),
    references: "10.1002/acr.24131, 10.1016/j.ard.2026.03.006",
  },
  {
    code: "POLYARTHRITE_RHUMATOIDE",
    label: "Polyarthrite rhumatoïde",
    sourcesNote: "Sources disponibles : England et al. 2022 (ACR, 10.1002/acr.25117), EULAR 2025/2026 (10.1016/j.ard.2026.03.006).",
    objectif: ["Réduire la sédentarité (proposé, à confirmer)", "Améliorer la condition physique (proposé, à confirmer)", "Améliorer la force (proposé, à confirmer)"],
    duree: [DUREE_PROPOSAL_STD, DUREE_PROPOSAL_INTERMEDIAIRE, DUREE_PROPOSAL_AVANCE],
    frequence: FREQ_PROPOSAL,
    intensite: INTENSITE_EULAR,
    aerobique: "D'après England et al. 2022 (ACR) : recommandation FORTE pour un engagement constant dans l'exercice (par opposition à l'absence d'exercice) ; recommandation conditionnelle (preuve de faible qualité) spécifiquement en faveur de l'exercice aérobique et de l'exercice aquatique. " + P("Modalité usuelle proposée : marche ou aquagym 15 à 30 minutes selon niveau ; l'exercice aquatique est particulièrement adapté en cas d'atteinte articulaire multiple (réduit la mise en charge)."),
    renforcement: "D'après England et al. 2022 : recommandation conditionnelle (preuve de faible qualité) en faveur du renforcement musculaire. " + P("Modalité usuelle proposée : grands groupes musculaires, 2 séries de 8 à 12 répétitions (volume prudent, à ajuster selon l'atteinte articulaire du jour), 48h entre 2 séances sollicitant le même groupe."),
    mobilite: P("Non détaillée par England et al. 2022. Contenu usuel proposé : mobilité active quotidienne des petites et grandes articulations (mains, poignets, genoux, épaules), en particulier le matin (dérouillage matinal), 5 à 10 minutes."),
    equilibre: P("Non détaillée par England et al. 2022. Non prioritaire en l'absence d'atteinte fonctionnelle associée ; à évaluer individuellement selon l'atteinte articulaire du patient."),
    fonctionnel: "D'après England et al. 2022 : recommandation conditionnelle (preuve de faible qualité) en faveur des approches « corps-esprit », en complément de l'exercice aérobique — catégorisation « fonctionnel » proposée par les rédacteurs, à confirmer.",
    progression: "D'après England et al. 2022, aucun rythme de progression n'est précisé. " + PROGRESSION_EULAR,
    regression: REGRESSION_DEFAUT_B9_24H,
    securite: SECURITE_EULAR_GENERIQUE + " " + P("Critère d'arrêt usuel proposé : signe de poussée en cours de séance (gonflement articulaire nouveau, raideur marquée), douleur > 6/10."),
    references: "10.1002/acr.25117, 10.1016/j.ard.2026.03.006",
  },
  {
    code: "SPONDYLOARTHRITE_AXIALE",
    label: "Spondyloarthrite axiale",
    sourcesNote:
      "Sources disponibles : ASAS-EULAR 2022 (10.1136/ard-2022-223296), EULAR 2025/2026 (10.1016/j.ard.2026.03.006, périmètre générique, sans contenu spécifique à la mobilité rachidienne). Les cellules Mobilité/Fonctionnel sont des propositions génériques de pratique courante en axSpA, hors des 2 références citées — à valider en priorité, ce point n'étant couvert par aucune des 10 références.",
    objectif: ["Réduire la sédentarité (proposé, à confirmer)", "Maintenir l'autonomie (proposé, à confirmer)", "Améliorer la condition physique (proposé, à confirmer)"],
    duree: [DUREE_PROPOSAL_STD, DUREE_PROPOSAL_INTERMEDIAIRE, DUREE_PROPOSAL_AVANCE],
    frequence: FREQ_PROPOSAL,
    intensite: [
      INTENSITE_EULAR[0] + " Point de vigilance ASAS-EULAR 2022 (Recommandation 4) : l'adhérence et l'efficacité sont rapportées comme meilleures en cas de supervision (kinésithérapie) par rapport aux exercices seuls à domicile — à considérer pour une application d'auto-exercice non supervisée.",
      INTENSITE_EULAR[1],
      INTENSITE_EULAR[2],
    ],
    aerobique: P("ASAS-EULAR 2022 recommande l'exercice de façon générale sans détailler de composante aérobique. Modalité usuelle proposée : marche, vélo ou natation 15 à 30 minutes selon niveau."),
    renforcement: P("Non détaillé par ASAS-EULAR 2022. Modalité usuelle proposée : renforcement des extenseurs du rachis et de la ceinture scapulaire, 2 à 3 séries de 8 à 12 répétitions."),
    mobilite: P("ASAS-EULAR 2022 ne détaille aucun exercice de mobilité rachidienne spécifique, pourtant classiquement central dans l'axSpA en pratique courante. Contenu usuel proposé : mobilité rachidienne active (extension, rotation, inclinaisons latérales) dans l'amplitude non douloureuse, quotidienne, 10 à 15 minutes — à considérer comme la proposition la plus importante à valider de ce document, faute de tout appui dans les 2 références citées."),
    equilibre: P("Non abordée par ASAS-EULAR 2022. Non prioritaire sauf atteinte fonctionnelle associée."),
    fonctionnel: P("Non abordée par ASAS-EULAR 2022. Contenu usuel proposé : exercices respiratoires (amplitude thoracique, expansion costale), classiquement associés à la prise en charge de l'axSpA en pratique courante — à valider spécifiquement, absent des 2 références citées."),
    progression: PROGRESSION_EULAR,
    regression: REGRESSION_DEFAUT_B9_24H,
    securite:
      "D'après ASAS-EULAR 2022 (Recommandation 4, texte intégral vérifié) : « Exercise is a cornerstone in the management of axSpA, with demonstrated benefits on disease outcomes independent of pharmacological treatment. » L'adhérence est rapportée comme meilleure en cas de supervision, et « Physiotherapy, specifically supervised exercise, has also proven to be more efficacious than home exercises » — élément à prendre en compte pour une application d'auto-exercice non supervisée. Complété par EULAR 2025/2026 (règle des 24h, pas de contre-indication spécifique à la pathologie pour l'AP elle-même). " +
      P("Critère d'arrêt usuel proposé : douleur rachidienne > 6/10, raideur empêchant la poursuite de l'exercice."),
    references: "10.1136/ard-2022-223296, 10.1016/j.ard.2026.03.006",
  },
  {
    code: "OSTEOPOROSE",
    label: "Ostéoporose",
    sourcesNote:
      "Sources disponibles : LeBoff et al. 2022 (10.1007/s00198-021-05900-y), Hoffmann et al. 2023 (10.1007/s00198-022-06592-8). Hoffmann et al. 2023 est une méta-analyse de 11 essais : réduction d'environ 23 % des fractures majeures (RR 0,75), mais les auteurs concluent eux-mêmes qu'aucun protocole précis ne peut être recommandé de façon fiable — les propositions ci-dessous s'appuient donc sur des repères génériques d'exercice en charge, pas sur un chiffre issu de cette méta-analyse.",
    objectif: ["Maintenir l'autonomie (proposé, à confirmer)", "Améliorer la force (proposé, à confirmer)", "Améliorer la force (proposé, à confirmer)"],
    duree: [
      P("Programme continu recommandé plutôt qu'une cure courte : Hoffmann et al. 2023 n'a pas trouvé de différence significative entre ≤ 12 mois et > 12 mois (p=.883), mais les essais favorables de la méta-analyse ont pour la plupart un suivi ≥ 12 mois. Phase initiale proposée : 8 semaines, puis poursuite continue par cycles de 3 mois avec réévaluation."),
      P("8 à 12 semaines pour la phase intermédiaire, puis poursuite par cycles de 3 mois."),
      P("Programme continu par cycles de 3 mois, sans limite de durée fixe (prévention au long cours)."),
    ],
    frequence: FREQ_PROPOSAL,
    intensite: [
      borgProposal(0, "Sans charge externe additionnelle à ce stade — poids du corps uniquement."),
      borgProposal(1, "Introduction possible d'une charge externe légère (poids libres, élastique) selon tolérance."),
      borgProposal(2, "Charge externe progressive selon tolérance, toujours sans mouvement de flexion du tronc chargée (cf. Sécurité)."),
    ],
    aerobique: P("Ni LeBoff et al. 2022 ni Hoffmann et al. 2023 ne détaillent de composante aérobique spécifique. Modalité usuelle proposée : marche en charge (« weight-bearing », cohérente avec LeBoff et al. 2022), 20 à 30 minutes, 3 à 5 fois par semaine."),
    renforcement: "D'après LeBoff et al. 2022 : l'exercice en charge (« weight-bearing ») et le renforcement musculaire (« resistance-training ») font partie de l'arsenal de prévention des fractures, aux côtés du traitement pharmacologique, des apports calcium/vitamine D et de la prévention des chutes. D'après Hoffmann et al. 2023 (méta-analyse, 11 essais) : réduction d'environ 23 % des fractures ostéoporotiques majeures (RR 0,75 ; IC95 % 0,54-0,94 ; p=.006), sans qu'un protocole précis puisse être recommandé de façon fiable. " + P("Modalité usuelle proposée : grands groupes musculaires et rachis en extension, 2 à 3 séries de 8 à 12 répétitions, en évitant systématiquement la flexion chargée du tronc (cf. Sécurité)."),
    mobilite: P("Non abordée par les 2 références. Contenu usuel proposé : mobilité douce, hors flexion importante du rachis, 5 minutes en échauffement."),
    equilibre: "D'après LeBoff et al. 2022 : la prévention des chutes fait partie de l'arsenal global de prévention des fractures, sans détail d'exercice spécifique. " + P("Contenu usuel proposé : exercices d'équilibre systématiques (appui unipodal avec sécurité, marche talon-pointe), 5 à 10 minutes, 2 à 3 fois par semaine — cohérent avec la place de la prévention des chutes chez LeBoff et al. 2022."),
    fonctionnel: P("Non abordée par les 2 références. Contenu usuel proposé : gestes du quotidien en évitant la flexion chargée du tronc (ex. se baisser en fléchissant les genoux plutôt que le dos), cohérent avec la contre-indication de LeBoff et al. 2022."),
    progression: P("Hoffmann et al. 2023 ne permet pas de dériver une règle de progression fiable (différence non significative, p=.133). Progression usuelle proposée : +5 à 10 % du volume ou de la charge par semaine si bonne tolérance, réévaluation tous les 15 jours."),
    regression: REGRESSION_DEFAUT_B9,
    securite: "D'après LeBoff et al. 2022 (description d'une figure dans l'abstract — à vérifier sur texte intégral avant validation, déjà signalé au Sprint 5bis) : les mouvements de flexion importante du tronc augmentent le risque de fracture vertébrale, les mouvements d'extension du rachis le diminuent. " + P("Critère d'arrêt usuel proposé : douleur dorsale/lombaire aiguë nouvelle (signe d'alerte de fracture vertébrale, à évaluer médicalement avant poursuite), douleur > 6/10."),
    references: "10.1007/s00198-021-05900-y, 10.1007/s00198-022-06592-8",
  },
];

function per(field) {
  return Array.isArray(field) ? field : [field, field, field];
}

const children = [];

children.push(
  new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: "Contenu des programmes (FITT-VP)" })] }),
  para("Questions par pathologie et par niveau — complété le 23/08/2026 avec des propositions, à votre demande", { italics: true }),
  para(""),
  para(
    "Sur votre demande, les cellules qu'aucune des 10 références ne permettait de renseigner ont été complétées par des propositions, construites sur des repères génériques d'exercice thérapeutique reconnus (structuration FITT-VP et échelle de Borg selon les conventions de l'American College of Sports Medicine — ACSM ; règle de progression de 5 à 10 %/semaine usuelle en réadaptation musculosquelettique) plutôt que sur les 10 références pathologie-spécifiques. Ce ne sont pas des données probantes spécifiques à chaque pathologie : ce sont des propositions raisonnables et prudentes, à votre validation en tant que rhumatologue."
  ),
  heading("Légende", HeadingLevel.HEADING_2),
  new Paragraph({ children: [new TextRun({ text: "Vert : contenu directement issu d'une des 10 références citées, avec citation précise.", size: 19 })] }),
  new Paragraph({ children: [new TextRun({ text: "Bleu (PROPOSITION) : proposition de l'assistant sur repères génériques d'exercice thérapeutique (ACSM, Borg, progression usuelle), hors des 10 références — à valider ou corriger.", size: 19, color: PROP_COLOR, italics: true })] }),
  para(""),
  heading("Rappel de vos réponses déjà données", HeadingLevel.HEADING_2),
  bullet("B4 — matrice décisionnelle narrative pour l'attribution : le statut de dépistage (vert/orange) est le premier filtre, le niveau initial fixe la dose de départ, la douleur module ensuite l'accès et l'adaptation."),
  bullet("B5 — chaque combinaison pathologie + niveau doit avoir une fiche FITT-VP complète."),
  bullet("B6 — intensité cible : Borg CR10 ou Borg 6-20 en mesure principale, complétée par la fréquence cardiaque et le « talk test » ; la FC max seule ne doit jamais être utilisée comme critère unique. Les valeurs Borg proposées ci-dessous (cellules bleues) suivent cette méthode."),
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
        page: { size: { width: 15840, height: 12240 }, margin: { top: 600, bottom: 600, left: 600, right: 600 } },
      },
      children,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("QUESTIONS_PROGRAMMES_FITTVP_20260823_v2.docx", buf);
  console.log("done");
});
