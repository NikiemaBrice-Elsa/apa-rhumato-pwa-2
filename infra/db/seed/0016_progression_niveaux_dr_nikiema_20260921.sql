-- Intégration du document « système de progression » (uploadé le
-- 21/09/2026, instruction « analyse et exécute »).
--
-- Contenu de sa demande (section B) :
--   Débutant -> Intermédiaire : >= 80% des séances prévues réalisées sur les
--     4 dernières semaines, douleur <= 3/10, fatigue < 7/10, aucun signal
--     d'alerte/aggravation, capacité fonctionnelle stable ou améliorée.
--   Intermédiaire -> Supérieur : mêmes critères sur une fenêtre de 6
--     semaines, plus « bonne tolérance des exercices du niveau
--     intermédiaire » (jugée redondante avec douleur/fatigue déjà exigées,
--     voir docs/DECISIONS.md — pas un mécanisme séparé inventé).
--   « L'application ne devrait pas augmenter automatiquement le niveau
--     uniquement parce que les critères sont remplis » -> déjà le
--     comportement existant (affichage informatif seul, bascule volontaire
--     via POST /api/programs/progress) : rien à changer sur ce point.
--
-- §43 (infra/db/migrations/0004_clinical_rules.sql) : « les règles sont des
-- DONNÉES versionnées, jamais du code : une mise à jour scientifique se fait
-- en modifiant une ligne, pas en redéployant ». Les 6 règles
-- PROGRESSION_PROGRESS_* (infra/db/seed/0014_..._20260831.sql) portent déjà
-- EXACTEMENT cette décision (action=adjust_progression,
-- progression_decision='progress') — mises à jour ici en place plutôt que
-- dupliquées, `rule_id` inchangé pour ne pas perdre l'historique déjà
-- rattaché à ces règles (matched_rule_id sur d'éventuelles
-- user_program_assignments passées).
--
-- La fenêtre (4 ou 6 semaines) N'EST PAS encodée dans la condition : elle
-- dépend du niveau ACTUEL du patient, déjà résolue en amont par
-- `computePathologyProgressionResult` (apps/web/src/lib/progression.ts, via
-- PROGRESSION_WINDOW_WEEKS, packages/domain/src/programs.ts) dans le fait
-- unique `adherence_percent_fenetre_progression` — la même condition
-- s'applique donc littéralement aux deux transitions.
--
-- `capacite_fonctionnelle_tendance` est un fait NOUVEAU (Sprint 29,
-- packages/domain/src/functionalCapacity.ts, computeFunctionalCapacityTrend)
-- : tant qu'un patient n'a pas au moins 2 évaluations de capacité
-- fonctionnelle du même instrument, ce fait est absent -> l'opérateur `in`
-- ne matche jamais (facts[field] undefined) -> aucune des règles
-- PROGRESSION_PROGRESS_* ne se déclenche -> MEDICAL_PARAMETER_REQUIRED
-- (aucune recommandation affichée), jamais un « progress » deviné sans
-- cette donnée (§57, §59, §78 — même principe que le reste du moteur).
--
-- `progression_signal = 'aucun'` couvre déjà « douleur <= 3/10, fatigue <
-- 7/10, aucun signal d'alerte/aggravation » (voir computeProgressionFacts,
-- packages/domain/src/sessions.ts) — inchangé, pas de nouveau fait requis
-- pour cette partie du critère.
update public.clinical_rules
set
  condition = '{"all": [
    {"field": "progression_signal", "operator": "equals", "value": "aucun"},
    {"field": "adherence_percent_fenetre_progression", "operator": "gte", "value": 80},
    {"field": "capacite_fonctionnelle_tendance", "operator": "in", "value": ["stable", "amelioree"]}
  ]}',
  message = 'Vous suivez bien votre programme (adhésion, douleur, fatigue) et votre capacité fonctionnelle est stable ou en amélioration. Si vous vous sentez prêt(e), vous pouvez passer au niveau supérieur.',
  version = 'V2.0',
  validated_by = 'Dr Wendtongo Brice Florent NIKIEMA',
  validated_date = '2026-09-21',
  updated_at = now()
where rule_id = 'PROGRESSION_PROGRESS_' || pathology
  and pathology in ('LOMBALGIE_COMMUNE', 'ARTHROSE_GENOU', 'ARTHROSE_HANCHE', 'POLYARTHRITE_RHUMATOIDE', 'SPONDYLOARTHRITE_AXIALE', 'OSTEOPOROSE');
