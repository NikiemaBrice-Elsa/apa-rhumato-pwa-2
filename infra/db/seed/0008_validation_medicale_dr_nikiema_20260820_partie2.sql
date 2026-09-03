-- Intégration (partie 2) des réponses de Dr Wendtongo Brice Florent NIKIEMA
-- au questionnaire de validation médicale du 20/08/2026, complétées en
-- échange direct le même jour (seuil de douleur harmonisé, questions de
-- dépistage supplémentaires genou/hanche/PR/spondyloarthrite/ostéoporose).
-- Contrairement à 0006_validation_medicale_dr_nikiema_20260820.sql (qui ne
-- fait qu'activer des propositions déjà rédigées au Sprint 6bis), CE
-- FICHIER contient de nouvelles règles réelles, `active = true` dès leur
-- insertion, `validated_by`/`validated_date` renseignés dès la création
-- (et non `active = false` en attente d'un second geste d'activation) :
-- ces règles sont rédigées EXACTEMENT à partir de ses réponses (le 20/08 en
-- questionnaire écrit, puis en échange direct le même jour pour combler les
-- points restés ouverts — seuil harmonisé, nouvelles questions), pas
-- proposées par l'équipe technique à partir de littérature tierce.
--
-- CHANGEMENT D'ARCHITECTURE ASSOCIÉ (voir packages/rules-engine/src/
-- screening/index.ts) : c'est la première fois qu'une règle
-- `require_precaution` réellement active existe dans ce projet. Le
-- dépistage (`evaluateSafetyScreeningFromRules`) peut désormais produire un
-- vrai statut `orange`, et un vrai statut `vert` quand aucune règle rouge
-- ni orange ne se déclenche POUR UNE PATHOLOGIE QUI A AU MOINS UNE RÈGLE
-- `require_precaution` active (jamais un `vert` inventé en l'absence de
-- toute règle graduée validée — voir le garde-fou
-- apps/web/tests/security/screening-no-invented-green.test.ts).
--
-- Portée : ce fichier ajoute des questions de dépistage à
-- packages/domain/src/screening.ts (SCREENING_ITEMS_BY_PATHOLOGY) — voir ce
-- fichier pour le détail des nouveaux items (`gonflement_evolution`,
-- `restrictions_pro_recentes`, `chutes_12_mois`, etc.) et le renommage du
-- libellé de `poussee_recente` (PR).

-- ============================================================
-- 1. Seuil de douleur harmonisé (réf. B1, décision du 20/08/2026) :
--    vert 0-3/10, orange 4-6/10, rouge > 6/10 — retenu comme seuil UNIQUE
--    pour toutes les pathologies (Dr Nikiema a explicitement choisi
--    d'harmoniser plutôt que de garder les valeurs spécifiques initialement
--    données en C3/lombalgie et D3/genou, qui différaient légèrement).
--    Douleur du genou (0007_proposed_thresholds_douleur_genou.sql, encore
--    `active = false`) est donc SUPERSEDED par PAIN_ORANGE/ROUGE_
--    ARTHROSE_GENOU ci-dessous et reste volontairement inactive.
-- ============================================================
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, active, version, validated_by, validated_date) values
  ('PAIN_ORANGE_ARTHROSE_GENOU', 'ARTHROSE_GENOU', '{"field": "douleur", "operator": "gte", "value": 4}', 'warning', 'require_precaution', 'Votre douleur est modérée aujourd''hui : adaptez l''intensité de votre séance (réduisez la charge, le volume ou l''amplitude) et évitez toute progression. Si la douleur augmente ou ne s''améliore pas d''ici 24 heures, faites une pause et parlez-en à un professionnel de santé.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('PAIN_ROUGE_ARTHROSE_GENOU', 'ARTHROSE_GENOU', '{"field": "douleur", "operator": "gte", "value": 7}', 'critical', 'medical_referral', 'Votre douleur est élevée aujourd''hui. Par sécurité, aucun programme n''est proposé automatiquement : nous vous recommandons de consulter un professionnel de santé avant de reprendre une activité physique.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),

  ('PAIN_ORANGE_ARTHROSE_HANCHE', 'ARTHROSE_HANCHE', '{"field": "douleur", "operator": "gte", "value": 4}', 'warning', 'require_precaution', 'Votre douleur est modérée aujourd''hui : adaptez l''intensité de votre séance (réduisez la charge, le volume ou l''amplitude) et évitez toute progression. Si la douleur augmente ou ne s''améliore pas d''ici 24 heures, faites une pause et parlez-en à un professionnel de santé.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('PAIN_ROUGE_ARTHROSE_HANCHE', 'ARTHROSE_HANCHE', '{"field": "douleur", "operator": "gte", "value": 7}', 'critical', 'medical_referral', 'Votre douleur est élevée aujourd''hui. Par sécurité, aucun programme n''est proposé automatiquement : nous vous recommandons de consulter un professionnel de santé avant de reprendre une activité physique.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),

  ('PAIN_ORANGE_POLYARTHRITE_RHUMATOIDE', 'POLYARTHRITE_RHUMATOIDE', '{"field": "douleur", "operator": "gte", "value": 4}', 'warning', 'require_precaution', 'Votre douleur est modérée aujourd''hui : adaptez l''intensité de votre séance (réduisez la charge, le volume ou l''amplitude) et évitez toute progression. Si la douleur augmente ou ne s''améliore pas d''ici 24 heures, faites une pause et parlez-en à un professionnel de santé.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('PAIN_ROUGE_POLYARTHRITE_RHUMATOIDE', 'POLYARTHRITE_RHUMATOIDE', '{"field": "douleur", "operator": "gte", "value": 7}', 'critical', 'medical_referral', 'Votre douleur est élevée aujourd''hui. Par sécurité, aucun programme n''est proposé automatiquement : nous vous recommandons de consulter un professionnel de santé avant de reprendre une activité physique.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),

  ('PAIN_ORANGE_SPONDYLOARTHRITE_AXIALE', 'SPONDYLOARTHRITE_AXIALE', '{"field": "douleur_rachidienne", "operator": "gte", "value": 4}', 'warning', 'require_precaution', 'Votre douleur est modérée aujourd''hui : adaptez l''intensité de votre séance (réduisez la charge, le volume ou l''amplitude) et évitez toute progression. Si la douleur augmente ou ne s''améliore pas d''ici 24 heures, faites une pause et parlez-en à un professionnel de santé.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('PAIN_ROUGE_SPONDYLOARTHRITE_AXIALE', 'SPONDYLOARTHRITE_AXIALE', '{"field": "douleur_rachidienne", "operator": "gte", "value": 7}', 'critical', 'medical_referral', 'Votre douleur est élevée aujourd''hui. Par sécurité, aucun programme n''est proposé automatiquement : nous vous recommandons de consulter un professionnel de santé avant de reprendre une activité physique.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),

  ('PAIN_ORANGE_LOMBALGIE_COMMUNE', 'LOMBALGIE_COMMUNE', '{"field": "douleur", "operator": "gte", "value": 4}', 'warning', 'require_precaution', 'Votre douleur est modérée aujourd''hui : adaptez l''intensité de votre séance (réduisez la charge, le volume ou l''amplitude) et évitez toute progression. Si la douleur augmente ou ne s''améliore pas d''ici 24 heures, faites une pause et parlez-en à un professionnel de santé.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('PAIN_ROUGE_LOMBALGIE_COMMUNE', 'LOMBALGIE_COMMUNE', '{"field": "douleur", "operator": "gte", "value": 7}', 'critical', 'medical_referral', 'Votre douleur est élevée aujourd''hui. Par sécurité, aucun programme n''est proposé automatiquement : nous vous recommandons de consulter un professionnel de santé avant de reprendre une activité physique.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),

  ('PAIN_ORANGE_OSTEOPOROSE', 'OSTEOPOROSE', '{"field": "douleur", "operator": "gte", "value": 4}', 'warning', 'require_precaution', 'Votre douleur est modérée aujourd''hui : adaptez l''intensité de votre séance (réduisez la charge, le volume ou l''amplitude) et évitez toute progression. Si la douleur augmente ou ne s''améliore pas d''ici 24 heures, faites une pause et parlez-en à un professionnel de santé.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('PAIN_ROUGE_OSTEOPOROSE', 'OSTEOPOROSE', '{"field": "douleur", "operator": "gte", "value": 7}', 'critical', 'medical_referral', 'Votre douleur est élevée aujourd''hui. Par sécurité, aucun programme n''est proposé automatiquement : nous vous recommandons de consulter un professionnel de santé avant de reprendre une activité physique.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20')
on conflict (rule_id) do nothing;

-- ============================================================
-- 2. PR — « poussée récente » (réf. A3, décision du 20/08/2026) : une
--    réponse « Oui » à la nouvelle question de dépistage oriente vers une
--    évaluation médicale (choix explicite de Dr Nikiema : rouge, pas
--    orange).
-- ============================================================
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, active, version, validated_by, validated_date) values
  ('PR_POUSSEE_RECENTE_ROUGE', 'POLYARTHRITE_RHUMATOIDE', '{"field": "poussee_recente", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Vous avez indiqué que votre polyarthrite rhumatoïde s''est aggravée récemment au point de penser que votre traitement devrait être modifié ou renforcé. Par sécurité, nous vous recommandons de consulter votre professionnel de santé avant de poursuivre un programme d''exercices : votre traitement de fond doit d''abord être réévalué par lui, jamais par cette application.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20')
on conflict (rule_id) do nothing;

-- ============================================================
-- 3. Genou / hanche — chirurgie, traumatisme récent et restrictions
--    professionnelles (réf. D1, D2, décisions du 20/08/2026) : aucun délai
--    fixe universel (rejeté explicitement par Dr Nikiema) ; la restriction
--    déclarée par un professionnel de santé prime sur le délai écoulé.
--    Restrictions actives -> rouge (bloqué). Événement récent SANS
--    restriction actuellement déclarée -> orange (prudence).
-- ============================================================
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, active, version, validated_by, validated_date) values
  (
    'GENOU_CHIRURGIE_TRAUMA_RESTRICTIONS_ROUGE',
    'ARTHROSE_GENOU',
    '{"all": [{"any": [{"field": "chirurgie_recente", "operator": "equals", "value": true}, {"field": "traumatisme_recent", "operator": "equals", "value": true}]}, {"field": "restrictions_pro_recentes", "operator": "equals", "value": true}]}',
    'critical',
    'medical_referral',
    'Vous avez signalé une chirurgie ou un traumatisme récent du genou, avec des restrictions actuellement données par un professionnel de santé. Par sécurité, aucun programme standard n''est proposé : suivez les consignes de votre professionnel de santé, qui priment toujours sur toute recommandation de cette application.',
    true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'
  ),
  (
    'GENOU_CHIRURGIE_TRAUMA_RECENT_ORANGE',
    'ARTHROSE_GENOU',
    '{"all": [{"any": [{"field": "chirurgie_recente", "operator": "equals", "value": true}, {"field": "traumatisme_recent", "operator": "equals", "value": true}]}, {"field": "restrictions_pro_recentes", "operator": "equals", "value": false}]}',
    'warning',
    'require_precaution',
    'Vous avez signalé une chirurgie ou un traumatisme récent du genou, sans restriction actuellement en cours de la part d''un professionnel de santé. Par prudence, un programme adapté vous est proposé, sans progression pour l''instant.',
    true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'
  ),
  (
    'HANCHE_CHIRURGIE_TRAUMA_RESTRICTIONS_ROUGE',
    'ARTHROSE_HANCHE',
    '{"all": [{"any": [{"field": "chirurgie_recente", "operator": "equals", "value": true}, {"field": "traumatisme", "operator": "equals", "value": true}]}, {"field": "restrictions_pro_recentes", "operator": "equals", "value": true}]}',
    'critical',
    'medical_referral',
    'Vous avez signalé une chirurgie ou un traumatisme récent de la hanche (y compris une prothèse), avec des restrictions actuellement données par un professionnel de santé. Par sécurité, aucun programme standard n''est proposé : suivez les consignes de l''équipe qui vous a opéré ou suivi, qui priment toujours sur toute recommandation de cette application.',
    true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'
  ),
  (
    'HANCHE_CHIRURGIE_TRAUMA_RECENT_ORANGE',
    'ARTHROSE_HANCHE',
    '{"all": [{"any": [{"field": "chirurgie_recente", "operator": "equals", "value": true}, {"field": "traumatisme", "operator": "equals", "value": true}]}, {"field": "restrictions_pro_recentes", "operator": "equals", "value": false}]}',
    'warning',
    'require_precaution',
    'Vous avez signalé une chirurgie ou un traumatisme récent de la hanche, sans restriction actuellement en cours de la part d''un professionnel de santé. Par prudence, un programme adapté vous est proposé, sans progression pour l''instant.',
    true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'
  )
on conflict (rule_id) do nothing;

-- ============================================================
-- 4. Genou / hanche — seuils gradués D3 (décision du 20/08/2026) :
--    gonflement et instabilité du genou, limitation de marche et de
--    mobilité de la hanche, désormais des items `select` à 3 niveaux
--    (0 = vert, 1 = orange, 2 = rouge) dans packages/domain/src/screening.ts.
-- ============================================================
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, active, version, validated_by, validated_date) values
  ('GENOU_GONFLEMENT_ORANGE', 'ARTHROSE_GENOU', '{"field": "gonflement_evolution", "operator": "gte", "value": 1}', 'warning', 'require_precaution', 'Votre gonflement est nouveau ou a augmenté par rapport à d''habitude. Par prudence, réduisez la charge et évitez les exercices à fort impact ; pas de progression pour l''instant.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('GENOU_GONFLEMENT_ROUGE', 'ARTHROSE_GENOU', '{"field": "gonflement_evolution", "operator": "gte", "value": 2}', 'critical', 'medical_referral', 'Votre gonflement est important, s''aggrave rapidement, ou s''accompagne d''une douleur importante ou d''une incapacité fonctionnelle. Par sécurité, nous vous recommandons de consulter un professionnel de santé avant de poursuivre une activité physique.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('GENOU_INSTABILITE_ORANGE', 'ARTHROSE_GENOU', '{"field": "instabilite", "operator": "gte", "value": 1}', 'warning', 'require_precaution', 'Vous ressentez une instabilité occasionnelle du genou. Par prudence, privilégiez des exercices contrôlés, sans pivot ni changement brusque de direction ; pas de progression pour l''instant.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('GENOU_INSTABILITE_ROUGE', 'ARTHROSE_GENOU', '{"field": "instabilite", "operator": "gte", "value": 2}', 'critical', 'medical_referral', 'Votre instabilité du genou est répétée, aggravée, associée à des chutes ou à un blocage. Par sécurité, nous vous recommandons de consulter un professionnel de santé avant de poursuivre une activité physique.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),

  ('HANCHE_LIMITATION_MARCHE_ORANGE', 'ARTHROSE_HANCHE', '{"field": "limitation_marche", "operator": "gte", "value": 1}', 'warning', 'require_precaution', 'Votre distance ou votre temps de marche habituel a récemment diminué. Par prudence, un programme adapté vous est proposé (volume et intensité réduits) ; pas de progression pour l''instant.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('HANCHE_LIMITATION_MARCHE_ROUGE', 'ARTHROSE_HANCHE', '{"field": "limitation_marche", "operator": "gte", "value": 2}', 'critical', 'medical_referral', 'Vous signalez une impossibilité nouvelle ou importante de marcher ou de prendre appui, une aggravation brutale, ou une douleur importante. Par sécurité, nous vous recommandons de consulter un professionnel de santé avant de poursuivre une activité physique.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('HANCHE_LIMITATION_MOBILITE_ORANGE', 'ARTHROSE_HANCHE', '{"field": "limitation_mobilite", "operator": "gte", "value": 1}', 'warning', 'require_precaution', 'Votre mobilité de hanche a récemment diminué. Par prudence, un programme adapté vous est proposé (amplitude, charge et complexité réduites) ; pas de progression pour l''instant.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('HANCHE_LIMITATION_MOBILITE_ROUGE', 'ARTHROSE_HANCHE', '{"field": "limitation_mobilite", "operator": "gte", "value": 2}', 'critical', 'medical_referral', 'Vous signalez une limitation brutale ou importante de la mobilité de hanche, un blocage, une douleur aiguë ou une aggravation rapide. Par sécurité, nous vous recommandons de consulter un professionnel de santé avant de poursuivre une activité physique.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20')
on conflict (rule_id) do nothing;

-- ============================================================
-- 5. Spondyloarthrite axiale (réf. F1, F2, décisions du 20/08/2026).
--    Statut ORANGE : effort perçu supérieur à la cible (Borg CR10 > 4),
--    récupération insuffisante depuis la séance précédente, raideur
--    nettement augmentée, ou mobilité diminuée (niveau 1). Statut ROUGE :
--    liste explicite de signes d'alerte (le traumatisme récent est déjà
--    couvert par PROPOSED_AXSPA_TRAUMA_FRACTURE_RISK, activée le 20/08/2026
--    — voir 0006_validation_medicale_dr_nikiema_20260820.sql).
--    `symptomes_peripheriques` n'est PAS encore relié à une règle : sa
--    formulation actuelle (présence/absence simple) ne permet pas de
--    distinguer une atteinte stable et légère (pas d'orange, selon Dr
--    Nikiema) d'une atteinte douloureuse/gonflée/limitante (orange) — point
--    laissé ouvert, voir docs/MEDICAL_VALIDATION_NEEDED.md.
-- ============================================================
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, active, version, validated_by, validated_date) values
  ('SPA_EFFORT_BORG_ORANGE', 'SPONDYLOARTHRITE_AXIALE', '{"field": "effort_percu_borg", "operator": "gte", "value": 5}', 'warning', 'require_precaution', 'Votre effort ressenti est supérieur à la cible prescrite. Par prudence, diminuez l''intensité ou le volume, et augmentez les temps de récupération ; pas de progression pour l''instant.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('SPA_RECUPERATION_INSUFFISANTE_ORANGE', 'SPONDYLOARTHRITE_AXIALE', '{"field": "recuperation_satisfaisante", "operator": "equals", "value": false}', 'warning', 'require_precaution', 'Vos symptômes restent aggravés depuis votre dernière séance. Par prudence, privilégiez temporairement une mobilité douce et une activité aérobie adaptée ; pas de progression pour l''instant.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('SPA_RAIDEUR_ORANGE', 'SPONDYLOARTHRITE_AXIALE', '{"field": "raideur", "operator": "equals", "value": true}', 'warning', 'require_precaution', 'Votre raideur est nettement augmentée par rapport à l''habitude. Par prudence, un programme adapté vous est proposé ; pas de progression pour l''instant.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('SPA_MOBILITE_ORANGE', 'SPONDYLOARTHRITE_AXIALE', '{"field": "mobilite_niveau", "operator": "gte", "value": 1}', 'warning', 'require_precaution', 'Votre mobilité a récemment diminué, ou vous avez des difficultés à réaliser certains mouvements prévus. Par prudence, un programme adapté vous est proposé ; pas de progression pour l''instant.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('SPA_MOBILITE_ROUGE', 'SPONDYLOARTHRITE_AXIALE', '{"field": "mobilite_niveau", "operator": "gte", "value": 2}', 'critical', 'medical_referral', 'Vous signalez une incapacité nouvelle et importante à réaliser un mouvement. Par sécurité, nous vous recommandons de consulter un professionnel de santé avant de poursuivre une activité physique.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('SPA_RED_FLAG_DOULEUR_THORACIQUE', 'SPONDYLOARTHRITE_AXIALE', '{"field": "douleur_thoracique_ou_malaise", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Vous avez signalé une douleur thoracique ou un malaise. Par sécurité, nous vous recommandons de consulter un professionnel de santé sans attendre avant toute activité physique.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('SPA_RED_FLAG_DYSPNEE', 'SPONDYLOARTHRITE_AXIALE', '{"field": "dyspnee_inhabituelle", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Vous avez signalé une gêne respiratoire inhabituelle et importante. Par sécurité, nous vous recommandons de consulter un professionnel de santé avant de poursuivre une activité physique.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('SPA_RED_FLAG_DEFICIT_NEURO', 'SPONDYLOARTHRITE_AXIALE', '{"field": "deficit_neurologique_nouveau", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Vous avez signalé un déficit neurologique nouveau ou qui s''aggrave progressivement. Par sécurité, nous vous recommandons de consulter un professionnel de santé sans attendre.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('SPA_RED_FLAG_FAIBLESSE', 'SPONDYLOARTHRITE_AXIALE', '{"field": "faiblesse_nouvelle_importante", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Vous avez signalé une faiblesse nouvelle et importante. Par sécurité, nous vous recommandons de consulter un professionnel de santé avant de poursuivre une activité physique.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('SPA_RED_FLAG_FIEVRE_ETAT_GENERAL', 'SPONDYLOARTHRITE_AXIALE', '{"field": "fievre_alteration_etat_general", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Vous avez signalé de la fièvre ou une altération importante de votre état général, associée à des symptômes inhabituels. Par sécurité, nous vous recommandons de consulter un professionnel de santé avant de poursuivre une activité physique.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20')
on conflict (rule_id) do nothing;

-- ============================================================
-- 6. Ostéoporose — risque de chute (réf. G1, décision du 20/08/2026,
--    avec substitution du TUG par une question déclarative). Le risque
--    fracturaire (fracture récente/vertébrale connue) reste couvert
--    séparément par OSTEO_RECENT_FRACTURE (§21, Sprint 3) — Dr Nikiema
--    insiste explicitement sur le fait que ces deux risques sont distincts.
-- ============================================================
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, active, version, validated_by, validated_date) values
  ('OSTEO_CHUTE_MULTIPLE_ROUGE', 'OSTEOPOROSE', '{"field": "chutes_12_mois", "operator": "gte", "value": 2}', 'critical', 'medical_referral', 'Vous avez signalé plusieurs chutes au cours des 12 derniers mois. Par sécurité, nous vous recommandons une évaluation par un professionnel de santé avant de poursuivre une activité physique en autonomie.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('OSTEO_CHUTE_SOINS_ROUGE', 'OSTEOPOROSE', '{"field": "chute_necessite_soins", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Votre chute a nécessité des soins médicaux. Par sécurité, nous vous recommandons une évaluation par un professionnel de santé avant de poursuivre une activité physique en autonomie.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('OSTEO_CHUTE_PERTE_CONNAISSANCE_ROUGE', 'OSTEOPOROSE', '{"field": "chute_perte_connaissance", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Vous avez perdu connaissance ou eu un malaise avant une chute. Par sécurité, nous vous recommandons une évaluation médicale avant de poursuivre une activité physique en autonomie.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('OSTEO_CHUTE_AIDE_RELEVER_ROUGE', 'OSTEOPOROSE', '{"field": "chute_aide_relever", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Vous avez eu besoin d''aide pour vous relever après une chute. Par sécurité, nous vous recommandons une évaluation par un professionnel de santé avant de poursuivre une activité physique en autonomie.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('OSTEO_CHUTE_ORANGE', 'OSTEOPOROSE', '{"field": "chutes_12_mois", "operator": "gte", "value": 1}', 'warning', 'require_precaution', 'Vous avez signalé une chute au cours des 12 derniers mois. Un programme adapté vous est proposé, avec une priorité donnée au travail de l''équilibre, de la force fonctionnelle et de la marche.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('OSTEO_INSTABILITE_MARCHE_ORANGE', 'OSTEOPOROSE', '{"field": "instabilite_marche", "operator": "equals", "value": true}', 'warning', 'require_precaution', 'Vous ressentez une instabilité en marchant ou en vous levant. Un programme adapté vous est proposé, avec une priorité donnée au travail de l''équilibre.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('OSTEO_PEUR_TOMBER_ORANGE', 'OSTEOPOROSE', '{"field": "peur_de_tomber", "operator": "equals", "value": true}', 'warning', 'require_precaution', 'Vous avez signalé une peur de tomber. Un programme adapté vous est proposé, avec une priorité donnée au travail de l''équilibre et de la confiance dans le mouvement.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('OSTEO_AIDE_MARCHE_ORANGE', 'OSTEOPOROSE', '{"field": "aide_marche", "operator": "equals", "value": true}', 'warning', 'require_precaution', 'Vous utilisez une aide à la marche. Un programme adapté vous est proposé, avec une priorité donnée au travail de l''équilibre et de la force fonctionnelle.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('OSTEO_LENTEUR_ORANGE', 'OSTEOPOROSE', '{"field": "lenteur_lever_marcher", "operator": "equals", "value": true}', 'warning', 'require_precaution', 'Vous avez l''impression de mettre plus de temps que d''habitude à vous lever et à marcher. Un programme adapté vous est proposé, avec une priorité donnée au travail de l''équilibre et de la force fonctionnelle.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20')
on conflict (rule_id) do nothing;
