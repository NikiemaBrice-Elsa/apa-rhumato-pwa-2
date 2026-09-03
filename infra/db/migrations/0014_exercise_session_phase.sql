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
