-- Sprint 19 : nouvelle formule d'adhésion (réf. B13) + séance du jour
-- planifiée (réf. B11), 31/08/2026.
--
-- Réponse B13 (formule d'adhésion) : 2 indicateurs — séances complètes /
-- séances prescrites, dose réelle / dose prescrite — avec une séance
-- « complète » définie par un seuil ≥ 80 % de la durée OU du contenu prévu.
-- La durée cible par séance n'étant trackée nulle part, c'est le CONTENU
-- (fraction d'exercices prescrits cochés comme faits) qui est retenu — un
-- des deux critères qu'il a lui-même explicitement proposés (voir
-- packages/domain/src/sessions.ts, `computeSessionCompletionLevel`).
alter table public.sessions
  add column if not exists completion_level text check (completion_level in ('complete', 'partial'));

comment on column public.sessions.completion_level is
  'Niveau de complétude du CONTENU de la séance (réf. B13, 31/08/2026) — fraction des exercices prescrits cochés comme faits, seuil 80%. NULL tant que non évaluable (pas de programme, séance abandonnée, séance antérieure à ce champ).';

-- Réponse B11 (séance du jour) : « oui, séance planifiée automatiquement
-- selon le FITT-VP du patient, avec fenêtre de réalisation flexible (pas
-- d'heure imposée) et report possible sans pénalisation ». `planned_sessions`
-- porte cette planification, générée à la lecture (pas de tâche planifiée
-- côté serveur dans cette architecture) à partir de `programs.frequency_per_week`
-- déjà validé et d'une convention de répartition des jours (voir
-- packages/domain/src/planning.ts, `computeWeeklyScheduleWeekdays` — un choix
-- produit, pas un seuil clinique, documenté et ajustable).
--
-- `status` :
--   - 'due'             : séance planifiée non encore réalisée (jamais
--                          renommée en cas de report — voir original_planned_for
--                          pour la traçabilité, §65).
--   - 'completed'        : la séance liée (session_id) a été clôturée avec
--                          realisee = true.
--   - 'cancelled_safety'  : annulée par le patient pour raison de sécurité —
--                          action volontaire du patient (jamais automatique,
--                          même principe que la bascule de niveau de
--                          progression, Sprint 18).
create table if not exists public.planned_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  pathology text not null references public.pathologies (code),
  program_id uuid references public.programs (program_id),
  planned_for date not null,
  status text not null default 'due' check (status in ('due', 'completed', 'cancelled_safety')),
  original_planned_for date, -- renseigné uniquement si cette ligne a été reportée (§65 traçabilité)
  session_id uuid references public.sessions (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, pathology, planned_for)
);

comment on table public.planned_sessions is
  'Séance du jour planifiée (réf. B11, 31/08/2026) — générée à la lecture à partir de la fréquence hebdomadaire du programme validé assigné. Report possible sans pénalisation (déplace planned_for, jamais une nouvelle ligne).';

alter table public.sessions
  add column if not exists planned_session_id uuid references public.planned_sessions (id);

create index if not exists idx_planned_sessions_user on public.planned_sessions (user_id);
create index if not exists idx_planned_sessions_status on public.planned_sessions (status);

alter table public.planned_sessions enable row level security;

-- Isolation par utilisateur (même principe que sessions, measurements,
-- user_program_assignments) : un patient ne voit et ne modifie que ses
-- propres séances planifiées.
create policy "planned_sessions_select_own" on public.planned_sessions
  for select using (auth.uid() = user_id);

create policy "planned_sessions_insert_own" on public.planned_sessions
  for insert with check (auth.uid() = user_id);

create policy "planned_sessions_update_own" on public.planned_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
