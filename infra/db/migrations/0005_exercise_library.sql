-- Sprint 5 : bibliothèque d'exercices (§25, §26, §27).
-- Aucun exercice n'est inséré par cette migration : le contenu doit venir du
-- concepteur médical (voir infra/db/seed/tools/README.md et le gabarit Excel).

create table if not exists public.exercise_library (
  exercise_id uuid primary key default gen_random_uuid(),
  name text not null,
  short_description text not null,
  detailed_description text,
  category text not null check (category in ('aerobique', 'renforcement', 'mobilite', 'equilibre', 'controle_moteur', 'fonctionnel')),
  difficulty text, -- échelle exacte à valider (§58 : « niveaux de difficulté »)
  starting_position text,
  execution_steps text,
  breathing_instruction text,
  duration_seconds integer,
  repetitions integer,
  sets integer,
  rest_time_seconds integer,
  frequency text,
  intensity text, -- seuil exact à valider (§58 : « intensités cibles »)
  progression text,
  regression text,
  contraindications text,
  precautions text,
  stop_criteria text,
  target_muscles text,
  equipment_required text[] not null default '{}', -- sous-ensemble de : chaise, mur, tapis, serviette, bouteille_eau, elastique, aucun (§27)
  video_url text,
  audio_url text,
  thumbnail_url text,
  last_reviewed date,
  medical_validation_status text not null default 'draft' check (medical_validation_status in ('draft', 'pending_validation', 'validated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exercise_pathologies (
  exercise_id uuid not null references public.exercise_library (exercise_id) on delete cascade,
  pathology_code text not null references public.pathologies (code),
  primary key (exercise_id, pathology_code)
);

create table if not exists public.exercise_objectives (
  exercise_id uuid not null references public.exercise_library (exercise_id) on delete cascade,
  objective_code text not null,
  primary key (exercise_id, objective_code)
);

create table if not exists public.exercise_references (
  exercise_id uuid not null references public.exercise_library (exercise_id) on delete cascade,
  reference_id uuid not null references public.scientific_references (id),
  primary key (exercise_id, reference_id)
);

create index if not exists idx_exercise_library_status on public.exercise_library (medical_validation_status);
create index if not exists idx_exercise_pathologies_pathology on public.exercise_pathologies (pathology_code);

alter table public.exercise_library enable row level security;
alter table public.exercise_pathologies enable row level security;
alter table public.exercise_objectives enable row level security;
alter table public.exercise_references enable row level security;

-- §57/§59 : un exercice non validé médicalement ne doit JAMAIS être visible
-- des utilisateurs. Seul le statut 'validated' est lisible côté client ;
-- 'draft' et 'pending_validation' ne sont accessibles que via service_role
-- (revue interne, Sprint 13).
create policy "exercise_library_read_validated_only" on public.exercise_library
  for select using (auth.role() = 'authenticated' and medical_validation_status = 'validated');

create policy "exercise_pathologies_read_validated_only" on public.exercise_pathologies
  for select using (
    exists (
      select 1 from public.exercise_library e
      where e.exercise_id = exercise_pathologies.exercise_id and e.medical_validation_status = 'validated'
    )
  );

create policy "exercise_objectives_read_validated_only" on public.exercise_objectives
  for select using (
    exists (
      select 1 from public.exercise_library e
      where e.exercise_id = exercise_objectives.exercise_id and e.medical_validation_status = 'validated'
    )
  );

create policy "exercise_references_read_validated_only" on public.exercise_references
  for select using (
    exists (
      select 1 from public.exercise_library e
      where e.exercise_id = exercise_references.exercise_id and e.medical_validation_status = 'validated'
    )
  );
