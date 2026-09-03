-- Intégration des réponses de Dr Wendtongo Brice Florent NIKIEMA au document
-- QUESTIONS_PROGRESSION_REGRESSION_20260823.docx (4 questions posées le
-- 23/08/2026, réponses reçues et complétées le 31/08/2026).
--
-- Synthèse de ses réponses (toutes Proposition A) :
--   Q1 (seuil de fatigue excessive)      -> fatigueApres >= 7/10 = vigilance.
--   Q2 (signal isolé/répété)             -> 1 signal isolé = maintain ;
--                                            2 séances consécutives avec le
--                                            même signal négatif = reduce ;
--                                            « tout signal rouge... prime
--                                            sur les règles de progression »
--                                            = suspend (réutilise le seuil
--                                            rouge transversal déjà validé,
--                                            réf. B1, douleur >= 7/10).
--   Q3 (périmètre de données)            -> démarrer avec adhésion/douleur/
--                                            fatigue/difficulté/réalisée,
--                                            déjà trackés ; gonflement/
--                                            raideur/baisse fonctionnelle
--                                            restent hors périmètre.
--   Q4 (surface produit)                 -> affichage informatif SEULEMENT ;
--                                            « ne modifie jamais
--                                            automatiquement le programme du
--                                            patient » — toute bascule de
--                                            niveau reste une action
--                                            volontaire (voir
--                                            apps/web/src/app/api/programs/
--                                            progress/route.ts).
--
-- Ces réponses sont traduites en faits par `computeProgressionFacts`
-- (packages/domain/src/sessions.ts, fait de synthèse `progression_signal`)
-- puis en 24 règles ci-dessous (une par décision × 6 pathologies) —
-- identiques d'une pathologie à l'autre car `progression_signal` et
-- `adherence_percent_semaine` sont calculés de façon générique à partir de
-- `sessions`, contrairement aux règles de dépistage qui portent sur des
-- champs spécifiques par pathologie.
--
-- §57, §59, §78 : une règle qui ne matche jamais aucun des 4 cas (ex.
-- « aucun signal négatif mais adhésion < 80 % ou inconnue ») ne déclenche
-- délibérément AUCUNE des 24 règles ci-dessous : `evaluateProgressionDecision`
-- renvoie alors MEDICAL_PARAMETER_REQUIRED (aucune recommandation affichée)
-- plutôt qu'un « maintain » deviné par défaut pour ce cas non couvert
-- explicitement par sa réponse.
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, progression_decision, active, version, validated_by, validated_date)
select
  'PROGRESSION_SUSPEND_' || p.code,
  p.code,
  '{"field": "progression_signal", "operator": "equals", "value": "critique"}',
  'critical',
  'adjust_progression',
  'Votre douleur après la dernière séance est élevée. Par sécurité, nous vous recommandons de suspendre votre programme et d''en parler à un professionnel de santé avant de reprendre une activité physique.',
  'suspend',
  true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-31'
from public.pathologies p
where p.code in ('LOMBALGIE_COMMUNE', 'ARTHROSE_GENOU', 'ARTHROSE_HANCHE', 'POLYARTHRITE_RHUMATOIDE', 'SPONDYLOARTHRITE_AXIALE', 'OSTEOPOROSE')
on conflict (rule_id) do nothing;

insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, progression_decision, active, version, validated_by, validated_date)
select
  'PROGRESSION_REDUCE_' || p.code,
  p.code,
  '{"field": "progression_signal", "operator": "equals", "value": "repete"}',
  'warning',
  'adjust_progression',
  'Le même signal (douleur, fatigue ou difficulté) est revenu lors de vos deux dernières séances. Par prudence, nous vous recommandons de réduire temporairement l''intensité et/ou le volume de votre programme ; si cela persiste, parlez-en à un professionnel de santé.',
  'reduce',
  true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-31'
from public.pathologies p
where p.code in ('LOMBALGIE_COMMUNE', 'ARTHROSE_GENOU', 'ARTHROSE_HANCHE', 'POLYARTHRITE_RHUMATOIDE', 'SPONDYLOARTHRITE_AXIALE', 'OSTEOPOROSE')
on conflict (rule_id) do nothing;

insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, progression_decision, active, version, validated_by, validated_date)
select
  'PROGRESSION_MAINTAIN_' || p.code,
  p.code,
  '{"field": "progression_signal", "operator": "equals", "value": "isole"}',
  'info',
  'adjust_progression',
  'Un signal ponctuel (douleur, fatigue ou difficulté) est apparu lors de votre dernière séance. Ce n''est pas inquiétant à lui seul : votre programme est maintenu tel quel cette semaine.',
  'maintain',
  true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-31'
from public.pathologies p
where p.code in ('LOMBALGIE_COMMUNE', 'ARTHROSE_GENOU', 'ARTHROSE_HANCHE', 'POLYARTHRITE_RHUMATOIDE', 'SPONDYLOARTHRITE_AXIALE', 'OSTEOPOROSE')
on conflict (rule_id) do nothing;

insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, progression_decision, active, version, validated_by, validated_date)
select
  'PROGRESSION_PROGRESS_' || p.code,
  p.code,
  '{"all": [{"field": "progression_signal", "operator": "equals", "value": "aucun"}, {"field": "adherence_percent_semaine", "operator": "gte", "value": 80}]}',
  'info',
  'adjust_progression',
  'Vous suivez bien votre programme cette semaine, sans signal de vigilance particulier. Si vous vous sentez prêt(e), vous pouvez passer au niveau supérieur.',
  'progress',
  true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-31'
from public.pathologies p
where p.code in ('LOMBALGIE_COMMUNE', 'ARTHROSE_GENOU', 'ARTHROSE_HANCHE', 'POLYARTHRITE_RHUMATOIDE', 'SPONDYLOARTHRITE_AXIALE', 'OSTEOPOROSE')
on conflict (rule_id) do nothing;
