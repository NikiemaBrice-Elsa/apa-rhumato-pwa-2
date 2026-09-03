-- Sprint 17 (suite 4) — Complète le mécanisme de progression/régression
-- (§29, §58, §70), resté un squelette depuis le Sprint 8 :
-- `evaluateProgressionDecision` (packages/rules-engine/src/progression.ts)
-- pouvait déjà repérer une règle `adjust_progression` correspondante, mais
-- ne pouvait pas savoir QUELLE décision (progresser / maintenir / réduire /
-- suspendre) elle porte, faute de colonne dédiée — le code renvoyait donc
-- toujours "maintain" en dur, quelle que soit la règle. Même principe que
-- `programs.program_id` sur `clinical_rules` (migration 0006) pour
-- `allow_program` : une colonne dédiée, ignorée pour toute autre action,
-- jamais devinée si absente (§57, §59, §78).

alter table public.clinical_rules
  add column if not exists progression_decision text
    check (progression_decision in ('progress', 'maintain', 'reduce', 'suspend'));

comment on column public.clinical_rules.progression_decision is
  'Décision portée par une règle action=adjust_progression (§29, §58, §70). '
  'Nulle pour toute autre action. Une règle adjust_progression sans cette '
  'colonne renseignée est ignorée par evaluateProgressionDecision (jamais '
  'de décision devinée, §57/§59/§78).';
