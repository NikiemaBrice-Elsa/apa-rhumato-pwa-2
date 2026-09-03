import type { PathologyCode } from "./pathologies";

/**
 * Éléments de dépistage de sécurité (§15-21 du cahier des charges).
 *
 * Les libellés ci-dessous reprennent littéralement les items que le cahier
 * des charges demande d'« évaluer » ou de « rechercher » par pathologie.
 * Ce ne sont PAS des questions patient prêtes à l'emploi : la formulation
 * exacte à afficher à l'utilisateur (ton, tournure de phrase) doit être
 * validée par le concepteur médical avant mise en production — voir
 * docs/MEDICAL_VALIDATION_NEEDED.md (« Contenu exact des questionnaires »).
 */

export type SafetyStatus = "vert" | "orange" | "rouge" | "pending_validation";

export const SAFETY_STATUS_LABELS_FR: Record<SafetyStatus, string> = {
  vert: "Programme possible",
  orange: "Programme possible avec précautions",
  rouge: "Orientation médicale nécessaire",
  pending_validation: "En attente de validation médicale",
};

/** Message imposé littéralement par le §16 en cas de suspicion de situation urgente (lombalgie). */
export const LOMBALGIE_URGENT_MESSAGE =
  "Cette application ne peut pas déterminer la cause de vos symptômes. Une évaluation médicale est nécessaire avant de commencer un programme d'exercices.";

/** Message associé à la règle de sécurité explicite ostéoporose (§21, Cas 4
 * du §56 : fracture récente -> pas de programme automatisé). Formulation
 * validée par Dr Wendtongo Brice Florent NIKIEMA le 20/08/2026 (réf. G3 du
 * questionnaire de validation médicale) — remplace le texte provisoire non
 * clinique utilisé depuis le Sprint 3. Reflétée dans la règle seedée
 * infra/db/seed/0003_clinical_rules.sql et mise à jour par
 * infra/db/seed/0006_validation_medicale_dr_nikiema_20260820.sql
 * (OSTEO_RECENT_FRACTURE). */
export const OSTEOPOROSE_RECENT_FRACTURE_MESSAGE =
  "Vous avez indiqué avoir eu une fracture récemment. Pour votre sécurité, nous ne pouvons pas vous proposer automatiquement un programme d'exercices. Avant de commencer ou de reprendre une activité physique, demandez l'avis du professionnel de santé qui vous suit. Le programme pourra être proposé progressivement après validation et selon les consignes médicales reçues. Ne modifiez pas votre traitement ou vos consignes de rééducation sur la base de cette application.";

/** Message générique (non clinique) affiché tant qu'une pathologie n'a pas
 * de règle de dépistage validée. Ne contient aucune affirmation médicale —
 * uniquement un message d'orientation applicatif (§59 : ne jamais présenter
 * une hypothèse médicale comme une recommandation scientifique). */
export const PENDING_VALIDATION_MESSAGE =
  "Nous avons bien enregistré vos réponses. Le programme personnalisé pour cette situation n'est pas encore disponible : il doit d'abord être validé par un professionnel de santé. Vous pouvez continuer à échanger avec votre médecin ou kinésithérapeute en attendant.";

/**
 * Message générique affiché quand le dépistage aboutit à un statut `vert`
 * réel (aucune règle rouge ni orange déclenchée, alors qu'au moins une
 * règle de sécurité validée existe pour la pathologie — voir
 * `evaluateSafetyScreeningFromRules`, packages/rules-engine). Ajouté le
 * 20/08/2026 : jusqu'à cette date, le dépistage ne produisait jamais
 * `vert` par construction (aucun seuil gradué n'avait été validé). Reste
 * volontairement prudent — ne jamais présenter l'absence de signal comme
 * une certitude médicale absolue (§57, §59). */
export const SCREENING_VERT_MESSAGE =
  "D'après les critères validés par le concepteur médical, aucun signal nécessitant une prudence particulière n'a été détecté dans vos réponses. Cela ne remplace pas un avis médical : contactez un professionnel de santé si votre état change.";

/** §16 — Lombalgie commune / lombosciatique commune : red flags.
 * BUG CORRIGÉ le 20/08/2026 : ces items n'avaient jamais `type: "boolean"`
 * — sans indication de type, `AssessmentFlow.tsx` les affichait comme des
 * champs de texte libre plutôt que des Oui/Non, et une réponse tapée au
 * clavier ne pouvait presque jamais correspondre exactement à la condition
 * `{"operator": "equals", "value": true}` des règles LBP_RED_FLAG_*
 * (actives depuis le Sprint 3). Ce défaut n'était détecté par aucun test
 * automatisé (aucune infrastructure de test de composant React dans ce
 * projet, voir docs/DECISIONS.md Sprint 15) — découvert en implémentant les
 * réponses du questionnaire de validation médicale du 20/08/2026, signalé et
 * corrigé immédiatement (§79 : ne jamais cacher une erreur), indépendamment
 * du reste de cette intégration.
 *
 * MODIFIÉ le 21/08/2026 (réponse Q5 au document de questions ouvertes du
 * Sprint 16) : `suspicion_queue_de_cheval` est RETIRÉ de cette liste — ce
 * n'est plus une question posée au patient. Dr Nikiema confirme que ses deux
 * composantes cliniques (`troubles_sphincteriens`, `anesthesie_en_selle`)
 * déclenchent déjà chacune, indépendamment, le statut rouge (voir
 * LBP_RED_FLAG_SPHINCTER / LBP_RED_FLAG_ANESTHESIE_SELLE,
 * infra/db/seed/0003_clinical_rules.sql) — sans qu'il soit nécessaire
 * d'attendre leur présence simultanée. La règle dédiée
 * LBP_RED_FLAG_QUEUE_DE_CHEVAL (qui portait sur ce champ) est désactivée par
 * infra/db/seed/0009_reponses_questions_ouvertes_20260821.sql ; le concept
 * clinique de « syndrome de la queue de cheval » reste documenté ici comme
 * synthèse interne, mais n'est plus un champ de dépistage.
 *
 * `autre_situation_preoccupante` est également RETIRÉ de cette liste (voir
 * `LOMBALGIE_COMMUNE_ITEMS` ci-dessous) : ce n'est plus, depuis le 21/08/2026,
 * un red flag déclenchant automatiquement le rouge — voir la note associée. */
export const LOMBALGIE_RED_FLAGS = [
  { code: "traumatisme_important", label: "Traumatisme important", type: "boolean" },
  { code: "douleur_inhabituelle_intense", label: "Douleur inhabituelle ou très intense", type: "boolean" },
  { code: "fievre_contexte_infectieux", label: "Fièvre ou contexte infectieux", type: "boolean" },
  { code: "antecedent_cancer_pertinent", label: "Antécédent de cancer pertinent", type: "boolean" },
  { code: "perte_poids_inexpliquee", label: "Perte de poids inexpliquée", type: "boolean" },
  { code: "deficit_moteur_important", label: "Déficit moteur important", type: "boolean" },
  { code: "deficit_neurologique_progressif", label: "Déficit neurologique progressif", type: "boolean" },
  { code: "troubles_sphincteriens", label: "Troubles sphinctériens", type: "boolean" },
  { code: "anesthesie_en_selle", label: "Anesthésie en selle", type: "boolean" },
] as const;

/** Ajouté le 20/08/2026 (réf. B1 du questionnaire de validation médicale :
 * seuil de douleur harmonisé, toutes pathologies) — la lombalgie n'avait
 * jusqu'ici aucun item de douleur numérique au dépistage (seulement les red
 * flags booléens). Voir infra/db/seed/0008_validation_medicale_dr_nikiema_20260820_partie2.sql.
 *
 * `signal_vigilance_autre` / `signal_vigilance_autre_details` ajoutés le
 * 21/08/2026 (réponse Q6) EN REMPLACEMENT de l'ancien item
 * `autre_situation_preoccupante` (retiré de `LOMBALGIE_RED_FLAGS`) : Dr
 * Nikiema précise qu'une réponse positive à ce signal, contrairement aux 9
 * autres red flags, « ne constitue pas à elle seule un red flag clinique
 * automatique » et doit déclencher une simple prudence (orange), pas une
 * orientation médicale automatique (rouge) — voir la règle
 * LOMBALGIE_VIGILANCE_AUTRE_ORANGE (infra/db/seed/0009_...sql). Le champ de
 * texte libre est facultatif et sert uniquement à documenter le motif
 * signalé pour le suivi ; conformément à sa consigne explicite, la décision
 * de sécurité ne dépend jamais d'une analyse automatique de ce texte. */
export const LOMBALGIE_COMMUNE_ITEMS = [
  ...LOMBALGIE_RED_FLAGS,
  { code: "douleur", label: "Douleur", type: "scale_0_10" },
  {
    code: "aggravation_recente",
    label:
      "Avez-vous l'impression que votre mal de dos s'aggrave actuellement (plutôt que stable ou en amélioration) ?",
    type: "boolean",
  },
  {
    code: "nouvelle_limitation_fonctionnelle_importante",
    label:
      "Une nouvelle difficulté importante est-elle apparue récemment (par exemple : une activité que vous faisiez avant devient impossible) ?",
    type: "boolean",
  },
  {
    code: "signal_vigilance_autre",
    label:
      "Y a-t-il actuellement un autre symptôme ou une autre situation concernant votre mal de dos qui vous inquiète particulièrement ou qui vous semble inhabituelle ?",
    type: "boolean",
  },
  {
    code: "signal_vigilance_autre_details",
    label: "Si vous le souhaitez, décrivez brièvement ce qui vous inquiète (facultatif)",
    type: "text",
  },
] as const;

/**
 * Champs ajoutés au Sprint 6bis, EN PLUS des items ci-dessus, pour permettre
 * l'expression de red flags proposés à partir de littérature scientifique
 * citée (voir infra/db/seed/0004_proposed_red_flags_pending_validation.sql)
 * — CE NE SONT PAS des items du cahier des charges (§17-20). Validées et
 * activées le 20/08/2026 (réf. A1, A2 du questionnaire de validation
 * médicale) — voir infra/db/seed/0006_validation_medicale_dr_nikiema_20260820.sql.
 */
const HOT_JOINT_FIELDS = [
  { code: "gonflement", label: "Gonflement", type: "boolean" },
  { code: "chaleur_locale", label: "Chaleur locale (articulation chaude)", type: "boolean" },
  { code: "fievre", label: "Fièvre associée", type: "boolean" },
] as const;

/** §17 — Arthrose du genou : éléments à évaluer (pas de red flags formalisés
 * dans le cahier des charges). Items `gonflement_evolution`, `instabilite`
 * (converti en `select` à 3 niveaux) et `restrictions_pro_recentes` ajoutés
 * le 20/08/2026 (réf. D1, D3 du questionnaire de validation médicale). */
export const ARTHROSE_GENOU_ITEMS = [
  { code: "douleur", label: "Douleur", type: "scale_0_10" },
  { code: "gonflement", label: "Gonflement", type: "boolean" },
  {
    code: "gonflement_evolution",
    label: "Évolution du gonflement, si présent",
    type: "select",
    options: [
      { value: 0, label: "Absent ou léger, stable, sans augmentation récente" },
      { value: 1, label: "Léger à modéré, nouveau ou augmenté par rapport à l'habitude" },
      { value: 2, label: "Important, rapidement progressif, ou avec douleur importante/incapacité fonctionnelle" },
    ],
  },
  {
    code: "instabilite",
    label: "Instabilité du genou",
    type: "select",
    options: [
      { value: 0, label: "Aucune sensation d'instabilité, de dérobement ou de blocage" },
      { value: 1, label: "Sensation occasionnelle et légère, sans chute, sans aggravation récente" },
      { value: 2, label: "Instabilité répétée, aggravée, associée à des chutes ou à un blocage" },
    ],
  },
  { code: "limitation_importante", label: "Limitation importante", type: "boolean" },
  { code: "capacite_marche", label: "Capacité de marche", type: "text" },
  { code: "capacite_lever_chaise", label: "Capacité à se lever d'une chaise", type: "text" },
  { code: "capacite_monter_marches", label: "Capacité à monter quelques marches", type: "text" },
  { code: "chirurgie_recente", label: "Chirurgie récente (genou)", type: "boolean" },
  { code: "traumatisme_recent", label: "Traumatisme récent (genou)", type: "boolean" },
  {
    code: "restrictions_pro_recentes",
    label:
      "Un professionnel de santé vous a-t-il donné des restrictions concernant l'appui, les mouvements ou l'activité physique ?",
    type: "boolean",
  },
  { code: "autre_pathologie_modifiante", label: "Autre pathologie susceptible de modifier le programme", type: "text" },
  { code: "chaleur_locale", label: "Chaleur locale (articulation chaude)", type: "boolean" },
  { code: "fievre", label: "Fièvre associée", type: "boolean" },
] as const;

/** §18 — Arthrose de hanche. Items `limitation_marche`/`limitation_mobilite`
 * convertis en `select` à 3 niveaux et `restrictions_pro_recentes` ajouté le
 * 20/08/2026 (réf. D2, D3 du questionnaire de validation médicale).
 *
 * MODIFIÉ le 21/08/2026 (réponse Q3 au document de questions ouvertes du
 * Sprint 16) : `restrictions_pro_recentes` (booléen) est REMPLACÉ par
 * `statut_restrictions_hanche` (`select` à 3 niveaux), pour distinguer les 3
 * statuts que Dr Nikiema décrivait dès sa réponse D2 (restrictions actives /
 * partielles ou incertaines / officiellement levées) — un simple Oui/Non ne
 * permettait de coder que 2 statuts. Voir
 * HANCHE_CHIRURGIE_TRAUMA_RESTRICTIONS_ACTIVES_ROUGE /
 * ..._PARTIELLES_ORANGE (infra/db/seed/0009_...sql). Pour le 3ᵉ statut
 * (« levées »), Dr Nikiema précise que l'intégration progressive ne doit
 * être proposée qu'après vérification de l'absence de signe d'alerte,
 * d'une douleur faible/stable/en amélioration, d'une capacité de marche/
 * appui conforme aux consignes, et d'une stabilité fonctionnelle
 * suffisante — CE SONT EXACTEMENT les critères déjà couverts par les règles
 * actives `PAIN_ORANGE/ROUGE_ARTHROSE_HANCHE`, `HANCHE_LIMITATION_MARCHE_*`
 * et `HANCHE_LIMITATION_MOBILITE_*` : aucune règle supplémentaire n'est donc
 * nécessaire pour ce statut — une fois les restrictions levées, le statut
 * vert/orange/rouge du patient est simplement déterminé par ces règles déjà
 * en place, sans intervention du champ `statut_restrictions_hanche`.
 * L'usage d'une aide à la marche n'est explicitement PAS un critère
 * d'exclusion (confirmé par Dr Nikiema) — aucune règle ne s'appuie dessus. */
export const ARTHROSE_HANCHE_ITEMS = [
  { code: "douleur", label: "Douleur", type: "scale_0_10" },
  {
    code: "limitation_marche",
    label: "Limitation de la marche",
    type: "select",
    options: [
      { value: 0, label: "Marche possible sans aggravation ni nouvelle limitation" },
      {
        value: 1,
        label:
          "Diminution récente/modérée de la distance ou du temps de marche, boiterie inhabituelle, ou augmentation des symptômes en marchant",
      },
      {
        value: 2,
        label: "Impossibilité nouvelle ou importante de marcher/prendre appui, aggravation brutale, ou douleur importante",
      },
    ],
  },
  {
    code: "limitation_mobilite",
    label: "Limitation de la mobilité de hanche",
    type: "select",
    options: [
      {
        value: 0,
        label: "Mobilité suffisante pour réaliser les mouvements avec contrôle, sans douleur importante ni aggravation récente",
      },
      {
        value: 1,
        label: "Diminution modérée/récente, difficulté sur certaines amplitudes, ou douleur modérée en fin d'amplitude",
      },
      { value: 2, label: "Limitation brutale ou importante, blocage, douleur aiguë, ou aggravation rapide" },
    ],
  },
  { code: "difficulte_se_lever", label: "Difficulté à se lever", type: "boolean" },
  { code: "difficulte_escaliers", label: "Difficulté à monter les escaliers", type: "boolean" },
  { code: "chirurgie_recente", label: "Chirurgie récente (hanche)", type: "boolean" },
  { code: "traumatisme", label: "Traumatisme récent (hanche)", type: "boolean" },
  {
    code: "statut_restrictions_hanche",
    label: "Quelles sont, aujourd'hui, les consignes de votre professionnel de santé concernant votre hanche ?",
    type: "select",
    options: [
      { value: 0, label: "Restrictions officiellement levées par mon professionnel de santé" },
      { value: 1, label: "Restrictions partielles, ou consignes pas totalement claires/incertaines" },
      { value: 2, label: "Restrictions actives, encore en cours" },
    ],
  },
  { code: "remplacement_prothetique", label: "Remplacement prothétique éventuel", type: "boolean" },
  { code: "autres_facteurs_securite", label: "Autres facteurs de sécurité", type: "text" },
  ...HOT_JOINT_FIELDS,
] as const;

/** §19 — Polyarthrite rhumatoïde. Libellé de `poussee_recente` remplacé le
 * 20/08/2026 par la question exacte proposée en réf. A3 du questionnaire de
 * validation médicale (une réponse « Oui » oriente désormais vers le statut
 * rouge, décision explicite de Dr Nikiema du même jour). */
export const POLYARTHRITE_RHUMATOIDE_ITEMS = [
  { code: "activite_ressentie_maladie", label: "Activité ressentie de la maladie", type: "scale_0_10" },
  { code: "douleur", label: "Douleur", type: "scale_0_10" },
  { code: "fatigue", label: "Fatigue", type: "scale_0_10" },
  { code: "articulations_symptomatiques", label: "Articulations symptomatiques", type: "text" },
  { code: "atteinte_mains", label: "Atteinte des mains", type: "boolean" },
  { code: "atteinte_pieds", label: "Atteinte des pieds", type: "boolean" },
  { code: "limitation_fonctionnelle", label: "Limitation fonctionnelle", type: "boolean" },
  {
    code: "poussee_recente",
    label:
      "Depuis votre dernière évaluation, votre polyarthrite rhumatoïde s'est-elle aggravée au point de vous faire penser que votre traitement devrait être modifié ou renforcé ?",
    type: "boolean",
  },
  { code: "comorbidites", label: "Comorbidités", type: "text" },
  { code: "capacite_physique_actuelle", label: "Capacité physique actuelle", type: "text" },
  ...HOT_JOINT_FIELDS,
] as const;

/** §20 — Spondyloarthrite axiale. Items structurés ajoutés le 20/08/2026
 * (réf. F1, F2 du questionnaire de validation médicale) pour rendre
 * exploitables des critères qui n'existaient jusqu'ici qu'en texte libre
 * (`mobilite`, `tolerance_effort`, retirés) : effort perçu (Borg CR10),
 * récupération après la séance précédente, mobilité fonctionnelle graduée,
 * et les items rouge listés explicitement par Dr Nikiema (douleur
 * thoracique/malaise, dyspnée inhabituelle, déficit neurologique/faiblesse
 * nouvelle, fièvre + altération de l'état général).
 *
 * MODIFIÉ le 21/08/2026 (réponse Q2 au document de questions ouvertes du
 * Sprint 16) : le champ unique `symptomes_peripheriques` (Oui/Non, réf. F2)
 * reste comme PORTE D'ENTRÉE (aucune règle ne s'appuie dessus directement,
 * conformément à sa réponse), mais est désormais suivi de 3 champs de
 * localisation (`arthrite_peripherique_presente`, `enthesite_presente`,
 * `dactylite_presente`) et de 4 champs de sévérité communs à l'atteinte
 * périphérique déclarée (douleur, évolution, gonflement/chaleur,
 * retentissement fonctionnel) — voir SPA_PERIPHERIQUE_ORANGE/ROUGE
 * (infra/db/seed/0009_...sql), dont la condition exige explicitement qu'au
 * moins une des 3 localisations soit déclarée avant de tenir compte de la
 * sévérité (une atteinte légère/stable reste compatible avec un vert,
 * conformément à sa réponse). */
export const SPONDYLOARTHRITE_AXIALE_ITEMS = [
  { code: "douleur_rachidienne", label: "Douleur rachidienne", type: "scale_0_10" },
  { code: "raideur", label: "Raideur nettement augmentée par rapport à l'habitude", type: "boolean" },
  {
    code: "mobilite_niveau",
    label: "Mobilité pour réaliser les mouvements prévus",
    type: "select",
    options: [
      { value: 0, label: "Suffisante, avec contrôle, sans douleur importante ni aggravation récente" },
      { value: 1, label: "Diminution récente, ou difficulté à réaliser correctement un mouvement prévu" },
      { value: 2, label: "Incapacité nouvelle et importante à réaliser un mouvement" },
    ],
  },
  { code: "fatigue", label: "Fatigue", type: "scale_0_10" },
  {
    code: "effort_percu_borg",
    label: "Effort perçu pendant l'activité (échelle de Borg CR10 : 0 = aucun effort, 10 = effort maximal)",
    type: "scale_0_10",
  },
  { code: "recuperation_satisfaisante", label: "Récupération satisfaisante depuis la séance précédente ?", type: "boolean" },
  { code: "activite_physique", label: "Activité physique", type: "text" },
  { code: "limitation_fonctionnelle", label: "Limitation fonctionnelle", type: "boolean" },
  {
    code: "symptomes_peripheriques",
    label: "Avez-vous des symptômes dans d'autres articulations que la colonne (mains, pieds, coudes, talons...) ?",
    type: "boolean",
  },
  {
    code: "arthrite_peripherique_presente",
    label: "S'agit-il d'une articulation gonflée ou douloureuse en dehors de la colonne (arthrite périphérique) ?",
    type: "boolean",
  },
  {
    code: "enthesite_presente",
    label: "S'agit-il d'une douleur à l'endroit où un tendon s'attache à l'os (par exemple le talon) ?",
    type: "boolean",
  },
  {
    code: "dactylite_presente",
    label: "S'agit-il d'un doigt ou d'un orteil entièrement gonflé (« en saucisse ») ?",
    type: "boolean",
  },
  { code: "douleur_peripherique", label: "Douleur liée à ces symptômes", type: "scale_0_10" },
  {
    code: "evolution_peripherique",
    label: "Évolution de ces symptômes",
    type: "select",
    options: [
      { value: 0, label: "Stable ou en amélioration, sans gêne fonctionnelle nouvelle" },
      { value: 1, label: "Légèrement aggravée ou nouvelle, sans incapacité importante" },
      { value: 2, label: "Aggravation importante ou rapide, ou incapacité fonctionnelle nouvelle importante" },
    ],
  },
  {
    code: "gonflement_chaleur_peripherique",
    label: "Gonflement ou chaleur au niveau de cette zone",
    type: "boolean",
  },
  {
    code: "limitation_fonctionnelle_peripherique",
    label: "Cela vous gêne-t-il pour utiliser normalement cette zone (marcher, tenir un objet, etc.) ?",
    type: "boolean",
  },
  { code: "comorbidites", label: "Comorbidités", type: "text" },
  { code: "traumatisme_recent", label: "Traumatisme récent (même mineur)", type: "boolean" },
  { code: "douleur_thoracique_ou_malaise", label: "Douleur thoracique ou malaise", type: "boolean" },
  { code: "dyspnee_inhabituelle", label: "Dyspnée inhabituelle importante", type: "boolean" },
  { code: "deficit_neurologique_nouveau", label: "Déficit neurologique nouveau ou progressif", type: "boolean" },
  { code: "faiblesse_nouvelle_importante", label: "Faiblesse nouvelle importante", type: "boolean" },
  {
    code: "fievre_alteration_etat_general",
    label: "Fièvre ou altération importante de l'état général, associée à des symptômes inhabituels",
    type: "boolean",
  },
] as const;

/** §21 — Ostéoporose. `fracture_recente` déclenche une règle explicite (voir
 * rules-engine). Items structurés du questionnaire de risque de chute
 * ajoutés le 20/08/2026 (réf. G1 du questionnaire de validation médicale) ;
 * `chutes`/`risque_de_chute` (texte libre) retirés, remplacés par ce
 * questionnaire. `douleur` ajouté (réf. B1, seuil harmonisé). Le test
 * Timed Up and Go n'étant pas réalisable dans l'application, il est
 * remplacé par une question déclarative (`lenteur_lever_marcher`), décision
 * explicite de Dr Nikiema du même jour. Le test « lever de chaise sans les
 * bras » n'est PAS repris ici : Dr Nikiema précise explicitement qu'il ne
 * doit jamais servir seul à classer un patient à haut risque, et aucune
 * règle ne s'appuie dessus. */
export const OSTEOPOROSE_ITEMS = [
  { code: "douleur", label: "Douleur", type: "scale_0_10" },
  { code: "antecedent_fracture", label: "Antécédent de fracture", type: "boolean" },
  { code: "fracture_vertebrale_connue", label: "Fracture vertébrale connue", type: "boolean" },
  { code: "fracture_recente", label: "Fracture récente", type: "boolean" },
  {
    code: "chutes_12_mois",
    label: "Êtes-vous tombé(e) au cours des 12 derniers mois ?",
    type: "select",
    options: [
      { value: 0, label: "Non" },
      { value: 1, label: "Oui, une fois" },
      { value: 2, label: "Oui, plusieurs fois" },
    ],
  },
  {
    code: "chute_necessite_soins",
    label: "Cette chute vous a-t-elle causé une blessure nécessitant des soins médicaux ?",
    type: "boolean",
  },
  { code: "chute_aide_relever", label: "Après cette chute, avez-vous eu besoin d'aide pour vous relever ?", type: "boolean" },
  {
    code: "chute_perte_connaissance",
    label: "Avez-vous perdu connaissance ou eu un malaise avant la chute ?",
    type: "boolean",
  },
  {
    code: "instabilite_marche",
    label: "Vous arrive-t-il de vous sentir instable lorsque vous marchez ou lorsque vous vous levez ?",
    type: "boolean",
  },
  { code: "peur_de_tomber", label: "Avez-vous peur de tomber ?", type: "boolean" },
  { code: "aide_marche", label: "Utilisez-vous une canne, un déambulateur ou une autre aide pour marcher ?", type: "boolean" },
  {
    code: "lenteur_lever_marcher",
    label: "Avez-vous l'impression de mettre plus de temps que d'habitude à vous lever et à marcher quelques pas ?",
    type: "boolean",
  },
  { code: "mobilite", label: "Mobilité", type: "text" },
  { code: "equilibre", label: "Équilibre", type: "text" },
  { code: "niveau_force", label: "Niveau de force", type: "text" },
  { code: "activite_physique", label: "Activité physique", type: "text" },
  { code: "douleurs_rachidiennes", label: "Douleurs rachidiennes", type: "boolean" },
  { code: "autres_facteurs_risque", label: "Autres facteurs de risque", type: "text" },
] as const;

export const SCREENING_ITEMS_BY_PATHOLOGY: Record<
  PathologyCode,
  ReadonlyArray<{
    code: string;
    label: string;
    type?: string;
    options?: ReadonlyArray<{ value: number; label: string }>;
  }>
> = {
  LOMBALGIE_COMMUNE: LOMBALGIE_COMMUNE_ITEMS,
  ARTHROSE_GENOU: ARTHROSE_GENOU_ITEMS,
  ARTHROSE_HANCHE: ARTHROSE_HANCHE_ITEMS,
  POLYARTHRITE_RHUMATOIDE: POLYARTHRITE_RHUMATOIDE_ITEMS,
  SPONDYLOARTHRITE_AXIALE: SPONDYLOARTHRITE_AXIALE_ITEMS,
  OSTEOPOROSE: OSTEOPOROSE_ITEMS,
};
