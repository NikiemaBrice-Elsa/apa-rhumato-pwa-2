-- Sprint 33 (27/09/2026, instruction directe de Dr Nikiema, suite à la mise
-- en place de l'avertissement avant séance du 27/09/2026) :
--
-- « en cas de séance non réalisée liée à une douleur élevée ou à un autre
-- critère, ce critère doit s'afficher sur le tableau de bord. Jusqu'à la
-- prochaine tentative de réalisation de séance. Et si, à la prochaine
-- tentative de réalisation de séance, le patient ne présente pas de
-- critères qui l'empêchent de le faire, alors le tableau doit être normal. »
--
-- Quand le patient voit l'avertissement (`shouldWarnBeforeSession`,
-- packages/domain/src/sessions.ts) et clique « Annuler », AUCUNE séance
-- n'est créée dans `public.sessions` — jusqu'ici, cet événement n'était donc
-- tracé nulle part, rendant impossible d'en garder la trace pour le tableau
-- de bord. Cette table journalise UNIQUEMENT ce cas précis (annulation) —
-- pas les séances poursuivies malgré l'avertissement, déjà tracées dans
-- `sessions` (colonnes `gonflement_articulaire_avant`, etc., migration 0025)
-- et considérées « réalisées » au sens de la demande de Dr Nikiema.
--
-- Immuable (même discipline que `clinical_assessments`,
-- `user_program_assignments`, §65) : aucune policy update/delete. Le
-- tableau de bord détermine si la dernière TENTATIVE pour une pathologie
-- est cette annulation (comparaison de `created_at` ici contre
-- `sessions.started_at` le plus récent pour la même pathologie) — dès
-- qu'une séance est démarrée après cette annulation (poursuivie ou non),
-- l'alerte cesse de s'afficher, sans qu'il soit nécessaire de supprimer ou
-- modifier cette ligne.
create table if not exists public.session_pre_alert_cancellations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  pathology text not null references public.pathologies (code),
  douleur_avant integer check (douleur_avant between 0 and 10),
  gonflement_articulaire boolean not null default false,
  fievre boolean not null default false,
  symptome_inhabituel boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_session_pre_alert_cancellations_user_pathology
  on public.session_pre_alert_cancellations (user_id, pathology, created_at desc);

alter table public.session_pre_alert_cancellations enable row level security;

create policy "session_pre_alert_cancellations_select_own" on public.session_pre_alert_cancellations
  for select using (auth.uid() = user_id);

create policy "session_pre_alert_cancellations_insert_own" on public.session_pre_alert_cancellations
  for insert with check (auth.uid() = user_id);

comment on table public.session_pre_alert_cancellations is
  'Sprint 33 (27/09/2026) : trace chaque séance non démarrée parce que le patient a choisi « Annuler » face à l''avertissement avant séance (douleur/gonflement/fièvre/symptôme). Sert uniquement à afficher un rappel sur le tableau de bord jusqu''à la prochaine tentative — jamais utilisée dans les calculs de progression/adhésion.';

NOTIFY pgrst, 'reload schema';
