-- §45, §46 : accès par rôle, principe du moindre privilège.
-- Chaque utilisateur ne peut lire/écrire que ses propres données.
-- Les tables de référence (pathologies, scientific_references) sont en
-- lecture publique authentifiée, écriture réservée au rôle admin (Sprint 13).

alter table public.users enable row level security;
alter table public.patient_profiles enable row level security;
alter table public.patient_other_pathologies enable row level security;
alter table public.pathologies enable row level security;
alter table public.scientific_references enable row level security;
alter table public.audit_logs enable row level security;

create policy "users_select_own" on public.users
  for select using (auth.uid() = id);

create policy "users_update_own" on public.users
  for update using (auth.uid() = id);

create policy "patient_profiles_select_own" on public.patient_profiles
  for select using (auth.uid() = user_id);

create policy "patient_profiles_upsert_own" on public.patient_profiles
  for insert with check (auth.uid() = user_id);

create policy "patient_profiles_update_own" on public.patient_profiles
  for update using (auth.uid() = user_id);

create policy "patient_other_pathologies_select_own" on public.patient_other_pathologies
  for select using (
    exists (
      select 1 from public.patient_profiles p
      where p.id = patient_other_pathologies.profile_id and p.user_id = auth.uid()
    )
  );

create policy "pathologies_read_authenticated" on public.pathologies
  for select using (auth.role() = 'authenticated');

create policy "scientific_references_read_authenticated" on public.scientific_references
  for select using (auth.role() = 'authenticated');

-- audit_logs : pas de lecture/écriture directe depuis le client ; uniquement
-- via la clé service_role côté serveur (aucune policy select/insert publique).
