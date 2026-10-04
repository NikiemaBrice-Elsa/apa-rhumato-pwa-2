-- Sprint 39 (04/10/2026, instruction directe de Dr Nikiema) : « Dans la liste
-- des activités physiques il faut ajouter "Renforcement musculaire" ».
--
-- Élargit la contrainte CHECK de `physical_activities.activity_type`
-- (0023_physical_activities.sql) au nouveau code `renforcement_musculaire`.
-- Aucune colonne supprimée ni modifiée : seules les valeurs autorisées
-- s'élargissent, les lignes existantes restent valides telles quelles.
alter table public.physical_activities
  drop constraint if exists physical_activities_activity_type_check;

alter table public.physical_activities
  add constraint physical_activities_activity_type_check check (
    activity_type in (
      'marche',
      'velo',
      'aerobie',
      'renforcement_musculaire',
      'fitness',
      'natation',
      'autre'
    )
  );

notify pgrst, 'reload schema';
