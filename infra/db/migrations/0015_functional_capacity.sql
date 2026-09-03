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
