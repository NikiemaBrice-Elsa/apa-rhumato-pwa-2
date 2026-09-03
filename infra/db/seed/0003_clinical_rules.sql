-- Sprint 4 : les deux seules règles de sécurité explicitement fournies par
-- le cahier des charges, désormais stockées comme données versionnées
-- (§30, §31, §43) plutôt que codées en dur. Toute autre règle nécessite une
-- validation du concepteur médical avant d'être ajoutée ici (§57, §59) —
-- voir docs/MEDICAL_VALIDATION_NEEDED.md.

-- §16 : 11 red flags lombalgie / lombosciatique. Un seul déclenché suffit à
-- faire basculer le dépistage sur "rouge" (aucun programme automatique).
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, active, version) values
  ('LBP_RED_FLAG_TRAUMATISME', 'LOMBALGIE_COMMUNE', '{"field": "traumatisme_important", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Cette application ne peut pas déterminer la cause de vos symptômes. Une évaluation médicale est nécessaire avant de commencer un programme d''exercices.', true, 'V1.0'),
  ('LBP_RED_FLAG_DOULEUR_INHABITUELLE', 'LOMBALGIE_COMMUNE', '{"field": "douleur_inhabituelle_intense", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Cette application ne peut pas déterminer la cause de vos symptômes. Une évaluation médicale est nécessaire avant de commencer un programme d''exercices.', true, 'V1.0'),
  ('LBP_RED_FLAG_FIEVRE', 'LOMBALGIE_COMMUNE', '{"field": "fievre_contexte_infectieux", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Cette application ne peut pas déterminer la cause de vos symptômes. Une évaluation médicale est nécessaire avant de commencer un programme d''exercices.', true, 'V1.0'),
  ('LBP_RED_FLAG_CANCER', 'LOMBALGIE_COMMUNE', '{"field": "antecedent_cancer_pertinent", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Cette application ne peut pas déterminer la cause de vos symptômes. Une évaluation médicale est nécessaire avant de commencer un programme d''exercices.', true, 'V1.0'),
  ('LBP_RED_FLAG_PERTE_POIDS', 'LOMBALGIE_COMMUNE', '{"field": "perte_poids_inexpliquee", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Cette application ne peut pas déterminer la cause de vos symptômes. Une évaluation médicale est nécessaire avant de commencer un programme d''exercices.', true, 'V1.0'),
  ('LBP_RED_FLAG_DEFICIT_MOTEUR', 'LOMBALGIE_COMMUNE', '{"field": "deficit_moteur_important", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Cette application ne peut pas déterminer la cause de vos symptômes. Une évaluation médicale est nécessaire avant de commencer un programme d''exercices.', true, 'V1.0'),
  ('LBP_RED_FLAG_DEFICIT_NEURO', 'LOMBALGIE_COMMUNE', '{"field": "deficit_neurologique_progressif", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Cette application ne peut pas déterminer la cause de vos symptômes. Une évaluation médicale est nécessaire avant de commencer un programme d''exercices.', true, 'V1.0'),
  ('LBP_RED_FLAG_SPHINCTER', 'LOMBALGIE_COMMUNE', '{"field": "troubles_sphincteriens", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Cette application ne peut pas déterminer la cause de vos symptômes. Une évaluation médicale est nécessaire avant de commencer un programme d''exercices.', true, 'V1.0'),
  ('LBP_RED_FLAG_ANESTHESIE_SELLE', 'LOMBALGIE_COMMUNE', '{"field": "anesthesie_en_selle", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Cette application ne peut pas déterminer la cause de vos symptômes. Une évaluation médicale est nécessaire avant de commencer un programme d''exercices.', true, 'V1.0'),
  ('LBP_RED_FLAG_QUEUE_DE_CHEVAL', 'LOMBALGIE_COMMUNE', '{"field": "suspicion_queue_de_cheval", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Cette application ne peut pas déterminer la cause de vos symptômes. Une évaluation médicale est nécessaire avant de commencer un programme d''exercices.', true, 'V1.0'),
  ('LBP_RED_FLAG_AUTRE', 'LOMBALGIE_COMMUNE', '{"field": "autre_situation_preoccupante", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Cette application ne peut pas déterminer la cause de vos symptômes. Une évaluation médicale est nécessaire avant de commencer un programme d''exercices.', true, 'V1.0')
on conflict (rule_id) do nothing;

-- §21 + Cas 4 du §56 : fracture récente -> pas de programme automatisé.
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, active, version) values
  ('OSTEO_RECENT_FRACTURE', 'OSTEOPOROSE', '{"field": "fracture_recente", "operator": "equals", "value": true}', 'critical', 'stop_program', 'Une fracture récente a été signalée. Pour votre sécurité, aucun programme n''est généré automatiquement : une validation par un professionnel de santé est nécessaire avant de commencer un programme d''exercices.', true, 'V1.0')
on conflict (rule_id) do nothing;

-- Aucune autre règle n'est insérée ici : les seuils vert/orange (lombalgie
-- hors red flag) et l'ensemble des critères pour arthrose genou/hanche, PR
-- et spondyloarthrite axiale restent à valider (docs/MEDICAL_VALIDATION_NEEDED.md).
