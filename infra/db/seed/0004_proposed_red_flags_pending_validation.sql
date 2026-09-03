-- Sprint 6bis — PROPOSITIONS de red flags pour arthrose du genou, arthrose
-- de hanche, polyarthrite rhumatoïde et spondyloarthrite axiale, quatre
-- modules qui n'avaient jusqu'ici AUCUNE règle de dépistage (toujours
-- `pending_validation`, jamais vert/orange/rouge, voir §57/§59/§78).
--
-- Contrairement aux règles de 0003_clinical_rules.sql (dictées littéralement
-- par le cahier des charges, §16 et §21), CELLES-CI sont proposées par
-- l'équipe technique à partir de littérature scientifique publiée et
-- vérifiée (voir docs/DECISIONS.md, Sprint 6bis). Elles ne remplacent PAS
-- le jugement clinique du concepteur médical : elles sont insérées
-- `active = false` et `validated_by = null`, donc STRICTEMENT INERTES tant
-- que Dr Nikiema ne les relit pas et ne les active pas explicitement
-- (mettre `active = true`, `validated_by`, `validated_date`).
--
-- Elles ne couvrent QUE des signaux d'alerte (rouge / orientation médicale),
-- pas les seuils gradués vert/orange (douleur, gonflement modéré...) : ceux-
-- là restent un jugement clinique propre à chaque patient, à renseigner par
-- le concepteur médical via infra/db/seed/tools/gabarit_seuils_cliniques.xlsx.

-- Références scientifiques à l'appui (DOI vérifiés, §32).
insert into public.scientific_references
  (title, authors, journal, year, doi, organization, pathologies, recommendation_summary, last_checked)
values
  (
    'BSR & BHPR, BOA, RCGP and BSAC guidelines for management of the hot swollen joint in adults',
    'Coakley G, Mathews C, Field M, Jones A, Kingsley G, Walker D, Phillips M, Bradish C, McLachlan A, Mohammed R, Weston V',
    'Rheumatology',
    2006,
    '10.1093/rheumatology/kel163a',
    'BSR/BHPR/BOA/RCGP/BSAC',
    '{ARTHROSE_GENOU,ARTHROSE_HANCHE,POLYARTHRITE_RHUMATOIDE}',
    'Toute articulation chaude, gonflée et douloureuse d''apparition récente doit être considérée comme une arthrite septique jusqu''à preuve du contraire ; admission/orientation en urgence recommandée, même en l''absence de fièvre si la suspicion clinique est forte.',
    current_date
  ),
  (
    'Developing a Construct to Evaluate Flares in Rheumatoid Arthritis: A Conceptual Report of the OMERACT RA Flare Definition Working Group',
    'Alten R, Pohl C, Choy EH, et al.',
    'The Journal of Rheumatology',
    2011,
    '10.3899/jrheum.110400',
    'OMERACT',
    '{POLYARTHRITE_RHUMATOIDE}',
    'Définit conceptuellement une poussée de PR comme une aggravation des signes/symptômes d''une intensité et d''une durée suffisantes pour entraîner un changement de traitement ; construct multi-domaines (douleur, raideur, fatigue, impact fonctionnel), pas un seuil numérique unique. Utile pour guider la FORMULATION de la question patient « poussée récente » (déjà identifiée comme en attente dans docs/MEDICAL_VALIDATION_NEEDED.md), pas pour une règle automatique.',
    current_date
  ),
  (
    'Injuries to the Rigid Spine: What the Spine Surgeon Wants to Know',
    'Shah NG, Keraliya A, Nunez DB, Schoenfeld A, Harris MB, Bono CM, Khurana B',
    'RadioGraphics',
    2019,
    '10.1148/rg.2019180125',
    'RSNA',
    '{SPONDYLOARTHRITE_AXIALE}',
    'Chez les personnes à rachis rigide/ankylosé (dont la spondyloarthrite axiale évoluée), la stabilité biomécanique du rachis est altérée : un traumatisme même mineur peut provoquer une fracture instable, le plus souvent par hyperextension. Ne fournit pas de seuil de douleur, seulement un principe d''alerte lié au traumatisme lui-même.',
    current_date
  )
on conflict do nothing;

-- PROPOSITION 1 — Arthrose du genou : suspicion d'arthrite septique
-- (articulation chaude + gonflée, ou fièvre associée). Cf. Coakley et al. 2006.
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, reference_id, active, version) values
  (
    'PROPOSED_OA_GENOU_HOT_JOINT',
    'ARTHROSE_GENOU',
    '{"any": [{"field": "fievre", "operator": "equals", "value": true}, {"all": [{"field": "gonflement", "operator": "equals", "value": true}, {"field": "chaleur_locale", "operator": "equals", "value": true}]}]}',
    'critical',
    'medical_referral',
    'PROPOSITION (non activée) : une articulation chaude et gonflée, ou une fièvre associée, doit être évaluée en urgence par un professionnel de santé avant de poursuivre — message final à valider par le concepteur médical.',
    (select id from public.scientific_references where doi = '10.1093/rheumatology/kel163a'),
    false,
    'V0.1-proposition'
  )
on conflict (rule_id) do nothing;

-- PROPOSITION 2 — Arthrose de hanche : même logique.
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, reference_id, active, version) values
  (
    'PROPOSED_OA_HANCHE_HOT_JOINT',
    'ARTHROSE_HANCHE',
    '{"any": [{"field": "fievre", "operator": "equals", "value": true}, {"all": [{"field": "gonflement", "operator": "equals", "value": true}, {"field": "chaleur_locale", "operator": "equals", "value": true}]}]}',
    'critical',
    'medical_referral',
    'PROPOSITION (non activée) : une articulation chaude et gonflée, ou une fièvre associée, doit être évaluée en urgence par un professionnel de santé avant de poursuivre — message final à valider par le concepteur médical. Le risque de sepsis de hanche justifie une orientation orthopédique rapide (Coakley et al. 2006).',
    (select id from public.scientific_references where doi = '10.1093/rheumatology/kel163a'),
    false,
    'V0.1-proposition'
  )
on conflict (rule_id) do nothing;

-- PROPOSITION 3 — Polyarthrite rhumatoïde : même logique, pertinence accrue
-- chez les patients sous traitement immunosuppresseur/biothérapie (risque
-- infectieux plus élevé, contexte général bien documenté en rhumatologie).
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, reference_id, active, version) values
  (
    'PROPOSED_PR_HOT_JOINT',
    'POLYARTHRITE_RHUMATOIDE',
    '{"any": [{"field": "fievre", "operator": "equals", "value": true}, {"all": [{"field": "gonflement", "operator": "equals", "value": true}, {"field": "chaleur_locale", "operator": "equals", "value": true}]}]}',
    'critical',
    'medical_referral',
    'PROPOSITION (non activée) : une articulation chaude et gonflée, ou une fièvre associée, doit être évaluée en urgence par un professionnel de santé avant de poursuivre — message final à valider par le concepteur médical. Vigilance particulière si traitement de fond immunosuppresseur/biothérapie.',
    (select id from public.scientific_references where doi = '10.1093/rheumatology/kel163a'),
    false,
    'V0.1-proposition'
  )
on conflict (rule_id) do nothing;

-- PROPOSITION 4 — Spondyloarthrite axiale : traumatisme récent (même
-- mineur) chez une personne à rachis potentiellement rigide/ankylosé.
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, reference_id, active, version) values
  (
    'PROPOSED_AXSPA_TRAUMA_FRACTURE_RISK',
    'SPONDYLOARTHRITE_AXIALE',
    '{"field": "traumatisme_recent", "operator": "equals", "value": true}',
    'critical',
    'medical_referral',
    'PROPOSITION (non activée) : chez une personne atteinte de spondyloarthrite axiale, un traumatisme même mineur peut provoquer une fracture instable du rachis en cas d''ankylose. Une évaluation médicale (imagerie) est recommandée avant de reprendre tout exercice — message final à valider par le concepteur médical.',
    (select id from public.scientific_references where doi = '10.1148/rg.2019180125'),
    false,
    'V0.1-proposition'
  )
on conflict (rule_id) do nothing;

-- Rappel : `active = false` sur les 4 lignes ci-dessus signifie qu'elles
-- n'ont AUCUN effet sur le comportement de l'application tant qu'elles ne
-- sont pas explicitement activées (voir packages/rules-engine/src/engine.ts,
-- evaluateRules filtre sur `active`). C'est le même mécanisme de sécurité
-- que celui déjà utilisé par le test de garde-fou
-- apps/web/tests/security/screening-no-invented-green.test.ts.
