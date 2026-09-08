-- Correctif post-déploiement (2026-09-06) : les migrations 0001-0016 ont été
-- exécutées via une connexion psql directe (contournant Supabase Studio),
-- qui pose normalement automatiquement les GRANT nécessaires pour les rôles
-- anon/authenticated/service_role sur les tables du schéma public. Ces GRANT
-- n'ont donc jamais été posés, provoquant "permission denied for table users"
-- dès la première inscription patient (§12).
--
-- Par ailleurs, 0002_row_level_security.sql définissait "users_select_own" et
-- "users_update_own" mais avait omis la policy INSERT nécessaire pour que
-- l'API d'inscription (apps/web/src/app/api/auth/signup/route.ts, qui insère
-- via le client anon + session utilisateur, donc soumis à la RLS) puisse
-- créer la ligne applicative correspondant au compte auth.users fraîchement
-- créé. La sécurité repose sur le principe déjà en place ailleurs dans ce
-- fichier : un utilisateur ne peut agir que sur sa propre ligne (auth.uid()).

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;

create policy "users_insert_own" on public.users
  for insert with check (auth.uid() = id);
