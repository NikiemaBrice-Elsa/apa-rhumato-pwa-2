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
