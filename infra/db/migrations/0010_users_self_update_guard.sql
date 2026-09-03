-- Sprint 13 : correctif de sécurité découvert PENDANT la vérification RLS de
-- ce sprint (§46, §78 : la sécurité prime, un correctif de sécurité n'attend
-- jamais la fin du sprint où il a été trouvé).
--
-- La policy "users_update_own" (migration 0002) autorise un utilisateur à
-- modifier SA PROPRE ligne `users`, sans aucune restriction de colonne. Or
-- cette même ligne porte `role` (patient/professional/admin) et `status`
-- (active/suspended/deleted) : sans ce correctif, n'importe quel utilisateur
-- authentifié pourrait s'auto-promouvoir administrateur (ou lever sa propre
-- suspension) par un simple appel PostgREST/Supabase direct, en contournant
-- entièrement l'espace admin et son contrôle applicatif `requireAdmin`
-- (apps/web/src/lib/adminAuth.ts) — RLS doit rester la ligne de défense
-- réelle, pas seulement le code applicatif (§46).
--
-- La policy RLS elle-même ne peut pas comparer proprement l'ancienne et la
-- nouvelle valeur d'une colonne (WITH CHECK ne voit que la ligne déjà
-- modifiée) : on utilise donc un trigger BEFORE UPDATE, qui a accès à OLD et
-- NEW. Seule une connexion utilisant la clé service_role (rôle Postgres
-- `service_role`, utilisée exclusivement par les routes /api/admin/*) peut
-- faire évoluer `role`/`status` ; toute autre tentative échoue explicitement
-- plutôt que d'être silencieusement ignorée.
--
-- IMPORTANT : cette fonction est volontairement SECURITY INVOKER (le
-- défaut — pas de `security definer`). L'objectif est de vérifier QUI
-- appelle (`current_user`, donc l'appelant réel) ; en `security definer`,
-- `current_user` refléterait le PROPRIÉTAIRE de la fonction (celui qui l'a
-- créée), pas l'appelant, ce qui aurait bloqué même les vraies écritures
-- service_role — erreur repérée et corrigée pendant la vérification RLS de
-- ce sprint (voir docs/DECISIONS.md).

create or replace function public.prevent_self_role_status_change()
returns trigger as $$
begin
  if (new.role is distinct from old.role or new.status is distinct from old.status)
     and current_user <> 'service_role' then
    raise exception 'Modification de role/status non autorisee via cette voie : passez par l''espace administrateur.';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists users_prevent_self_role_status_change on public.users;

create trigger users_prevent_self_role_status_change
  before update on public.users
  for each row execute function public.prevent_self_role_status_change();
