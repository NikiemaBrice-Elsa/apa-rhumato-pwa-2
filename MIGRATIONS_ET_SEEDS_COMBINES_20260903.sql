-- ============================================================
-- APA Rhumatologie — Script combiné de mise en production
-- Généré le 2026-09-03 — concatène, DANS L'ORDRE, toutes
-- les migrations (infra/db/migrations/) puis tous les seeds
-- (infra/db/seed/), pour un COLLER-EXÉCUTER unique dans
-- l'éditeur SQL de Supabase plutôt que 31 allers-retours.
-- ============================================================

-- ===== MIGRATION : 0001_users_and_profiles.sql =====
-- Sprint 2 : authentification, comptes, profils patients.
-- Correspond au schéma proposé dans docs/ARCHITECTURE_TECHNIQUE_V1.md (section 4).
-- Prérequis : Supabase Auth déjà activé (fournit auth.users).

create extension if not exists "pgcrypto";

-- §12 : création de compte. Étend auth.users avec les données applicatives.
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null,
  last_name text,
  birth_date date,
  sex text check (sex in ('female', 'male', 'other', 'undisclosed')),
  email text unique,
  phone text unique,
  role text not null default 'patient' check (role in ('patient', 'professional', 'admin')),
  locale text not null default 'fr',
  consent_terms_accepted_at timestamptz,
  consent_data_processing_accepted_at timestamptz,
  status text not null default 'active' check (status in ('active', 'suspended', 'deleted')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- §7 : les six modules de la V1. Table de référence, extensible plus tard.
create table if not exists public.pathologies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_fr text not null,
  description text,
  module_version text not null default 'V1.0',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- §13 : profil patient.
create table if not exists public.patient_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  height_cm numeric(5, 1),
  weight_kg numeric(5, 1),
  bmi numeric(4, 1),
  waist_circumference_cm numeric(5, 1),
  physical_activity_level smallint check (physical_activity_level between 1 and 5),
  main_pathology text references public.pathologies (code),
  objectives text[] not null default '{}',
  functional_limitations text,
  pain_baseline smallint check (pain_baseline between 0 and 10),
  fatigue_baseline smallint check (fatigue_baseline between 0 and 10),
  track_cardio_params boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- §13 « autres pathologies » : comorbidités déclarées.
create table if not exists public.patient_other_pathologies (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.patient_profiles (id) on delete cascade,
  pathology_id uuid not null references public.pathologies (id),
  notes text,
  unique (profile_id, pathology_id)
);

-- §32 : base documentaire scientifique.
create table if not exists public.scientific_references (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  authors text not null,
  journal text,
  year integer not null,
  doi text,
  url text,
  organization text not null,
  pathologies text[] not null default '{}',
  recommendation_summary text not null,
  evidence_level text,
  last_checked date not null default current_date
);

-- §45 : journalisation des actions sensibles.
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  ip_address text,
  user_agent text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_patient_profiles_user_id on public.patient_profiles (user_id);
create index if not exists idx_audit_logs_user_id on public.audit_logs (user_id);

-- ===== MIGRATION : 0002_row_level_security.sql =====
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

-- ===== MIGRATION : 0003_clinical_assessments.sql =====
-- Sprint 3 : évaluation initiale + dépistage de sécurité (§14, §15).

create table if not exists public.clinical_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  pathology text not null references public.pathologies (code),
  assessment_type text not null default 'initial' check (assessment_type in ('initial', 'reassessment', 'safety_screening')),
  responses jsonb not null default '{}'::jsonb,
  safety_status text not null check (safety_status in ('vert', 'orange', 'rouge', 'pending_validation')),
  triggered_flags text[] not null default '{}',
  message text not null,
  engine_version text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_clinical_assessments_user_id on public.clinical_assessments (user_id);
create index if not exists idx_clinical_assessments_pathology on public.clinical_assessments (pathology);

alter table public.clinical_assessments enable row level security;

create policy "clinical_assessments_select_own" on public.clinical_assessments
  for select using (auth.uid() = user_id);

create policy "clinical_assessments_insert_own" on public.clinical_assessments
  for insert with check (auth.uid() = user_id);

-- Aucune policy update/delete : une évaluation est un enregistrement
-- immuable (traçabilité §65) ; une réévaluation crée une nouvelle ligne.

-- ===== MIGRATION : 0004_clinical_rules.sql =====
-- Sprint 4 : moteur de règles médicales déterministe (§30, §31).
-- Les règles sont des DONNÉES versionnées, jamais du code : une mise à jour
-- scientifique se fait en modifiant une ligne, pas en redéployant (§43).

create table if not exists public.clinical_rules (
  rule_id text primary key,
  pathology text not null references public.pathologies (code),
  condition jsonb not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  action text not null check (action in ('allow_program', 'require_precaution', 'medical_referral', 'adjust_progression', 'stop_program')),
  message text not null,
  reference_id uuid references public.scientific_references (id),
  active boolean not null default true,
  version text not null default 'V1.0',
  validated_by text,
  validated_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_clinical_rules_pathology on public.clinical_rules (pathology) where active;

alter table public.clinical_rules enable row level security;

-- Lecture seule pour tout utilisateur authentifié (le moteur tourne côté
-- serveur, mais la lecture n'expose aucune donnée personnelle — seulement
-- des règles génériques). Écriture réservée à l'espace administrateur
-- (Sprint 13), via la clé service_role uniquement : aucune policy
-- insert/update/delete publique ici.
create policy "clinical_rules_read_authenticated" on public.clinical_rules
  for select using (auth.role() = 'authenticated');

-- ===== MIGRATION : 0005_exercise_library.sql =====
-- Sprint 5 : bibliothèque d'exercices (§25, §26, §27).
-- Aucun exercice n'est inséré par cette migration : le contenu doit venir du
-- concepteur médical (voir infra/db/seed/tools/README.md et le gabarit Excel).

create table if not exists public.exercise_library (
  exercise_id uuid primary key default gen_random_uuid(),
  name text not null,
  short_description text not null,
  detailed_description text,
  category text not null check (category in ('aerobique', 'renforcement', 'mobilite', 'equilibre', 'controle_moteur', 'fonctionnel')),
  difficulty text, -- échelle exacte à valider (§58 : « niveaux de difficulté »)
  starting_position text,
  execution_steps text,
  breathing_instruction text,
  duration_seconds integer,
  repetitions integer,
  sets integer,
  rest_time_seconds integer,
  frequency text,
  intensity text, -- seuil exact à valider (§58 : « intensités cibles »)
  progression text,
  regression text,
  contraindications text,
  precautions text,
  stop_criteria text,
  target_muscles text,
  equipment_required text[] not null default '{}', -- sous-ensemble de : chaise, mur, tapis, serviette, bouteille_eau, elastique, aucun (§27)
  video_url text,
  audio_url text,
  thumbnail_url text,
  last_reviewed date,
  medical_validation_status text not null default 'draft' check (medical_validation_status in ('draft', 'pending_validation', 'validated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exercise_pathologies (
  exercise_id uuid not null references public.exercise_library (exercise_id) on delete cascade,
  pathology_code text not null references public.pathologies (code),
  primary key (exercise_id, pathology_code)
);

create table if not exists public.exercise_objectives (
  exercise_id uuid not null references public.exercise_library (exercise_id) on delete cascade,
  objective_code text not null,
  primary key (exercise_id, objective_code)
);

create table if not exists public.exercise_references (
  exercise_id uuid not null references public.exercise_library (exercise_id) on delete cascade,
  reference_id uuid not null references public.scientific_references (id),
  primary key (exercise_id, reference_id)
);

create index if not exists idx_exercise_library_status on public.exercise_library (medical_validation_status);
create index if not exists idx_exercise_pathologies_pathology on public.exercise_pathologies (pathology_code);

alter table public.exercise_library enable row level security;
alter table public.exercise_pathologies enable row level security;
alter table public.exercise_objectives enable row level security;
alter table public.exercise_references enable row level security;

-- §57/§59 : un exercice non validé médicalement ne doit JAMAIS être visible
-- des utilisateurs. Seul le statut 'validated' est lisible côté client ;
-- 'draft' et 'pending_validation' ne sont accessibles que via service_role
-- (revue interne, Sprint 13).
create policy "exercise_library_read_validated_only" on public.exercise_library
  for select using (auth.role() = 'authenticated' and medical_validation_status = 'validated');

create policy "exercise_pathologies_read_validated_only" on public.exercise_pathologies
  for select using (
    exists (
      select 1 from public.exercise_library e
      where e.exercise_id = exercise_pathologies.exercise_id and e.medical_validation_status = 'validated'
    )
  );

create policy "exercise_objectives_read_validated_only" on public.exercise_objectives
  for select using (
    exists (
      select 1 from public.exercise_library e
      where e.exercise_id = exercise_objectives.exercise_id and e.medical_validation_status = 'validated'
    )
  );

create policy "exercise_references_read_validated_only" on public.exercise_references
  for select using (
    exists (
      select 1 from public.exercise_library e
      where e.exercise_id = exercise_references.exercise_id and e.medical_validation_status = 'validated'
    )
  );

-- ===== MIGRATION : 0006_programs.sql =====
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

-- ===== MIGRATION : 0007_sessions.sql =====
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

-- ===== MIGRATION : 0008_measurements.sql =====
-- Sprint 8 : suivi (§33 « Progression », §34 douleur, §35 poids, §36 tour de
-- taille, §37 tension artérielle, §38 glycémie).
--
-- La douleur (§34) n'a PAS de table dédiée : elle est déjà capturée par
-- `sessions.douleur_avant`/`douleur_apres` (Sprint 7) et par
-- `clinical_assessments.responses` (Sprint 3) — dupliquer cette donnée créerait
-- un risque de divergence. Cette migration couvre les quatre mesures encore
-- sans historique : poids, tour de taille, tension artérielle, glycémie.
--
-- Contrairement à `clinical_assessments`/`sessions` (traçabilité d'un acte
-- médical ou d'une évaluation de sécurité, immuables ou à cycle de vie
-- contrôlé), une mesure autodéclarée par le patient (son propre poids, sa
-- propre tension) est une donnée personnelle qu'il doit pouvoir corriger
-- lui-même (faute de frappe) : la policy autorise donc update/delete "own",
-- sans que cela ne pose de problème de sécurité clinique (§57, §59) puisque
-- aucune mesure ne déclenche par elle-même de décision automatique ici.
create table if not exists public.measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  measurement_type text not null check (
    measurement_type in ('poids', 'tour_de_taille', 'tension_arterielle', 'glycemie')
  ),
  -- §35 : poids.
  weight_kg numeric(5, 1),
  -- §36 : tour de taille.
  waist_circumference_cm numeric(5, 1),
  -- §37 : tension artérielle (« éventuellement » — soumis à l'accord
  -- `patient_profiles.track_cardio_params` du §13, appliqué côté route).
  systolic_mmhg integer,
  diastolic_mmhg integer,
  heart_rate_bpm integer,
  -- §38 : glycémie, valeur saisie + unité d'origine (g/L ou mmol/L) ;
  -- l'autre unité est calculée à l'affichage (conversion automatique
  -- imposée par le §38 : 1 g/L = 5,5556 mmol/L, packages/domain/measurements.ts).
  glycemia_value numeric(6, 2),
  glycemia_unit text check (glycemia_unit in ('g_l', 'mmol_l')),
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_measurements_user_type on public.measurements (user_id, measurement_type, recorded_at);

alter table public.measurements enable row level security;

create policy "measurements_select_own" on public.measurements
  for select using (auth.uid() = user_id);

create policy "measurements_insert_own" on public.measurements
  for insert with check (auth.uid() = user_id);

create policy "measurements_update_own" on public.measurements
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "measurements_delete_own" on public.measurements
  for delete using (auth.uid() = user_id);

-- ===== MIGRATION : 0009_notifications.sql =====
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

-- ===== MIGRATION : 0010_users_self_update_guard.sql =====
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

-- ===== MIGRATION : 0011_subscriptions_and_payments.sql =====
-- Sprint 14 : abonnements et paiements (§44, §47, §48).
--
-- §47 : « Ne pas coder un système de paiement fictif. » Aucune passerelle
-- externe n'est appelée par ce projet (voir packages/payment-service) : le
-- mécanisme réel du V1 est une réconciliation MANUELLE — le patient
-- transfère via Mobile Money/Orange Money/Moov Money selon les instructions
-- du plan, saisit la référence de transaction reçue, et un administrateur
-- confirme le paiement dans `/admin/abonnements` avant d'activer la
-- souscription. RLS reflète strictement ce circuit à humain dans la
-- boucle : un patient peut UNIQUEMENT créer des lignes à l'état `pending`
-- (jamais `active`/`confirmed`), jamais les faire progresser lui-même.
--
-- §46, leçon du Sprint 13 : la faille corrigée en migration 0010 (un
-- utilisateur pouvait modifier son propre `role`/`status` via la policy
-- `users_update_own`, sans restriction de colonne) est de la MÊME FAMILLE
-- qu'un patient qui s'auto-activerait un abonnement premium. Ici, la
-- prévention est plus simple qu'un trigger : aucune policy UPDATE
-- n'existe pour `authenticated` sur `subscriptions`/`payments`, et les
-- policies INSERT contraignent explicitement `status = 'pending'` — un
-- patient ne peut donc structurellement jamais écrire autre chose qu'une
-- demande en attente, quelle que soit la valeur qu'il tenterait d'envoyer.

create table if not exists public.subscription_plans (
  plan_code text primary key check (plan_code in ('free', 'premium_monthly', 'premium_yearly')),
  name_fr text not null,
  -- §48 : « Ces prix sont des paramètres configurables et non des valeurs
  -- codées en dur. » Null uniquement pour 'free' (garde-fou applicatif :
  -- isValidPlanPricing, packages/domain/src/subscriptions.ts).
  price_amount numeric(10, 2),
  price_currency text not null default 'XOF',
  billing_period text check (billing_period in ('monthly', 'yearly')),
  payment_instructions_fr text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  plan_code text not null references public.subscription_plans (plan_code),
  status text not null default 'pending' check (status in ('pending', 'active', 'expired', 'canceled')),
  started_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  provider text not null check (provider in ('orange_money', 'moov_money', 'mobile_money', 'manual')),
  amount numeric(10, 2) not null check (amount > 0),
  currency text not null default 'XOF',
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'failed', 'refunded')),
  external_reference text,
  recorded_by uuid references public.users (id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_user on public.subscriptions (user_id);
create index if not exists idx_payments_user on public.payments (user_id);
create index if not exists idx_payments_status on public.payments (status);

alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;

-- Tarifs publics une fois authentifié (nécessaire pour afficher l'écran
-- « Mon abonnement ») ; écriture réservée à service_role (admin).
create policy "subscription_plans_read_authenticated" on public.subscription_plans
  for select using (auth.role() = 'authenticated');

create policy "subscriptions_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);

-- Un patient peut demander un plan (statut `pending` forcé) ; il ne peut
-- JAMAIS l'activer lui-même : aucune policy UPDATE n'existe ici pour
-- `authenticated`, l'activation passe exclusivement par service_role
-- (voir apps/web/src/app/api/admin/subscriptions/[id]/route.ts).
create policy "subscriptions_insert_own_pending" on public.subscriptions
  for insert with check (auth.uid() = user_id and status = 'pending');

create policy "payments_select_own" on public.payments
  for select using (auth.uid() = user_id);

-- Même principe : le patient déclare un paiement (`pending`), jamais son
-- issue (`confirmed`/`failed`/`refunded`), qui reste une décision humaine
-- administrateur après vérification réelle du transfert Mobile Money.
create policy "payments_insert_own_pending" on public.payments
  for insert with check (auth.uid() = user_id and status = 'pending');

-- ===== MIGRATION : 0012_audit_logs_entity_id_text.sql =====
-- Sprint 15 : corrige un bug découvert en écrivant le script de vérification
-- RLS complet de ce sprint (infra/db/scripts/verify_rls.sh).
--
-- `audit_logs.entity_id` (migration 0001) était typé `uuid`. Or plusieurs
-- routes admin journalisent un identifiant TEXTE plutôt qu'un UUID généré
-- par la base :
--   - /api/admin/clinical-rules(/[id])  -> rule_id (ex. "LBP_RED_FLAG_...")
--   - /api/admin/pathologies/[id]        -> code pathologie (ex. "LOMBALGIE_COMMUNE")
--   - /api/admin/subscription-plans/[planCode] -> plan_code (ex. "premium_monthly")
--
-- Le client Supabase (`@supabase/supabase-js`) ne lève PAS d'exception par
-- défaut sur une erreur d'insertion — il renvoie `{ data: null, error }`.
-- Comme `recordAuditLog` (apps/web/src/lib/auditLog.ts) n'inspectait pas ce
-- champ `error`, l'incompatibilité de type provoquait un échec d'insertion
-- SILENCIEUX à chaque appel pour ces trois familles de routes : la création
-- ou la modification d'une règle clinique, la modification d'une pathologie
-- et la modification d'un plan d'abonnement — pourtant parmi les actions
-- les plus sensibles du système — n'étaient en réalité JAMAIS journalisées
-- malgré un code qui semblait le faire. C'est exactement ce que le §79
-- interdit : « Ne jamais cacher une erreur. »
--
-- Corrigé ici (colonne élargie à `text`, qui accepte aussi bien un UUID
-- qu'un code métier) ET dans apps/web/src/lib/auditLog.ts (qui journalise
-- désormais explicitement toute erreur d'insertion plutôt que de l'ignorer,
-- pour qu'une régression future de ce type ne redevienne jamais silencieuse).
alter table public.audit_logs alter column entity_id type text using entity_id::text;

-- ===== MIGRATION : 0013_clinical_rules_progression_decision.sql =====
-- Sprint 17 (suite 4) — Complète le mécanisme de progression/régression
-- (§29, §58, §70), resté un squelette depuis le Sprint 8 :
-- `evaluateProgressionDecision` (packages/rules-engine/src/progression.ts)
-- pouvait déjà repérer une règle `adjust_progression` correspondante, mais
-- ne pouvait pas savoir QUELLE décision (progresser / maintenir / réduire /
-- suspendre) elle porte, faute de colonne dédiée — le code renvoyait donc
-- toujours "maintain" en dur, quelle que soit la règle. Même principe que
-- `programs.program_id` sur `clinical_rules` (migration 0006) pour
-- `allow_program` : une colonne dédiée, ignorée pour toute autre action,
-- jamais devinée si absente (§57, §59, §78).

alter table public.clinical_rules
  add column if not exists progression_decision text
    check (progression_decision in ('progress', 'maintain', 'reduce', 'suspend'));

comment on column public.clinical_rules.progression_decision is
  'Décision portée par une règle action=adjust_progression (§29, §58, §70). '
  'Nulle pour toute autre action. Une règle adjust_progression sans cette '
  'colonne renseignée est ignorée par evaluateProgressionDecision (jamais '
  'de décision devinée, §57/§59/§78).';

-- ===== MIGRATION : 0014_exercise_session_phase.sql =====
-- Sprint 18 : structure de séance en 3 phases (§28, réf. B8, 20/08/2026).
--
-- Dr Nikiema a répondu (B8) : échauffement 10-15 % (5-10 min), partie
-- principale 70-80 % (20-40 min), retour au calme 10-15 % (5-10 min),
-- adaptable selon niveau/pathologie. Cette réponse donne la RÉPARTITION
-- globale, pas la classification exercice par exercice — savoir si "Rotation
-- du tronc assise" est un exercice d'échauffement ou de retour au calme est
-- un jugement clinique que rien ici ne doit deviner (§57, §59, §78).
--
-- `phase` est donc ajouté NULLABLE, sans aucune valeur par défaut devinée :
-- un exercice existant reste `phase IS NULL` (non classé) tant que Dr
-- Nikiema ne l'a pas explicitement classé (voir
-- RELECTURE_PHASES_EXERCICES_20260830.docx). Le code applicatif
-- (SessionFlow.tsx) doit se comporter en conséquence : afficher les 3
-- sections nommées UNIQUEMENT si tous les exercices d'une séance ont une
-- phase renseignée, sinon retomber sur l'affichage en un seul bloc déjà en
-- place (jamais de section "non classé" fusionnée silencieusement avec une
-- vraie phase).
alter table public.exercise_library
  add column if not exists phase text check (phase in ('echauffement', 'principal', 'retour_au_calme'));

comment on column public.exercise_library.phase is
  'Classification échauffement/principal/retour au calme (§28, réf. B8, 20/08/2026). NULL = non classé, jamais une valeur devinée (§57, §59).';

-- §28 étape 4 : les exercices d'une séance sont figés au démarrage
-- (session_exercises, migration 0007) — la phase doit donc être figée en
-- même temps que le nom/l'ordre, pour qu'une reclassification ultérieure
-- d'un exercice ne change jamais rétroactivement l'affichage d'une séance
-- déjà commencée (même principe que order_index, déjà figé).
alter table public.session_exercises
  add column if not exists phase text check (phase in ('echauffement', 'principal', 'retour_au_calme'));

comment on column public.session_exercises.phase is
  'Phase de l''exercice au moment du démarrage de la séance (copiée depuis exercise_library.phase) — figée, jamais recalculée rétroactivement.';

-- ===== MIGRATION : 0015_functional_capacity.sql =====
-- Sprint 18 : capacité fonctionnelle (§33, réf. B10, 20/08/2026).
--
-- Dr Nikiema a répondu (B10) : PROMIS Physical Function (format CAT) en
-- mesure principale, complété par le Patient-Specific Functional Scale
-- (PSFS) ; recueil à l'inclusion puis à intervalles réguliers.
--
-- Ces deux instruments ne rentrent pas dans le modèle `measurements`
-- (migration 0008, une ligne = une valeur scalaire) : PROMIS produit un
-- score résumé (T-score + erreur standard) mais AUCUNE administration réelle
-- de l'algorithme adaptatif (CAT) n'est implémentée ici — le faire sans la
-- banque d'items et le moteur officiels (HealthMeasures Assessment Center)
-- reviendrait à fabriquer un instrument validé de mémoire, exactement le
-- type de contenu médical non sourcé interdit par §57/§59. Cette table sait
-- donc seulement ENREGISTRER un score déjà obtenu par ailleurs, en attendant
-- une décision de Dr Nikiema sur le mode d'administration (voir
-- QUESTIONS_SEANCE_CAPACITE_FONCTIONNELLE_20260830.docx).
--
-- PSFS, à l'inverse, est un instrument dont la méthodologie (le patient nomme
-- lui-même 3 à 5 activités qui lui posent difficulté et leur attribue un
-- score 0-10 ; le score global est la moyenne arithmétique) est publique et
-- ne dépend d'aucun contenu clinique propre à Dr Nikiema : entièrement
-- implémenté ici (voir packages/domain/src/functionalCapacity.ts).
create table if not exists public.functional_capacity_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  instrument text not null check (instrument in ('psfs', 'promis_pf_cat')),
  -- PROMIS uniquement : score déjà calculé en dehors de l'application.
  promis_t_score numeric(5, 1),
  promis_standard_error numeric(5, 1),
  assessed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- PSFS uniquement : une ligne par activité nommée par le patient (3 à 5,
-- recommandation de méthodologie standard de l'instrument — voir
-- packages/domain/src/validation.ts, PAS un seuil clinique de Dr Nikiema).
create table if not exists public.psfs_activities (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.functional_capacity_assessments (id) on delete cascade,
  activity_label text not null,
  difficulty_score integer not null check (difficulty_score between 0 and 10),
  order_index integer not null default 0
);

create index if not exists idx_functional_capacity_user on public.functional_capacity_assessments (user_id, instrument, assessed_at);
create index if not exists idx_psfs_activities_assessment on public.psfs_activities (assessment_id);

alter table public.functional_capacity_assessments enable row level security;
alter table public.psfs_activities enable row level security;

-- Même principe que `measurements` (migration 0008) : une auto-évaluation
-- reste modifiable/supprimable par son propriétaire (faute de frappe), sans
-- risque de sécurité clinique puisqu'aucune décision automatique n'en dépend
-- ici (contrairement à clinical_assessments, immuable).
create policy "functional_capacity_select_own" on public.functional_capacity_assessments
  for select using (auth.uid() = user_id);

create policy "functional_capacity_insert_own" on public.functional_capacity_assessments
  for insert with check (auth.uid() = user_id);

create policy "functional_capacity_update_own" on public.functional_capacity_assessments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "functional_capacity_delete_own" on public.functional_capacity_assessments
  for delete using (auth.uid() = user_id);

create policy "psfs_activities_select_own" on public.psfs_activities
  for select using (
    exists (
      select 1 from public.functional_capacity_assessments a
      where a.id = psfs_activities.assessment_id and a.user_id = auth.uid()
    )
  );

create policy "psfs_activities_insert_own" on public.psfs_activities
  for insert with check (
    exists (
      select 1 from public.functional_capacity_assessments a
      where a.id = psfs_activities.assessment_id and a.user_id = auth.uid()
    )
  );

create policy "psfs_activities_update_own" on public.psfs_activities
  for update using (
    exists (
      select 1 from public.functional_capacity_assessments a
      where a.id = psfs_activities.assessment_id and a.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.functional_capacity_assessments a
      where a.id = psfs_activities.assessment_id and a.user_id = auth.uid()
    )
  );

create policy "psfs_activities_delete_own" on public.psfs_activities
  for delete using (
    exists (
      select 1 from public.functional_capacity_assessments a
      where a.id = psfs_activities.assessment_id and a.user_id = auth.uid()
    )
  );

-- ===== MIGRATION : 0016_session_completion_and_planning.sql =====
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

-- ===== SEED : 0001_pathologies.sql =====
-- Six modules obligatoires de la V1 (§7). Ne pas en ajouter d'autres sans
-- validation du concepteur médical.
insert into public.pathologies (code, name_fr, module_version, active) values
  ('LOMBALGIE_COMMUNE', 'Lombalgie commune / lombosciatique commune', 'V1.0', true),
  ('ARTHROSE_GENOU', 'Arthrose du genou', 'V1.0', true),
  ('ARTHROSE_HANCHE', 'Arthrose de hanche', 'V1.0', true),
  ('POLYARTHRITE_RHUMATOIDE', 'Polyarthrite rhumatoïde', 'V1.0', true),
  ('SPONDYLOARTHRITE_AXIALE', 'Spondyloarthrite axiale', 'V1.0', true),
  ('OSTEOPOROSE', 'Ostéoporose', 'V1.0', true)
on conflict (code) do nothing;

-- ===== SEED : 0002_scientific_references.sql =====
-- Références scientifiques déjà fournies par le concepteur médical au §81
-- du cahier des charges. Reprises telles quelles — aucun DOI inventé (§32).

insert into public.scientific_references
  (title, authors, journal, year, doi, organization, pathologies, recommendation_summary, last_checked)
values
  (
    'World Health Organization 2020 guidelines on physical activity and sedentary behaviour',
    'Bull FC, et al.',
    'British Journal of Sports Medicine',
    2020,
    '10.1136/bjsports-2020-102955',
    'OMS',
    '{}',
    'Référence générale : l''activité physique doit être régulière, progressive et adaptée aux capacités de la personne (§3.1).',
    current_date
  ),
  (
    'EULAR recommendations for physical activity in people with inflammatory arthritis and osteoarthritis: 2025 update',
    'Rausch Osthoff AK, et al.',
    'Annals of the Rheumatic Diseases',
    2026,
    '10.1016/j.ard.2026.03.006',
    'EULAR',
    '{ARTHROSE_GENOU,ARTHROSE_HANCHE,POLYARTHRITE_RHUMATOIDE,SPONDYLOARTHRITE_AXIALE}',
    'Référence majeure pour arthrose, polyarthrite rhumatoïde, spondyloarthrite/inflammation articulaire, activité physique, réduction de la sédentarité, interventions numériques, personnalisation et progression (§4).',
    current_date
  ),
  (
    '2019 American College of Rheumatology/Arthritis Foundation Guideline for the Management of Osteoarthritis of the Hand, Hip, and Knee',
    'Kolasinski SL, et al.',
    'Arthritis Care & Research',
    2020,
    '10.1002/acr.24131',
    'ACR',
    '{ARTHROSE_GENOU,ARTHROSE_HANCHE}',
    'Recommandations ACR/Arthritis Foundation pour l''arthrose de la main, de la hanche et du genou (§5.1).',
    current_date
  ),
  (
    '2022 American College of Rheumatology Guideline for Exercise, Rehabilitation, Diet, and Additional Integrative Interventions for Rheumatoid Arthritis',
    'England BR, et al.',
    'Arthritis Care & Research',
    2023,
    '10.1002/acr.25117',
    'ACR',
    '{POLYARTHRITE_RHUMATOIDE}',
    'L''ACR recommande fortement l''engagement régulier dans l''exercice chez les personnes atteintes de polyarthrite rhumatoïde (§5.2).',
    current_date
  ),
  (
    'ASAS-EULAR recommendations for the management of axial spondyloarthritis: 2022 update',
    'Ramiro S, et al.',
    'Annals of the Rheumatic Diseases',
    2023,
    '10.1136/ard-2022-223296',
    'ASAS-EULAR',
    '{SPONDYLOARTHRITE_AXIALE}',
    'Référence de prise en charge de la spondyloarthrite axiale (§81).',
    current_date
  ),
  (
    'WHO guideline for non-surgical management of chronic primary low back pain in adults in primary and community care settings',
    'World Health Organization',
    null,
    2023,
    null,
    'OMS',
    '{LOMBALGIE_COMMUNE}',
    'Un programme d''exercice structuré peut être proposé aux adultes présentant une lombalgie chronique primaire (§6).',
    current_date
  ),
  (
    'Interventions for the Management of Acute and Chronic Low Back Pain: Revision 2021',
    'George SZ, et al.',
    'Journal of Orthopaedic & Sports Physical Therapy',
    2021,
    '10.2519/jospt.2021.0304',
    'JOSPT',
    '{LOMBALGIE_COMMUNE}',
    'Complète la référence OMS lombalgie (§6).',
    current_date
  ),
  (
    'Low back pain',
    'Knezevic NN, et al.',
    'Lancet',
    2021,
    '10.1016/S0140-6736(21)00733-9',
    'Lancet',
    '{LOMBALGIE_COMMUNE}',
    'Revue de référence sur la lombalgie (§6).',
    current_date
  ),
  (
    'The clinician''s guide to prevention and treatment of osteoporosis',
    'LeBoff MS, et al.',
    'Osteoporosis International',
    2022,
    '10.1007/s00198-021-05900-y',
    'Société savante (ostéoporose)',
    '{OSTEOPOROSE}',
    'Guide clinique de prévention et traitement de l''ostéoporose (§81).',
    current_date
  ),
  (
    'Exercise and the prevention of major osteoporotic fractures in adults',
    'Hoffmann I, et al.',
    'Osteoporosis International',
    2023,
    '10.1007/s00198-022-06592-8',
    'Société savante (ostéoporose)',
    '{OSTEOPOROSE}',
    'Exercice et prévention des fractures ostéoporotiques majeures (§81).',
    current_date
  );

-- ===== SEED : 0003_clinical_rules.sql =====
-- Sprint 4 : les deux seules règles de sécurité explicitement fournies par
-- le cahier des charges, désormais stockées comme données versionnées
-- (§30, §31, §43) plutôt que codées en dur. Toute autre règle nécessite une
-- validation du concepteur médical avant d'être ajoutée ici (§57, §59) —
-- voir docs/MEDICAL_VALIDATION_NEEDED.md.

-- §16 : 11 red flags lombalgie / lombosciatique. Un seul déclenché suffit à
-- faire basculer le dépistage sur "rouge" (aucun programme automatique).
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, active, version) values
  ('LBP_RED_FLAG_TRAUMATISME', 'LOMBALGIE_COMMUNE', '{"field": "traumatisme_important", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Cette application ne peut pas déterminer la cause de vos symptômes. Une évaluation médicale est nécessaire avant de commencer un programme d''exercices.', true, 'V1.0'),
  ('LBP_RED_FLAG_DOULEUR_INHABITUELLE', 'LOMBALGIE_COMMUNE', '{"field": "douleur_inhabituelle_intense", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Cette application ne peut pas déterminer la cause de vos symptômes. Une évaluation médicale est nécessaire avant de commencer un programme d''exercices.', true, 'V1.0'),
  ('LBP_RED_FLAG_FIEVRE', 'LOMBALGIE_COMMUNE', '{"field": "fievre_contexte_infectieux", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Cette application ne peut pas déterminer la cause de vos symptômes. Une évaluation médicale est nécessaire avant de commencer un programme d''exercices.', true, 'V1.0'),
  ('LBP_RED_FLAG_CANCER', 'LOMBALGIE_COMMUNE', '{"field": "antecedent_cancer_pertinent", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Cette application ne peut pas déterminer la cause de vos symptômes. Une évaluation médicale est nécessaire avant de commencer un programme d''exercices.', true, 'V1.0'),
  ('LBP_RED_FLAG_PERTE_POIDS', 'LOMBALGIE_COMMUNE', '{"field": "perte_poids_inexpliquee", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Cette application ne peut pas déterminer la cause de vos symptômes. Une évaluation médicale est nécessaire avant de commencer un programme d''exercices.', true, 'V1.0'),
  ('LBP_RED_FLAG_DEFICIT_MOTEUR', 'LOMBALGIE_COMMUNE', '{"field": "deficit_moteur_important", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Cette application ne peut pas déterminer la cause de vos symptômes. Une évaluation médicale est nécessaire avant de commencer un programme d''exercices.', true, 'V1.0'),
  ('LBP_RED_FLAG_DEFICIT_NEURO', 'LOMBALGIE_COMMUNE', '{"field": "deficit_neurologique_progressif", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Cette application ne peut pas déterminer la cause de vos symptômes. Une évaluation médicale est nécessaire avant de commencer un programme d''exercices.', true, 'V1.0'),
  ('LBP_RED_FLAG_SPHINCTER', 'LOMBALGIE_COMMUNE', '{"field": "troubles_sphincteriens", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Cette application ne peut pas déterminer la cause de vos symptômes. Une évaluation médicale est nécessaire avant de commencer un programme d''exercices.', true, 'V1.0'),
  ('LBP_RED_FLAG_ANESTHESIE_SELLE', 'LOMBALGIE_COMMUNE', '{"field": "anesthesie_en_selle", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Cette application ne peut pas déterminer la cause de vos symptômes. Une évaluation médicale est nécessaire avant de commencer un programme d''exercices.', true, 'V1.0'),
  ('LBP_RED_FLAG_QUEUE_DE_CHEVAL', 'LOMBALGIE_COMMUNE', '{"field": "suspicion_queue_de_cheval", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Cette application ne peut pas déterminer la cause de vos symptômes. Une évaluation médicale est nécessaire avant de commencer un programme d''exercices.', true, 'V1.0'),
  ('LBP_RED_FLAG_AUTRE', 'LOMBALGIE_COMMUNE', '{"field": "autre_situation_preoccupante", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Cette application ne peut pas déterminer la cause de vos symptômes. Une évaluation médicale est nécessaire avant de commencer un programme d''exercices.', true, 'V1.0')
on conflict (rule_id) do nothing;

-- §21 + Cas 4 du §56 : fracture récente -> pas de programme automatisé.
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, active, version) values
  ('OSTEO_RECENT_FRACTURE', 'OSTEOPOROSE', '{"field": "fracture_recente", "operator": "equals", "value": true}', 'critical', 'stop_program', 'Une fracture récente a été signalée. Pour votre sécurité, aucun programme n''est généré automatiquement : une validation par un professionnel de santé est nécessaire avant de commencer un programme d''exercices.', true, 'V1.0')
on conflict (rule_id) do nothing;

-- Aucune autre règle n'est insérée ici : les seuils vert/orange (lombalgie
-- hors red flag) et l'ensemble des critères pour arthrose genou/hanche, PR
-- et spondyloarthrite axiale restent à valider (docs/MEDICAL_VALIDATION_NEEDED.md).

-- ===== SEED : 0004_proposed_red_flags_pending_validation.sql =====
-- Sprint 6bis — PROPOSITIONS de red flags pour arthrose du genou, arthrose
-- de hanche, polyarthrite rhumatoïde et spondyloarthrite axiale, quatre
-- modules qui n'avaient jusqu'ici AUCUNE règle de dépistage (toujours
-- `pending_validation`, jamais vert/orange/rouge, voir §57/§59/§78).
--
-- Contrairement aux règles de 0003_clinical_rules.sql (dictées littéralement
-- par le cahier des charges, §16 et §21), CELLES-CI sont proposées par
-- l'équipe technique à partir de littérature scientifique publiée et
-- vérifiée (voir docs/DECISIONS.md, Sprint 6bis). Elles ne remplacent PAS
-- le jugement clinique du concepteur médical : elles sont insérées
-- `active = false` et `validated_by = null`, donc STRICTEMENT INERTES tant
-- que Dr Nikiema ne les relit pas et ne les active pas explicitement
-- (mettre `active = true`, `validated_by`, `validated_date`).
--
-- Elles ne couvrent QUE des signaux d'alerte (rouge / orientation médicale),
-- pas les seuils gradués vert/orange (douleur, gonflement modéré...) : ceux-
-- là restent un jugement clinique propre à chaque patient, à renseigner par
-- le concepteur médical via infra/db/seed/tools/gabarit_seuils_cliniques.xlsx.

-- Références scientifiques à l'appui (DOI vérifiés, §32).
insert into public.scientific_references
  (title, authors, journal, year, doi, organization, pathologies, recommendation_summary, last_checked)
values
  (
    'BSR & BHPR, BOA, RCGP and BSAC guidelines for management of the hot swollen joint in adults',
    'Coakley G, Mathews C, Field M, Jones A, Kingsley G, Walker D, Phillips M, Bradish C, McLachlan A, Mohammed R, Weston V',
    'Rheumatology',
    2006,
    '10.1093/rheumatology/kel163a',
    'BSR/BHPR/BOA/RCGP/BSAC',
    '{ARTHROSE_GENOU,ARTHROSE_HANCHE,POLYARTHRITE_RHUMATOIDE}',
    'Toute articulation chaude, gonflée et douloureuse d''apparition récente doit être considérée comme une arthrite septique jusqu''à preuve du contraire ; admission/orientation en urgence recommandée, même en l''absence de fièvre si la suspicion clinique est forte.',
    current_date
  ),
  (
    'Developing a Construct to Evaluate Flares in Rheumatoid Arthritis: A Conceptual Report of the OMERACT RA Flare Definition Working Group',
    'Alten R, Pohl C, Choy EH, et al.',
    'The Journal of Rheumatology',
    2011,
    '10.3899/jrheum.110400',
    'OMERACT',
    '{POLYARTHRITE_RHUMATOIDE}',
    'Définit conceptuellement une poussée de PR comme une aggravation des signes/symptômes d''une intensité et d''une durée suffisantes pour entraîner un changement de traitement ; construct multi-domaines (douleur, raideur, fatigue, impact fonctionnel), pas un seuil numérique unique. Utile pour guider la FORMULATION de la question patient « poussée récente » (déjà identifiée comme en attente dans docs/MEDICAL_VALIDATION_NEEDED.md), pas pour une règle automatique.',
    current_date
  ),
  (
    'Injuries to the Rigid Spine: What the Spine Surgeon Wants to Know',
    'Shah NG, Keraliya A, Nunez DB, Schoenfeld A, Harris MB, Bono CM, Khurana B',
    'RadioGraphics',
    2019,
    '10.1148/rg.2019180125',
    'RSNA',
    '{SPONDYLOARTHRITE_AXIALE}',
    'Chez les personnes à rachis rigide/ankylosé (dont la spondyloarthrite axiale évoluée), la stabilité biomécanique du rachis est altérée : un traumatisme même mineur peut provoquer une fracture instable, le plus souvent par hyperextension. Ne fournit pas de seuil de douleur, seulement un principe d''alerte lié au traumatisme lui-même.',
    current_date
  )
on conflict do nothing;

-- PROPOSITION 1 — Arthrose du genou : suspicion d'arthrite septique
-- (articulation chaude + gonflée, ou fièvre associée). Cf. Coakley et al. 2006.
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, reference_id, active, version) values
  (
    'PROPOSED_OA_GENOU_HOT_JOINT',
    'ARTHROSE_GENOU',
    '{"any": [{"field": "fievre", "operator": "equals", "value": true}, {"all": [{"field": "gonflement", "operator": "equals", "value": true}, {"field": "chaleur_locale", "operator": "equals", "value": true}]}]}',
    'critical',
    'medical_referral',
    'PROPOSITION (non activée) : une articulation chaude et gonflée, ou une fièvre associée, doit être évaluée en urgence par un professionnel de santé avant de poursuivre — message final à valider par le concepteur médical.',
    (select id from public.scientific_references where doi = '10.1093/rheumatology/kel163a'),
    false,
    'V0.1-proposition'
  )
on conflict (rule_id) do nothing;

-- PROPOSITION 2 — Arthrose de hanche : même logique.
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, reference_id, active, version) values
  (
    'PROPOSED_OA_HANCHE_HOT_JOINT',
    'ARTHROSE_HANCHE',
    '{"any": [{"field": "fievre", "operator": "equals", "value": true}, {"all": [{"field": "gonflement", "operator": "equals", "value": true}, {"field": "chaleur_locale", "operator": "equals", "value": true}]}]}',
    'critical',
    'medical_referral',
    'PROPOSITION (non activée) : une articulation chaude et gonflée, ou une fièvre associée, doit être évaluée en urgence par un professionnel de santé avant de poursuivre — message final à valider par le concepteur médical. Le risque de sepsis de hanche justifie une orientation orthopédique rapide (Coakley et al. 2006).',
    (select id from public.scientific_references where doi = '10.1093/rheumatology/kel163a'),
    false,
    'V0.1-proposition'
  )
on conflict (rule_id) do nothing;

-- PROPOSITION 3 — Polyarthrite rhumatoïde : même logique, pertinence accrue
-- chez les patients sous traitement immunosuppresseur/biothérapie (risque
-- infectieux plus élevé, contexte général bien documenté en rhumatologie).
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, reference_id, active, version) values
  (
    'PROPOSED_PR_HOT_JOINT',
    'POLYARTHRITE_RHUMATOIDE',
    '{"any": [{"field": "fievre", "operator": "equals", "value": true}, {"all": [{"field": "gonflement", "operator": "equals", "value": true}, {"field": "chaleur_locale", "operator": "equals", "value": true}]}]}',
    'critical',
    'medical_referral',
    'PROPOSITION (non activée) : une articulation chaude et gonflée, ou une fièvre associée, doit être évaluée en urgence par un professionnel de santé avant de poursuivre — message final à valider par le concepteur médical. Vigilance particulière si traitement de fond immunosuppresseur/biothérapie.',
    (select id from public.scientific_references where doi = '10.1093/rheumatology/kel163a'),
    false,
    'V0.1-proposition'
  )
on conflict (rule_id) do nothing;

-- PROPOSITION 4 — Spondyloarthrite axiale : traumatisme récent (même
-- mineur) chez une personne à rachis potentiellement rigide/ankylosé.
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, reference_id, active, version) values
  (
    'PROPOSED_AXSPA_TRAUMA_FRACTURE_RISK',
    'SPONDYLOARTHRITE_AXIALE',
    '{"field": "traumatisme_recent", "operator": "equals", "value": true}',
    'critical',
    'medical_referral',
    'PROPOSITION (non activée) : chez une personne atteinte de spondyloarthrite axiale, un traumatisme même mineur peut provoquer une fracture instable du rachis en cas d''ankylose. Une évaluation médicale (imagerie) est recommandée avant de reprendre tout exercice — message final à valider par le concepteur médical.',
    (select id from public.scientific_references where doi = '10.1148/rg.2019180125'),
    false,
    'V0.1-proposition'
  )
on conflict (rule_id) do nothing;

-- Rappel : `active = false` sur les 4 lignes ci-dessus signifie qu'elles
-- n'ont AUCUN effet sur le comportement de l'application tant qu'elles ne
-- sont pas explicitement activées (voir packages/rules-engine/src/engine.ts,
-- evaluateRules filtre sur `active`). C'est le même mécanisme de sécurité
-- que celui déjà utilisé par le test de garde-fou
-- apps/web/tests/security/screening-no-invented-green.test.ts.

-- ===== SEED : 0005_subscription_plans.sql =====
-- Sprint 14 (§48) : modèle économique initial. Ces montants sont les prix
-- « envisagés initialement » par le cahier des charges — des PARAMÈTRES,
-- pas des valeurs codées en dur (§48) : modifiables à tout moment depuis
-- `/admin/abonnements`, sans déploiement de code.
--
-- `payment_instructions_fr` est laissé NULL volontairement : ce projet ne
-- dispose d'aucun numéro Mobile Money/Orange Money/Moov Money réel à
-- afficher aux patients (§57/§59, discipline étendue ici aux données
-- produit : ne jamais inventer une coordonnée de paiement qui semblerait
-- officielle). Le concepteur/porteur du projet doit renseigner ce champ
-- avant d'ouvrir les inscriptions premium — voir docs/MEDICAL_VALIDATION_NEEDED.md.
insert into public.subscription_plans (plan_code, name_fr, price_amount, price_currency, billing_period, payment_instructions_fr, active) values
  ('free', 'Gratuit', null, 'XOF', null, null, true),
  ('premium_monthly', 'Premium (mensuel)', 2000, 'XOF', 'monthly', null, true),
  ('premium_yearly', 'Premium (annuel)', 10000, 'XOF', 'yearly', null, true)
on conflict (plan_code) do nothing;

-- ===== SEED : 0006_validation_medicale_dr_nikiema_20260820.sql =====
-- Intégration des réponses de Dr Wendtongo Brice Florent NIKIEMA au
-- questionnaire de validation médicale du 20/08/2026 (APA_Questionnaire_
-- Validation_Medicale_20260820.docx, réponses complétées le 20/08/2026).
--
-- Portée de ce fichier : UNIQUEMENT les décisions sans aucune ambiguïté
-- d'interprétation — approbation explicite, telle quelle, d'une règle déjà
-- rédigée et sourcée (§57, §59, §78 : on n'active jamais un mécanisme de
-- sécurité sur une réponse qui laisse place à interprétation technique).
-- Les réponses plus riches (seuils gradués, formules, structure de séance,
-- etc.) sont documentées dans docs/MEDICAL_VALIDATION_NEEDED.md et
-- docs/DECISIONS.md, mais nécessitent un travail d'implémentation
-- (nouveaux champs, nouvelles règles, UI) avant de pouvoir être traduites
-- en `clinical_rules` — voir la synthèse livrée au concepteur médical.

-- Référence A1 du questionnaire : « Oui j'approuve cette règle de sécurité
-- telle quelle » pour arthrose du genou, arthrose de la hanche et
-- polyarthrite rhumatoïde (suspicion d'arthrite septique, Coakley et al.
-- 2006). Les 3 règles proposées dans 0004_proposed_red_flags_pending_
-- validation.sql sont donc activées sans aucune modification de condition
-- ni de message.
update public.clinical_rules
set active = true,
    validated_by = 'Dr Wendtongo Brice Florent NIKIEMA',
    validated_date = '2026-08-20'
where rule_id in ('PROPOSED_OA_GENOU_HOT_JOINT', 'PROPOSED_OA_HANCHE_HOT_JOINT', 'PROPOSED_PR_HOT_JOINT')
  and validated_by is null;

-- Référence A2 du questionnaire : « Oui j'approuve cette règle de sécurité
-- telle quelle » pour la spondyloarthrite axiale (traumatisme récent même
-- mineur → risque de fracture rachidienne, Shah et al. 2019).
update public.clinical_rules
set active = true,
    validated_by = 'Dr Wendtongo Brice Florent NIKIEMA',
    validated_date = '2026-08-20'
where rule_id = 'PROPOSED_AXSPA_TRAUMA_FRACTURE_RISK'
  and validated_by is null;

-- Référence G3 du questionnaire : reformulation validée du message affiché
-- en cas de fracture récente signalée (ostéoporose). La règle OSTEO_RECENT_
-- FRACTURE (0003_clinical_rules.sql) était déjà `active = true` depuis le
-- Sprint 3 (§21 du cahier des charges impose directement cette règle) mais
-- son message patient-facing restait un texte provisoire non validé — il
-- est remplacé ici par la formulation de Dr Nikiema (voir
-- packages/domain/src/screening.ts, OSTEOPOROSE_RECENT_FRACTURE_MESSAGE,
-- qui doit rester synchronisé avec cette valeur).
update public.clinical_rules
set message = 'Vous avez indiqué avoir eu une fracture récemment. Pour votre sécurité, nous ne pouvons pas vous proposer automatiquement un programme d''exercices. Avant de commencer ou de reprendre une activité physique, demandez l''avis du professionnel de santé qui vous suit. Le programme pourra être proposé progressivement après validation et selon les consignes médicales reçues. Ne modifiez pas votre traitement ou vos consignes de rééducation sur la base de cette application.',
    validated_by = 'Dr Wendtongo Brice Florent NIKIEMA',
    validated_date = '2026-08-20'
where rule_id = 'OSTEO_RECENT_FRACTURE';

-- Rappel : à partir de maintenant, ces 4 règles produisent un statut
-- « rouge » réel (orientation médicale) dès que les champs fievre /
-- gonflement+chaleur_locale (genou, hanche, PR) ou traumatisme_recent
-- (spondyloarthrite axiale) sont renseignés positivement au dépistage —
-- alors qu'auparavant ces 4 pathologies ne produisaient jamais que
-- `pending_validation` (aucun red flag actif, voir §58, Sprint 6bis).
-- Vérifier `infra/db/scripts/verify_rls.sh` et la suite de tests
-- (`packages/rules-engine`) après application de ce seed en environnement
-- de développement, puis en production.

-- ===== SEED : 0007_proposed_thresholds_douleur_genou.sql =====
-- Sprint 6bis (mécanisme) / intégration du 20/08/2026 (contenu) —
-- généré automatiquement par
-- `python3 infra/db/seed/tools/convert_thresholds_to_rules.py \
--    infra/db/seed/tools/gabarit_seuils_cliniques.xlsx`
-- à partir de la réponse D3 du questionnaire de validation médicale
-- (douleur du genou, seul item du D3 exprimable dans le type `scale_0_10`
-- du gabarit — voir docs/MEDICAL_VALIDATION_NEEDED.md pour les items
-- (gonflement/instabilité genou, limitation de marche/mobilité hanche)
-- que le gabarit ne peut pas encore représenter fidèlement).
--
-- TOUTES les règles ci-dessous sont insérées `active = false`. Le message
-- patient-facing n'a volontairement PAS été inventé (Dr Nikiema a fourni
-- une description clinique, pas une formulation destinée au patient) —
-- à rédiger avec le concepteur médical (voir B7/C1) avant toute activation.
-- Relire chaque condition, puis activer explicitement (active = true,
-- validated_by, validated_date) UNIQUEMENT celles que vous validez.

-- Source/justification (concepteur médical) : Réponse Dr Nikiema (D3, 20/08/2026) : vert 0-3/10 (stable/amélioration), orange 4-5/10 (adaptation, réduction charge/volume/amplitude, aucune progression), au-delà de 5/10 ou douleur inhabituelle/brutale/aggravée -> ne pas classer en simple orange, appliquer les règles de suspension/réévaluation. Messages patient-facing définitifs (colonnes G/H) non fournis -- à rédiger avec le concepteur médical (voir B7/C1).
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, active, version) values (
  'PROPOSED_ARTHROSE_GENOU_DOULEUR_ORANGE',
  'ARTHROSE_GENOU',
  '{"field": "douleur", "operator": "gte", "value": 4}',
  'warning',
  'require_precaution',
  '(message non renseigné dans le gabarit — à compléter)',
  false,
  'V0.1-proposition'
)
on conflict (rule_id) do nothing;

-- Source/justification (concepteur médical) : Réponse Dr Nikiema (D3, 20/08/2026) : vert 0-3/10 (stable/amélioration), orange 4-5/10 (adaptation, réduction charge/volume/amplitude, aucune progression), au-delà de 5/10 ou douleur inhabituelle/brutale/aggravée -> ne pas classer en simple orange, appliquer les règles de suspension/réévaluation. Messages patient-facing définitifs (colonnes G/H) non fournis -- à rédiger avec le concepteur médical (voir B7/C1).
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, active, version) values (
  'PROPOSED_ARTHROSE_GENOU_DOULEUR_ROUGE',
  'ARTHROSE_GENOU',
  '{"field": "douleur", "operator": "gte", "value": 6}',
  'critical',
  'medical_referral',
  '(message non renseigné dans le gabarit — à compléter)',
  false,
  'V0.1-proposition'
)
on conflict (rule_id) do nothing;


-- ===== SEED : 0008_validation_medicale_dr_nikiema_20260820_partie2.sql =====
-- Intégration (partie 2) des réponses de Dr Wendtongo Brice Florent NIKIEMA
-- au questionnaire de validation médicale du 20/08/2026, complétées en
-- échange direct le même jour (seuil de douleur harmonisé, questions de
-- dépistage supplémentaires genou/hanche/PR/spondyloarthrite/ostéoporose).
-- Contrairement à 0006_validation_medicale_dr_nikiema_20260820.sql (qui ne
-- fait qu'activer des propositions déjà rédigées au Sprint 6bis), CE
-- FICHIER contient de nouvelles règles réelles, `active = true` dès leur
-- insertion, `validated_by`/`validated_date` renseignés dès la création
-- (et non `active = false` en attente d'un second geste d'activation) :
-- ces règles sont rédigées EXACTEMENT à partir de ses réponses (le 20/08 en
-- questionnaire écrit, puis en échange direct le même jour pour combler les
-- points restés ouverts — seuil harmonisé, nouvelles questions), pas
-- proposées par l'équipe technique à partir de littérature tierce.
--
-- CHANGEMENT D'ARCHITECTURE ASSOCIÉ (voir packages/rules-engine/src/
-- screening/index.ts) : c'est la première fois qu'une règle
-- `require_precaution` réellement active existe dans ce projet. Le
-- dépistage (`evaluateSafetyScreeningFromRules`) peut désormais produire un
-- vrai statut `orange`, et un vrai statut `vert` quand aucune règle rouge
-- ni orange ne se déclenche POUR UNE PATHOLOGIE QUI A AU MOINS UNE RÈGLE
-- `require_precaution` active (jamais un `vert` inventé en l'absence de
-- toute règle graduée validée — voir le garde-fou
-- apps/web/tests/security/screening-no-invented-green.test.ts).
--
-- Portée : ce fichier ajoute des questions de dépistage à
-- packages/domain/src/screening.ts (SCREENING_ITEMS_BY_PATHOLOGY) — voir ce
-- fichier pour le détail des nouveaux items (`gonflement_evolution`,
-- `restrictions_pro_recentes`, `chutes_12_mois`, etc.) et le renommage du
-- libellé de `poussee_recente` (PR).

-- ============================================================
-- 1. Seuil de douleur harmonisé (réf. B1, décision du 20/08/2026) :
--    vert 0-3/10, orange 4-6/10, rouge > 6/10 — retenu comme seuil UNIQUE
--    pour toutes les pathologies (Dr Nikiema a explicitement choisi
--    d'harmoniser plutôt que de garder les valeurs spécifiques initialement
--    données en C3/lombalgie et D3/genou, qui différaient légèrement).
--    Douleur du genou (0007_proposed_thresholds_douleur_genou.sql, encore
--    `active = false`) est donc SUPERSEDED par PAIN_ORANGE/ROUGE_
--    ARTHROSE_GENOU ci-dessous et reste volontairement inactive.
-- ============================================================
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, active, version, validated_by, validated_date) values
  ('PAIN_ORANGE_ARTHROSE_GENOU', 'ARTHROSE_GENOU', '{"field": "douleur", "operator": "gte", "value": 4}', 'warning', 'require_precaution', 'Votre douleur est modérée aujourd''hui : adaptez l''intensité de votre séance (réduisez la charge, le volume ou l''amplitude) et évitez toute progression. Si la douleur augmente ou ne s''améliore pas d''ici 24 heures, faites une pause et parlez-en à un professionnel de santé.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('PAIN_ROUGE_ARTHROSE_GENOU', 'ARTHROSE_GENOU', '{"field": "douleur", "operator": "gte", "value": 7}', 'critical', 'medical_referral', 'Votre douleur est élevée aujourd''hui. Par sécurité, aucun programme n''est proposé automatiquement : nous vous recommandons de consulter un professionnel de santé avant de reprendre une activité physique.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),

  ('PAIN_ORANGE_ARTHROSE_HANCHE', 'ARTHROSE_HANCHE', '{"field": "douleur", "operator": "gte", "value": 4}', 'warning', 'require_precaution', 'Votre douleur est modérée aujourd''hui : adaptez l''intensité de votre séance (réduisez la charge, le volume ou l''amplitude) et évitez toute progression. Si la douleur augmente ou ne s''améliore pas d''ici 24 heures, faites une pause et parlez-en à un professionnel de santé.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('PAIN_ROUGE_ARTHROSE_HANCHE', 'ARTHROSE_HANCHE', '{"field": "douleur", "operator": "gte", "value": 7}', 'critical', 'medical_referral', 'Votre douleur est élevée aujourd''hui. Par sécurité, aucun programme n''est proposé automatiquement : nous vous recommandons de consulter un professionnel de santé avant de reprendre une activité physique.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),

  ('PAIN_ORANGE_POLYARTHRITE_RHUMATOIDE', 'POLYARTHRITE_RHUMATOIDE', '{"field": "douleur", "operator": "gte", "value": 4}', 'warning', 'require_precaution', 'Votre douleur est modérée aujourd''hui : adaptez l''intensité de votre séance (réduisez la charge, le volume ou l''amplitude) et évitez toute progression. Si la douleur augmente ou ne s''améliore pas d''ici 24 heures, faites une pause et parlez-en à un professionnel de santé.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('PAIN_ROUGE_POLYARTHRITE_RHUMATOIDE', 'POLYARTHRITE_RHUMATOIDE', '{"field": "douleur", "operator": "gte", "value": 7}', 'critical', 'medical_referral', 'Votre douleur est élevée aujourd''hui. Par sécurité, aucun programme n''est proposé automatiquement : nous vous recommandons de consulter un professionnel de santé avant de reprendre une activité physique.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),

  ('PAIN_ORANGE_SPONDYLOARTHRITE_AXIALE', 'SPONDYLOARTHRITE_AXIALE', '{"field": "douleur_rachidienne", "operator": "gte", "value": 4}', 'warning', 'require_precaution', 'Votre douleur est modérée aujourd''hui : adaptez l''intensité de votre séance (réduisez la charge, le volume ou l''amplitude) et évitez toute progression. Si la douleur augmente ou ne s''améliore pas d''ici 24 heures, faites une pause et parlez-en à un professionnel de santé.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('PAIN_ROUGE_SPONDYLOARTHRITE_AXIALE', 'SPONDYLOARTHRITE_AXIALE', '{"field": "douleur_rachidienne", "operator": "gte", "value": 7}', 'critical', 'medical_referral', 'Votre douleur est élevée aujourd''hui. Par sécurité, aucun programme n''est proposé automatiquement : nous vous recommandons de consulter un professionnel de santé avant de reprendre une activité physique.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),

  ('PAIN_ORANGE_LOMBALGIE_COMMUNE', 'LOMBALGIE_COMMUNE', '{"field": "douleur", "operator": "gte", "value": 4}', 'warning', 'require_precaution', 'Votre douleur est modérée aujourd''hui : adaptez l''intensité de votre séance (réduisez la charge, le volume ou l''amplitude) et évitez toute progression. Si la douleur augmente ou ne s''améliore pas d''ici 24 heures, faites une pause et parlez-en à un professionnel de santé.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('PAIN_ROUGE_LOMBALGIE_COMMUNE', 'LOMBALGIE_COMMUNE', '{"field": "douleur", "operator": "gte", "value": 7}', 'critical', 'medical_referral', 'Votre douleur est élevée aujourd''hui. Par sécurité, aucun programme n''est proposé automatiquement : nous vous recommandons de consulter un professionnel de santé avant de reprendre une activité physique.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),

  ('PAIN_ORANGE_OSTEOPOROSE', 'OSTEOPOROSE', '{"field": "douleur", "operator": "gte", "value": 4}', 'warning', 'require_precaution', 'Votre douleur est modérée aujourd''hui : adaptez l''intensité de votre séance (réduisez la charge, le volume ou l''amplitude) et évitez toute progression. Si la douleur augmente ou ne s''améliore pas d''ici 24 heures, faites une pause et parlez-en à un professionnel de santé.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('PAIN_ROUGE_OSTEOPOROSE', 'OSTEOPOROSE', '{"field": "douleur", "operator": "gte", "value": 7}', 'critical', 'medical_referral', 'Votre douleur est élevée aujourd''hui. Par sécurité, aucun programme n''est proposé automatiquement : nous vous recommandons de consulter un professionnel de santé avant de reprendre une activité physique.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20')
on conflict (rule_id) do nothing;

-- ============================================================
-- 2. PR — « poussée récente » (réf. A3, décision du 20/08/2026) : une
--    réponse « Oui » à la nouvelle question de dépistage oriente vers une
--    évaluation médicale (choix explicite de Dr Nikiema : rouge, pas
--    orange).
-- ============================================================
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, active, version, validated_by, validated_date) values
  ('PR_POUSSEE_RECENTE_ROUGE', 'POLYARTHRITE_RHUMATOIDE', '{"field": "poussee_recente", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Vous avez indiqué que votre polyarthrite rhumatoïde s''est aggravée récemment au point de penser que votre traitement devrait être modifié ou renforcé. Par sécurité, nous vous recommandons de consulter votre professionnel de santé avant de poursuivre un programme d''exercices : votre traitement de fond doit d''abord être réévalué par lui, jamais par cette application.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20')
on conflict (rule_id) do nothing;

-- ============================================================
-- 3. Genou / hanche — chirurgie, traumatisme récent et restrictions
--    professionnelles (réf. D1, D2, décisions du 20/08/2026) : aucun délai
--    fixe universel (rejeté explicitement par Dr Nikiema) ; la restriction
--    déclarée par un professionnel de santé prime sur le délai écoulé.
--    Restrictions actives -> rouge (bloqué). Événement récent SANS
--    restriction actuellement déclarée -> orange (prudence).
-- ============================================================
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, active, version, validated_by, validated_date) values
  (
    'GENOU_CHIRURGIE_TRAUMA_RESTRICTIONS_ROUGE',
    'ARTHROSE_GENOU',
    '{"all": [{"any": [{"field": "chirurgie_recente", "operator": "equals", "value": true}, {"field": "traumatisme_recent", "operator": "equals", "value": true}]}, {"field": "restrictions_pro_recentes", "operator": "equals", "value": true}]}',
    'critical',
    'medical_referral',
    'Vous avez signalé une chirurgie ou un traumatisme récent du genou, avec des restrictions actuellement données par un professionnel de santé. Par sécurité, aucun programme standard n''est proposé : suivez les consignes de votre professionnel de santé, qui priment toujours sur toute recommandation de cette application.',
    true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'
  ),
  (
    'GENOU_CHIRURGIE_TRAUMA_RECENT_ORANGE',
    'ARTHROSE_GENOU',
    '{"all": [{"any": [{"field": "chirurgie_recente", "operator": "equals", "value": true}, {"field": "traumatisme_recent", "operator": "equals", "value": true}]}, {"field": "restrictions_pro_recentes", "operator": "equals", "value": false}]}',
    'warning',
    'require_precaution',
    'Vous avez signalé une chirurgie ou un traumatisme récent du genou, sans restriction actuellement en cours de la part d''un professionnel de santé. Par prudence, un programme adapté vous est proposé, sans progression pour l''instant.',
    true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'
  ),
  (
    'HANCHE_CHIRURGIE_TRAUMA_RESTRICTIONS_ROUGE',
    'ARTHROSE_HANCHE',
    '{"all": [{"any": [{"field": "chirurgie_recente", "operator": "equals", "value": true}, {"field": "traumatisme", "operator": "equals", "value": true}]}, {"field": "restrictions_pro_recentes", "operator": "equals", "value": true}]}',
    'critical',
    'medical_referral',
    'Vous avez signalé une chirurgie ou un traumatisme récent de la hanche (y compris une prothèse), avec des restrictions actuellement données par un professionnel de santé. Par sécurité, aucun programme standard n''est proposé : suivez les consignes de l''équipe qui vous a opéré ou suivi, qui priment toujours sur toute recommandation de cette application.',
    true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'
  ),
  (
    'HANCHE_CHIRURGIE_TRAUMA_RECENT_ORANGE',
    'ARTHROSE_HANCHE',
    '{"all": [{"any": [{"field": "chirurgie_recente", "operator": "equals", "value": true}, {"field": "traumatisme", "operator": "equals", "value": true}]}, {"field": "restrictions_pro_recentes", "operator": "equals", "value": false}]}',
    'warning',
    'require_precaution',
    'Vous avez signalé une chirurgie ou un traumatisme récent de la hanche, sans restriction actuellement en cours de la part d''un professionnel de santé. Par prudence, un programme adapté vous est proposé, sans progression pour l''instant.',
    true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'
  )
on conflict (rule_id) do nothing;

-- ============================================================
-- 4. Genou / hanche — seuils gradués D3 (décision du 20/08/2026) :
--    gonflement et instabilité du genou, limitation de marche et de
--    mobilité de la hanche, désormais des items `select` à 3 niveaux
--    (0 = vert, 1 = orange, 2 = rouge) dans packages/domain/src/screening.ts.
-- ============================================================
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, active, version, validated_by, validated_date) values
  ('GENOU_GONFLEMENT_ORANGE', 'ARTHROSE_GENOU', '{"field": "gonflement_evolution", "operator": "gte", "value": 1}', 'warning', 'require_precaution', 'Votre gonflement est nouveau ou a augmenté par rapport à d''habitude. Par prudence, réduisez la charge et évitez les exercices à fort impact ; pas de progression pour l''instant.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('GENOU_GONFLEMENT_ROUGE', 'ARTHROSE_GENOU', '{"field": "gonflement_evolution", "operator": "gte", "value": 2}', 'critical', 'medical_referral', 'Votre gonflement est important, s''aggrave rapidement, ou s''accompagne d''une douleur importante ou d''une incapacité fonctionnelle. Par sécurité, nous vous recommandons de consulter un professionnel de santé avant de poursuivre une activité physique.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('GENOU_INSTABILITE_ORANGE', 'ARTHROSE_GENOU', '{"field": "instabilite", "operator": "gte", "value": 1}', 'warning', 'require_precaution', 'Vous ressentez une instabilité occasionnelle du genou. Par prudence, privilégiez des exercices contrôlés, sans pivot ni changement brusque de direction ; pas de progression pour l''instant.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('GENOU_INSTABILITE_ROUGE', 'ARTHROSE_GENOU', '{"field": "instabilite", "operator": "gte", "value": 2}', 'critical', 'medical_referral', 'Votre instabilité du genou est répétée, aggravée, associée à des chutes ou à un blocage. Par sécurité, nous vous recommandons de consulter un professionnel de santé avant de poursuivre une activité physique.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),

  ('HANCHE_LIMITATION_MARCHE_ORANGE', 'ARTHROSE_HANCHE', '{"field": "limitation_marche", "operator": "gte", "value": 1}', 'warning', 'require_precaution', 'Votre distance ou votre temps de marche habituel a récemment diminué. Par prudence, un programme adapté vous est proposé (volume et intensité réduits) ; pas de progression pour l''instant.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('HANCHE_LIMITATION_MARCHE_ROUGE', 'ARTHROSE_HANCHE', '{"field": "limitation_marche", "operator": "gte", "value": 2}', 'critical', 'medical_referral', 'Vous signalez une impossibilité nouvelle ou importante de marcher ou de prendre appui, une aggravation brutale, ou une douleur importante. Par sécurité, nous vous recommandons de consulter un professionnel de santé avant de poursuivre une activité physique.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('HANCHE_LIMITATION_MOBILITE_ORANGE', 'ARTHROSE_HANCHE', '{"field": "limitation_mobilite", "operator": "gte", "value": 1}', 'warning', 'require_precaution', 'Votre mobilité de hanche a récemment diminué. Par prudence, un programme adapté vous est proposé (amplitude, charge et complexité réduites) ; pas de progression pour l''instant.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('HANCHE_LIMITATION_MOBILITE_ROUGE', 'ARTHROSE_HANCHE', '{"field": "limitation_mobilite", "operator": "gte", "value": 2}', 'critical', 'medical_referral', 'Vous signalez une limitation brutale ou importante de la mobilité de hanche, un blocage, une douleur aiguë ou une aggravation rapide. Par sécurité, nous vous recommandons de consulter un professionnel de santé avant de poursuivre une activité physique.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20')
on conflict (rule_id) do nothing;

-- ============================================================
-- 5. Spondyloarthrite axiale (réf. F1, F2, décisions du 20/08/2026).
--    Statut ORANGE : effort perçu supérieur à la cible (Borg CR10 > 4),
--    récupération insuffisante depuis la séance précédente, raideur
--    nettement augmentée, ou mobilité diminuée (niveau 1). Statut ROUGE :
--    liste explicite de signes d'alerte (le traumatisme récent est déjà
--    couvert par PROPOSED_AXSPA_TRAUMA_FRACTURE_RISK, activée le 20/08/2026
--    — voir 0006_validation_medicale_dr_nikiema_20260820.sql).
--    `symptomes_peripheriques` n'est PAS encore relié à une règle : sa
--    formulation actuelle (présence/absence simple) ne permet pas de
--    distinguer une atteinte stable et légère (pas d'orange, selon Dr
--    Nikiema) d'une atteinte douloureuse/gonflée/limitante (orange) — point
--    laissé ouvert, voir docs/MEDICAL_VALIDATION_NEEDED.md.
-- ============================================================
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, active, version, validated_by, validated_date) values
  ('SPA_EFFORT_BORG_ORANGE', 'SPONDYLOARTHRITE_AXIALE', '{"field": "effort_percu_borg", "operator": "gte", "value": 5}', 'warning', 'require_precaution', 'Votre effort ressenti est supérieur à la cible prescrite. Par prudence, diminuez l''intensité ou le volume, et augmentez les temps de récupération ; pas de progression pour l''instant.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('SPA_RECUPERATION_INSUFFISANTE_ORANGE', 'SPONDYLOARTHRITE_AXIALE', '{"field": "recuperation_satisfaisante", "operator": "equals", "value": false}', 'warning', 'require_precaution', 'Vos symptômes restent aggravés depuis votre dernière séance. Par prudence, privilégiez temporairement une mobilité douce et une activité aérobie adaptée ; pas de progression pour l''instant.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('SPA_RAIDEUR_ORANGE', 'SPONDYLOARTHRITE_AXIALE', '{"field": "raideur", "operator": "equals", "value": true}', 'warning', 'require_precaution', 'Votre raideur est nettement augmentée par rapport à l''habitude. Par prudence, un programme adapté vous est proposé ; pas de progression pour l''instant.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('SPA_MOBILITE_ORANGE', 'SPONDYLOARTHRITE_AXIALE', '{"field": "mobilite_niveau", "operator": "gte", "value": 1}', 'warning', 'require_precaution', 'Votre mobilité a récemment diminué, ou vous avez des difficultés à réaliser certains mouvements prévus. Par prudence, un programme adapté vous est proposé ; pas de progression pour l''instant.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('SPA_MOBILITE_ROUGE', 'SPONDYLOARTHRITE_AXIALE', '{"field": "mobilite_niveau", "operator": "gte", "value": 2}', 'critical', 'medical_referral', 'Vous signalez une incapacité nouvelle et importante à réaliser un mouvement. Par sécurité, nous vous recommandons de consulter un professionnel de santé avant de poursuivre une activité physique.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('SPA_RED_FLAG_DOULEUR_THORACIQUE', 'SPONDYLOARTHRITE_AXIALE', '{"field": "douleur_thoracique_ou_malaise", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Vous avez signalé une douleur thoracique ou un malaise. Par sécurité, nous vous recommandons de consulter un professionnel de santé sans attendre avant toute activité physique.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('SPA_RED_FLAG_DYSPNEE', 'SPONDYLOARTHRITE_AXIALE', '{"field": "dyspnee_inhabituelle", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Vous avez signalé une gêne respiratoire inhabituelle et importante. Par sécurité, nous vous recommandons de consulter un professionnel de santé avant de poursuivre une activité physique.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('SPA_RED_FLAG_DEFICIT_NEURO', 'SPONDYLOARTHRITE_AXIALE', '{"field": "deficit_neurologique_nouveau", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Vous avez signalé un déficit neurologique nouveau ou qui s''aggrave progressivement. Par sécurité, nous vous recommandons de consulter un professionnel de santé sans attendre.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('SPA_RED_FLAG_FAIBLESSE', 'SPONDYLOARTHRITE_AXIALE', '{"field": "faiblesse_nouvelle_importante", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Vous avez signalé une faiblesse nouvelle et importante. Par sécurité, nous vous recommandons de consulter un professionnel de santé avant de poursuivre une activité physique.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('SPA_RED_FLAG_FIEVRE_ETAT_GENERAL', 'SPONDYLOARTHRITE_AXIALE', '{"field": "fievre_alteration_etat_general", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Vous avez signalé de la fièvre ou une altération importante de votre état général, associée à des symptômes inhabituels. Par sécurité, nous vous recommandons de consulter un professionnel de santé avant de poursuivre une activité physique.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20')
on conflict (rule_id) do nothing;

-- ============================================================
-- 6. Ostéoporose — risque de chute (réf. G1, décision du 20/08/2026,
--    avec substitution du TUG par une question déclarative). Le risque
--    fracturaire (fracture récente/vertébrale connue) reste couvert
--    séparément par OSTEO_RECENT_FRACTURE (§21, Sprint 3) — Dr Nikiema
--    insiste explicitement sur le fait que ces deux risques sont distincts.
-- ============================================================
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, active, version, validated_by, validated_date) values
  ('OSTEO_CHUTE_MULTIPLE_ROUGE', 'OSTEOPOROSE', '{"field": "chutes_12_mois", "operator": "gte", "value": 2}', 'critical', 'medical_referral', 'Vous avez signalé plusieurs chutes au cours des 12 derniers mois. Par sécurité, nous vous recommandons une évaluation par un professionnel de santé avant de poursuivre une activité physique en autonomie.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('OSTEO_CHUTE_SOINS_ROUGE', 'OSTEOPOROSE', '{"field": "chute_necessite_soins", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Votre chute a nécessité des soins médicaux. Par sécurité, nous vous recommandons une évaluation par un professionnel de santé avant de poursuivre une activité physique en autonomie.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('OSTEO_CHUTE_PERTE_CONNAISSANCE_ROUGE', 'OSTEOPOROSE', '{"field": "chute_perte_connaissance", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Vous avez perdu connaissance ou eu un malaise avant une chute. Par sécurité, nous vous recommandons une évaluation médicale avant de poursuivre une activité physique en autonomie.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('OSTEO_CHUTE_AIDE_RELEVER_ROUGE', 'OSTEOPOROSE', '{"field": "chute_aide_relever", "operator": "equals", "value": true}', 'critical', 'medical_referral', 'Vous avez eu besoin d''aide pour vous relever après une chute. Par sécurité, nous vous recommandons une évaluation par un professionnel de santé avant de poursuivre une activité physique en autonomie.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('OSTEO_CHUTE_ORANGE', 'OSTEOPOROSE', '{"field": "chutes_12_mois", "operator": "gte", "value": 1}', 'warning', 'require_precaution', 'Vous avez signalé une chute au cours des 12 derniers mois. Un programme adapté vous est proposé, avec une priorité donnée au travail de l''équilibre, de la force fonctionnelle et de la marche.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('OSTEO_INSTABILITE_MARCHE_ORANGE', 'OSTEOPOROSE', '{"field": "instabilite_marche", "operator": "equals", "value": true}', 'warning', 'require_precaution', 'Vous ressentez une instabilité en marchant ou en vous levant. Un programme adapté vous est proposé, avec une priorité donnée au travail de l''équilibre.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('OSTEO_PEUR_TOMBER_ORANGE', 'OSTEOPOROSE', '{"field": "peur_de_tomber", "operator": "equals", "value": true}', 'warning', 'require_precaution', 'Vous avez signalé une peur de tomber. Un programme adapté vous est proposé, avec une priorité donnée au travail de l''équilibre et de la confiance dans le mouvement.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('OSTEO_AIDE_MARCHE_ORANGE', 'OSTEOPOROSE', '{"field": "aide_marche", "operator": "equals", "value": true}', 'warning', 'require_precaution', 'Vous utilisez une aide à la marche. Un programme adapté vous est proposé, avec une priorité donnée au travail de l''équilibre et de la force fonctionnelle.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20'),
  ('OSTEO_LENTEUR_ORANGE', 'OSTEOPOROSE', '{"field": "lenteur_lever_marcher", "operator": "equals", "value": true}', 'warning', 'require_precaution', 'Vous avez l''impression de mettre plus de temps que d''habitude à vous lever et à marcher. Un programme adapté vous est proposé, avec une priorité donnée au travail de l''équilibre et de la force fonctionnelle.', true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-20')
on conflict (rule_id) do nothing;

-- ===== SEED : 0009_reponses_questions_ouvertes_20260821.sql =====
-- Intégration des réponses de Dr Wendtongo Brice Florent NIKIEMA au document
-- QUESTIONS_OUVERTES_SPRINT16_20260821.docx (6 points laissés explicitement
-- ouverts à l'issue du Sprint 16, réponses reçues et complétées le
-- 21/08/2026). Contrairement à 0006 (simples activations) et 0008 (nouvelles
-- règles à partir de réponses déjà données), CE FICHIER modifie aussi des
-- règles existantes (désactivation, remplacement de condition) suite à un
-- changement de champ de dépistage — voir packages/domain/src/screening.ts
-- pour le détail des items ajoutés/retirés/renommés en même temps que ce
-- fichier.
--
-- Portée par question :
--   Q1 (outil gabarit Excel)             -> aucune ligne ici, voir
--                                            infra/db/seed/tools/.
--   Q2 (SpA symptômes périphériques)     -> section 1.
--   Q3 (hanche, statut restrictions 3n.) -> section 2.
--   Q4 (lombalgie, critères qualitatifs) -> section 3.
--   Q5 (retrait « queue de cheval »)     -> section 4.
--   Q6 (« autre situation préoccupante ») -> section 5.

-- ============================================================
-- 1. Q2 — Spondyloarthrite axiale, symptômes périphériques (réf. F2 puis Q2).
--    Le champ `symptomes_peripheriques` reste une simple porte d'entrée
--    (aucune règle dessus). La sévérité réelle est évaluée sur les nouveaux
--    champs `douleur_peripherique` / `evolution_peripherique` /
--    `gonflement_chaleur_peripherique` / `limitation_fonctionnelle_peripherique`,
--    mais UNIQUEMENT si au moins une localisation (arthrite périphérique,
--    enthésite, dactylite) est déclarée — une atteinte légère et stable
--    reste compatible avec un vert, conformément à sa réponse.
-- ============================================================
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, active, version, validated_by, validated_date) values
  (
    'SPA_PERIPHERIQUE_ORANGE',
    'SPONDYLOARTHRITE_AXIALE',
    '{"all": [{"any": [{"field": "arthrite_peripherique_presente", "operator": "equals", "value": true}, {"field": "enthesite_presente", "operator": "equals", "value": true}, {"field": "dactylite_presente", "operator": "equals", "value": true}]}, {"any": [{"field": "douleur_peripherique", "operator": "gte", "value": 4}, {"field": "evolution_peripherique", "operator": "gte", "value": 1}, {"field": "gonflement_chaleur_peripherique", "operator": "equals", "value": true}, {"field": "limitation_fonctionnelle_peripherique", "operator": "equals", "value": true}]}]}',
    'warning',
    'require_precaution',
    'Vous avez signalé une atteinte périphérique (arthrite, enthésite ou dactylite) qui semble active ou vous gêne. Par prudence, votre programme est adapté à la zone concernée (adaptation régionale) ; pas de progression pour l''instant.',
    true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-21'
  ),
  (
    'SPA_PERIPHERIQUE_ROUGE',
    'SPONDYLOARTHRITE_AXIALE',
    '{"all": [{"any": [{"field": "arthrite_peripherique_presente", "operator": "equals", "value": true}, {"field": "enthesite_presente", "operator": "equals", "value": true}, {"field": "dactylite_presente", "operator": "equals", "value": true}]}, {"any": [{"field": "douleur_peripherique", "operator": "gte", "value": 7}, {"field": "evolution_peripherique", "operator": "gte", "value": 2}]}]}',
    'critical',
    'medical_referral',
    'Votre atteinte périphérique est très douloureuse, s''aggrave rapidement, ou entraîne une incapacité fonctionnelle nouvelle importante. Par sécurité, nous vous recommandons de consulter un professionnel de santé avant de poursuivre une activité physique.',
    true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-21'
  )
on conflict (rule_id) do nothing;

-- ============================================================
-- 2. Q3 — Arthrose de hanche, statut des restrictions à 3 niveaux (réf. D2
--    puis Q3). Remplace HANCHE_CHIRURGIE_TRAUMA_RESTRICTIONS_ROUGE/ORANGE
--    (0008, fondées sur le booléen `restrictions_pro_recentes`, retiré du
--    dépistage hanche) par deux nouvelles règles fondées sur
--    `statut_restrictions_hanche` (select 0/1/2). Le 3ᵉ statut (« levées »,
--    valeur 0) ne déclenche AUCUNE règle ici : Dr Nikiema confirme que
--    l'intégration progressive doit alors être régie par les règles déjà
--    actives de douleur et de limitation de marche/mobilité
--    (PAIN_*_ARTHROSE_HANCHE, HANCHE_LIMITATION_MARCHE_*,
--    HANCHE_LIMITATION_MOBILITE_*), pas par une règle dédiée.
-- ============================================================
update public.clinical_rules
set active = false
where rule_id in ('HANCHE_CHIRURGIE_TRAUMA_RESTRICTIONS_ROUGE', 'HANCHE_CHIRURGIE_TRAUMA_RECENT_ORANGE');

insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, active, version, validated_by, validated_date) values
  (
    'HANCHE_CHIRURGIE_TRAUMA_RESTRICTIONS_ACTIVES_ROUGE',
    'ARTHROSE_HANCHE',
    '{"all": [{"any": [{"field": "chirurgie_recente", "operator": "equals", "value": true}, {"field": "traumatisme", "operator": "equals", "value": true}]}, {"field": "statut_restrictions_hanche", "operator": "equals", "value": 2}]}',
    'critical',
    'medical_referral',
    'Vous avez signalé une chirurgie ou un traumatisme récent de la hanche (y compris une prothèse), avec des restrictions actuellement actives données par un professionnel de santé. Par sécurité, aucun programme standard n''est proposé : suivez les consignes de l''équipe qui vous a opéré ou suivi, qui priment toujours sur toute recommandation de cette application.',
    true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-21'
  ),
  (
    'HANCHE_CHIRURGIE_TRAUMA_RESTRICTIONS_PARTIELLES_ORANGE',
    'ARTHROSE_HANCHE',
    '{"all": [{"any": [{"field": "chirurgie_recente", "operator": "equals", "value": true}, {"field": "traumatisme", "operator": "equals", "value": true}]}, {"field": "statut_restrictions_hanche", "operator": "equals", "value": 1}]}',
    'warning',
    'require_precaution',
    'Vous avez signalé une chirurgie ou un traumatisme récent de la hanche, avec des restrictions partielles ou des consignes pas totalement claires. Par prudence, un programme PTH adapté vous est proposé, sans progression pour l''instant.',
    true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-21'
  )
on conflict (rule_id) do nothing;

-- ============================================================
-- 3. Q4 — Lombalgie, critères qualitatifs du statut vert/orange (réf. C3
--    puis Q4). S'ajoutent, indépendamment du seuil de douleur harmonisé
--    (PAIN_ORANGE/ROUGE_LOMBALGIE_COMMUNE, 0008 section 1) : toute
--    aggravation déclarée ou toute nouvelle limitation fonctionnelle
--    importante fait basculer au minimum en orange, MÊME SI la douleur est
--    ≤ 3/10 (décision explicite de Dr Nikiema).
-- ============================================================
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, active, version, validated_by, validated_date) values
  (
    'LOMBALGIE_AGGRAVATION_ORANGE',
    'LOMBALGIE_COMMUNE',
    '{"field": "aggravation_recente", "operator": "equals", "value": true}',
    'warning',
    'require_precaution',
    'Vous avez indiqué que votre mal de dos s''aggrave actuellement. Par prudence, adaptez l''intensité de votre séance et évitez toute progression ; si l''aggravation persiste au-delà de 24 heures, parlez-en à un professionnel de santé.',
    true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-21'
  ),
  (
    'LOMBALGIE_NOUVELLE_LIMITATION_ORANGE',
    'LOMBALGIE_COMMUNE',
    '{"field": "nouvelle_limitation_fonctionnelle_importante", "operator": "equals", "value": true}',
    'warning',
    'require_precaution',
    'Vous avez signalé une nouvelle difficulté importante dans vos activités habituelles. Par prudence, un programme adapté vous est proposé ; pas de progression pour l''instant.',
    true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-21'
  )
on conflict (rule_id) do nothing;

-- ============================================================
-- 4. Q5 — Retrait de « suspicion de syndrome de la queue de cheval » comme
--    question patient indépendante (réf. C1 puis Q5). Dr Nikiema confirme
--    que ses deux composantes cliniques (troubles sphinctériens, anesthésie
--    en selle) déclenchent déjà chacune, indépendamment, le statut rouge
--    (LBP_RED_FLAG_SPHINCTER, LBP_RED_FLAG_ANESTHESIE_SELLE — actives depuis
--    le Sprint 3, 0003_clinical_rules.sql), sans qu'il soit nécessaire
--    d'attendre leur présence simultanée. La règle dédiée devient donc sans
--    objet (son champ n'est plus posé au patient) et est désactivée plutôt
--    que laissée active sur un champ mort.
-- ============================================================
update public.clinical_rules
set active = false
where rule_id = 'LBP_RED_FLAG_QUEUE_DE_CHEVAL';

-- ============================================================
-- 5. Q6 — « Autre situation préoccupante » (réf. C1 puis Q6) : n'est plus un
--    red flag automatique déclenchant le rouge comme les 9 autres items de
--    LOMBALGIE_RED_FLAGS. Décision explicite de Dr Nikiema : une réponse
--    positive à ce signal de vigilance déclenche une simple prudence
--    (orange), pas une orientation médicale automatique. Le champ de texte
--    libre associé (`signal_vigilance_autre_details`) documente le motif
--    pour le suivi, mais n'entre dans AUCUNE condition de règle — la
--    décision de sécurité ne dépend jamais d'une analyse automatique du
--    texte, conformément à sa consigne explicite. L'ancienne règle
--    LBP_RED_FLAG_AUTRE (portant sur le champ désormais retiré
--    `autre_situation_preoccupante`) est désactivée.
-- ============================================================
update public.clinical_rules
set active = false
where rule_id = 'LBP_RED_FLAG_AUTRE';

insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, active, version, validated_by, validated_date) values
  (
    'LOMBALGIE_VIGILANCE_AUTRE_ORANGE',
    'LOMBALGIE_COMMUNE',
    '{"field": "signal_vigilance_autre", "operator": "equals", "value": true}',
    'warning',
    'require_precaution',
    'Vous avez signalé une autre situation qui vous inquiète. Cela ne constitue pas à elle seule un signal d''alerte : par prudence, un programme adapté vous est proposé, sans progression pour l''instant. Si votre inquiétude persiste ou s''aggrave, parlez-en à un professionnel de santé.',
    true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-21'
  )
on conflict (rule_id) do nothing;

-- ===== SEED : 0010_exercises_pending_validation_20260819.sql =====
-- Sprint 5bis/5ter (19/08/2026) : premier remplissage du gabarit d'exercices
-- (infra/db/seed/tools/gabarit_exercices_apa_rhumato.xlsx), sourcé exclusivement
-- sur les références scientifiques déjà citées au §81 (OMS 2023, Kolasinski
-- et al. 2019, England et al. 2022, LeBoff et al. 2022, EULAR 2025/2026,
-- George et al. 2021/JOSPT) — voir docs/DECISIONS.md, sections Sprint 5bis
-- et Sprint 5ter, pour le détail de la recherche menée référence par référence.
--
-- Mis à jour le 23/08/2026 (Sprint 17 suite, 2 passes) :
-- 1) les notes des exercices 6, 7 (ostéoporose) et 8 (spondyloarthrite
--    axiale) référençaient Hoffmann et al. 2023 et ASAS-EULAR 2022 comme
--    "accès bloqué" — ces deux références ont pu être vérifiées en texte
--    intégral entretemps ; leur contenu réel remplace les anciennes notes.
-- 2) à la demande explicite de Dr Nikiema ("fait des propositions à mon
--    nom... sois le plus scientifique et réaliste possible"), les champs
--    que les 10 références ne permettaient toujours pas de renseigner
--    (intensité/progression/contre-indications/critères d'arrêt restants)
--    ont été complétés par des PROPOSITIONS explicitement étiquetées comme
--    telles, construites sur des repères génériques d'exercice thérapeutique
--    (ACSM, échelle de Borg, règle de progression usuelle de 5-10%/semaine)
--    plutôt que sur les 10 références pathologie-spécifiques. Voir
--    docs/DECISIONS.md, section Sprint 17 (compléments), pour le détail.
--
-- Ce fichier committe la sortie de `python3 infra/db/seed/tools/import_exercises.py
-- gabarit_exercices_apa_rhumato.xlsx`. Toutes les lignes restent
-- `medical_validation_status = 'pending_validation'` (§57, §59) : la policy
-- RLS `exercise_library_read_validated_only` (0005_exercise_library.sql) les
-- rend invisibles de tout utilisateur patient tant qu'elles ne sont pas
-- explicitement passées à 'validated' par le Dr Nikiema. Elles sont
-- consultables et modifiables dès maintenant via /admin/exercices
-- (accès service_role, Sprint 13).

-- Généré automatiquement depuis gabarit_exercices_apa_rhumato.xlsx
-- 8 exercice(s) importé(s), 1 ligne(s) d'exemple ignorée(s).
-- Rappel : un exercice n'est visible des utilisateurs que si medical_validation_status = 'validated'.

insert into public.exercise_library (exercise_id, name, short_description, detailed_description, category, difficulty, starting_position, execution_steps, breathing_instruction, duration_seconds, repetitions, sets, rest_time_seconds, frequency, intensity, progression, regression, contraindications, precautions, stop_criteria, target_muscles, video_url, audio_url, thumbnail_url, last_reviewed, medical_validation_status, equipment_required) values ('d6f353e0-9442-4bf2-9c6f-3ae2d3414039', 'Marche régulière adaptée (lombalgie)', 'Marche à allure confortable, dans le cadre d''un programme d''exercice structuré.', 'D''après l''OMS 2023 (guideline lombalgie chronique primaire), déjà citée au §6 du cahier des charges : un programme d''exercice structuré peut être proposé aux adultes présentant une lombalgie chronique primaire. Le détail (durée, fréquence, type précis) n''a pas pu être vérifié au-delà de ce principe général — voir colonnes ci-contre. Complément d''après George et al. 2021 (JOSPT, texte intégral) : pour la lombalgie chronique, l''exercice général (restaurer/améliorer la force ou l''endurance des grands groupes musculaires des membres et du tronc, incluant des exercices de flexibilité/mobilité et d''aérobie/conditionnement) fait partie des interventions recommandées avec un niveau de preuve fort (recommandation A), au même titre que le renforcement/endurance du tronc, l''exercice aérobique, aquatique et multimodal — sans supériorité démontrée d''un type sur un autre.', 'aerobique', null, null, null, null, null, null, null, null, null, 'PROPOSITION (hors des 10 références citées, repère générique d''exercice thérapeutique — à valider) — intensité légère à modérée, Borg CR10 ≈ 2-4 (méthode réf. B6), talk test positif ; à ajuster selon le niveau du programme auquel l''exercice est intégré.', 'PROPOSITION (hors des 10 références citées, repère générique d''exercice thérapeutique — à valider) — augmenter la durée de marche de 5 à 10 % par semaine si bonne tolérance (pas d''aggravation à 24h), cohérent avec le principe « rester actif » de George et al. 2021.', null, 'PROPOSITION (hors des 10 références citées, repère générique d''exercice thérapeutique — à valider) — red flags actifs (déjà couverts par le dépistage de sécurité de l''application), douleur radiculaire aiguë non stabilisée.', 'D''après George et al. 2021 (JOSPT 2021;51(11):CPG1-CPG60, DOI 10.2519/jospt.2021.0304 — texte intégral vérifié), section « Intervention: Patient Education » : les stratégies d''éducation ne doivent PAS augmenter la perception de menace ou la peur associée à la lombalgie — il est notamment déconseillé de recommander le repos au lit prolongé ou de donner des explications pathoanatomiques approfondies sur la cause précise de la douleur (Recommandation, niveau B). À l''inverse, il est recommandé d''insister sur le pronostic globalement favorable de la lombalgie aiguë, sur l''importance de rester actif malgré la douleur, et sur l''amélioration du niveau d''activité (pas seulement le soulagement de la douleur) comme objectif.', 'PROPOSITION (hors des 10 références citées, repère générique d''exercice thérapeutique — à valider) — douleur > 6/10 en cours d''exercice, douleur irradiante nouvelle ou aggravée dans la jambe, essoufflement empêchant de parler.', null, null, null, null, '2026-08-19', 'pending_validation', '{aucun}');
insert into public.exercise_pathologies (exercise_id, pathology_code) values ('d6f353e0-9442-4bf2-9c6f-3ae2d3414039', 'LOMBALGIE_COMMUNE');
insert into public.exercise_objectives (exercise_id, objective_code) values ('d6f353e0-9442-4bf2-9c6f-3ae2d3414039', 'REDUIRE_SEDENTARITE');
insert into public.exercise_objectives (exercise_id, objective_code) values ('d6f353e0-9442-4bf2-9c6f-3ae2d3414039', 'AMELIORER_CONDITION_PHYSIQUE');
insert into public.exercise_references (exercise_id, reference_id) select 'd6f353e0-9442-4bf2-9c6f-3ae2d3414039', id from public.scientific_references where doi = '10.2519/jospt.2021.0304';
insert into public.exercise_library (exercise_id, name, short_description, detailed_description, category, difficulty, starting_position, execution_steps, breathing_instruction, duration_seconds, repetitions, sets, rest_time_seconds, frequency, intensity, progression, regression, contraindications, precautions, stop_criteria, target_muscles, video_url, audio_url, thumbnail_url, last_reviewed, medical_validation_status, equipment_required) values ('8ec87752-fd97-4cf9-be89-d7a43e4f9672', 'Marche adaptée (arthrose du genou/hanche)', 'Marche recommandée comme option d''exercice aérobique de première intention, au même titre que le renforcement ou l''exercice aquatique.', 'D''après Kolasinski et al. 2019 (ACR/Arthritis Foundation) : « l''exercice pour l''arthrose du genou et de la hanche peut inclure la marche, le renforcement, l''entraînement neuromusculaire et l''exercice aquatique, sans hiérarchie entre ces options » (recommandation FORTE).', 'aerobique', null, null, null, null, null, null, null, null, null, 'D''après EULAR 2025/2026 (texte intégral) : chez les personnes déconditionnées ou avec limitations fonctionnelles importantes, l''exercice à intensité modérée ou vigoureuse peut être initialement trop épuisant. Il est jugé approprié de débuter avec une dose plus faible, bien tolérée, puis d''augmenter progressivement la durée ou la charge sur les 4 à 6 premières semaines. Au-delà de ce principe, les paramètres FITT-VP exacts (fréquence, intensité, temps, type, volume, progression) doivent être définis individuellement par le professionnel de santé (Recommandation 7 du document) — aucun chiffre cible générique (ex. % FC max, minutes/semaine) n''est fourni par cette référence.', 'D''après EULAR 2025/2026 (texte intégral) : chez les personnes déconditionnées ou avec limitations fonctionnelles importantes, l''exercice à intensité modérée ou vigoureuse peut être initialement trop épuisant. Il est jugé approprié de débuter avec une dose plus faible, bien tolérée, puis d''augmenter progressivement la durée ou la charge sur les 4 à 6 premières semaines. Au-delà de ce principe, les paramètres FITT-VP exacts (fréquence, intensité, temps, type, volume, progression) doivent être définis individuellement par le professionnel de santé (Recommandation 7 du document) — aucun chiffre cible générique (ex. % FC max, minutes/semaine) n''est fourni par cette référence.', null, 'D''après EULAR 2025/2026 (Rausch Osthoff et al., Ann Rheum Dis 2026;85:1026-1038 — texte intégral vérifié, section « Recommendation 4 ») : il n''existe pas de contre-indication spécifique à la pathologie pour l''activité physique en tant que telle chez les personnes avec arthrite inflammatoire ou arthrose (« there are no disease-specific contraindications for PA per se » — cette contre-indication figurait dans la version 2018 des recommandations EULAR mais a été retirée en 2025/2026, faute de preuve). En revanche, l''intensité doit être adaptée à l''activité de la maladie et à l''état de santé du moment : en cas d''atteinte d''une articulation donnée (ex. genou gonflé), éviter l''exercice de forte intensité impliquant spécifiquement cette zone ; l''exercice de forte intensité reste possible sur les zones non atteintes (ex. membres supérieurs à la place des membres inférieurs).', 'D''après EULAR 2025/2026 (texte intégral) : les effets indésirables rapportés dans les études sur l''arthrite inflammatoire et l''arthrose sont transitoires et légers (ex. douleur musculaire, fatigue) ; aucun effet délétère de l''exercice sur l''activité de la maladie n''est rapporté. Une augmentation transitoire de la douleur dans les 48 à 72 heures suivant l''exercice peut être normale (courbatures/DOMS), en particulier chez les personnes novices en exercice. En cas de poussée, les activités de forte intensité peuvent devenir impossibles, mais des activités de plus faible intensité (marche, exercices d''amplitude articulaire) restent le plus souvent possibles — à adapter selon la zone du corps touchée.', 'PROPOSITION (hors des 10 références citées, repère générique d''exercice thérapeutique — à valider) — douleur articulaire > 5-6/10 en cours d''exercice, gonflement articulaire aigu nouveau, dérobement/instabilité en charge, essoufflement empêchant de parler.', null, null, null, null, '2026-08-19', 'pending_validation', '{aucun}');
insert into public.exercise_pathologies (exercise_id, pathology_code) values ('8ec87752-fd97-4cf9-be89-d7a43e4f9672', 'ARTHROSE_GENOU');
insert into public.exercise_pathologies (exercise_id, pathology_code) values ('8ec87752-fd97-4cf9-be89-d7a43e4f9672', 'ARTHROSE_HANCHE');
insert into public.exercise_objectives (exercise_id, objective_code) values ('8ec87752-fd97-4cf9-be89-d7a43e4f9672', 'AMELIORER_MOBILITE');
insert into public.exercise_objectives (exercise_id, objective_code) values ('8ec87752-fd97-4cf9-be89-d7a43e4f9672', 'REDUIRE_SEDENTARITE');
insert into public.exercise_references (exercise_id, reference_id) select '8ec87752-fd97-4cf9-be89-d7a43e4f9672', id from public.scientific_references where doi = '10.1002/acr.24131';
insert into public.exercise_references (exercise_id, reference_id) select '8ec87752-fd97-4cf9-be89-d7a43e4f9672', id from public.scientific_references where doi = '10.1016/j.ard.2026.03.006';
insert into public.exercise_library (exercise_id, name, short_description, detailed_description, category, difficulty, starting_position, execution_steps, breathing_instruction, duration_seconds, repetitions, sets, rest_time_seconds, frequency, intensity, progression, regression, contraindications, precautions, stop_criteria, target_muscles, video_url, audio_url, thumbnail_url, last_reviewed, medical_validation_status, equipment_required) values ('1933750b-d11a-4324-8af6-200d2cd34618', 'Renforcement musculaire des membres inférieurs (arthrose)', 'Renforcement musculaire recommandé en première intention pour l''arthrose du genou et de la hanche, sans hiérarchie par rapport à la marche ou l''exercice aquatique.', 'D''après Kolasinski et al. 2019 (ACR/Arthritis Foundation), recommandation FORTE pour l''exercice incluant le renforcement musculaire, sans hiérarchie de modalité.', 'renforcement', null, null, null, null, null, null, null, null, null, 'D''après EULAR 2025/2026 (texte intégral) : chez les personnes déconditionnées ou avec limitations fonctionnelles importantes, l''exercice à intensité modérée ou vigoureuse peut être initialement trop épuisant. Il est jugé approprié de débuter avec une dose plus faible, bien tolérée, puis d''augmenter progressivement la durée ou la charge sur les 4 à 6 premières semaines. Au-delà de ce principe, les paramètres FITT-VP exacts (fréquence, intensité, temps, type, volume, progression) doivent être définis individuellement par le professionnel de santé (Recommandation 7 du document) — aucun chiffre cible générique (ex. % FC max, minutes/semaine) n''est fourni par cette référence.', 'D''après EULAR 2025/2026 (texte intégral) : chez les personnes déconditionnées ou avec limitations fonctionnelles importantes, l''exercice à intensité modérée ou vigoureuse peut être initialement trop épuisant. Il est jugé approprié de débuter avec une dose plus faible, bien tolérée, puis d''augmenter progressivement la durée ou la charge sur les 4 à 6 premières semaines. Au-delà de ce principe, les paramètres FITT-VP exacts (fréquence, intensité, temps, type, volume, progression) doivent être définis individuellement par le professionnel de santé (Recommandation 7 du document) — aucun chiffre cible générique (ex. % FC max, minutes/semaine) n''est fourni par cette référence.', null, 'D''après EULAR 2025/2026 (Rausch Osthoff et al., Ann Rheum Dis 2026;85:1026-1038 — texte intégral vérifié, section « Recommendation 4 ») : il n''existe pas de contre-indication spécifique à la pathologie pour l''activité physique en tant que telle chez les personnes avec arthrite inflammatoire ou arthrose (« there are no disease-specific contraindications for PA per se » — cette contre-indication figurait dans la version 2018 des recommandations EULAR mais a été retirée en 2025/2026, faute de preuve). En revanche, l''intensité doit être adaptée à l''activité de la maladie et à l''état de santé du moment : en cas d''atteinte d''une articulation donnée (ex. genou gonflé), éviter l''exercice de forte intensité impliquant spécifiquement cette zone ; l''exercice de forte intensité reste possible sur les zones non atteintes (ex. membres supérieurs à la place des membres inférieurs).', 'D''après EULAR 2025/2026 (texte intégral) : les effets indésirables rapportés dans les études sur l''arthrite inflammatoire et l''arthrose sont transitoires et légers (ex. douleur musculaire, fatigue) ; aucun effet délétère de l''exercice sur l''activité de la maladie n''est rapporté. Une augmentation transitoire de la douleur dans les 48 à 72 heures suivant l''exercice peut être normale (courbatures/DOMS), en particulier chez les personnes novices en exercice. En cas de poussée, les activités de forte intensité peuvent devenir impossibles, mais des activités de plus faible intensité (marche, exercices d''amplitude articulaire) restent le plus souvent possibles — à adapter selon la zone du corps touchée.', 'PROPOSITION (hors des 10 références citées, repère générique d''exercice thérapeutique — à valider) — douleur articulaire > 5-6/10 pendant l''exercice, gonflement aigu nouveau, dérobement du genou.', 'Quadriceps, ischio-jambiers, fessiers (muscles génériquement associés au renforcement membre inférieur — exercice précis à définir)', null, null, null, '2026-08-19', 'pending_validation', '{chaise}');
insert into public.exercise_pathologies (exercise_id, pathology_code) values ('1933750b-d11a-4324-8af6-200d2cd34618', 'ARTHROSE_GENOU');
insert into public.exercise_pathologies (exercise_id, pathology_code) values ('1933750b-d11a-4324-8af6-200d2cd34618', 'ARTHROSE_HANCHE');
insert into public.exercise_objectives (exercise_id, objective_code) values ('1933750b-d11a-4324-8af6-200d2cd34618', 'AMELIORER_FORCE');
insert into public.exercise_references (exercise_id, reference_id) select '1933750b-d11a-4324-8af6-200d2cd34618', id from public.scientific_references where doi = '10.1002/acr.24131';
insert into public.exercise_references (exercise_id, reference_id) select '1933750b-d11a-4324-8af6-200d2cd34618', id from public.scientific_references where doi = '10.1016/j.ard.2026.03.006';
insert into public.exercise_library (exercise_id, name, short_description, detailed_description, category, difficulty, starting_position, execution_steps, breathing_instruction, duration_seconds, repetitions, sets, rest_time_seconds, frequency, intensity, progression, regression, contraindications, precautions, stop_criteria, target_muscles, video_url, audio_url, thumbnail_url, last_reviewed, medical_validation_status, equipment_required) values ('4c7c37e4-da9f-4893-87af-0f03562273a4', 'Activité aérobique adaptée (polyarthrite rhumatoïde)', 'Activité aérobique conditionnellement recommandée, à privilégier à la sédentarité.', 'D''après England et al. 2022 (ACR) : recommandation FORTE pour « un engagement constant dans l''exercice plutôt que l''absence d''exercice ». Recommandation conditionnelle (preuves de faible qualité) en faveur de l''exercice aérobique.', 'aerobique', null, null, null, null, null, null, null, null, null, 'D''après EULAR 2025/2026 (texte intégral) : chez les personnes déconditionnées ou avec limitations fonctionnelles importantes, l''exercice à intensité modérée ou vigoureuse peut être initialement trop épuisant. Il est jugé approprié de débuter avec une dose plus faible, bien tolérée, puis d''augmenter progressivement la durée ou la charge sur les 4 à 6 premières semaines. Au-delà de ce principe, les paramètres FITT-VP exacts (fréquence, intensité, temps, type, volume, progression) doivent être définis individuellement par le professionnel de santé (Recommandation 7 du document) — aucun chiffre cible générique (ex. % FC max, minutes/semaine) n''est fourni par cette référence.', 'D''après EULAR 2025/2026 (texte intégral) : chez les personnes déconditionnées ou avec limitations fonctionnelles importantes, l''exercice à intensité modérée ou vigoureuse peut être initialement trop épuisant. Il est jugé approprié de débuter avec une dose plus faible, bien tolérée, puis d''augmenter progressivement la durée ou la charge sur les 4 à 6 premières semaines. Au-delà de ce principe, les paramètres FITT-VP exacts (fréquence, intensité, temps, type, volume, progression) doivent être définis individuellement par le professionnel de santé (Recommandation 7 du document) — aucun chiffre cible générique (ex. % FC max, minutes/semaine) n''est fourni par cette référence.', null, 'D''après EULAR 2025/2026 (Rausch Osthoff et al., Ann Rheum Dis 2026;85:1026-1038 — texte intégral vérifié, section « Recommendation 4 ») : il n''existe pas de contre-indication spécifique à la pathologie pour l''activité physique en tant que telle chez les personnes avec arthrite inflammatoire ou arthrose (« there are no disease-specific contraindications for PA per se » — cette contre-indication figurait dans la version 2018 des recommandations EULAR mais a été retirée en 2025/2026, faute de preuve). En revanche, l''intensité doit être adaptée à l''activité de la maladie et à l''état de santé du moment : en cas d''atteinte d''une articulation donnée (ex. genou gonflé), éviter l''exercice de forte intensité impliquant spécifiquement cette zone ; l''exercice de forte intensité reste possible sur les zones non atteintes (ex. membres supérieurs à la place des membres inférieurs).', 'D''après EULAR 2025/2026 (texte intégral) : les effets indésirables rapportés dans les études sur l''arthrite inflammatoire et l''arthrose sont transitoires et légers (ex. douleur musculaire, fatigue) ; aucun effet délétère de l''exercice sur l''activité de la maladie n''est rapporté. Une augmentation transitoire de la douleur dans les 48 à 72 heures suivant l''exercice peut être normale (courbatures/DOMS), en particulier chez les personnes novices en exercice. En cas de poussée, les activités de forte intensité peuvent devenir impossibles, mais des activités de plus faible intensité (marche, exercices d''amplitude articulaire) restent le plus souvent possibles — à adapter selon la zone du corps touchée.', 'PROPOSITION (hors des 10 références citées, repère générique d''exercice thérapeutique — à valider) — signe de poussée en cours de séance (gonflement articulaire nouveau, raideur marquée), douleur > 6/10, essoufflement empêchant de parler.', null, null, null, null, '2026-08-19', 'pending_validation', '{aucun}');
insert into public.exercise_pathologies (exercise_id, pathology_code) values ('4c7c37e4-da9f-4893-87af-0f03562273a4', 'POLYARTHRITE_RHUMATOIDE');
insert into public.exercise_objectives (exercise_id, objective_code) values ('4c7c37e4-da9f-4893-87af-0f03562273a4', 'REDUIRE_SEDENTARITE');
insert into public.exercise_objectives (exercise_id, objective_code) values ('4c7c37e4-da9f-4893-87af-0f03562273a4', 'AMELIORER_CONDITION_PHYSIQUE');
insert into public.exercise_references (exercise_id, reference_id) select '4c7c37e4-da9f-4893-87af-0f03562273a4', id from public.scientific_references where doi = '10.1002/acr.25117';
insert into public.exercise_references (exercise_id, reference_id) select '4c7c37e4-da9f-4893-87af-0f03562273a4', id from public.scientific_references where doi = '10.1016/j.ard.2026.03.006';
insert into public.exercise_library (exercise_id, name, short_description, detailed_description, category, difficulty, starting_position, execution_steps, breathing_instruction, duration_seconds, repetitions, sets, rest_time_seconds, frequency, intensity, progression, regression, contraindications, precautions, stop_criteria, target_muscles, video_url, audio_url, thumbnail_url, last_reviewed, medical_validation_status, equipment_required) values ('208903af-4b2b-4dd4-8ced-02ad030d014a', 'Renforcement musculaire léger (polyarthrite rhumatoïde)', 'Renforcement musculaire conditionnellement recommandé, à privilégier à la sédentarité.', 'D''après England et al. 2022 (ACR) : recommandation conditionnelle (preuves de faible qualité) en faveur du renforcement musculaire, de l''exercice aquatique et des approches corps-esprit, en complément de l''exercice aérobique.', 'renforcement', null, null, null, null, null, null, null, null, null, 'D''après EULAR 2025/2026 (texte intégral) : chez les personnes déconditionnées ou avec limitations fonctionnelles importantes, l''exercice à intensité modérée ou vigoureuse peut être initialement trop épuisant. Il est jugé approprié de débuter avec une dose plus faible, bien tolérée, puis d''augmenter progressivement la durée ou la charge sur les 4 à 6 premières semaines. Au-delà de ce principe, les paramètres FITT-VP exacts (fréquence, intensité, temps, type, volume, progression) doivent être définis individuellement par le professionnel de santé (Recommandation 7 du document) — aucun chiffre cible générique (ex. % FC max, minutes/semaine) n''est fourni par cette référence.', 'D''après EULAR 2025/2026 (texte intégral) : chez les personnes déconditionnées ou avec limitations fonctionnelles importantes, l''exercice à intensité modérée ou vigoureuse peut être initialement trop épuisant. Il est jugé approprié de débuter avec une dose plus faible, bien tolérée, puis d''augmenter progressivement la durée ou la charge sur les 4 à 6 premières semaines. Au-delà de ce principe, les paramètres FITT-VP exacts (fréquence, intensité, temps, type, volume, progression) doivent être définis individuellement par le professionnel de santé (Recommandation 7 du document) — aucun chiffre cible générique (ex. % FC max, minutes/semaine) n''est fourni par cette référence.', null, 'D''après EULAR 2025/2026 (Rausch Osthoff et al., Ann Rheum Dis 2026;85:1026-1038 — texte intégral vérifié, section « Recommendation 4 ») : il n''existe pas de contre-indication spécifique à la pathologie pour l''activité physique en tant que telle chez les personnes avec arthrite inflammatoire ou arthrose (« there are no disease-specific contraindications for PA per se » — cette contre-indication figurait dans la version 2018 des recommandations EULAR mais a été retirée en 2025/2026, faute de preuve). En revanche, l''intensité doit être adaptée à l''activité de la maladie et à l''état de santé du moment : en cas d''atteinte d''une articulation donnée (ex. genou gonflé), éviter l''exercice de forte intensité impliquant spécifiquement cette zone ; l''exercice de forte intensité reste possible sur les zones non atteintes (ex. membres supérieurs à la place des membres inférieurs).', 'D''après EULAR 2025/2026 (texte intégral) : les effets indésirables rapportés dans les études sur l''arthrite inflammatoire et l''arthrose sont transitoires et légers (ex. douleur musculaire, fatigue) ; aucun effet délétère de l''exercice sur l''activité de la maladie n''est rapporté. Une augmentation transitoire de la douleur dans les 48 à 72 heures suivant l''exercice peut être normale (courbatures/DOMS), en particulier chez les personnes novices en exercice. En cas de poussée, les activités de forte intensité peuvent devenir impossibles, mais des activités de plus faible intensité (marche, exercices d''amplitude articulaire) restent le plus souvent possibles — à adapter selon la zone du corps touchée.', 'PROPOSITION (hors des 10 références citées, repère générique d''exercice thérapeutique — à valider) — douleur articulaire > 6/10, gonflement nouveau pendant l''exercice, signe de poussée.', null, null, null, null, '2026-08-19', 'pending_validation', '{aucun}');
insert into public.exercise_pathologies (exercise_id, pathology_code) values ('208903af-4b2b-4dd4-8ced-02ad030d014a', 'POLYARTHRITE_RHUMATOIDE');
insert into public.exercise_objectives (exercise_id, objective_code) values ('208903af-4b2b-4dd4-8ced-02ad030d014a', 'AMELIORER_FORCE');
insert into public.exercise_references (exercise_id, reference_id) select '208903af-4b2b-4dd4-8ced-02ad030d014a', id from public.scientific_references where doi = '10.1002/acr.25117';
insert into public.exercise_references (exercise_id, reference_id) select '208903af-4b2b-4dd4-8ced-02ad030d014a', id from public.scientific_references where doi = '10.1016/j.ard.2026.03.006';
insert into public.exercise_library (exercise_id, name, short_description, detailed_description, category, difficulty, starting_position, execution_steps, breathing_instruction, duration_seconds, repetitions, sets, rest_time_seconds, frequency, intensity, progression, regression, contraindications, precautions, stop_criteria, target_muscles, video_url, audio_url, thumbnail_url, last_reviewed, medical_validation_status, equipment_required) values ('81dc6666-8d7f-49ce-b6e3-50d5ef921690', 'Renforcement musculaire avec mise en charge (ostéoporose)', 'Exercice de renforcement en charge, composante de la prévention des fractures ostéoporotiques.', 'D''après LeBoff et al. 2022 (Bone Health and Osteoporosis Foundation, Clinician''s Guide) : l''exercice en charge (« weight-bearing ») et de renforcement musculaire (« resistance-training ») fait partie de l''arsenal de prévention des fractures, aux côtés du traitement pharmacologique, des apports en calcium/vitamine D et de la prévention des chutes.', 'renforcement', null, null, null, null, null, null, null, null, null, 'D''après Hoffmann et al. 2023 (DOI 10.1007/s00198-022-06592-8, texte intégral vérifié le 23/08/2026 — précédemment bloqué, méta-analyse de 11 essais, 9715 participant-années groupe exercice) : l''exercice réduit les fractures ostéoporotiques majeures d''environ 23 % (RR 0,75 ; IC95 % 0,54-0,94 ; p=.006). La progression d''intensité montrait une tendance plus favorable, non statistiquement significative (p=.133 ; 5 études avec progression vs 6 à intensité constante) ; la durée du programme n''avait pas d''effet significatif non plus (p=.883 ; études de 6 mois à 16 ans). Les auteurs concluent EUX-MÊMES que l''hétérogénéité des protocoles empêche de dériver une recommandation fiable de fréquence/intensité/durée — à définir par le concepteur médical malgré cette lecture complète. PROPOSITION (hors des 10 références citées, repère générique d''exercice thérapeutique — à valider) — valeur cible proposée (méthode réf. B6) : Borg CR10 ≈ 2-4 selon niveau, sans mouvement de flexion chargée du tronc (cf. contre-indications).', 'D''après Hoffmann et al. 2023 (DOI 10.1007/s00198-022-06592-8, texte intégral vérifié le 23/08/2026 — précédemment bloqué, méta-analyse de 11 essais, 9715 participant-années groupe exercice) : l''exercice réduit les fractures ostéoporotiques majeures d''environ 23 % (RR 0,75 ; IC95 % 0,54-0,94 ; p=.006). La progression d''intensité montrait une tendance plus favorable, non statistiquement significative (p=.133 ; 5 études avec progression vs 6 à intensité constante) ; la durée du programme n''avait pas d''effet significatif non plus (p=.883 ; études de 6 mois à 16 ans). Les auteurs concluent EUX-MÊMES que l''hétérogénéité des protocoles empêche de dériver une recommandation fiable de fréquence/intensité/durée — à définir par le concepteur médical malgré cette lecture complète.', null, 'D''après LeBoff et al. 2022 (Bone Health and Osteoporosis Foundation, Clinician''s Guide) : les mouvements de flexion importante du tronc (flexion rachidienne) augmentent le risque de fracture vertébrale, tandis que les mouvements d''extension du rachis le diminuent. Cette information provient de la description d''une figure dans l''abstract — à vérifier sur le texte intégral et à préciser (quels mouvements exactement, quel degré de flexion) avant validation.', 'Contenu dérivé de la description d''une figure dans l''abstract — à vérifier sur le texte intégral avant validation.', 'PROPOSITION (hors des 10 références citées, repère générique d''exercice thérapeutique — à valider) — douleur dorsale/lombaire aiguë nouvelle (signe d''alerte de fracture vertébrale — nécessite une évaluation médicale avant poursuite), douleur > 6/10.', null, null, null, null, '2026-08-19', 'pending_validation', '{aucun}');
insert into public.exercise_pathologies (exercise_id, pathology_code) values ('81dc6666-8d7f-49ce-b6e3-50d5ef921690', 'OSTEOPOROSE');
insert into public.exercise_objectives (exercise_id, objective_code) values ('81dc6666-8d7f-49ce-b6e3-50d5ef921690', 'AMELIORER_FORCE');
insert into public.exercise_objectives (exercise_id, objective_code) values ('81dc6666-8d7f-49ce-b6e3-50d5ef921690', 'MAINTENIR_AUTONOMIE');
insert into public.exercise_references (exercise_id, reference_id) select '81dc6666-8d7f-49ce-b6e3-50d5ef921690', id from public.scientific_references where doi = '10.1007/s00198-021-05900-y';
insert into public.exercise_references (exercise_id, reference_id) select '81dc6666-8d7f-49ce-b6e3-50d5ef921690', id from public.scientific_references where doi = '10.1007/s00198-022-06592-8';
insert into public.exercise_library (exercise_id, name, short_description, detailed_description, category, difficulty, starting_position, execution_steps, breathing_instruction, duration_seconds, repetitions, sets, rest_time_seconds, frequency, intensity, progression, regression, contraindications, precautions, stop_criteria, target_muscles, video_url, audio_url, thumbnail_url, last_reviewed, medical_validation_status, equipment_required) values ('3bf422dc-88d8-44d9-a656-d6ddfaddb74b', 'Exercices d''extension du rachis (ostéoporose)', 'Renforcement des extenseurs du rachis ; orientation posturale favorable selon LeBoff et al. 2022.', 'D''après LeBoff et al. 2022 : les figures de l''article associent les mouvements d''extension du rachis à une diminution du risque de fracture vertébrale, à l''inverse de la flexion importante du tronc. Exercice précis, position et amplitude restent à définir par le concepteur médical.', 'renforcement', null, null, null, null, null, null, null, null, null, 'D''après Hoffmann et al. 2023 (DOI 10.1007/s00198-022-06592-8, texte intégral vérifié le 23/08/2026 — précédemment bloqué, méta-analyse de 11 essais, 9715 participant-années groupe exercice) : l''exercice réduit les fractures ostéoporotiques majeures d''environ 23 % (RR 0,75 ; IC95 % 0,54-0,94 ; p=.006). La progression d''intensité montrait une tendance plus favorable, non statistiquement significative (p=.133 ; 5 études avec progression vs 6 à intensité constante) ; la durée du programme n''avait pas d''effet significatif non plus (p=.883 ; études de 6 mois à 16 ans). Les auteurs concluent EUX-MÊMES que l''hétérogénéité des protocoles empêche de dériver une recommandation fiable de fréquence/intensité/durée — à définir par le concepteur médical malgré cette lecture complète. PROPOSITION (hors des 10 références citées, repère générique d''exercice thérapeutique — à valider) — valeur cible proposée (méthode réf. B6) : Borg CR10 ≈ 2-4 selon niveau.', 'D''après Hoffmann et al. 2023 (DOI 10.1007/s00198-022-06592-8, texte intégral vérifié le 23/08/2026 — précédemment bloqué, méta-analyse de 11 essais, 9715 participant-années groupe exercice) : l''exercice réduit les fractures ostéoporotiques majeures d''environ 23 % (RR 0,75 ; IC95 % 0,54-0,94 ; p=.006). La progression d''intensité montrait une tendance plus favorable, non statistiquement significative (p=.133 ; 5 études avec progression vs 6 à intensité constante) ; la durée du programme n''avait pas d''effet significatif non plus (p=.883 ; études de 6 mois à 16 ans). Les auteurs concluent EUX-MÊMES que l''hétérogénéité des protocoles empêche de dériver une recommandation fiable de fréquence/intensité/durée — à définir par le concepteur médical malgré cette lecture complète.', null, 'D''après LeBoff et al. 2022 (Bone Health and Osteoporosis Foundation, Clinician''s Guide) : les mouvements de flexion importante du tronc (flexion rachidienne) augmentent le risque de fracture vertébrale, tandis que les mouvements d''extension du rachis le diminuent. Cette information provient de la description d''une figure dans l''abstract — à vérifier sur le texte intégral et à préciser (quels mouvements exactement, quel degré de flexion) avant validation.', 'Contenu dérivé de la description d''une figure dans l''abstract — à vérifier sur le texte intégral avant validation.', 'PROPOSITION (hors des 10 références citées, repère générique d''exercice thérapeutique — à valider) — douleur dorsale/lombaire aiguë nouvelle (signe d''alerte de fracture vertébrale — nécessite une évaluation médicale avant poursuite), douleur > 6/10.', null, null, null, null, '2026-08-19', 'pending_validation', '{aucun}');
insert into public.exercise_pathologies (exercise_id, pathology_code) values ('3bf422dc-88d8-44d9-a656-d6ddfaddb74b', 'OSTEOPOROSE');
insert into public.exercise_objectives (exercise_id, objective_code) values ('3bf422dc-88d8-44d9-a656-d6ddfaddb74b', 'MAINTENIR_AUTONOMIE');
insert into public.exercise_references (exercise_id, reference_id) select '3bf422dc-88d8-44d9-a656-d6ddfaddb74b', id from public.scientific_references where doi = '10.1007/s00198-021-05900-y';
insert into public.exercise_library (exercise_id, name, short_description, detailed_description, category, difficulty, starting_position, execution_steps, breathing_instruction, duration_seconds, repetitions, sets, rest_time_seconds, frequency, intensity, progression, regression, contraindications, precautions, stop_criteria, target_muscles, video_url, audio_url, thumbnail_url, last_reviewed, medical_validation_status, equipment_required) values ('b9475f5e-4c07-4da5-ba9a-925736870ec5', 'Activité physique adaptée générale (spondyloarthrite axiale)', 'Activité physique générale adaptée, encadrée par les principes généraux EULAR 2025/2026 pour l''arthrite inflammatoire — PAS un programme spécifique à la spondyloarthrite axiale.', 'D''après EULAR 2025/2026 (texte intégral vérifié) : la spondyloarthrite axiale (axSpA) fait partie du périmètre « arthrite inflammatoire » (IA) couvert par ce document, au même titre que la polyarthrite rhumatoïde. Les principes généraux s''appliquent donc (promotion de l''AP comme partie intégrante des soins standards, 4 domaines — cardiorespiratoire, force musculaire, flexibilité, performance neuromotrice — tous jugés applicables et sûrs). Complément d''après ASAS-EULAR 2022 (Ramiro et al., DOI 10.1136/ard-2022-223296, texte intégral vérifié le 23/08/2026 — précédemment bloqué), Recommandation 4 : « Patients should be educated about axSpA and encouraged to exercise on a regular basis... physiotherapy should be considered. » L''exercice y est qualifié de « pilier » de la prise en charge, avec des bénéfices indépendants du traitement pharmacologique ; l''adhérence et l''efficacité sont rapportées comme meilleures en cas de supervision (« Physiotherapy, specifically supervised exercise, has also proven to be more efficacious than home exercises ») — point de vigilance direct pour un exercice réalisé seul via cette application. ATTENTION : ni EULAR 2025/2026 ni ASAS-EULAR 2022 ne fournissent de contenu spécifique à la mobilité rachidienne, aux exercices respiratoires ou de posture, pourtant classiquement centraux dans la prise en charge de l''axSpA — confirmé sur les deux références, ce n''est pas un accès bloqué mais un vide de contenu constaté.', 'aerobique', null, null, null, null, null, null, null, null, null, 'D''après EULAR 2025/2026 (texte intégral) : chez les personnes déconditionnées ou avec limitations fonctionnelles importantes, l''exercice à intensité modérée ou vigoureuse peut être initialement trop épuisant. Il est jugé approprié de débuter avec une dose plus faible, bien tolérée, puis d''augmenter progressivement la durée ou la charge sur les 4 à 6 premières semaines. Au-delà de ce principe, les paramètres FITT-VP exacts (fréquence, intensité, temps, type, volume, progression) doivent être définis individuellement par le professionnel de santé (Recommandation 7 du document) — aucun chiffre cible générique (ex. % FC max, minutes/semaine) n''est fourni par cette référence.', 'D''après EULAR 2025/2026 (texte intégral) : chez les personnes déconditionnées ou avec limitations fonctionnelles importantes, l''exercice à intensité modérée ou vigoureuse peut être initialement trop épuisant. Il est jugé approprié de débuter avec une dose plus faible, bien tolérée, puis d''augmenter progressivement la durée ou la charge sur les 4 à 6 premières semaines. Au-delà de ce principe, les paramètres FITT-VP exacts (fréquence, intensité, temps, type, volume, progression) doivent être définis individuellement par le professionnel de santé (Recommandation 7 du document) — aucun chiffre cible générique (ex. % FC max, minutes/semaine) n''est fourni par cette référence.', null, 'D''après EULAR 2025/2026 (Rausch Osthoff et al., Ann Rheum Dis 2026;85:1026-1038 — texte intégral vérifié, section « Recommendation 4 ») : il n''existe pas de contre-indication spécifique à la pathologie pour l''activité physique en tant que telle chez les personnes avec arthrite inflammatoire ou arthrose (« there are no disease-specific contraindications for PA per se » — cette contre-indication figurait dans la version 2018 des recommandations EULAR mais a été retirée en 2025/2026, faute de preuve). En revanche, l''intensité doit être adaptée à l''activité de la maladie et à l''état de santé du moment : en cas d''atteinte d''une articulation donnée (ex. genou gonflé), éviter l''exercice de forte intensité impliquant spécifiquement cette zone ; l''exercice de forte intensité reste possible sur les zones non atteintes (ex. membres supérieurs à la place des membres inférieurs).', 'D''après EULAR 2025/2026 (texte intégral) : les effets indésirables rapportés dans les études sur l''arthrite inflammatoire et l''arthrose sont transitoires et légers (ex. douleur musculaire, fatigue) ; aucun effet délétère de l''exercice sur l''activité de la maladie n''est rapporté. Une augmentation transitoire de la douleur dans les 48 à 72 heures suivant l''exercice peut être normale (courbatures/DOMS), en particulier chez les personnes novices en exercice. En cas de poussée, les activités de forte intensité peuvent devenir impossibles, mais des activités de plus faible intensité (marche, exercices d''amplitude articulaire) restent le plus souvent possibles — à adapter selon la zone du corps touchée. Complément ASAS-EULAR 2022 (texte intégral vérifié le 23/08/2026) : l''exercice supervisé (kinésithérapie) est rapporté plus efficace que l''exercice seul à domicile — à prendre en compte pour un usage en autonomie via cette application. Rappel : aucune adaptation spécifique à l''atteinte axiale/rachidienne n''a pu être vérifiée dans l''une ou l''autre référence (cf. detailed_description) — à valider impérativement avant tout usage clinique.', 'PROPOSITION (hors des 10 références citées, repère générique d''exercice thérapeutique — à valider) — douleur rachidienne > 6/10, raideur empêchant la poursuite de l''exercice.', null, null, null, null, '2026-08-19', 'pending_validation', '{aucun}');
insert into public.exercise_pathologies (exercise_id, pathology_code) values ('b9475f5e-4c07-4da5-ba9a-925736870ec5', 'SPONDYLOARTHRITE_AXIALE');
insert into public.exercise_objectives (exercise_id, objective_code) values ('b9475f5e-4c07-4da5-ba9a-925736870ec5', 'REDUIRE_SEDENTARITE');
insert into public.exercise_objectives (exercise_id, objective_code) values ('b9475f5e-4c07-4da5-ba9a-925736870ec5', 'AMELIORER_CONDITION_PHYSIQUE');
insert into public.exercise_references (exercise_id, reference_id) select 'b9475f5e-4c07-4da5-ba9a-925736870ec5', id from public.scientific_references where doi = '10.1016/j.ard.2026.03.006';
insert into public.exercise_references (exercise_id, reference_id) select 'b9475f5e-4c07-4da5-ba9a-925736870ec5', id from public.scientific_references where doi = '10.1136/ard-2022-223296';

-- ===== SEED : 0011_exercises_validation_dr_nikiema_20260823.sql =====
-- Sprint 17 (intégration) — Validation médicale des 8 exercices brouillon.
--
-- Contexte : les 8 exercices ont été rédigés au Sprint 5bis/5ter (19/08/2026,
-- fichier 0010_exercises_pending_validation_20260819.sql) à partir des 10
-- références du §81, puis relus par Dr Nikiema dans
-- RELECTURE_EXERCICES_20260823_AVEC_PROPOSITIONS.docx (contenu complété le
-- 23/08/2026 par des propositions de l'assistant sur repères génériques —
-- ACSM, échelle de Borg — clairement identifiées "PROPOSITION" dans le
-- document, à la demande explicite de Dr Nikiema).
--
-- Dr Nikiema a répondu "Je valide. Tu peux les intégrer" (23/08/2026) : ce
-- fichier fait passer les 8 exercices de pending_validation à validated. Ils
-- ne restent PAS silencieusement modifiés : le texte des champs (y compris
-- les propositions) n'est pas touché ici, seul le statut change, conformément
-- à la traçabilité exigée (§57, §59, §78 — ne jamais écraser sans historique).
-- On ne fait pas non plus de DELETE/ré-écriture de 0010 : ce fichier est un
-- UPDATE qui s'ajoute à la suite, comme convenu pour tout contenu superseded.
--
-- Les identifiants ci-dessous sont ceux réellement chargés en base par 0010
-- (vérifiés par requête sur exercise_library avant écriture de ce fichier).

update public.exercise_library
set medical_validation_status = 'validated',
    last_reviewed = current_date,
    updated_at = now()
where exercise_id in (
  'd6f353e0-9442-4bf2-9c6f-3ae2d3414039',
  '8ec87752-fd97-4cf9-be89-d7a43e4f9672',
  '1933750b-d11a-4324-8af6-200d2cd34618',
  '4c7c37e4-da9f-4893-87af-0f03562273a4',
  '208903af-4b2b-4dd4-8ced-02ad030d014a',
  '81dc6666-8d7f-49ce-b6e3-50d5ef921690',
  '3bf422dc-88d8-44d9-a656-d6ddfaddb74b',
  'b9475f5e-4c07-4da5-ba9a-925736870ec5'
)
and medical_validation_status <> 'validated';

-- ===== SEED : 0012_programs_validation_dr_nikiema_20260823.sql =====
-- Sprint 17 (intégration) — Contenu des 18 programmes FITT-VP, validé par
-- Dr Nikiema le 23/08/2026 ("Je valide. Tu peux les intégrer"), tel que
-- délivré dans QUESTIONS_PROGRAMMES_FITTVP_20260823_AVEC_PROPOSITIONS.docx.
--
-- Provenance à retenir (cf. docs/DECISIONS.md, Sprint 17) : une partie du
-- contenu est directement issue des 10 références du §81 (citée précisément
-- dans chaque champ concerné) ; une autre partie est une PROPOSITION de
-- l'assistant sur repères génériques d'exercice thérapeutique (ACSM, échelle
-- de Borg, règle de progression usuelle de 5 à 10 %/semaine) faite à la
-- demande explicite de Dr Nikiema et explicitement validée par lui — ce n'est
-- pas une donnée probante pathologie-spécifique. Les deux provenances sont
-- conservées telles quelles dans le texte des champs ci-dessous (préfixe
-- "PROPOSITION (...)" quand c'est le cas), pour une traçabilité complète.
--
-- duration_weeks et frequency_per_week : les propositions sources sont des
-- plages narratives (ex. "8 à 12 semaines", "3 à 4 séances/semaine") alors
-- que la colonne est un entier. Choix retenu (borne basse, la plus prudente,
-- cohérent avec la logique de réévaluation fréquente déjà en place) :
-- duration_weeks = 8 pour les 3 niveaux ; frequency_per_week = 2 / 3 / 4 pour
-- débutant / intermédiaire / avancé. La plage complète reste lisible dans les
-- champs texte (intensity, progression_rule, etc.) pour ne pas perdre la
-- nuance clinique.

insert into public.programs
  (program_code, pathology, profile_level, objective, duration_weeks, frequency_per_week,
   intensity, aerobic_component, strength_component, mobility_component, balance_component,
   functional_component, progression_rule, regression_rule, safety_rules, version, medical_validation_status)
values
  ('LOMBALGIE_COMMUNE_DEBUTANT_01', 'LOMBALGIE_COMMUNE', 'debutant', 'REPRENDRE_ACTIVITE_PROGRESSIVEMENT', 8, 2, 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Valeur cible proposée (méthode déjà fixée réf. B6) : intensité légère, Borg CR10 ≈ 2-3 (ou Borg 6-20 ≈ 10-11) : effort perceptible mais confortable, talk test largement positif (parle sans difficulté). Marche continue 10 à 15 minutes en une fois.', 'D''après George et al. 2021 (JOSPT, recommandation A, niveau de preuve fort) : l''exercice aérobique fait partie de l''« exercice général » recommandé, sans supériorité démontrée par rapport aux autres approches (renforcement du tronc, exercice aquatique, multimodal).', 'D''après George et al. 2021 : renforcement/endurance du tronc et des grands groupes musculaires des membres, recommandation A. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Modalité usuelle proposée : 2 à 3 séries de 8 à 12 répétitions, 1 à 2 minutes de repos entre séries, sans matériel ou avec élastique/poids du corps.', 'D''après George et al. 2021 : exercices de flexibilité/mobilité inclus dans l''« exercice général » recommandé (recommandation A), sans détail supplémentaire. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Contenu usuel proposé : mobilité active du rachis lombaire et des hanches (flexion/extension/rotation douces dans l''amplitude non douloureuse), 5 à 10 minutes en échauffement.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Non spécifique à la lombalgie dans les 3 références, mais intégré par prudence générale (prévention de chute, population souvent sédentaire) : 5 à 10 minutes d''exercices d''équilibre simple (appui unipodal tenu, transferts d''appui), 2 fois par semaine.', 'D''après George et al. 2021 (principe « rester actif », recommandation A) : PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — réintroduction progressive de gestes du quotidien (se pencher, porter une charge légère) selon tolérance, en fin de programme.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Règle de progression usuelle en réadaptation : augmenter le volume (durée ou charge), pas l''intensité et le volume en même temps, de 5 à 10 % par semaine si bonne tolérance (pas d''aggravation de la douleur au-delà de 24h, pas de nouveau signal d''alerte) ; réévaluer tous les 15 jours plutôt qu''à chaque séance.', 'Par défaut (B9)', 'D''après George et al. 2021 (JOSPT), section Patient Education (recommandation, niveau de preuve B) : ne pas augmenter la perception de menace/peur (éviter le repos au lit prolongé, éviter les explications pathoanatomiques poussées) ; insister sur le pronostic globalement favorable et l''importance de rester actif. Cohérent avec Knezevic et al. 2021 (Lancet), qui situe les approches non pharmacologiques en première ligne dans un modèle biopsychosocial, sans dosage précis. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Critère d''arrêt usuel proposé : douleur > 6/10 en cours d''exercice, douleur irradiante nouvelle ou aggravée, essoufflement empêchant de parler.', 'V1.0', 'validated'),
  ('LOMBALGIE_COMMUNE_INTERMEDIAIRE_01', 'LOMBALGIE_COMMUNE', 'intermediaire', 'REDUIRE_SEDENTARITE', 8, 3, 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Valeur cible proposée (méthode déjà fixée réf. B6) : intensité modérée, Borg CR10 ≈ 3-4 (ou Borg 6-20 ≈ 12-13) : talk test positif (parle mais ne chante pas). Marche continue 20 à 25 minutes, ou fractionnée équivalente.', 'D''après George et al. 2021 (JOSPT, recommandation A, niveau de preuve fort) : l''exercice aérobique fait partie de l''« exercice général » recommandé, sans supériorité démontrée par rapport aux autres approches (renforcement du tronc, exercice aquatique, multimodal).', 'D''après George et al. 2021 : renforcement/endurance du tronc et des grands groupes musculaires des membres, recommandation A. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Modalité usuelle proposée : 2 à 3 séries de 8 à 12 répétitions, 1 à 2 minutes de repos entre séries, sans matériel ou avec élastique/poids du corps.', 'D''après George et al. 2021 : exercices de flexibilité/mobilité inclus dans l''« exercice général » recommandé (recommandation A), sans détail supplémentaire. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Contenu usuel proposé : mobilité active du rachis lombaire et des hanches (flexion/extension/rotation douces dans l''amplitude non douloureuse), 5 à 10 minutes en échauffement.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Non spécifique à la lombalgie dans les 3 références, mais intégré par prudence générale (prévention de chute, population souvent sédentaire) : 5 à 10 minutes d''exercices d''équilibre simple (appui unipodal tenu, transferts d''appui), 2 fois par semaine.', 'D''après George et al. 2021 (principe « rester actif », recommandation A) : PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — réintroduction progressive de gestes du quotidien (se pencher, porter une charge légère) selon tolérance, en fin de programme.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Règle de progression usuelle en réadaptation : augmenter le volume (durée ou charge), pas l''intensité et le volume en même temps, de 5 à 10 % par semaine si bonne tolérance (pas d''aggravation de la douleur au-delà de 24h, pas de nouveau signal d''alerte) ; réévaluer tous les 15 jours plutôt qu''à chaque séance.', 'Par défaut (B9)', 'D''après George et al. 2021 (JOSPT), section Patient Education (recommandation, niveau de preuve B) : ne pas augmenter la perception de menace/peur (éviter le repos au lit prolongé, éviter les explications pathoanatomiques poussées) ; insister sur le pronostic globalement favorable et l''importance de rester actif. Cohérent avec Knezevic et al. 2021 (Lancet), qui situe les approches non pharmacologiques en première ligne dans un modèle biopsychosocial, sans dosage précis. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Critère d''arrêt usuel proposé : douleur > 6/10 en cours d''exercice, douleur irradiante nouvelle ou aggravée, essoufflement empêchant de parler.', 'V1.0', 'validated'),
  ('LOMBALGIE_COMMUNE_AVANCE_01', 'LOMBALGIE_COMMUNE', 'avance', 'AMELIORER_CONDITION_PHYSIQUE', 8, 4, 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Valeur cible proposée (méthode déjà fixée réf. B6) : intensité modérée à modérément soutenue, Borg CR10 ≈ 4-5 (ou Borg 6-20 ≈ 13-14), sans dépasser ce palier par prudence en pathologie rhumatologique ; talk test à la limite (phrases courtes). Marche continue 25 à 35 minutes ; ne pas dépasser ce palier d''intensité pour cette pathologie (absence de risque cardiovasculaire spécifique documenté dans les 3 références, mais absence aussi de justification à aller au-delà).', 'D''après George et al. 2021 (JOSPT, recommandation A, niveau de preuve fort) : l''exercice aérobique fait partie de l''« exercice général » recommandé, sans supériorité démontrée par rapport aux autres approches (renforcement du tronc, exercice aquatique, multimodal).', 'D''après George et al. 2021 : renforcement/endurance du tronc et des grands groupes musculaires des membres, recommandation A. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Modalité usuelle proposée : 2 à 3 séries de 8 à 12 répétitions, 1 à 2 minutes de repos entre séries, sans matériel ou avec élastique/poids du corps.', 'D''après George et al. 2021 : exercices de flexibilité/mobilité inclus dans l''« exercice général » recommandé (recommandation A), sans détail supplémentaire. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Contenu usuel proposé : mobilité active du rachis lombaire et des hanches (flexion/extension/rotation douces dans l''amplitude non douloureuse), 5 à 10 minutes en échauffement.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Non spécifique à la lombalgie dans les 3 références, mais intégré par prudence générale (prévention de chute, population souvent sédentaire) : 5 à 10 minutes d''exercices d''équilibre simple (appui unipodal tenu, transferts d''appui), 2 fois par semaine.', 'D''après George et al. 2021 (principe « rester actif », recommandation A) : PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — réintroduction progressive de gestes du quotidien (se pencher, porter une charge légère) selon tolérance, en fin de programme.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Règle de progression usuelle en réadaptation : augmenter le volume (durée ou charge), pas l''intensité et le volume en même temps, de 5 à 10 % par semaine si bonne tolérance (pas d''aggravation de la douleur au-delà de 24h, pas de nouveau signal d''alerte) ; réévaluer tous les 15 jours plutôt qu''à chaque séance.', 'Par défaut (B9)', 'D''après George et al. 2021 (JOSPT), section Patient Education (recommandation, niveau de preuve B) : ne pas augmenter la perception de menace/peur (éviter le repos au lit prolongé, éviter les explications pathoanatomiques poussées) ; insister sur le pronostic globalement favorable et l''importance de rester actif. Cohérent avec Knezevic et al. 2021 (Lancet), qui situe les approches non pharmacologiques en première ligne dans un modèle biopsychosocial, sans dosage précis. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Critère d''arrêt usuel proposé : douleur > 6/10 en cours d''exercice, douleur irradiante nouvelle ou aggravée, essoufflement empêchant de parler.', 'V1.0', 'validated'),
  ('ARTHROSE_GENOU_DEBUTANT_01', 'ARTHROSE_GENOU', 'debutant', 'REDUIRE_SEDENTARITE', 8, 2, 'D''après EULAR 2025/2026 (Recommandation 7, texte intégral vérifié) : débuter à une dose plus faible, bien tolérée, chez les personnes déconditionnées ou avec limitations fonctionnelles importantes. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Valeur cible proposée (méthode déjà fixée réf. B6) : intensité légère, Borg CR10 ≈ 2-3 (ou Borg 6-20 ≈ 10-11) : effort perceptible mais confortable, talk test largement positif (parle sans difficulté).', 'D''après Kolasinski et al. 2019 (ACR/Arthritis Foundation, recommandation FORTE) : la marche est une option d''exercice aérobique de première intention, sans hiérarchie par rapport au renforcement ou à l''exercice aquatique. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Modalité usuelle proposée : marche 15 à 30 minutes selon niveau, ou vélo stationnaire à faible résistance si douleur à la marche.', 'D''après Kolasinski et al. 2019 : renforcement musculaire recommandé en première intention (recommandation FORTE), sans hiérarchie de modalité. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Modalité usuelle proposée : quadriceps/fessiers/ischio-jambiers, 2 à 3 séries de 8 à 12 répétitions, chaise/poids du corps, 1 à 2 minutes de repos entre séries.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Ni Kolasinski et al. 2019 ni EULAR 2025/2026 ne détaillent d''exercice de mobilité spécifique. Contenu usuel proposé : mobilisation active du genou en amplitude non douloureuse (flexion/extension assise), 5 à 10 minutes en échauffement.', 'D''après Kolasinski et al. 2019 : l''entraînement neuromusculaire fait partie des options recommandées (recommandation FORTE), sans détail sur le contenu précis. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Contenu usuel proposé : appui unipodal tenu (avec appui de sécurité type chaise/mur), transferts d''appui, 5 à 10 minutes, 2 fois par semaine.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Non détaillé par les 2 références. Contenu usuel proposé : lever de chaise, montée/descente de marche, selon tolérance, introduits en phase intermédiaire/avancée.', 'D''après EULAR 2025/2026 (Recommandation 7) : chez les personnes déconditionnées, débuter à dose plus faible puis augmenter progressivement la durée ou la charge sur les 4 à 6 premières semaines. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Au-delà, progression usuelle : +5 à 10 % du volume par semaine si bonne tolérance, réévaluation tous les 15 jours.', 'Par défaut (B9), complété par la « règle des 24 heures » d''EULAR 2025/2026 : si l''augmentation de la douleur persiste au-delà de 24h après l''exercice, réduire l''intensité.', 'D''après EULAR 2025/2026 (Recommandation 4, texte intégral vérifié) : aucune contre-indication spécifique à la pathologie pour l''activité physique elle-même (contre-indication retirée en 2025/2026, présente dans la version 2018) ; adapter l''intensité selon l''articulation/la zone atteinte (éviter la forte intensité sur une zone atteinte, ex. genou gonflé — les zones non atteintes restent praticables à forte intensité). Effets indésirables rapportés transitoires et légers (douleur musculaire, fatigue). PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Critère d''arrêt usuel proposé : douleur articulaire > 5-6/10 en cours d''exercice, gonflement articulaire aigu nouveau.', 'V1.0', 'validated'),
  ('ARTHROSE_GENOU_INTERMEDIAIRE_01', 'ARTHROSE_GENOU', 'intermediaire', 'AMELIORER_MOBILITE', 8, 3, 'D''après EULAR 2025/2026 : augmentation progressive de la durée ou de la charge sur les 4 à 6 premières semaines. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Valeur cible proposée (méthode déjà fixée réf. B6) : intensité modérée, Borg CR10 ≈ 3-4 (ou Borg 6-20 ≈ 12-13) : talk test positif (parle mais ne chante pas).', 'D''après Kolasinski et al. 2019 (ACR/Arthritis Foundation, recommandation FORTE) : la marche est une option d''exercice aérobique de première intention, sans hiérarchie par rapport au renforcement ou à l''exercice aquatique. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Modalité usuelle proposée : marche 15 à 30 minutes selon niveau, ou vélo stationnaire à faible résistance si douleur à la marche.', 'D''après Kolasinski et al. 2019 : renforcement musculaire recommandé en première intention (recommandation FORTE), sans hiérarchie de modalité. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Modalité usuelle proposée : quadriceps/fessiers/ischio-jambiers, 2 à 3 séries de 8 à 12 répétitions, chaise/poids du corps, 1 à 2 minutes de repos entre séries.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Ni Kolasinski et al. 2019 ni EULAR 2025/2026 ne détaillent d''exercice de mobilité spécifique. Contenu usuel proposé : mobilisation active du genou en amplitude non douloureuse (flexion/extension assise), 5 à 10 minutes en échauffement.', 'D''après Kolasinski et al. 2019 : l''entraînement neuromusculaire fait partie des options recommandées (recommandation FORTE), sans détail sur le contenu précis. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Contenu usuel proposé : appui unipodal tenu (avec appui de sécurité type chaise/mur), transferts d''appui, 5 à 10 minutes, 2 fois par semaine.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Non détaillé par les 2 références. Contenu usuel proposé : lever de chaise, montée/descente de marche, selon tolérance, introduits en phase intermédiaire/avancée.', 'D''après EULAR 2025/2026 (Recommandation 7) : chez les personnes déconditionnées, débuter à dose plus faible puis augmenter progressivement la durée ou la charge sur les 4 à 6 premières semaines. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Au-delà, progression usuelle : +5 à 10 % du volume par semaine si bonne tolérance, réévaluation tous les 15 jours.', 'Par défaut (B9), complété par la « règle des 24 heures » d''EULAR 2025/2026 : si l''augmentation de la douleur persiste au-delà de 24h après l''exercice, réduire l''intensité.', 'D''après EULAR 2025/2026 (Recommandation 4, texte intégral vérifié) : aucune contre-indication spécifique à la pathologie pour l''activité physique elle-même (contre-indication retirée en 2025/2026, présente dans la version 2018) ; adapter l''intensité selon l''articulation/la zone atteinte (éviter la forte intensité sur une zone atteinte, ex. genou gonflé — les zones non atteintes restent praticables à forte intensité). Effets indésirables rapportés transitoires et légers (douleur musculaire, fatigue). PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Critère d''arrêt usuel proposé : douleur articulaire > 5-6/10 en cours d''exercice, gonflement articulaire aigu nouveau.', 'V1.0', 'validated'),
  ('ARTHROSE_GENOU_AVANCE_01', 'ARTHROSE_GENOU', 'avance', 'AMELIORER_FORCE', 8, 4, 'D''après EULAR 2025/2026 : au-delà de la période de progression initiale (4-6 semaines), les paramètres FITT-VP exacts restent délégués au professionnel de santé (Recommandation 7). PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Valeur cible proposée (méthode déjà fixée réf. B6) : intensité modérée à modérément soutenue, Borg CR10 ≈ 4-5 (ou Borg 6-20 ≈ 13-14), sans dépasser ce palier par prudence en pathologie rhumatologique ; talk test à la limite (phrases courtes).', 'D''après Kolasinski et al. 2019 (ACR/Arthritis Foundation, recommandation FORTE) : la marche est une option d''exercice aérobique de première intention, sans hiérarchie par rapport au renforcement ou à l''exercice aquatique. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Modalité usuelle proposée : marche 15 à 30 minutes selon niveau, ou vélo stationnaire à faible résistance si douleur à la marche.', 'D''après Kolasinski et al. 2019 : renforcement musculaire recommandé en première intention (recommandation FORTE), sans hiérarchie de modalité. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Modalité usuelle proposée : quadriceps/fessiers/ischio-jambiers, 2 à 3 séries de 8 à 12 répétitions, chaise/poids du corps, 1 à 2 minutes de repos entre séries.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Ni Kolasinski et al. 2019 ni EULAR 2025/2026 ne détaillent d''exercice de mobilité spécifique. Contenu usuel proposé : mobilisation active du genou en amplitude non douloureuse (flexion/extension assise), 5 à 10 minutes en échauffement.', 'D''après Kolasinski et al. 2019 : l''entraînement neuromusculaire fait partie des options recommandées (recommandation FORTE), sans détail sur le contenu précis. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Contenu usuel proposé : appui unipodal tenu (avec appui de sécurité type chaise/mur), transferts d''appui, 5 à 10 minutes, 2 fois par semaine.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Non détaillé par les 2 références. Contenu usuel proposé : lever de chaise, montée/descente de marche, selon tolérance, introduits en phase intermédiaire/avancée.', 'D''après EULAR 2025/2026 (Recommandation 7) : chez les personnes déconditionnées, débuter à dose plus faible puis augmenter progressivement la durée ou la charge sur les 4 à 6 premières semaines. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Au-delà, progression usuelle : +5 à 10 % du volume par semaine si bonne tolérance, réévaluation tous les 15 jours.', 'Par défaut (B9), complété par la « règle des 24 heures » d''EULAR 2025/2026 : si l''augmentation de la douleur persiste au-delà de 24h après l''exercice, réduire l''intensité.', 'D''après EULAR 2025/2026 (Recommandation 4, texte intégral vérifié) : aucune contre-indication spécifique à la pathologie pour l''activité physique elle-même (contre-indication retirée en 2025/2026, présente dans la version 2018) ; adapter l''intensité selon l''articulation/la zone atteinte (éviter la forte intensité sur une zone atteinte, ex. genou gonflé — les zones non atteintes restent praticables à forte intensité). Effets indésirables rapportés transitoires et légers (douleur musculaire, fatigue). PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Critère d''arrêt usuel proposé : douleur articulaire > 5-6/10 en cours d''exercice, gonflement articulaire aigu nouveau.', 'V1.0', 'validated'),
  ('ARTHROSE_HANCHE_DEBUTANT_01', 'ARTHROSE_HANCHE', 'debutant', 'REDUIRE_SEDENTARITE', 8, 2, 'D''après EULAR 2025/2026 (Recommandation 7, texte intégral vérifié) : débuter à une dose plus faible, bien tolérée, chez les personnes déconditionnées ou avec limitations fonctionnelles importantes. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Valeur cible proposée (méthode déjà fixée réf. B6) : intensité légère, Borg CR10 ≈ 2-3 (ou Borg 6-20 ≈ 10-11) : effort perceptible mais confortable, talk test largement positif (parle sans difficulté).', 'D''après Kolasinski et al. 2019 (ACR/Arthritis Foundation, recommandation FORTE) : la marche est une option d''exercice aérobique de première intention, sans hiérarchie par rapport au renforcement ou à l''exercice aquatique. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Modalité usuelle proposée : marche 15 à 30 minutes selon niveau, ou vélo stationnaire à faible résistance si douleur à la marche.', 'D''après Kolasinski et al. 2019 : renforcement musculaire recommandé en première intention (recommandation FORTE), sans hiérarchie de modalité. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Modalité usuelle proposée : fessiers/abducteurs de hanche/quadriceps, 2 à 3 séries de 8 à 12 répétitions, chaise/poids du corps, 1 à 2 minutes de repos entre séries.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Ni Kolasinski et al. 2019 ni EULAR 2025/2026 ne détaillent d''exercice de mobilité spécifique. Contenu usuel proposé : mobilisation active de la hanche en amplitude non douloureuse, 5 à 10 minutes en échauffement.', 'D''après Kolasinski et al. 2019 : l''entraînement neuromusculaire fait partie des options recommandées (recommandation FORTE), sans détail sur le contenu précis. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Contenu usuel proposé : appui unipodal tenu (avec appui de sécurité), transferts d''appui, 5 à 10 minutes, 2 fois par semaine.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Non détaillé par les 2 références. Contenu usuel proposé : lever de chaise, montée/descente de marche, selon tolérance, introduits en phase intermédiaire/avancée.', 'D''après EULAR 2025/2026 (Recommandation 7) : chez les personnes déconditionnées, débuter à dose plus faible puis augmenter progressivement la durée ou la charge sur les 4 à 6 premières semaines. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Au-delà, progression usuelle : +5 à 10 % du volume par semaine si bonne tolérance, réévaluation tous les 15 jours.', 'Par défaut (B9), complété par la « règle des 24 heures » d''EULAR 2025/2026 : si l''augmentation de la douleur persiste au-delà de 24h après l''exercice, réduire l''intensité.', 'D''après EULAR 2025/2026 (Recommandation 4, texte intégral vérifié) : aucune contre-indication spécifique à la pathologie pour l''activité physique elle-même (contre-indication retirée en 2025/2026, présente dans la version 2018) ; adapter l''intensité selon l''articulation/la zone atteinte (éviter la forte intensité sur une zone atteinte, ex. genou gonflé — les zones non atteintes restent praticables à forte intensité). Effets indésirables rapportés transitoires et légers (douleur musculaire, fatigue). PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Critère d''arrêt usuel proposé : douleur articulaire > 5-6/10 en cours d''exercice, gonflement articulaire aigu nouveau.', 'V1.0', 'validated'),
  ('ARTHROSE_HANCHE_INTERMEDIAIRE_01', 'ARTHROSE_HANCHE', 'intermediaire', 'AMELIORER_MOBILITE', 8, 3, 'D''après EULAR 2025/2026 : augmentation progressive de la durée ou de la charge sur les 4 à 6 premières semaines. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Valeur cible proposée (méthode déjà fixée réf. B6) : intensité modérée, Borg CR10 ≈ 3-4 (ou Borg 6-20 ≈ 12-13) : talk test positif (parle mais ne chante pas).', 'D''après Kolasinski et al. 2019 (ACR/Arthritis Foundation, recommandation FORTE) : la marche est une option d''exercice aérobique de première intention, sans hiérarchie par rapport au renforcement ou à l''exercice aquatique. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Modalité usuelle proposée : marche 15 à 30 minutes selon niveau, ou vélo stationnaire à faible résistance si douleur à la marche.', 'D''après Kolasinski et al. 2019 : renforcement musculaire recommandé en première intention (recommandation FORTE), sans hiérarchie de modalité. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Modalité usuelle proposée : fessiers/abducteurs de hanche/quadriceps, 2 à 3 séries de 8 à 12 répétitions, chaise/poids du corps, 1 à 2 minutes de repos entre séries.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Ni Kolasinski et al. 2019 ni EULAR 2025/2026 ne détaillent d''exercice de mobilité spécifique. Contenu usuel proposé : mobilisation active de la hanche en amplitude non douloureuse, 5 à 10 minutes en échauffement.', 'D''après Kolasinski et al. 2019 : l''entraînement neuromusculaire fait partie des options recommandées (recommandation FORTE), sans détail sur le contenu précis. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Contenu usuel proposé : appui unipodal tenu (avec appui de sécurité), transferts d''appui, 5 à 10 minutes, 2 fois par semaine.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Non détaillé par les 2 références. Contenu usuel proposé : lever de chaise, montée/descente de marche, selon tolérance, introduits en phase intermédiaire/avancée.', 'D''après EULAR 2025/2026 (Recommandation 7) : chez les personnes déconditionnées, débuter à dose plus faible puis augmenter progressivement la durée ou la charge sur les 4 à 6 premières semaines. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Au-delà, progression usuelle : +5 à 10 % du volume par semaine si bonne tolérance, réévaluation tous les 15 jours.', 'Par défaut (B9), complété par la « règle des 24 heures » d''EULAR 2025/2026 : si l''augmentation de la douleur persiste au-delà de 24h après l''exercice, réduire l''intensité.', 'D''après EULAR 2025/2026 (Recommandation 4, texte intégral vérifié) : aucune contre-indication spécifique à la pathologie pour l''activité physique elle-même (contre-indication retirée en 2025/2026, présente dans la version 2018) ; adapter l''intensité selon l''articulation/la zone atteinte (éviter la forte intensité sur une zone atteinte, ex. genou gonflé — les zones non atteintes restent praticables à forte intensité). Effets indésirables rapportés transitoires et légers (douleur musculaire, fatigue). PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Critère d''arrêt usuel proposé : douleur articulaire > 5-6/10 en cours d''exercice, gonflement articulaire aigu nouveau.', 'V1.0', 'validated'),
  ('ARTHROSE_HANCHE_AVANCE_01', 'ARTHROSE_HANCHE', 'avance', 'AMELIORER_FORCE', 8, 4, 'D''après EULAR 2025/2026 : au-delà de la période de progression initiale (4-6 semaines), les paramètres FITT-VP exacts restent délégués au professionnel de santé (Recommandation 7). PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Valeur cible proposée (méthode déjà fixée réf. B6) : intensité modérée à modérément soutenue, Borg CR10 ≈ 4-5 (ou Borg 6-20 ≈ 13-14), sans dépasser ce palier par prudence en pathologie rhumatologique ; talk test à la limite (phrases courtes).', 'D''après Kolasinski et al. 2019 (ACR/Arthritis Foundation, recommandation FORTE) : la marche est une option d''exercice aérobique de première intention, sans hiérarchie par rapport au renforcement ou à l''exercice aquatique. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Modalité usuelle proposée : marche 15 à 30 minutes selon niveau, ou vélo stationnaire à faible résistance si douleur à la marche.', 'D''après Kolasinski et al. 2019 : renforcement musculaire recommandé en première intention (recommandation FORTE), sans hiérarchie de modalité. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Modalité usuelle proposée : fessiers/abducteurs de hanche/quadriceps, 2 à 3 séries de 8 à 12 répétitions, chaise/poids du corps, 1 à 2 minutes de repos entre séries.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Ni Kolasinski et al. 2019 ni EULAR 2025/2026 ne détaillent d''exercice de mobilité spécifique. Contenu usuel proposé : mobilisation active de la hanche en amplitude non douloureuse, 5 à 10 minutes en échauffement.', 'D''après Kolasinski et al. 2019 : l''entraînement neuromusculaire fait partie des options recommandées (recommandation FORTE), sans détail sur le contenu précis. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Contenu usuel proposé : appui unipodal tenu (avec appui de sécurité), transferts d''appui, 5 à 10 minutes, 2 fois par semaine.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Non détaillé par les 2 références. Contenu usuel proposé : lever de chaise, montée/descente de marche, selon tolérance, introduits en phase intermédiaire/avancée.', 'D''après EULAR 2025/2026 (Recommandation 7) : chez les personnes déconditionnées, débuter à dose plus faible puis augmenter progressivement la durée ou la charge sur les 4 à 6 premières semaines. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Au-delà, progression usuelle : +5 à 10 % du volume par semaine si bonne tolérance, réévaluation tous les 15 jours.', 'Par défaut (B9), complété par la « règle des 24 heures » d''EULAR 2025/2026 : si l''augmentation de la douleur persiste au-delà de 24h après l''exercice, réduire l''intensité.', 'D''après EULAR 2025/2026 (Recommandation 4, texte intégral vérifié) : aucune contre-indication spécifique à la pathologie pour l''activité physique elle-même (contre-indication retirée en 2025/2026, présente dans la version 2018) ; adapter l''intensité selon l''articulation/la zone atteinte (éviter la forte intensité sur une zone atteinte, ex. genou gonflé — les zones non atteintes restent praticables à forte intensité). Effets indésirables rapportés transitoires et légers (douleur musculaire, fatigue). PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Critère d''arrêt usuel proposé : douleur articulaire > 5-6/10 en cours d''exercice, gonflement articulaire aigu nouveau.', 'V1.0', 'validated'),
  ('POLYARTHRITE_RHUMATOIDE_DEBUTANT_01', 'POLYARTHRITE_RHUMATOIDE', 'debutant', 'REDUIRE_SEDENTARITE', 8, 2, 'D''après EULAR 2025/2026 (Recommandation 7, texte intégral vérifié) : débuter à une dose plus faible, bien tolérée, chez les personnes déconditionnées ou avec limitations fonctionnelles importantes. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Valeur cible proposée (méthode déjà fixée réf. B6) : intensité légère, Borg CR10 ≈ 2-3 (ou Borg 6-20 ≈ 10-11) : effort perceptible mais confortable, talk test largement positif (parle sans difficulté).', 'D''après England et al. 2022 (ACR) : recommandation FORTE pour un engagement constant dans l''exercice (par opposition à l''absence d''exercice) ; recommandation conditionnelle (preuve de faible qualité) spécifiquement en faveur de l''exercice aérobique et de l''exercice aquatique. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Modalité usuelle proposée : marche ou aquagym 15 à 30 minutes selon niveau ; l''exercice aquatique est particulièrement adapté en cas d''atteinte articulaire multiple (réduit la mise en charge).', 'D''après England et al. 2022 : recommandation conditionnelle (preuve de faible qualité) en faveur du renforcement musculaire. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Modalité usuelle proposée : grands groupes musculaires, 2 séries de 8 à 12 répétitions (volume prudent, à ajuster selon l''atteinte articulaire du jour), 48h entre 2 séances sollicitant le même groupe.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Non détaillée par England et al. 2022. Contenu usuel proposé : mobilité active quotidienne des petites et grandes articulations (mains, poignets, genoux, épaules), en particulier le matin (dérouillage matinal), 5 à 10 minutes.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Non détaillée par England et al. 2022. Non prioritaire en l''absence d''atteinte fonctionnelle associée ; à évaluer individuellement selon l''atteinte articulaire du patient.', 'D''après England et al. 2022 : recommandation conditionnelle (preuve de faible qualité) en faveur des approches « corps-esprit », en complément de l''exercice aérobique — catégorisation « fonctionnel » proposée par les rédacteurs, à confirmer.', 'D''après England et al. 2022, aucun rythme de progression n''est précisé. D''après EULAR 2025/2026 (Recommandation 7) : chez les personnes déconditionnées, débuter à dose plus faible puis augmenter progressivement la durée ou la charge sur les 4 à 6 premières semaines. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Au-delà, progression usuelle : +5 à 10 % du volume par semaine si bonne tolérance, réévaluation tous les 15 jours.', 'Par défaut (B9), complété par la « règle des 24 heures » d''EULAR 2025/2026 : si l''augmentation de la douleur persiste au-delà de 24h après l''exercice, réduire l''intensité.', 'D''après EULAR 2025/2026 (Recommandation 4, texte intégral vérifié) : aucune contre-indication spécifique à la pathologie pour l''activité physique elle-même (contre-indication retirée en 2025/2026, présente dans la version 2018) ; adapter l''intensité selon l''articulation/la zone atteinte (éviter la forte intensité sur une zone atteinte, ex. genou gonflé — les zones non atteintes restent praticables à forte intensité). Effets indésirables rapportés transitoires et légers (douleur musculaire, fatigue). PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Critère d''arrêt usuel proposé : signe de poussée en cours de séance (gonflement articulaire nouveau, raideur marquée), douleur > 6/10.', 'V1.0', 'validated'),
  ('POLYARTHRITE_RHUMATOIDE_INTERMEDIAIRE_01', 'POLYARTHRITE_RHUMATOIDE', 'intermediaire', 'AMELIORER_CONDITION_PHYSIQUE', 8, 3, 'D''après EULAR 2025/2026 : augmentation progressive de la durée ou de la charge sur les 4 à 6 premières semaines. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Valeur cible proposée (méthode déjà fixée réf. B6) : intensité modérée, Borg CR10 ≈ 3-4 (ou Borg 6-20 ≈ 12-13) : talk test positif (parle mais ne chante pas).', 'D''après England et al. 2022 (ACR) : recommandation FORTE pour un engagement constant dans l''exercice (par opposition à l''absence d''exercice) ; recommandation conditionnelle (preuve de faible qualité) spécifiquement en faveur de l''exercice aérobique et de l''exercice aquatique. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Modalité usuelle proposée : marche ou aquagym 15 à 30 minutes selon niveau ; l''exercice aquatique est particulièrement adapté en cas d''atteinte articulaire multiple (réduit la mise en charge).', 'D''après England et al. 2022 : recommandation conditionnelle (preuve de faible qualité) en faveur du renforcement musculaire. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Modalité usuelle proposée : grands groupes musculaires, 2 séries de 8 à 12 répétitions (volume prudent, à ajuster selon l''atteinte articulaire du jour), 48h entre 2 séances sollicitant le même groupe.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Non détaillée par England et al. 2022. Contenu usuel proposé : mobilité active quotidienne des petites et grandes articulations (mains, poignets, genoux, épaules), en particulier le matin (dérouillage matinal), 5 à 10 minutes.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Non détaillée par England et al. 2022. Non prioritaire en l''absence d''atteinte fonctionnelle associée ; à évaluer individuellement selon l''atteinte articulaire du patient.', 'D''après England et al. 2022 : recommandation conditionnelle (preuve de faible qualité) en faveur des approches « corps-esprit », en complément de l''exercice aérobique — catégorisation « fonctionnel » proposée par les rédacteurs, à confirmer.', 'D''après England et al. 2022, aucun rythme de progression n''est précisé. D''après EULAR 2025/2026 (Recommandation 7) : chez les personnes déconditionnées, débuter à dose plus faible puis augmenter progressivement la durée ou la charge sur les 4 à 6 premières semaines. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Au-delà, progression usuelle : +5 à 10 % du volume par semaine si bonne tolérance, réévaluation tous les 15 jours.', 'Par défaut (B9), complété par la « règle des 24 heures » d''EULAR 2025/2026 : si l''augmentation de la douleur persiste au-delà de 24h après l''exercice, réduire l''intensité.', 'D''après EULAR 2025/2026 (Recommandation 4, texte intégral vérifié) : aucune contre-indication spécifique à la pathologie pour l''activité physique elle-même (contre-indication retirée en 2025/2026, présente dans la version 2018) ; adapter l''intensité selon l''articulation/la zone atteinte (éviter la forte intensité sur une zone atteinte, ex. genou gonflé — les zones non atteintes restent praticables à forte intensité). Effets indésirables rapportés transitoires et légers (douleur musculaire, fatigue). PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Critère d''arrêt usuel proposé : signe de poussée en cours de séance (gonflement articulaire nouveau, raideur marquée), douleur > 6/10.', 'V1.0', 'validated'),
  ('POLYARTHRITE_RHUMATOIDE_AVANCE_01', 'POLYARTHRITE_RHUMATOIDE', 'avance', 'AMELIORER_FORCE', 8, 4, 'D''après EULAR 2025/2026 : au-delà de la période de progression initiale (4-6 semaines), les paramètres FITT-VP exacts restent délégués au professionnel de santé (Recommandation 7). PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Valeur cible proposée (méthode déjà fixée réf. B6) : intensité modérée à modérément soutenue, Borg CR10 ≈ 4-5 (ou Borg 6-20 ≈ 13-14), sans dépasser ce palier par prudence en pathologie rhumatologique ; talk test à la limite (phrases courtes).', 'D''après England et al. 2022 (ACR) : recommandation FORTE pour un engagement constant dans l''exercice (par opposition à l''absence d''exercice) ; recommandation conditionnelle (preuve de faible qualité) spécifiquement en faveur de l''exercice aérobique et de l''exercice aquatique. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Modalité usuelle proposée : marche ou aquagym 15 à 30 minutes selon niveau ; l''exercice aquatique est particulièrement adapté en cas d''atteinte articulaire multiple (réduit la mise en charge).', 'D''après England et al. 2022 : recommandation conditionnelle (preuve de faible qualité) en faveur du renforcement musculaire. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Modalité usuelle proposée : grands groupes musculaires, 2 séries de 8 à 12 répétitions (volume prudent, à ajuster selon l''atteinte articulaire du jour), 48h entre 2 séances sollicitant le même groupe.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Non détaillée par England et al. 2022. Contenu usuel proposé : mobilité active quotidienne des petites et grandes articulations (mains, poignets, genoux, épaules), en particulier le matin (dérouillage matinal), 5 à 10 minutes.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Non détaillée par England et al. 2022. Non prioritaire en l''absence d''atteinte fonctionnelle associée ; à évaluer individuellement selon l''atteinte articulaire du patient.', 'D''après England et al. 2022 : recommandation conditionnelle (preuve de faible qualité) en faveur des approches « corps-esprit », en complément de l''exercice aérobique — catégorisation « fonctionnel » proposée par les rédacteurs, à confirmer.', 'D''après England et al. 2022, aucun rythme de progression n''est précisé. D''après EULAR 2025/2026 (Recommandation 7) : chez les personnes déconditionnées, débuter à dose plus faible puis augmenter progressivement la durée ou la charge sur les 4 à 6 premières semaines. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Au-delà, progression usuelle : +5 à 10 % du volume par semaine si bonne tolérance, réévaluation tous les 15 jours.', 'Par défaut (B9), complété par la « règle des 24 heures » d''EULAR 2025/2026 : si l''augmentation de la douleur persiste au-delà de 24h après l''exercice, réduire l''intensité.', 'D''après EULAR 2025/2026 (Recommandation 4, texte intégral vérifié) : aucune contre-indication spécifique à la pathologie pour l''activité physique elle-même (contre-indication retirée en 2025/2026, présente dans la version 2018) ; adapter l''intensité selon l''articulation/la zone atteinte (éviter la forte intensité sur une zone atteinte, ex. genou gonflé — les zones non atteintes restent praticables à forte intensité). Effets indésirables rapportés transitoires et légers (douleur musculaire, fatigue). PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Critère d''arrêt usuel proposé : signe de poussée en cours de séance (gonflement articulaire nouveau, raideur marquée), douleur > 6/10.', 'V1.0', 'validated'),
  ('SPONDYLOARTHRITE_AXIALE_DEBUTANT_01', 'SPONDYLOARTHRITE_AXIALE', 'debutant', 'REDUIRE_SEDENTARITE', 8, 2, 'D''après EULAR 2025/2026 (Recommandation 7, texte intégral vérifié) : débuter à une dose plus faible, bien tolérée, chez les personnes déconditionnées ou avec limitations fonctionnelles importantes. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Valeur cible proposée (méthode déjà fixée réf. B6) : intensité légère, Borg CR10 ≈ 2-3 (ou Borg 6-20 ≈ 10-11) : effort perceptible mais confortable, talk test largement positif (parle sans difficulté). Point de vigilance ASAS-EULAR 2022 (Recommandation 4) : l''adhérence et l''efficacité sont rapportées comme meilleures en cas de supervision (kinésithérapie) par rapport aux exercices seuls à domicile — à considérer pour une application d''auto-exercice non supervisée.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — ASAS-EULAR 2022 recommande l''exercice de façon générale sans détailler de composante aérobique. Modalité usuelle proposée : marche, vélo ou natation 15 à 30 minutes selon niveau.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Non détaillé par ASAS-EULAR 2022. Modalité usuelle proposée : renforcement des extenseurs du rachis et de la ceinture scapulaire, 2 à 3 séries de 8 à 12 répétitions.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — ASAS-EULAR 2022 ne détaille aucun exercice de mobilité rachidienne spécifique, pourtant classiquement central dans l''axSpA en pratique courante. Contenu usuel proposé : mobilité rachidienne active (extension, rotation, inclinaisons latérales) dans l''amplitude non douloureuse, quotidienne, 10 à 15 minutes — à considérer comme la proposition la plus importante à valider de ce document, faute de tout appui dans les 2 références citées.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Non abordée par ASAS-EULAR 2022. Non prioritaire sauf atteinte fonctionnelle associée.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Non abordée par ASAS-EULAR 2022. Contenu usuel proposé : exercices respiratoires (amplitude thoracique, expansion costale), classiquement associés à la prise en charge de l''axSpA en pratique courante — à valider spécifiquement, absent des 2 références citées.', 'D''après EULAR 2025/2026 (Recommandation 7) : chez les personnes déconditionnées, débuter à dose plus faible puis augmenter progressivement la durée ou la charge sur les 4 à 6 premières semaines. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Au-delà, progression usuelle : +5 à 10 % du volume par semaine si bonne tolérance, réévaluation tous les 15 jours.', 'Par défaut (B9), complété par la « règle des 24 heures » d''EULAR 2025/2026 : si l''augmentation de la douleur persiste au-delà de 24h après l''exercice, réduire l''intensité.', 'D''après ASAS-EULAR 2022 (Recommandation 4, texte intégral vérifié) : « Exercise is a cornerstone in the management of axSpA, with demonstrated benefits on disease outcomes independent of pharmacological treatment. » L''adhérence est rapportée comme meilleure en cas de supervision, et « Physiotherapy, specifically supervised exercise, has also proven to be more efficacious than home exercises » — élément à prendre en compte pour une application d''auto-exercice non supervisée. Complété par EULAR 2025/2026 (règle des 24h, pas de contre-indication spécifique à la pathologie pour l''AP elle-même). PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Critère d''arrêt usuel proposé : douleur rachidienne > 6/10, raideur empêchant la poursuite de l''exercice.', 'V1.0', 'validated'),
  ('SPONDYLOARTHRITE_AXIALE_INTERMEDIAIRE_01', 'SPONDYLOARTHRITE_AXIALE', 'intermediaire', 'MAINTENIR_AUTONOMIE', 8, 3, 'D''après EULAR 2025/2026 : augmentation progressive de la durée ou de la charge sur les 4 à 6 premières semaines. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Valeur cible proposée (méthode déjà fixée réf. B6) : intensité modérée, Borg CR10 ≈ 3-4 (ou Borg 6-20 ≈ 12-13) : talk test positif (parle mais ne chante pas).', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — ASAS-EULAR 2022 recommande l''exercice de façon générale sans détailler de composante aérobique. Modalité usuelle proposée : marche, vélo ou natation 15 à 30 minutes selon niveau.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Non détaillé par ASAS-EULAR 2022. Modalité usuelle proposée : renforcement des extenseurs du rachis et de la ceinture scapulaire, 2 à 3 séries de 8 à 12 répétitions.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — ASAS-EULAR 2022 ne détaille aucun exercice de mobilité rachidienne spécifique, pourtant classiquement central dans l''axSpA en pratique courante. Contenu usuel proposé : mobilité rachidienne active (extension, rotation, inclinaisons latérales) dans l''amplitude non douloureuse, quotidienne, 10 à 15 minutes — à considérer comme la proposition la plus importante à valider de ce document, faute de tout appui dans les 2 références citées.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Non abordée par ASAS-EULAR 2022. Non prioritaire sauf atteinte fonctionnelle associée.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Non abordée par ASAS-EULAR 2022. Contenu usuel proposé : exercices respiratoires (amplitude thoracique, expansion costale), classiquement associés à la prise en charge de l''axSpA en pratique courante — à valider spécifiquement, absent des 2 références citées.', 'D''après EULAR 2025/2026 (Recommandation 7) : chez les personnes déconditionnées, débuter à dose plus faible puis augmenter progressivement la durée ou la charge sur les 4 à 6 premières semaines. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Au-delà, progression usuelle : +5 à 10 % du volume par semaine si bonne tolérance, réévaluation tous les 15 jours.', 'Par défaut (B9), complété par la « règle des 24 heures » d''EULAR 2025/2026 : si l''augmentation de la douleur persiste au-delà de 24h après l''exercice, réduire l''intensité.', 'D''après ASAS-EULAR 2022 (Recommandation 4, texte intégral vérifié) : « Exercise is a cornerstone in the management of axSpA, with demonstrated benefits on disease outcomes independent of pharmacological treatment. » L''adhérence est rapportée comme meilleure en cas de supervision, et « Physiotherapy, specifically supervised exercise, has also proven to be more efficacious than home exercises » — élément à prendre en compte pour une application d''auto-exercice non supervisée. Complété par EULAR 2025/2026 (règle des 24h, pas de contre-indication spécifique à la pathologie pour l''AP elle-même). PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Critère d''arrêt usuel proposé : douleur rachidienne > 6/10, raideur empêchant la poursuite de l''exercice.', 'V1.0', 'validated'),
  ('SPONDYLOARTHRITE_AXIALE_AVANCE_01', 'SPONDYLOARTHRITE_AXIALE', 'avance', 'AMELIORER_CONDITION_PHYSIQUE', 8, 4, 'D''après EULAR 2025/2026 : au-delà de la période de progression initiale (4-6 semaines), les paramètres FITT-VP exacts restent délégués au professionnel de santé (Recommandation 7). PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Valeur cible proposée (méthode déjà fixée réf. B6) : intensité modérée à modérément soutenue, Borg CR10 ≈ 4-5 (ou Borg 6-20 ≈ 13-14), sans dépasser ce palier par prudence en pathologie rhumatologique ; talk test à la limite (phrases courtes).', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — ASAS-EULAR 2022 recommande l''exercice de façon générale sans détailler de composante aérobique. Modalité usuelle proposée : marche, vélo ou natation 15 à 30 minutes selon niveau.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Non détaillé par ASAS-EULAR 2022. Modalité usuelle proposée : renforcement des extenseurs du rachis et de la ceinture scapulaire, 2 à 3 séries de 8 à 12 répétitions.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — ASAS-EULAR 2022 ne détaille aucun exercice de mobilité rachidienne spécifique, pourtant classiquement central dans l''axSpA en pratique courante. Contenu usuel proposé : mobilité rachidienne active (extension, rotation, inclinaisons latérales) dans l''amplitude non douloureuse, quotidienne, 10 à 15 minutes — à considérer comme la proposition la plus importante à valider de ce document, faute de tout appui dans les 2 références citées.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Non abordée par ASAS-EULAR 2022. Non prioritaire sauf atteinte fonctionnelle associée.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Non abordée par ASAS-EULAR 2022. Contenu usuel proposé : exercices respiratoires (amplitude thoracique, expansion costale), classiquement associés à la prise en charge de l''axSpA en pratique courante — à valider spécifiquement, absent des 2 références citées.', 'D''après EULAR 2025/2026 (Recommandation 7) : chez les personnes déconditionnées, débuter à dose plus faible puis augmenter progressivement la durée ou la charge sur les 4 à 6 premières semaines. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Au-delà, progression usuelle : +5 à 10 % du volume par semaine si bonne tolérance, réévaluation tous les 15 jours.', 'Par défaut (B9), complété par la « règle des 24 heures » d''EULAR 2025/2026 : si l''augmentation de la douleur persiste au-delà de 24h après l''exercice, réduire l''intensité.', 'D''après ASAS-EULAR 2022 (Recommandation 4, texte intégral vérifié) : « Exercise is a cornerstone in the management of axSpA, with demonstrated benefits on disease outcomes independent of pharmacological treatment. » L''adhérence est rapportée comme meilleure en cas de supervision, et « Physiotherapy, specifically supervised exercise, has also proven to be more efficacious than home exercises » — élément à prendre en compte pour une application d''auto-exercice non supervisée. Complété par EULAR 2025/2026 (règle des 24h, pas de contre-indication spécifique à la pathologie pour l''AP elle-même). PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Critère d''arrêt usuel proposé : douleur rachidienne > 6/10, raideur empêchant la poursuite de l''exercice.', 'V1.0', 'validated'),
  ('OSTEOPOROSE_DEBUTANT_01', 'OSTEOPOROSE', 'debutant', 'MAINTENIR_AUTONOMIE', 8, 2, 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Valeur cible proposée (méthode déjà fixée réf. B6) : intensité légère, Borg CR10 ≈ 2-3 (ou Borg 6-20 ≈ 10-11) : effort perceptible mais confortable, talk test largement positif (parle sans difficulté). Sans charge externe additionnelle à ce stade — poids du corps uniquement.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Ni LeBoff et al. 2022 ni Hoffmann et al. 2023 ne détaillent de composante aérobique spécifique. Modalité usuelle proposée : marche en charge (« weight-bearing », cohérente avec LeBoff et al. 2022), 20 à 30 minutes, 3 à 5 fois par semaine.', 'D''après LeBoff et al. 2022 : l''exercice en charge (« weight-bearing ») et le renforcement musculaire (« resistance-training ») font partie de l''arsenal de prévention des fractures, aux côtés du traitement pharmacologique, des apports calcium/vitamine D et de la prévention des chutes. D''après Hoffmann et al. 2023 (méta-analyse, 11 essais) : réduction d''environ 23 % des fractures ostéoporotiques majeures (RR 0,75 ; IC95 % 0,54-0,94 ; p=.006), sans qu''un protocole précis puisse être recommandé de façon fiable. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Modalité usuelle proposée : grands groupes musculaires et rachis en extension, 2 à 3 séries de 8 à 12 répétitions, en évitant systématiquement la flexion chargée du tronc (cf. Sécurité).', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Non abordée par les 2 références. Contenu usuel proposé : mobilité douce, hors flexion importante du rachis, 5 minutes en échauffement.', 'D''après LeBoff et al. 2022 : la prévention des chutes fait partie de l''arsenal global de prévention des fractures, sans détail d''exercice spécifique. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Contenu usuel proposé : exercices d''équilibre systématiques (appui unipodal avec sécurité, marche talon-pointe), 5 à 10 minutes, 2 à 3 fois par semaine — cohérent avec la place de la prévention des chutes chez LeBoff et al. 2022.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Non abordée par les 2 références. Contenu usuel proposé : gestes du quotidien en évitant la flexion chargée du tronc (ex. se baisser en fléchissant les genoux plutôt que le dos), cohérent avec la contre-indication de LeBoff et al. 2022.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Hoffmann et al. 2023 ne permet pas de dériver une règle de progression fiable (différence non significative, p=.133). Progression usuelle proposée : +5 à 10 % du volume ou de la charge par semaine si bonne tolérance, réévaluation tous les 15 jours.', 'Par défaut (B9)', 'D''après LeBoff et al. 2022 (description d''une figure dans l''abstract — à vérifier sur texte intégral avant validation, déjà signalé au Sprint 5bis) : les mouvements de flexion importante du tronc augmentent le risque de fracture vertébrale, les mouvements d''extension du rachis le diminuent. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Critère d''arrêt usuel proposé : douleur dorsale/lombaire aiguë nouvelle (signe d''alerte de fracture vertébrale, à évaluer médicalement avant poursuite), douleur > 6/10.', 'V1.0', 'validated'),
  ('OSTEOPOROSE_INTERMEDIAIRE_01', 'OSTEOPOROSE', 'intermediaire', 'AMELIORER_FORCE', 8, 3, 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Valeur cible proposée (méthode déjà fixée réf. B6) : intensité modérée, Borg CR10 ≈ 3-4 (ou Borg 6-20 ≈ 12-13) : talk test positif (parle mais ne chante pas). Introduction possible d''une charge externe légère (poids libres, élastique) selon tolérance.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Ni LeBoff et al. 2022 ni Hoffmann et al. 2023 ne détaillent de composante aérobique spécifique. Modalité usuelle proposée : marche en charge (« weight-bearing », cohérente avec LeBoff et al. 2022), 20 à 30 minutes, 3 à 5 fois par semaine.', 'D''après LeBoff et al. 2022 : l''exercice en charge (« weight-bearing ») et le renforcement musculaire (« resistance-training ») font partie de l''arsenal de prévention des fractures, aux côtés du traitement pharmacologique, des apports calcium/vitamine D et de la prévention des chutes. D''après Hoffmann et al. 2023 (méta-analyse, 11 essais) : réduction d''environ 23 % des fractures ostéoporotiques majeures (RR 0,75 ; IC95 % 0,54-0,94 ; p=.006), sans qu''un protocole précis puisse être recommandé de façon fiable. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Modalité usuelle proposée : grands groupes musculaires et rachis en extension, 2 à 3 séries de 8 à 12 répétitions, en évitant systématiquement la flexion chargée du tronc (cf. Sécurité).', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Non abordée par les 2 références. Contenu usuel proposé : mobilité douce, hors flexion importante du rachis, 5 minutes en échauffement.', 'D''après LeBoff et al. 2022 : la prévention des chutes fait partie de l''arsenal global de prévention des fractures, sans détail d''exercice spécifique. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Contenu usuel proposé : exercices d''équilibre systématiques (appui unipodal avec sécurité, marche talon-pointe), 5 à 10 minutes, 2 à 3 fois par semaine — cohérent avec la place de la prévention des chutes chez LeBoff et al. 2022.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Non abordée par les 2 références. Contenu usuel proposé : gestes du quotidien en évitant la flexion chargée du tronc (ex. se baisser en fléchissant les genoux plutôt que le dos), cohérent avec la contre-indication de LeBoff et al. 2022.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Hoffmann et al. 2023 ne permet pas de dériver une règle de progression fiable (différence non significative, p=.133). Progression usuelle proposée : +5 à 10 % du volume ou de la charge par semaine si bonne tolérance, réévaluation tous les 15 jours.', 'Par défaut (B9)', 'D''après LeBoff et al. 2022 (description d''une figure dans l''abstract — à vérifier sur texte intégral avant validation, déjà signalé au Sprint 5bis) : les mouvements de flexion importante du tronc augmentent le risque de fracture vertébrale, les mouvements d''extension du rachis le diminuent. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Critère d''arrêt usuel proposé : douleur dorsale/lombaire aiguë nouvelle (signe d''alerte de fracture vertébrale, à évaluer médicalement avant poursuite), douleur > 6/10.', 'V1.0', 'validated'),
  ('OSTEOPOROSE_AVANCE_01', 'OSTEOPOROSE', 'avance', 'AMELIORER_FORCE', 8, 4, 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Valeur cible proposée (méthode déjà fixée réf. B6) : intensité modérée à modérément soutenue, Borg CR10 ≈ 4-5 (ou Borg 6-20 ≈ 13-14), sans dépasser ce palier par prudence en pathologie rhumatologique ; talk test à la limite (phrases courtes). Charge externe progressive selon tolérance, toujours sans mouvement de flexion du tronc chargée (cf. Sécurité).', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Ni LeBoff et al. 2022 ni Hoffmann et al. 2023 ne détaillent de composante aérobique spécifique. Modalité usuelle proposée : marche en charge (« weight-bearing », cohérente avec LeBoff et al. 2022), 20 à 30 minutes, 3 à 5 fois par semaine.', 'D''après LeBoff et al. 2022 : l''exercice en charge (« weight-bearing ») et le renforcement musculaire (« resistance-training ») font partie de l''arsenal de prévention des fractures, aux côtés du traitement pharmacologique, des apports calcium/vitamine D et de la prévention des chutes. D''après Hoffmann et al. 2023 (méta-analyse, 11 essais) : réduction d''environ 23 % des fractures ostéoporotiques majeures (RR 0,75 ; IC95 % 0,54-0,94 ; p=.006), sans qu''un protocole précis puisse être recommandé de façon fiable. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Modalité usuelle proposée : grands groupes musculaires et rachis en extension, 2 à 3 séries de 8 à 12 répétitions, en évitant systématiquement la flexion chargée du tronc (cf. Sécurité).', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Non abordée par les 2 références. Contenu usuel proposé : mobilité douce, hors flexion importante du rachis, 5 minutes en échauffement.', 'D''après LeBoff et al. 2022 : la prévention des chutes fait partie de l''arsenal global de prévention des fractures, sans détail d''exercice spécifique. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Contenu usuel proposé : exercices d''équilibre systématiques (appui unipodal avec sécurité, marche talon-pointe), 5 à 10 minutes, 2 à 3 fois par semaine — cohérent avec la place de la prévention des chutes chez LeBoff et al. 2022.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Non abordée par les 2 références. Contenu usuel proposé : gestes du quotidien en évitant la flexion chargée du tronc (ex. se baisser en fléchissant les genoux plutôt que le dos), cohérent avec la contre-indication de LeBoff et al. 2022.', 'PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Hoffmann et al. 2023 ne permet pas de dériver une règle de progression fiable (différence non significative, p=.133). Progression usuelle proposée : +5 à 10 % du volume ou de la charge par semaine si bonne tolérance, réévaluation tous les 15 jours.', 'Par défaut (B9)', 'D''après LeBoff et al. 2022 (description d''une figure dans l''abstract — à vérifier sur texte intégral avant validation, déjà signalé au Sprint 5bis) : les mouvements de flexion importante du tronc augmentent le risque de fracture vertébrale, les mouvements d''extension du rachis le diminuent. PROPOSITION (hors des 10 références citées, repères génériques d''exercice thérapeutique — à valider) — Critère d''arrêt usuel proposé : douleur dorsale/lombaire aiguë nouvelle (signe d''alerte de fracture vertébrale, à évaluer médicalement avant poursuite), douleur > 6/10.', 'V1.0', 'validated')

on conflict (program_code) do update set
  objective = excluded.objective,
  duration_weeks = excluded.duration_weeks,
  frequency_per_week = excluded.frequency_per_week,
  intensity = excluded.intensity,
  aerobic_component = excluded.aerobic_component,
  strength_component = excluded.strength_component,
  mobility_component = excluded.mobility_component,
  balance_component = excluded.balance_component,
  functional_component = excluded.functional_component,
  progression_rule = excluded.progression_rule,
  regression_rule = excluded.regression_rule,
  safety_rules = excluded.safety_rules,
  medical_validation_status = excluded.medical_validation_status,
  updated_at = now();

-- Références bibliographiques par programme (join table program_references).
-- Bull et al. 2020 (10.1136/bjsports-2020-102955) est rattaché aux 6
-- pathologies : c'est la source du repère de fréquence transversal
-- (FREQ_PROPOSAL) réutilisé pour les 6.
insert into public.program_references (program_id, reference_id)
select pr.program_id, sr.id
from (values
  ('LOMBALGIE_COMMUNE_DEBUTANT_01', 'title', 'WHO guideline for non-surgical management of chronic primary low back pain in adults in primary and community care settings'),
  ('LOMBALGIE_COMMUNE_DEBUTANT_01', 'doi', '10.2519/jospt.2021.0304'),
  ('LOMBALGIE_COMMUNE_DEBUTANT_01', 'doi', '10.1016/S0140-6736(21)00733-9'),
  ('LOMBALGIE_COMMUNE_DEBUTANT_01', 'doi', '10.1136/bjsports-2020-102955'),
  ('LOMBALGIE_COMMUNE_INTERMEDIAIRE_01', 'title', 'WHO guideline for non-surgical management of chronic primary low back pain in adults in primary and community care settings'),
  ('LOMBALGIE_COMMUNE_INTERMEDIAIRE_01', 'doi', '10.2519/jospt.2021.0304'),
  ('LOMBALGIE_COMMUNE_INTERMEDIAIRE_01', 'doi', '10.1016/S0140-6736(21)00733-9'),
  ('LOMBALGIE_COMMUNE_INTERMEDIAIRE_01', 'doi', '10.1136/bjsports-2020-102955'),
  ('LOMBALGIE_COMMUNE_AVANCE_01', 'title', 'WHO guideline for non-surgical management of chronic primary low back pain in adults in primary and community care settings'),
  ('LOMBALGIE_COMMUNE_AVANCE_01', 'doi', '10.2519/jospt.2021.0304'),
  ('LOMBALGIE_COMMUNE_AVANCE_01', 'doi', '10.1016/S0140-6736(21)00733-9'),
  ('LOMBALGIE_COMMUNE_AVANCE_01', 'doi', '10.1136/bjsports-2020-102955'),
  ('ARTHROSE_GENOU_DEBUTANT_01', 'doi', '10.1002/acr.24131'),
  ('ARTHROSE_GENOU_DEBUTANT_01', 'doi', '10.1016/j.ard.2026.03.006'),
  ('ARTHROSE_GENOU_DEBUTANT_01', 'doi', '10.1136/bjsports-2020-102955'),
  ('ARTHROSE_GENOU_INTERMEDIAIRE_01', 'doi', '10.1002/acr.24131'),
  ('ARTHROSE_GENOU_INTERMEDIAIRE_01', 'doi', '10.1016/j.ard.2026.03.006'),
  ('ARTHROSE_GENOU_INTERMEDIAIRE_01', 'doi', '10.1136/bjsports-2020-102955'),
  ('ARTHROSE_GENOU_AVANCE_01', 'doi', '10.1002/acr.24131'),
  ('ARTHROSE_GENOU_AVANCE_01', 'doi', '10.1016/j.ard.2026.03.006'),
  ('ARTHROSE_GENOU_AVANCE_01', 'doi', '10.1136/bjsports-2020-102955'),
  ('ARTHROSE_HANCHE_DEBUTANT_01', 'doi', '10.1002/acr.24131'),
  ('ARTHROSE_HANCHE_DEBUTANT_01', 'doi', '10.1016/j.ard.2026.03.006'),
  ('ARTHROSE_HANCHE_DEBUTANT_01', 'doi', '10.1136/bjsports-2020-102955'),
  ('ARTHROSE_HANCHE_INTERMEDIAIRE_01', 'doi', '10.1002/acr.24131'),
  ('ARTHROSE_HANCHE_INTERMEDIAIRE_01', 'doi', '10.1016/j.ard.2026.03.006'),
  ('ARTHROSE_HANCHE_INTERMEDIAIRE_01', 'doi', '10.1136/bjsports-2020-102955'),
  ('ARTHROSE_HANCHE_AVANCE_01', 'doi', '10.1002/acr.24131'),
  ('ARTHROSE_HANCHE_AVANCE_01', 'doi', '10.1016/j.ard.2026.03.006'),
  ('ARTHROSE_HANCHE_AVANCE_01', 'doi', '10.1136/bjsports-2020-102955'),
  ('POLYARTHRITE_RHUMATOIDE_DEBUTANT_01', 'doi', '10.1002/acr.25117'),
  ('POLYARTHRITE_RHUMATOIDE_DEBUTANT_01', 'doi', '10.1016/j.ard.2026.03.006'),
  ('POLYARTHRITE_RHUMATOIDE_DEBUTANT_01', 'doi', '10.1136/bjsports-2020-102955'),
  ('POLYARTHRITE_RHUMATOIDE_INTERMEDIAIRE_01', 'doi', '10.1002/acr.25117'),
  ('POLYARTHRITE_RHUMATOIDE_INTERMEDIAIRE_01', 'doi', '10.1016/j.ard.2026.03.006'),
  ('POLYARTHRITE_RHUMATOIDE_INTERMEDIAIRE_01', 'doi', '10.1136/bjsports-2020-102955'),
  ('POLYARTHRITE_RHUMATOIDE_AVANCE_01', 'doi', '10.1002/acr.25117'),
  ('POLYARTHRITE_RHUMATOIDE_AVANCE_01', 'doi', '10.1016/j.ard.2026.03.006'),
  ('POLYARTHRITE_RHUMATOIDE_AVANCE_01', 'doi', '10.1136/bjsports-2020-102955'),
  ('SPONDYLOARTHRITE_AXIALE_DEBUTANT_01', 'doi', '10.1136/ard-2022-223296'),
  ('SPONDYLOARTHRITE_AXIALE_DEBUTANT_01', 'doi', '10.1016/j.ard.2026.03.006'),
  ('SPONDYLOARTHRITE_AXIALE_DEBUTANT_01', 'doi', '10.1136/bjsports-2020-102955'),
  ('SPONDYLOARTHRITE_AXIALE_INTERMEDIAIRE_01', 'doi', '10.1136/ard-2022-223296'),
  ('SPONDYLOARTHRITE_AXIALE_INTERMEDIAIRE_01', 'doi', '10.1016/j.ard.2026.03.006'),
  ('SPONDYLOARTHRITE_AXIALE_INTERMEDIAIRE_01', 'doi', '10.1136/bjsports-2020-102955'),
  ('SPONDYLOARTHRITE_AXIALE_AVANCE_01', 'doi', '10.1136/ard-2022-223296'),
  ('SPONDYLOARTHRITE_AXIALE_AVANCE_01', 'doi', '10.1016/j.ard.2026.03.006'),
  ('SPONDYLOARTHRITE_AXIALE_AVANCE_01', 'doi', '10.1136/bjsports-2020-102955'),
  ('OSTEOPOROSE_DEBUTANT_01', 'doi', '10.1007/s00198-021-05900-y'),
  ('OSTEOPOROSE_DEBUTANT_01', 'doi', '10.1007/s00198-022-06592-8'),
  ('OSTEOPOROSE_DEBUTANT_01', 'doi', '10.1136/bjsports-2020-102955'),
  ('OSTEOPOROSE_INTERMEDIAIRE_01', 'doi', '10.1007/s00198-021-05900-y'),
  ('OSTEOPOROSE_INTERMEDIAIRE_01', 'doi', '10.1007/s00198-022-06592-8'),
  ('OSTEOPOROSE_INTERMEDIAIRE_01', 'doi', '10.1136/bjsports-2020-102955'),
  ('OSTEOPOROSE_AVANCE_01', 'doi', '10.1007/s00198-021-05900-y'),
  ('OSTEOPOROSE_AVANCE_01', 'doi', '10.1007/s00198-022-06592-8'),
  ('OSTEOPOROSE_AVANCE_01', 'doi', '10.1136/bjsports-2020-102955')
) as v(program_code, ref_kind, ref_value)
join public.programs pr on pr.program_code = v.program_code
join public.scientific_references sr
  on (v.ref_kind = 'doi' and sr.doi = v.ref_value)
  or (v.ref_kind = 'title' and sr.title = v.ref_value)
on conflict do nothing;

-- ===== SEED : 0013_allow_program_rules_dr_nikiema_20260823.sql =====
-- Sprint 17 (suite 2, intégration) — Règles allow_program réelles, validées
-- par Dr Nikiema le 23/08/2026 (QUESTIONS_ALLOW_PROGRAM_20260823.docx,
-- réponses aux Questions 1 et 2), traduisant sa réponse B4 (20/08/2026).
--
-- Logique retenue, littéralement conforme à ses réponses :
--   - le fait `niveau` (débutant/intermédiaire/avancé) est calculé côté
--     application (classifyInitialProfileLevel, packages/domain/src/programs.ts)
--     à partir de physical_activity_level et du statut de dépistage — PAS
--     par ces règles elles-mêmes, qui restent de simples correspondances
--     pathologie + niveau + statut -> programme.
--   - dépistage vert : niveau tel que calculé (1-2 -> débutant, 3 ->
--     intermédiaire, 4-5 -> avancé) -> le programme du même niveau.
--   - dépistage orange : niveau initial déjà plafonné à débutant par
--     classifyInitialProfileLevel — mais la condition ci-dessous restreint
--     EXPLICITEMENT et INDÉPENDAMMENT les règles intermédiaire/avancé au seul
--     statut vert (défense en profondeur : même en cas de bug côté calcul du
--     fait niveau, un dépistage orange ne peut jamais déclencher autre chose
--     que le programme débutant, conformément à sa réponse Q2).
--   - dépistage rouge / pending_validation : niveau = null (jamais transmis)
--     -> aucune règle ne matche jamais -> MEDICAL_PARAMETER_REQUIRED, comme
--     avant ce fichier.

insert into public.clinical_rules
  (rule_id, pathology, condition, severity, action, message, program_id, active, version, validated_by, validated_date)
values
  ('ALLOW_PROGRAM_LOMBALGIE_COMMUNE_DEBUTANT', 'LOMBALGIE_COMMUNE', '{"all":[{"field":"niveau","operator":"equals","value":"debutant"},{"field":"screening","operator":"in","value":["vert","orange"]}]}', 'info', 'allow_program', 'Programme LOMBALGIE_COMMUNE_DEBUTANT_01 attribué automatiquement (niveau initial debutant, dépistage vert ou orange (plafonné à débutant en orange, réponse Q2 du 23/08/2026)) — règle dérivée de B4 et des réponses du 23/08/2026, aucun contenu médical nouveau.', (select program_id from public.programs where program_code = 'LOMBALGIE_COMMUNE_DEBUTANT_01'), true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-23'),
  ('ALLOW_PROGRAM_LOMBALGIE_COMMUNE_INTERMEDIAIRE', 'LOMBALGIE_COMMUNE', '{"all":[{"field":"niveau","operator":"equals","value":"intermediaire"},{"field":"screening","operator":"in","value":["vert"]}]}', 'info', 'allow_program', 'Programme LOMBALGIE_COMMUNE_INTERMEDIAIRE_01 attribué automatiquement (niveau initial intermediaire, dépistage vert) — règle dérivée de B4 et des réponses du 23/08/2026, aucun contenu médical nouveau.', (select program_id from public.programs where program_code = 'LOMBALGIE_COMMUNE_INTERMEDIAIRE_01'), true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-23'),
  ('ALLOW_PROGRAM_LOMBALGIE_COMMUNE_AVANCE', 'LOMBALGIE_COMMUNE', '{"all":[{"field":"niveau","operator":"equals","value":"avance"},{"field":"screening","operator":"in","value":["vert"]}]}', 'info', 'allow_program', 'Programme LOMBALGIE_COMMUNE_AVANCE_01 attribué automatiquement (niveau initial avance, dépistage vert) — règle dérivée de B4 et des réponses du 23/08/2026, aucun contenu médical nouveau.', (select program_id from public.programs where program_code = 'LOMBALGIE_COMMUNE_AVANCE_01'), true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-23'),
  ('ALLOW_PROGRAM_ARTHROSE_GENOU_DEBUTANT', 'ARTHROSE_GENOU', '{"all":[{"field":"niveau","operator":"equals","value":"debutant"},{"field":"screening","operator":"in","value":["vert","orange"]}]}', 'info', 'allow_program', 'Programme ARTHROSE_GENOU_DEBUTANT_01 attribué automatiquement (niveau initial debutant, dépistage vert ou orange (plafonné à débutant en orange, réponse Q2 du 23/08/2026)) — règle dérivée de B4 et des réponses du 23/08/2026, aucun contenu médical nouveau.', (select program_id from public.programs where program_code = 'ARTHROSE_GENOU_DEBUTANT_01'), true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-23'),
  ('ALLOW_PROGRAM_ARTHROSE_GENOU_INTERMEDIAIRE', 'ARTHROSE_GENOU', '{"all":[{"field":"niveau","operator":"equals","value":"intermediaire"},{"field":"screening","operator":"in","value":["vert"]}]}', 'info', 'allow_program', 'Programme ARTHROSE_GENOU_INTERMEDIAIRE_01 attribué automatiquement (niveau initial intermediaire, dépistage vert) — règle dérivée de B4 et des réponses du 23/08/2026, aucun contenu médical nouveau.', (select program_id from public.programs where program_code = 'ARTHROSE_GENOU_INTERMEDIAIRE_01'), true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-23'),
  ('ALLOW_PROGRAM_ARTHROSE_GENOU_AVANCE', 'ARTHROSE_GENOU', '{"all":[{"field":"niveau","operator":"equals","value":"avance"},{"field":"screening","operator":"in","value":["vert"]}]}', 'info', 'allow_program', 'Programme ARTHROSE_GENOU_AVANCE_01 attribué automatiquement (niveau initial avance, dépistage vert) — règle dérivée de B4 et des réponses du 23/08/2026, aucun contenu médical nouveau.', (select program_id from public.programs where program_code = 'ARTHROSE_GENOU_AVANCE_01'), true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-23'),
  ('ALLOW_PROGRAM_ARTHROSE_HANCHE_DEBUTANT', 'ARTHROSE_HANCHE', '{"all":[{"field":"niveau","operator":"equals","value":"debutant"},{"field":"screening","operator":"in","value":["vert","orange"]}]}', 'info', 'allow_program', 'Programme ARTHROSE_HANCHE_DEBUTANT_01 attribué automatiquement (niveau initial debutant, dépistage vert ou orange (plafonné à débutant en orange, réponse Q2 du 23/08/2026)) — règle dérivée de B4 et des réponses du 23/08/2026, aucun contenu médical nouveau.', (select program_id from public.programs where program_code = 'ARTHROSE_HANCHE_DEBUTANT_01'), true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-23'),
  ('ALLOW_PROGRAM_ARTHROSE_HANCHE_INTERMEDIAIRE', 'ARTHROSE_HANCHE', '{"all":[{"field":"niveau","operator":"equals","value":"intermediaire"},{"field":"screening","operator":"in","value":["vert"]}]}', 'info', 'allow_program', 'Programme ARTHROSE_HANCHE_INTERMEDIAIRE_01 attribué automatiquement (niveau initial intermediaire, dépistage vert) — règle dérivée de B4 et des réponses du 23/08/2026, aucun contenu médical nouveau.', (select program_id from public.programs where program_code = 'ARTHROSE_HANCHE_INTERMEDIAIRE_01'), true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-23'),
  ('ALLOW_PROGRAM_ARTHROSE_HANCHE_AVANCE', 'ARTHROSE_HANCHE', '{"all":[{"field":"niveau","operator":"equals","value":"avance"},{"field":"screening","operator":"in","value":["vert"]}]}', 'info', 'allow_program', 'Programme ARTHROSE_HANCHE_AVANCE_01 attribué automatiquement (niveau initial avance, dépistage vert) — règle dérivée de B4 et des réponses du 23/08/2026, aucun contenu médical nouveau.', (select program_id from public.programs where program_code = 'ARTHROSE_HANCHE_AVANCE_01'), true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-23'),
  ('ALLOW_PROGRAM_POLYARTHRITE_RHUMATOIDE_DEBUTANT', 'POLYARTHRITE_RHUMATOIDE', '{"all":[{"field":"niveau","operator":"equals","value":"debutant"},{"field":"screening","operator":"in","value":["vert","orange"]}]}', 'info', 'allow_program', 'Programme POLYARTHRITE_RHUMATOIDE_DEBUTANT_01 attribué automatiquement (niveau initial debutant, dépistage vert ou orange (plafonné à débutant en orange, réponse Q2 du 23/08/2026)) — règle dérivée de B4 et des réponses du 23/08/2026, aucun contenu médical nouveau.', (select program_id from public.programs where program_code = 'POLYARTHRITE_RHUMATOIDE_DEBUTANT_01'), true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-23'),
  ('ALLOW_PROGRAM_POLYARTHRITE_RHUMATOIDE_INTERMEDIAIRE', 'POLYARTHRITE_RHUMATOIDE', '{"all":[{"field":"niveau","operator":"equals","value":"intermediaire"},{"field":"screening","operator":"in","value":["vert"]}]}', 'info', 'allow_program', 'Programme POLYARTHRITE_RHUMATOIDE_INTERMEDIAIRE_01 attribué automatiquement (niveau initial intermediaire, dépistage vert) — règle dérivée de B4 et des réponses du 23/08/2026, aucun contenu médical nouveau.', (select program_id from public.programs where program_code = 'POLYARTHRITE_RHUMATOIDE_INTERMEDIAIRE_01'), true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-23'),
  ('ALLOW_PROGRAM_POLYARTHRITE_RHUMATOIDE_AVANCE', 'POLYARTHRITE_RHUMATOIDE', '{"all":[{"field":"niveau","operator":"equals","value":"avance"},{"field":"screening","operator":"in","value":["vert"]}]}', 'info', 'allow_program', 'Programme POLYARTHRITE_RHUMATOIDE_AVANCE_01 attribué automatiquement (niveau initial avance, dépistage vert) — règle dérivée de B4 et des réponses du 23/08/2026, aucun contenu médical nouveau.', (select program_id from public.programs where program_code = 'POLYARTHRITE_RHUMATOIDE_AVANCE_01'), true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-23'),
  ('ALLOW_PROGRAM_SPONDYLOARTHRITE_AXIALE_DEBUTANT', 'SPONDYLOARTHRITE_AXIALE', '{"all":[{"field":"niveau","operator":"equals","value":"debutant"},{"field":"screening","operator":"in","value":["vert","orange"]}]}', 'info', 'allow_program', 'Programme SPONDYLOARTHRITE_AXIALE_DEBUTANT_01 attribué automatiquement (niveau initial debutant, dépistage vert ou orange (plafonné à débutant en orange, réponse Q2 du 23/08/2026)) — règle dérivée de B4 et des réponses du 23/08/2026, aucun contenu médical nouveau.', (select program_id from public.programs where program_code = 'SPONDYLOARTHRITE_AXIALE_DEBUTANT_01'), true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-23'),
  ('ALLOW_PROGRAM_SPONDYLOARTHRITE_AXIALE_INTERMEDIAIRE', 'SPONDYLOARTHRITE_AXIALE', '{"all":[{"field":"niveau","operator":"equals","value":"intermediaire"},{"field":"screening","operator":"in","value":["vert"]}]}', 'info', 'allow_program', 'Programme SPONDYLOARTHRITE_AXIALE_INTERMEDIAIRE_01 attribué automatiquement (niveau initial intermediaire, dépistage vert) — règle dérivée de B4 et des réponses du 23/08/2026, aucun contenu médical nouveau.', (select program_id from public.programs where program_code = 'SPONDYLOARTHRITE_AXIALE_INTERMEDIAIRE_01'), true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-23'),
  ('ALLOW_PROGRAM_SPONDYLOARTHRITE_AXIALE_AVANCE', 'SPONDYLOARTHRITE_AXIALE', '{"all":[{"field":"niveau","operator":"equals","value":"avance"},{"field":"screening","operator":"in","value":["vert"]}]}', 'info', 'allow_program', 'Programme SPONDYLOARTHRITE_AXIALE_AVANCE_01 attribué automatiquement (niveau initial avance, dépistage vert) — règle dérivée de B4 et des réponses du 23/08/2026, aucun contenu médical nouveau.', (select program_id from public.programs where program_code = 'SPONDYLOARTHRITE_AXIALE_AVANCE_01'), true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-23'),
  ('ALLOW_PROGRAM_OSTEOPOROSE_DEBUTANT', 'OSTEOPOROSE', '{"all":[{"field":"niveau","operator":"equals","value":"debutant"},{"field":"screening","operator":"in","value":["vert","orange"]}]}', 'info', 'allow_program', 'Programme OSTEOPOROSE_DEBUTANT_01 attribué automatiquement (niveau initial debutant, dépistage vert ou orange (plafonné à débutant en orange, réponse Q2 du 23/08/2026)) — règle dérivée de B4 et des réponses du 23/08/2026, aucun contenu médical nouveau.', (select program_id from public.programs where program_code = 'OSTEOPOROSE_DEBUTANT_01'), true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-23'),
  ('ALLOW_PROGRAM_OSTEOPOROSE_INTERMEDIAIRE', 'OSTEOPOROSE', '{"all":[{"field":"niveau","operator":"equals","value":"intermediaire"},{"field":"screening","operator":"in","value":["vert"]}]}', 'info', 'allow_program', 'Programme OSTEOPOROSE_INTERMEDIAIRE_01 attribué automatiquement (niveau initial intermediaire, dépistage vert) — règle dérivée de B4 et des réponses du 23/08/2026, aucun contenu médical nouveau.', (select program_id from public.programs where program_code = 'OSTEOPOROSE_INTERMEDIAIRE_01'), true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-23'),
  ('ALLOW_PROGRAM_OSTEOPOROSE_AVANCE', 'OSTEOPOROSE', '{"all":[{"field":"niveau","operator":"equals","value":"avance"},{"field":"screening","operator":"in","value":["vert"]}]}', 'info', 'allow_program', 'Programme OSTEOPOROSE_AVANCE_01 attribué automatiquement (niveau initial avance, dépistage vert) — règle dérivée de B4 et des réponses du 23/08/2026, aucun contenu médical nouveau.', (select program_id from public.programs where program_code = 'OSTEOPOROSE_AVANCE_01'), true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-23')
on conflict (rule_id) do update set
  condition = excluded.condition,
  program_id = excluded.program_id,
  message = excluded.message,
  active = excluded.active,
  updated_at = now();

-- ===== SEED : 0014_adjust_progression_rules_dr_nikiema_20260831.sql =====
-- Intégration des réponses de Dr Wendtongo Brice Florent NIKIEMA au document
-- QUESTIONS_PROGRESSION_REGRESSION_20260823.docx (4 questions posées le
-- 23/08/2026, réponses reçues et complétées le 31/08/2026).
--
-- Synthèse de ses réponses (toutes Proposition A) :
--   Q1 (seuil de fatigue excessive)      -> fatigueApres >= 7/10 = vigilance.
--   Q2 (signal isolé/répété)             -> 1 signal isolé = maintain ;
--                                            2 séances consécutives avec le
--                                            même signal négatif = reduce ;
--                                            « tout signal rouge... prime
--                                            sur les règles de progression »
--                                            = suspend (réutilise le seuil
--                                            rouge transversal déjà validé,
--                                            réf. B1, douleur >= 7/10).
--   Q3 (périmètre de données)            -> démarrer avec adhésion/douleur/
--                                            fatigue/difficulté/réalisée,
--                                            déjà trackés ; gonflement/
--                                            raideur/baisse fonctionnelle
--                                            restent hors périmètre.
--   Q4 (surface produit)                 -> affichage informatif SEULEMENT ;
--                                            « ne modifie jamais
--                                            automatiquement le programme du
--                                            patient » — toute bascule de
--                                            niveau reste une action
--                                            volontaire (voir
--                                            apps/web/src/app/api/programs/
--                                            progress/route.ts).
--
-- Ces réponses sont traduites en faits par `computeProgressionFacts`
-- (packages/domain/src/sessions.ts, fait de synthèse `progression_signal`)
-- puis en 24 règles ci-dessous (une par décision × 6 pathologies) —
-- identiques d'une pathologie à l'autre car `progression_signal` et
-- `adherence_percent_semaine` sont calculés de façon générique à partir de
-- `sessions`, contrairement aux règles de dépistage qui portent sur des
-- champs spécifiques par pathologie.
--
-- §57, §59, §78 : une règle qui ne matche jamais aucun des 4 cas (ex.
-- « aucun signal négatif mais adhésion < 80 % ou inconnue ») ne déclenche
-- délibérément AUCUNE des 24 règles ci-dessous : `evaluateProgressionDecision`
-- renvoie alors MEDICAL_PARAMETER_REQUIRED (aucune recommandation affichée)
-- plutôt qu'un « maintain » deviné par défaut pour ce cas non couvert
-- explicitement par sa réponse.
insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, progression_decision, active, version, validated_by, validated_date)
select
  'PROGRESSION_SUSPEND_' || p.code,
  p.code,
  '{"field": "progression_signal", "operator": "equals", "value": "critique"}',
  'critical',
  'adjust_progression',
  'Votre douleur après la dernière séance est élevée. Par sécurité, nous vous recommandons de suspendre votre programme et d''en parler à un professionnel de santé avant de reprendre une activité physique.',
  'suspend',
  true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-31'
from public.pathologies p
where p.code in ('LOMBALGIE_COMMUNE', 'ARTHROSE_GENOU', 'ARTHROSE_HANCHE', 'POLYARTHRITE_RHUMATOIDE', 'SPONDYLOARTHRITE_AXIALE', 'OSTEOPOROSE')
on conflict (rule_id) do nothing;

insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, progression_decision, active, version, validated_by, validated_date)
select
  'PROGRESSION_REDUCE_' || p.code,
  p.code,
  '{"field": "progression_signal", "operator": "equals", "value": "repete"}',
  'warning',
  'adjust_progression',
  'Le même signal (douleur, fatigue ou difficulté) est revenu lors de vos deux dernières séances. Par prudence, nous vous recommandons de réduire temporairement l''intensité et/ou le volume de votre programme ; si cela persiste, parlez-en à un professionnel de santé.',
  'reduce',
  true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-31'
from public.pathologies p
where p.code in ('LOMBALGIE_COMMUNE', 'ARTHROSE_GENOU', 'ARTHROSE_HANCHE', 'POLYARTHRITE_RHUMATOIDE', 'SPONDYLOARTHRITE_AXIALE', 'OSTEOPOROSE')
on conflict (rule_id) do nothing;

insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, progression_decision, active, version, validated_by, validated_date)
select
  'PROGRESSION_MAINTAIN_' || p.code,
  p.code,
  '{"field": "progression_signal", "operator": "equals", "value": "isole"}',
  'info',
  'adjust_progression',
  'Un signal ponctuel (douleur, fatigue ou difficulté) est apparu lors de votre dernière séance. Ce n''est pas inquiétant à lui seul : votre programme est maintenu tel quel cette semaine.',
  'maintain',
  true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-31'
from public.pathologies p
where p.code in ('LOMBALGIE_COMMUNE', 'ARTHROSE_GENOU', 'ARTHROSE_HANCHE', 'POLYARTHRITE_RHUMATOIDE', 'SPONDYLOARTHRITE_AXIALE', 'OSTEOPOROSE')
on conflict (rule_id) do nothing;

insert into public.clinical_rules (rule_id, pathology, condition, severity, action, message, progression_decision, active, version, validated_by, validated_date)
select
  'PROGRESSION_PROGRESS_' || p.code,
  p.code,
  '{"all": [{"field": "progression_signal", "operator": "equals", "value": "aucun"}, {"field": "adherence_percent_semaine", "operator": "gte", "value": 80}]}',
  'info',
  'adjust_progression',
  'Vous suivez bien votre programme cette semaine, sans signal de vigilance particulier. Si vous vous sentez prêt(e), vous pouvez passer au niveau supérieur.',
  'progress',
  true, 'V1.0', 'Dr Wendtongo Brice Florent NIKIEMA', '2026-08-31'
from public.pathologies p
where p.code in ('LOMBALGIE_COMMUNE', 'ARTHROSE_GENOU', 'ARTHROSE_HANCHE', 'POLYARTHRITE_RHUMATOIDE', 'SPONDYLOARTHRITE_AXIALE', 'OSTEOPOROSE')
on conflict (rule_id) do nothing;

-- ===== SEED : 0015_exercise_phases_dr_nikiema_20260831.sql =====
-- Intégration de la réponse de Dr Wendtongo Brice Florent NIKIEMA à la
-- Question 1 de `QUESTIONS_SEANCE_CAPACITE_FONCTIONNELLE_20260830.docx`
-- (réf. B8, structure de séance en 3 phases), réponse reçue et complétée
-- le 31/08/2026.
--
-- Réponse : les 8 exercices déjà validés (0011_exercises_validation_
-- dr_nikiema_20260823.sql) sont tous classés en « Partie principale »
-- (proposition de l'assistant confirmée telle quelle, tableau non corrigé).
--
-- Deux contraintes explicites ajoutées par Dr Nikiema dans le document
-- (encadrés) sont respectées ici et documentées pour toute évolution
-- future du code :
--   1. « L'application ne doit pas déduire automatiquement la phase d'un
--      exercice à partir de sa catégorie ou de son nom » — ce fichier est
--      donc un UPDATE explicite, exercice par exercice, sur les identifiants
--      réellement chargés en base (mêmes 8 exercise_id que 0011), jamais une
--      règle générique de classification automatique par nom/catégorie.
--   2. « Ne pas fabriquer artificiellement un échauffement ou un retour au
--      calme à partir des 8 exercices existants » — aucun exercice n'est
--      donc reclassé en 'echauffement' ou 'retour_au_calme' ici : tant
--      qu'aucun contenu d'échauffement/retour au calme réel n'est fourni et
--      validé par Dr Nikiema, l'écran de séance affichera une « Partie
--      principale » seule (les 8 exercices), sans sections d'échauffement/
--      retour au calme vides ou inventées — comportement déjà géré par
--      `SessionFlow.tsx` (§28, Sprint 18).
--
-- Les identifiants ci-dessous sont ceux réellement chargés en base par 0010
-- (mêmes 8 exercise_id que 0011_exercises_validation_dr_nikiema_20260823.sql).

update public.exercise_library
set phase = 'principal',
    last_reviewed = current_date,
    updated_at = now()
where exercise_id in (
  'd6f353e0-9442-4bf2-9c6f-3ae2d3414039',
  '8ec87752-fd97-4cf9-be89-d7a43e4f9672',
  '1933750b-d11a-4324-8af6-200d2cd34618',
  '4c7c37e4-da9f-4893-87af-0f03562273a4',
  '208903af-4b2b-4dd4-8ced-02ad030d014a',
  '81dc6666-8d7f-49ce-b6e3-50d5ef921690',
  '3bf422dc-88d8-44d9-a656-d6ddfaddb74b',
  'b9475f5e-4c07-4da5-ba9a-925736870ec5'
)
and (phase is distinct from 'principal');


-- ===== MIGRATION : 0017_grants_and_users_insert_policy.sql (ajoutée le 2026-09-06) =====
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


-- ===== MIGRATION : 0018_quarterly_billing_period.sql (ajoutée le 2026-09-09) =====
-- Sprint 15 (09/09/2026) : nouvelle périodicité « trimestrielle », à la
-- demande du Dr Nikiema, qui souhaite remplacer l'offre annuelle par une
-- offre trimestrielle. Le plan `premium_yearly` est conservé tel quel comme
-- identifiant technique (clé primaire référencée par `subscriptions.plan_code`)
-- pour ne rien casser côté souscriptions déjà existantes ; seuls son libellé,
-- son prix et sa périodicité changent (voir aussi packages/domain/src/
-- subscriptions.ts, dont le commentaire documente ce choix).
--
-- Vérifié avant exécution : le nom de la contrainte CHECK existante est bien
-- `subscription_plans_billing_period_check` (confirmé via une requête sur
-- pg_constraint), donc le DROP CONSTRAINT IF EXISTS ci-dessous s'applique
-- correctement et n'est pas un no-op silencieux.
--
-- Exécuté et vérifié en production le 09/09/2026 : les 2 plans premium
-- affichent désormais price_amount=5000/monthly et
-- price_amount=10000/quarterly avec name_fr='Premium (trimestriel)'.

alter table public.subscription_plans
  drop constraint if exists subscription_plans_billing_period_check;

alter table public.subscription_plans
  add constraint subscription_plans_billing_period_check
  check (billing_period in ('monthly', 'quarterly', 'yearly'));

update public.subscription_plans
set
  price_amount = 5000,
  payment_instructions_fr = 'Effectuez un transfert de 5 000 FCFA au nom de NIKIEMA Brice : via Orange Money au +226 76 01 03 06, ou via Moov Money au +226 62 15 22 46. Une fois le transfert effectue, indiquez ci-dessous la reference de la transaction fournie par votre operateur. Votre abonnement sera active apres verification par notre equipe.',
  updated_at = now()
where plan_code = 'premium_monthly';

update public.subscription_plans
set
  name_fr = 'Premium (trimestriel)',
  price_amount = 10000,
  billing_period = 'quarterly',
  updated_at = now()
where plan_code = 'premium_yearly';
