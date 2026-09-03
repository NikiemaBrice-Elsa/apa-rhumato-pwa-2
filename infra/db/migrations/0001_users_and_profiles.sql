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
