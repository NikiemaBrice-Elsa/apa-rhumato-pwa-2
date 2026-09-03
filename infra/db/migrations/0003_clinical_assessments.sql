-- Sprint 3 : évaluation initiale + dépistage de sécurité (§14, §15).

create table if not exists public.clinical_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  pathology text not null references public.pathologies (code),
  assessment_type text not null default 'initial' check (assessment_type in ('initial', 'reassessment', 'safety_screening')),
  responses jsonb not null default '{}'::jsonb,
  safety_status text not null check (safety_status in ('vert', 'orange', 'rouge', 'pending_validation')),
  triggered_flags text[] not null default '{}',
  message text not null,
  engine_version text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_clinical_assessments_user_id on public.clinical_assessments (user_id);
create index if not exists idx_clinical_assessments_pathology on public.clinical_assessments (pathology);

alter table public.clinical_assessments enable row level security;

create policy "clinical_assessments_select_own" on public.clinical_assessments
  for select using (auth.uid() = user_id);

create policy "clinical_assessments_insert_own" on public.clinical_assessments
  for insert with check (auth.uid() = user_id);

-- Aucune policy update/delete : une évaluation est un enregistrement
-- immuable (traçabilité §65) ; une réévaluation crée une nouvelle ligne.
