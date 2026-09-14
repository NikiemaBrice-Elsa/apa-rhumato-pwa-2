-- Sprint 24 : format formalisé pour la difficulté et l'intensité cible d'un
-- exercice (§58 : « niveaux de difficulté », « intensités cibles »), validé
-- par Dr Nikiema le 14/09/2026 (Question 2 « a » du document
-- Propositions_Reformulation_Echelle_Premium_20260913.docx) : réutiliser
-- EXACTEMENT les deux échelles déjà validées ailleurs dans l'application,
-- plutôt que d'en inventer une nouvelle —
--   • difficulté  -> Débutant / Intermédiaire / Avancé (même vocabulaire que
--     `patient_profiles`/programme, voir packages/domain/src/programs.ts,
--     `PROFILE_LEVELS`) ;
--   • intensité   -> fourchette cible en échelle de Borg CR10 (0-10), déjà
--     utilisée pour l'effort perçu pendant l'activité (réf. B6, voir par
--     exemple `effort_percu_borg` dans packages/domain/src/screening.ts).
--
-- Ce sont des colonnes NOUVELLES, distinctes des colonnes `difficulty` et
-- `intensity` (texte libre) déjà présentes depuis le Sprint 5 : ces
-- dernières restent inchangées et continuent de porter la documentation
-- clinique détaillée déjà rédigée (raisonnement, références citées,
-- mentions explicites « PROPOSITION... à valider » — voir
-- infra/db/seed/0010_exercises_pending_validation_20260819.sql). Les
-- nouvelles colonnes ne portent QUE la valeur simple affichée au patient
-- (ex. « Intensité cible : 3-4/10 ») ; aucune valeur n'est fixée par cette
-- migration elle-même (toutes NULL par défaut, `null` = non classé, jamais
-- une valeur devinée — §57, §59, même discipline que `programs.ExercisePhase`).
alter table public.exercise_library
  add column if not exists difficulty_level text
  check (difficulty_level is null or difficulty_level in ('debutant', 'intermediaire', 'avance'));

alter table public.exercise_library
  add column if not exists intensity_borg_min integer
  check (intensity_borg_min is null or (intensity_borg_min >= 0 and intensity_borg_min <= 10));

alter table public.exercise_library
  add column if not exists intensity_borg_max integer
  check (intensity_borg_max is null or (intensity_borg_max >= 0 and intensity_borg_max <= 10));

alter table public.exercise_library
  add constraint exercise_library_borg_range_order
  check (intensity_borg_min is null or intensity_borg_max is null or intensity_borg_min <= intensity_borg_max);

comment on column public.exercise_library.difficulty_level is
  'Niveau de difficulté affiché au patient (Débutant/Intermédiaire/Avancé — §58, Sprint 24, 14/09/2026). Distinct du champ `difficulty` (texte libre, documentation clinique interne, Sprint 5).';

comment on column public.exercise_library.intensity_borg_min is
  'Borne basse de la fourchette d''intensité cible affichée au patient, échelle de Borg CR10 (§58, Sprint 24, 14/09/2026). Distinct du champ `intensity` (texte libre, documentation clinique interne, Sprint 5).';

comment on column public.exercise_library.intensity_borg_max is
  'Borne haute de la fourchette d''intensité cible affichée au patient, échelle de Borg CR10 (§58, Sprint 24, 14/09/2026). Distinct du champ `intensity` (texte libre, documentation clinique interne, Sprint 5).';
