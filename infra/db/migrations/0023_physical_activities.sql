-- Sprint 26 (21/09/2026) : historique des activités physiques (chronomètre +
-- suivi de marche/vélo GPS, Sprint 25) — répond à la demande de Dr Nikiema
-- de pouvoir choisir un type d'activité avant de lancer le compte à rebours
-- et de conserver un historique (durée, type, distance quand pertinente),
-- repris dans le rapport PDF de suivi (§40, §71).
--
-- Donnée autodéclarée par le patient, comme `measurements` (Sprint 8,
-- 0008_measurements.sql) : mêmes policies RLS "own" en select/insert/update/
-- delete (le patient peut corriger une saisie, par ex. un type d'activité
-- erroné) — aucune décision clinique n'est prise à partir de cette table
-- (§57, §59). `alter default privileges` posé par la migration 0017
-- couvre déjà automatiquement les GRANT anon/authenticated/service_role
-- pour cette nouvelle table, aucun GRANT explicite nécessaire ici.
create table if not exists public.physical_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  activity_type text not null check (
    activity_type in ('marche', 'velo', 'aerobie', 'fitness', 'natation', 'autre')
  ),
  duration_seconds integer not null check (duration_seconds > 0),
  -- Distance GPS (Sprint 25) : uniquement pertinente pour marche/vélo ;
  -- NULL pour les autres types, jamais une valeur inventée pour un type qui
  -- n'a pas de suivi GPS.
  distance_meters numeric(8, 1),
  started_at timestamptz not null,
  completed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_physical_activities_user_started on public.physical_activities (user_id, started_at);

alter table public.physical_activities enable row level security;

create policy "physical_activities_select_own" on public.physical_activities
  for select using (auth.uid() = user_id);

create policy "physical_activities_insert_own" on public.physical_activities
  for insert with check (auth.uid() = user_id);

create policy "physical_activities_update_own" on public.physical_activities
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "physical_activities_delete_own" on public.physical_activities
  for delete using (auth.uid() = user_id);
