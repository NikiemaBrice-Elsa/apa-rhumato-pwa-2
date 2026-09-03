-- Sprint 11 : notifications (§39).
--
-- Ce projet n'implémente PAS l'envoi de notifications push (nécessiterait
-- des clés VAPID, un abonnement navigateur et une infrastructure de
-- planification/cron externes à cette base — voir docs/DECISIONS.md et
-- docs/DEPLOYMENT.md pour la justification de cette limite assumée). Cette
-- table alimente un centre de notifications IN-APP réel et testable :
-- chaque ligne est un message déjà généré, que l'utilisateur consulte dans
-- l'application.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  notification_type text not null check (
    notification_type in (
      'session_reminder',
      'assessment_reminder',
      'measurement_reminder',
      'encouragement',
      'missed_sessions_reminder',
      'streak_congratulations'
    )
  ),
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_unread on public.notifications (user_id, read, created_at);

alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications
  for select using (auth.uid() = user_id);

create policy "notifications_insert_own" on public.notifications
  for insert with check (auth.uid() = user_id);

create policy "notifications_update_own" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "notifications_delete_own" on public.notifications
  for delete using (auth.uid() = user_id);
