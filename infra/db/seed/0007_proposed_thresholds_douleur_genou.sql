-- Sprint 6bis (mécanisme) / intégration du 20/08/2026 (contenu) —
-- généré automatiquement par
-- `python3 infra/db/seed/tools/convert_thresholds_to_rules.py \
--    infra/db/seed/tools/gabarit_seuils_cliniques.xlsx`
-- à partir de la réponse D3 du questionnaire de validation médicale
-- (douleur du genou, seul item du D3 exprimable dans le type `scale_0_10`
-- du gabarit — voir docs/MEDICAL_VALIDATION_NEEDED.md pour les items
-- (gonflement/instabilité genou, limitation de marche/mobilité hanche)
-- que le gabarit ne peut pas encore représenter fidèlement).
--
-- TOUTES les règles ci-dessous sont insérées `active = false`. Le message
-- patient-facing n'a volontairement PAS été inventé (Dr Nikiema a fourni
-- une description clinique, pas une formulation destinée au patient) —
-- à rédiger avec le concepteur médical (voir B7/C1) avant toute activation.
-- Relire chaque condition, puis activer explicitement (active = true,
-- validated_by, validated_date) UNIQUEMENT celles que vous validez.

-- Source/justification (concepteur médical) : Réponse Dr Nikiema (D3, 20/08/2026) : vert 0-3/10 (stable/amélioration), orange 4-5/10 (adaptation, réduction charge/volume/amplitude, aucune progression), au-delà de 5/10 ou douleur inhabituelle/brutale/aggravée -> ne pas classer en simple orange, appliquer les règles de suspension/réévaluation. Messages patient-facing définitifs (colonnes G/H) non fournis -- à rédiger avec le concepteur médical (voir B7/C1).
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, active, version) values (
  'PROPOSED_ARTHROSE_GENOU_DOULEUR_ORANGE',
  'ARTHROSE_GENOU',
  '{"field": "douleur", "operator": "gte", "value": 4}',
  'warning',
  'require_precaution',
  '(message non renseigné dans le gabarit — à compléter)',
  false,
  'V0.1-proposition'
)
on conflict (rule_id) do nothing;

-- Source/justification (concepteur médical) : Réponse Dr Nikiema (D3, 20/08/2026) : vert 0-3/10 (stable/amélioration), orange 4-5/10 (adaptation, réduction charge/volume/amplitude, aucune progression), au-delà de 5/10 ou douleur inhabituelle/brutale/aggravée -> ne pas classer en simple orange, appliquer les règles de suspension/réévaluation. Messages patient-facing définitifs (colonnes G/H) non fournis -- à rédiger avec le concepteur médical (voir B7/C1).
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, active, version) values (
  'PROPOSED_ARTHROSE_GENOU_DOULEUR_ROUGE',
  'ARTHROSE_GENOU',
  '{"field": "douleur", "operator": "gte", "value": 6}',
  'critical',
  'medical_referral',
  '(message non renseigné dans le gabarit — à compléter)',
  false,
  'V0.1-proposition'
)
on conflict (rule_id) do nothing;

