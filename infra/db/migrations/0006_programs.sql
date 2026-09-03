-- Sprint 6 : programmes (§29, §30, §67, §68).
-- Comme pour exercise_library (Sprint 5), cette migration crée uniquement la
-- STRUCTURE : aucun programme n'est inséré ici. Un programme ne peut être
-- proposé à un utilisateur que s'il existe (1) une règle `clinical_rules`
-- de type `allow_program` explicitement validée par le concepteur médical
-- ET pointant vers ce programme (colonne `program_id` ajoutée ci-dessous),
-- ET (2) le programme lui-même est `medical_validation_status = 'validated'`
-- (§57, §59) — défense en profondeur, comme pour exercise_library.

create table if not exists public.programs (
  program_id uuid primary key default gen_random_uuid(),
  program_code text not null unique, -- ex. OA_GENOU_DEBUTANT_01 (§30)
  pathology text not null references public.pathologies (code),
  profile_level text not null check (profile_level in ('debutant', 'intermediaire', 'avance')), -- critères de passage exacts : TODO_MEDICAL_VALIDATION (§58)
  objective text, -- code objectif (packages/domain/src/objectives.ts), texte libre pour tolérer une combinaison
  duration_weeks integer, -- TODO_MEDICAL_VALIDATION si non renseigné
  frequency_per_week integer, -- TODO_MEDICAL_VALIDATION si non renseigné
  intensity text, -- seuil exact à valider (§58 : « intensités cibles »)
  aerobic_component text,
  strength_component text,
  mobility_component text,
  balance_component text,
  functional_component text,
  progression_rule text, -- résumé texte ; la logique exécutable vit dans clinical_rules (action adjust_progression, Sprint 8)
  regression_rule text,
  safety_rules text,
  version text not null default 'V1.0',
  medical_validation_status text not null default 'draft' check (medical_validation_status in ('draft', 'pending_validation', 'validated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.program_exercises (
  program_id uuid not null references public.programs (program_id) on delete cascade,
  exercise_id uuid not null references public.exercise_library (exercise_id),
  order_index integer not null default 0,
  sets_override integer,
  repetitions_override integer,
  notes text,
  primary key (program_id, exercise_id)
);

create table if not exists public.program_references (
  program_id uuid not null references public.programs (program_id) on delete cascade,
  reference_id uuid not null references public.scientific_references (id),
  primary key (program_id, reference_id)
);

-- Un programme ne peut être assigné automatiquement que via une règle
-- `allow_program` qui porte désormais elle-même le programme concerné
-- (§30 exemple 1 : "ALORS programme = OA_GENOU_DEBUTANT_01"). Cette colonne
-- est nullable et ignorée pour toute autre action.
alter table public.clinical_rules
  add column if not exists program_id uuid references public.programs (program_id);

-- Historique immuable des tentatives d'attribution de programme, une par
-- évaluation (même logique que clinical_assessments, Sprint 3 : §65
-- traçabilité, jamais de modification silencieuse). `program_id` reste nul
-- tant qu'aucune règle `allow_program` validée ne s'est déclenchée : ce
-- n'est PAS une erreur, c'est l'état par défaut et sûr (§57, §59, §78).
create table if not exists public.user_program_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  assessment_id uuid references public.clinical_assessments (id),
  pathology text not null references public.pathologies (code),
  program_id uuid references public.programs (program_id),
  status text not null check (status in ('assigned', 'pending_validation')),
  matched_rule_id text references public.clinical_rules (rule_id),
  engine_version text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_programs_status on public.programs (medical_validation_status);
create index if not exists idx_program_exercises_program on public.program_exercises (program_id);
create index if not exists idx_user_program_assignments_user on public.user_program_assignments (user_id);

alter table public.programs enable row level security;
alter table public.program_exercises enable row level security;
alter table public.program_references enable row level security;
alter table public.user_program_assignments enable row level security;

-- Même défense en profondeur que exercise_library (migration 0005) : un
-- programme non validé n'est jamais lisible côté client, quel que soit le
-- code applicatif au-dessus.
create policy "programs_read_validated_only" on public.programs
  for select using (auth.role() = 'authenticated' and medical_validation_status = 'validated');

create policy "program_exercises_read_validated_only" on public.program_exercises
  for select using (
    exists (
      select 1 from public.programs p
      where p.program_id = program_exercises.program_id and p.medical_validation_status = 'validated'
    )
  );

create policy "program_references_read_validated_only" on public.program_references
  for select using (
    exists (
      select 1 from public.programs p
      where p.program_id = program_references.program_id and p.medical_validation_status = 'validated'
    )
  );

-- user_program_assignments : chaque utilisateur ne voit que ses propres
-- tentatives d'attribution (comme clinical_assessments). Immuable : pas de
-- policy update/delete, une réévaluation crée une nouvelle ligne.
create policy "user_program_assignments_select_own" on public.user_program_assignments
  for select using (auth.uid() = user_id);

create policy "user_program_assignments_insert_own" on public.user_program_assignments
  for insert with check (auth.uid() = user_id);
