-- Sprint 23 : espace professionnel de santé (§41), activé à la demande de
-- Dr Nikiema (13/09/2026, Q3 de Feuille_de_route_prioritaire_20260912.docx :
-- « Prioriser ce chantier maintenant »).
--
-- §41 : un professionnel de santé (kinésithérapeute, médecin traitant — PAS
-- nécessairement Dr Nikiema lui-même) doit pouvoir consulter les rapports
-- d'un patient qui le lui a autorisé. Le rôle `professional` existe déjà
-- dans `public.users.role` (migration 0001) et l'espace admin (Sprint 13,
-- `/admin/utilisateurs`) sait déjà attribuer ce rôle à un compte — cette
-- migration ajoute uniquement ce qui manquait : le lien d'autorisation
-- patient <-> professionnel.
--
-- Modèle volontairement simple et TOUJOURS initié par le PATIENT (jamais par
-- le professionnel lui-même — §46, même discipline que l'interdiction
-- d'auto-promotion admin, migration 0010) :
--   pending    -> le patient vient d'inviter ce professionnel
--   authorized -> le professionnel a accepté : accès en LECTURE SEULE
--   revoked    -> accès retiré (par le patient à tout moment, ou déclin
--                 initial du professionnel) ; un patient peut réinviter
--                 (revoked -> pending) mais jamais s'auto-autoriser.
create table if not exists public.patient_professional_links (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users (id) on delete cascade,
  professional_id uuid not null references public.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'authorized', 'revoked')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, professional_id),
  check (patient_id <> professional_id)
);

create index if not exists idx_ppl_patient on public.patient_professional_links (patient_id);
create index if not exists idx_ppl_professional on public.patient_professional_links (professional_id);

alter table public.patient_professional_links enable row level security;

-- Chacun des deux côtés du lien voit la ligne (mais rien d'un lien auquel il
-- n'appartient pas) — même principe que toutes les tables "propriétaire"
-- de ce projet (migration 0002 et suivantes).
create policy "ppl_select_own" on public.patient_professional_links
  for select using (auth.uid() = patient_id or auth.uid() = professional_id);

-- Seul le PATIENT crée l'invitation, et seulement vers un compte réellement
-- `professional`/`active` — vérifié ici, en RLS, pas seulement côté route
-- (§46 : « ne jamais faire confiance uniquement aux contrôles frontend »,
-- même exigence que le trigger de la migration 0010).
create policy "ppl_insert_patient" on public.patient_professional_links
  for insert
  with check (
    auth.uid() = patient_id
    and status = 'pending'
    and exists (
      select 1 from public.users u
      where u.id = professional_id and u.role = 'professional' and u.status = 'active'
    )
  );

-- Le patient peut annuler une invitation ou révoquer un accès déjà autorisé,
-- ou réinviter après une révocation — mais ne peut JAMAIS s'auto-autoriser
-- (`authorized` absent des valeurs permises ici).
create policy "ppl_update_patient" on public.patient_professional_links
  for update
  using (auth.uid() = patient_id)
  with check (auth.uid() = patient_id and status in ('pending', 'revoked'));

-- Le professionnel peut accepter (pending -> authorized) ou décliner/se
-- retirer (-> revoked) — mais ne peut jamais réinviter lui-même
-- (`pending` absent des valeurs permises ici : seul le patient réinvite).
create policy "ppl_update_professional" on public.patient_professional_links
  for update
  using (auth.uid() = professional_id)
  with check (auth.uid() = professional_id and status in ('authorized', 'revoked'));

comment on table public.patient_professional_links is
  'Autorisation patient -> professionnel de santé (§41, Sprint 23) : toujours initiée par le patient, jamais par le professionnel. Donne un accès LECTURE SEULE au rapport du patient (voir apps/web/src/lib/professionalAuth.ts et /api/professionnel/patients/[patientId]/report), jamais un droit d''écriture.';

-- `users_select_own` (migration 0002) ne permet à personne de lire la ligne
-- `users` d'un tiers — nécessaire ici pour qu'un patient voie le nom du
-- professionnel qu'il a invité, et qu'un professionnel voie le nom d'un
-- patient qui l'a autorisé. Restreint strictement aux deux parties d'un
-- lien EXISTANT (pending, authorized ou revoked) : jamais un accès général
-- à l'annuaire des utilisateurs, seulement à l'identité de la personne avec
-- qui un lien a déjà été créé (ce qui suppose que l'un des deux connaissait
-- déjà l'email de l'autre). Ne donne accès qu'à la ligne `users`
-- elle-même (identité, pas de donnée clinique) — jamais aux séances,
-- mesures ou évaluations du patient, qui restent régies séparément (voir
-- apps/web/src/lib/professionalAuth.ts, accès service_role explicitement
-- gated par un lien 'authorized').
create policy "users_select_linked_party" on public.users
  for select
  using (
    exists (
      select 1 from public.patient_professional_links l
      where (l.patient_id = auth.uid() and l.professional_id = users.id)
         or (l.professional_id = auth.uid() and l.patient_id = users.id)
    )
  );
