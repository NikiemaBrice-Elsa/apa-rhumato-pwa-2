-- Sprint 7 : séances (§28 « Structure d'une séance », §69 « Feedback après séance »).
--
-- Contrairement à clinical_assessments (Sprint 3, immuable) et
-- user_program_assignments (Sprint 6, immuable), une séance a un cycle de vie
-- en deux temps : démarrage (in_progress) puis clôture (completed/abandoned)
-- avec le feedback du patient (§69). Une policy update « own » est donc
-- nécessaire ici, contrairement aux tables précédentes — voir le commentaire
-- sur la policy plus bas pour les limites de ce que RLS peut/doit garantir.

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  program_id uuid references public.programs (program_id),
  pathology text not null references public.pathologies (code),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  -- §28 étape 2 « Vérification rapide » : capturée au démarrage.
  douleur_avant integer check (douleur_avant between 0 and 10),
  fatigue_avant integer check (fatigue_avant between 0 and 10),
  etat_general_avant text,
  -- §69 « Feedback après séance » : renseigné à la clôture uniquement.
  realisee boolean,
  difficulte text check (difficulte in ('facile', 'adaptee', 'difficile', 'tres_difficile')),
  douleur_apres integer check (douleur_apres between 0 and 10),
  fatigue_apres integer check (fatigue_apres between 0 and 10),
  ressenti text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- §28 étape 4 « Exercices principaux » : les exercices effectivement proposés
-- pour CETTE séance, figés au démarrage (une modification ultérieure du
-- programme ne doit jamais changer rétroactivement une séance déjà commencée
-- — §65 traçabilité). Comme program_exercises (Sprint 6), un exercice n'est
-- réellement affiché que s'il est `medical_validation_status = 'validated'`
-- (RLS de exercise_library, migration 0005) — défense en profondeur.
create table if not exists public.session_exercises (
  session_id uuid not null references public.sessions (id) on delete cascade,
  exercise_id uuid not null references public.exercise_library (exercise_id),
  order_index integer not null default 0,
  completed boolean not null default false,
  primary key (session_id, exercise_id)
);

create index if not exists idx_sessions_user_id on public.sessions (user_id);
create index if not exists idx_sessions_status on public.sessions (status);
create index if not exists idx_session_exercises_session on public.session_exercises (session_id);

alter table public.sessions enable row level security;
alter table public.session_exercises enable row level security;

create policy "sessions_select_own" on public.sessions
  for select using (auth.uid() = user_id);

create policy "sessions_insert_own" on public.sessions
  for insert with check (auth.uid() = user_id);

-- Une séance passe de 'in_progress' à 'completed'/'abandoned' avec le
-- feedback §69 : contrairement à clinical_assessments et
-- user_program_assignments, une policy update est donc nécessaire. RLS ne
-- peut pas exprimer ici « uniquement depuis in_progress, uniquement ces
-- colonnes » sans trigger dédié : cette policy garantit seulement la
-- frontière de sécurité essentielle (un utilisateur ne peut modifier que ses
-- propres séances) ; la restriction fonctionnelle des transitions autorisées
-- (in_progress -> completed | abandoned) est appliquée par la route API
-- (§46 : ne jamais faire confiance uniquement aux contrôles frontend — ici,
-- ni à RLS seule).
create policy "sessions_update_own" on public.sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "session_exercises_select_own" on public.session_exercises
  for select using (
    exists (
      select 1 from public.sessions s
      where s.id = session_exercises.session_id and s.user_id = auth.uid()
    )
  );

create policy "session_exercises_insert_own" on public.session_exercises
  for insert with check (
    exists (
      select 1 from public.sessions s
      where s.id = session_exercises.session_id and s.user_id = auth.uid()
    )
  );

create policy "session_exercises_update_own" on public.session_exercises
  for update using (
    exists (
      select 1 from public.sessions s
      where s.id = session_exercises.session_id and s.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.sessions s
      where s.id = session_exercises.session_id and s.user_id = auth.uid()
    )
  );
