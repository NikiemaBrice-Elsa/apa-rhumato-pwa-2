-- Sprint 32 (23/09/2026, instruction directe de Dr Nikiema) : « dans le
-- profil on ne peut pas choisir plusieurs pathologies actuellement. Il faut
-- modifier pour qu'un choix multiple soit possible. »
--
-- `patient_profiles.main_pathology` (§13) était une colonne texte unique
-- (une seule pathologie déclarée dans le profil). Nouvelle colonne tableau
-- `main_pathologies`, même schéma que `objectives` (déjà un `text[]` sur
-- cette même table) : à partir de ce sprint, c'est elle que lisent/écrivent
-- packages/domain/src/validation.ts et apps/web/src/app/api/profile/route.ts.
--
-- L'ancienne colonne `main_pathology` N'EST PAS supprimée : ses valeurs
-- existantes sont reprises dans la nouvelle colonne (aucune perte de
-- donnée), et elle reste en base pour l'historique, simplement marquée
-- obsolète ci-dessous et plus jamais lue/écrite par le code applicatif.
alter table public.patient_profiles
  add column if not exists main_pathologies text[] not null default '{}';

-- Reprise des valeurs déjà saisies : chaque pathologie unique existante
-- devient un tableau à un seul élément. La condition `main_pathologies = '{}'`
-- rend cette étape rejouable sans écraser une saisie multiple déjà faite
-- après l'ajout de la colonne ci-dessus.
update public.patient_profiles
set main_pathologies = array[main_pathology]
where main_pathology is not null
  and main_pathologies = '{}';

comment on column public.patient_profiles.main_pathologies is
  'Pathologies suivies déclarées par le patient dans son profil (§13, Sprint 32, 23/09/2026, choix multiple) — remplace `main_pathology`.';

comment on column public.patient_profiles.main_pathology is
  'OBSOLÈTE depuis le Sprint 32 (23/09/2026) : remplacée par `main_pathologies` (tableau, choix multiple). Conservée uniquement pour ne pas perdre les données déjà saisies ; plus lue ni écrite par le code applicatif.';
