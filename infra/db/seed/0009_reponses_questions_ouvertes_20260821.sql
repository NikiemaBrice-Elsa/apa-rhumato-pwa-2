-- Intégration des réponses de Dr Wendtongo Brice Florent NIKIEMA au document
-- QUESTIONS_OUVERTES_SPRINT16_20260821.docx (6 points laissés explicitement
-- ouverts à l'issue du Sprint 16, réponses reçues et complétées le
-- 21/08/2026). Contrairement à 0006 (simples activations) et 0008 (nouvelles
-- règles à partir de réponses déjà données), CE FICHIER modifie aussi des
-- règles existantes (désactivation, remplacement de condition) suite à un
-- changement de champ de dépistage — voir packages/domain/src/screening.ts
-- pour le détail des items ajoutés/retirés/renommés en même temps que ce
-- fichier.
--
-- Portée par question :
--   Q1 (outil gabarit Excel)             -> aucune ligne ici, voir
--                                            infra/db/seed/tools/.
--   Q2 (SpA symptômes périphériques)     -> section 1.
--   Q3 (hanche, statut restrictions 3n.) -> section 2.
--   Q4 (lombalgie, critères qualitatifs) -> section 3.
--   Q5 (retrait « queue de cheval »)     -> section 4.
--   Q6 (« autre situation préoccupante ») -> section 5.

-- ============================================================
-- 1. Q2 — Spondyloarthrite axiale, symptômes périphériques (réf. F2 puis Q2).
--    Le champ `symptomes_peripheriques` reste une simple porte d'entrée
--    (aucune règle dessus). La sévérité réelle est évaluée sur les nouveaux
--    champs `douleur_peripherique` / `evolution_peripherique` /
--    `gonflement_chaleur_peripherique` / `limitation_fonctionnelle_peripherique`,
--    mais UNIQUEMENT si au moins une localisation (arthrite périphérique,
--    enthésite, dactylite) est déclarée — une atteinte légère et stable
--    reste compatible avec un vert, conformément à sa réponse.
-- ============================================================
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, active, version, validated_by, validated_date) values
  (
    'SPA_PERIPHERIQUE_ORANGE',
    'SPONDYLOARTHRITE_AXIALE',
    '{"all": [{"any": [{"field": "arthrite_peripherique_presente", "operator": "equals", "value": true}, {"field": "enthesite_presente", "operator": "equals", "value": true}, {"field": "dactylite_presente", "operator": "equals", "value": true}]}, {"any": [{"field": "douleur_peripherique", "operator": "gte", "value": 4}, {"field": "evolution_peripherique", "operator": "gte", "value": 1}, {"field": "gonflement_chaleur_peripherique", "operator": "equals", "value": true}, {"field": "limitation_fonctionnelle_peripherique", "operator": "equals", "value": true}]}]}',
    'warning',
    'require_precaution',
    'Vous avez signalé une atteinte périphérique (arthrite, enthésite ou dactylite) qui semble active ou vous gêne. Par prudence, votre programme est adapté à la zone concernée (adaptation régionale) ; pas de progression pour l''instant.',
    true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-21'
  ),
  (
    'SPA_PERIPHERIQUE_ROUGE',
    'SPONDYLOARTHRITE_AXIALE',
    '{"all": [{"any": [{"field": "arthrite_peripherique_presente", "operator": "equals", "value": true}, {"field": "enthesite_presente", "operator": "equals", "value": true}, {"field": "dactylite_presente", "operator": "equals", "value": true}]}, {"any": [{"field": "douleur_peripherique", "operator": "gte", "value": 7}, {"field": "evolution_peripherique", "operator": "gte", "value": 2}]}]}',
    'critical',
    'medical_referral',
    'Votre atteinte périphérique est très douloureuse, s''aggrave rapidement, ou entraîne une incapacité fonctionnelle nouvelle importante. Par sécurité, nous vous recommandons de consulter un professionnel de santé avant de poursuivre une activité physique.',
    true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-21'
  )
on conflict (rule_id) do nothing;

-- ============================================================
-- 2. Q3 — Arthrose de hanche, statut des restrictions à 3 niveaux (réf. D2
--    puis Q3). Remplace HANCHE_CHIRURGIE_TRAUMA_RESTRICTIONS_ROUGE/ORANGE
--    (0008, fondées sur le booléen `restrictions_pro_recentes`, retiré du
--    dépistage hanche) par deux nouvelles règles fondées sur
--    `statut_restrictions_hanche` (select 0/1/2). Le 3ᵉ statut (« levées »,
--    valeur 0) ne déclenche AUCUNE règle ici : Dr Nikiema confirme que
--    l'intégration progressive doit alors être régie par les règles déjà
--    actives de douleur et de limitation de marche/mobilité
--    (PAIN_*_ARTHROSE_HANCHE, HANCHE_LIMITATION_MARCHE_*,
--    HANCHE_LIMITATION_MOBILITE_*), pas par une règle dédiée.
-- ============================================================
update public.clinical_rules
set active = false
where rule_id in ('HANCHE_CHIRURGIE_TRAUMA_RESTRICTIONS_ROUGE', 'HANCHE_CHIRURGIE_TRAUMA_RECENT_ORANGE');

insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, active, version, validated_by, validated_date) values
  (
    'HANCHE_CHIRURGIE_TRAUMA_RESTRICTIONS_ACTIVES_ROUGE',
    'ARTHROSE_HANCHE',
    '{"all": [{"any": [{"field": "chirurgie_recente", "operator": "equals", "value": true}, {"field": "traumatisme", "operator": "equals", "value": true}]}, {"field": "statut_restrictions_hanche", "operator": "equals", "value": 2}]}',
    'critical',
    'medical_referral',
    'Vous avez signalé une chirurgie ou un traumatisme récent de la hanche (y compris une prothèse), avec des restrictions actuellement actives données par un professionnel de santé. Par sécurité, aucun programme standard n''est proposé : suivez les consignes de l''équipe qui vous a opéré ou suivi, qui priment toujours sur toute recommandation de cette application.',
    true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-21'
  ),
  (
    'HANCHE_CHIRURGIE_TRAUMA_RESTRICTIONS_PARTIELLES_ORANGE',
    'ARTHROSE_HANCHE',
    '{"all": [{"any": [{"field": "chirurgie_recente", "operator": "equals", "value": true}, {"field": "traumatisme", "operator": "equals", "value": true}]}, {"field": "statut_restrictions_hanche", "operator": "equals", "value": 1}]}',
    'warning',
    'require_precaution',
    'Vous avez signalé une chirurgie ou un traumatisme récent de la hanche, avec des restrictions partielles ou des consignes pas totalement claires. Par prudence, un programme PTH adapté vous est proposé, sans progression pour l''instant.',
    true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-21'
  )
on conflict (rule_id) do nothing;

-- ============================================================
-- 3. Q4 — Lombalgie, critères qualitatifs du statut vert/orange (réf. C3
--    puis Q4). S'ajoutent, indépendamment du seuil de douleur harmonisé
--    (PAIN_ORANGE/ROUGE_LOMBALGIE_COMMUNE, 0008 section 1) : toute
--    aggravation déclarée ou toute nouvelle limitation fonctionnelle
--    importante fait basculer au minimum en orange, MÊME SI la douleur est
--    ≤ 3/10 (décision explicite de Dr Nikiema).
-- ============================================================
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, active, version, validated_by, validated_date) values
  (
    'LOMBALGIE_AGGRAVATION_ORANGE',
    'LOMBALGIE_COMMUNE',
    '{"field": "aggravation_recente", "operator": "equals", "value": true}',
    'warning',
    'require_precaution',
    'Vous avez indiqué que votre mal de dos s''aggrave actuellement. Par prudence, adaptez l''intensité de votre séance et évitez toute progression ; si l''aggravation persiste au-delà de 24 heures, parlez-en à un professionnel de santé.',
    true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-21'
  ),
  (
    'LOMBALGIE_NOUVELLE_LIMITATION_ORANGE',
    'LOMBALGIE_COMMUNE',
    '{"field": "nouvelle_limitation_fonctionnelle_importante", "operator": "equals", "value": true}',
    'warning',
    'require_precaution',
    'Vous avez signalé une nouvelle difficulté importante dans vos activités habituelles. Par prudence, un programme adapté vous est proposé ; pas de progression pour l''instant.',
    true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-21'
  )
on conflict (rule_id) do nothing;

-- ============================================================
-- 4. Q5 — Retrait de « suspicion de syndrome de la queue de cheval » comme
--    question patient indépendante (réf. C1 puis Q5). Dr Nikiema confirme
--    que ses deux composantes cliniques (troubles sphinctériens, anesthésie
--    en selle) déclenchent déjà chacune, indépendamment, le statut rouge
--    (LBP_RED_FLAG_SPHINCTER, LBP_RED_FLAG_ANESTHESIE_SELLE — actives depuis
--    le Sprint 3, 0003_clinical_rules.sql), sans qu'il soit nécessaire
--    d'attendre leur présence simultanée. La règle dédiée devient donc sans
--    objet (son champ n'est plus posé au patient) et est désactivée plutôt
--    que laissée active sur un champ mort.
-- ============================================================
update public.clinical_rules
set active = false
where rule_id = 'LBP_RED_FLAG_QUEUE_DE_CHEVAL';

-- ============================================================
-- 5. Q6 — « Autre situation préoccupante » (réf. C1 puis Q6) : n'est plus un
--    red flag automatique déclenchant le rouge comme les 9 autres items de
--    LOMBALGIE_RED_FLAGS. Décision explicite de Dr Nikiema : une réponse
--    positive à ce signal de vigilance déclenche une simple prudence
--    (orange), pas une orientation médicale automatique. Le champ de texte
--    libre associé (`signal_vigilance_autre_details`) documente le motif
--    pour le suivi, mais n'entre dans AUCUNE condition de règle — la
--    décision de sécurité ne dépend jamais d'une analyse automatique du
--    texte, conformément à sa consigne explicite. L'ancienne règle
--    LBP_RED_FLAG_AUTRE (portant sur le champ désormais retiré
--    `autre_situation_preoccupante`) est désactivée.
-- ============================================================
update public.clinical_rules
set active = false
where rule_id = 'LBP_RED_FLAG_AUTRE';

insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, active, version, validated_by, validated_date) values
  (
    'LOMBALGIE_VIGILANCE_AUTRE_ORANGE',
    'LOMBALGIE_COMMUNE',
    '{"field": "signal_vigilance_autre", "operator": "equals", "value": true}',
    'warning',
    'require_precaution',
    'Vous avez signalé une autre situation qui vous inquiète. Cela ne constitue pas à elle seule un signal d''alerte : par prudence, un programme adapté vous est proposé, sans progression pour l''instant. Si votre inquiétude persiste ou s''aggrave, parlez-en à un professionnel de santé.',
    true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-21'
  )
on conflict (rule_id) do nothing;
