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
