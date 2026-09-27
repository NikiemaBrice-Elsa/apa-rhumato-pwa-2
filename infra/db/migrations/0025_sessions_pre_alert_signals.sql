-- Sprint 33 (27/09/2026, Dr Nikiema, document Questions/Réponses, Question 3).
--
-- Dr Nikiema a testé l'application en simulant une douleur à 9/10 juste
-- avant de démarrer une séance (« Vérification rapide », §28 étape 2) :
-- rien ne l'a averti ni empêché de démarrer quand même. Vérification faite :
-- aucun seuil n'existait sur la douleur AVANT séance (seuls des seuils sur
-- la douleur/fatigue APRÈS séance existent, packages/domain/src/sessions.ts,
-- pour un signal de progression purement informatif). Réponse (a) : un
-- avertissement avec confirmation obligatoire (jamais un blocage strict),
-- seuil douleur >= 5/10, identique pour les 6 pathologies. Réponse
-- complémentaire : en plus de la douleur, ajouter gonflement articulaire,
-- fièvre et symptôme inhabituel comme signaux déclencheurs à part entière.
--
-- Ces trois nouvelles colonnes enregistrent simplement CE QUE LE PATIENT A
-- DÉCLARÉ à cet instant (jamais recalculées) — la logique de déclenchement
-- de l'avertissement (`shouldWarnBeforeSession`, packages/domain/src/
-- sessions.ts) et le choix du patient (continuer ou non) ont déjà eu lieu
-- côté client avant l'appel à `POST /api/sessions` ; ces colonnes ne servent
-- qu'à la traçabilité (§65), jamais à un contrôle serveur bloquant.
--
-- Question 4 (revérifier le statut « rouge » du dépistage initial avant
-- chaque séance) est explicitement reportée à plus tard par Dr Nikiema
-- (réponse (a)) — aucune colonne ni logique correspondante ici.
alter table public.sessions
  add column if not exists gonflement_articulaire_avant boolean not null default false,
  add column if not exists fievre_avant boolean not null default false,
  add column if not exists symptome_inhabituel_avant boolean not null default false;

comment on column public.sessions.gonflement_articulaire_avant is
  'Gonflement articulaire déclaré par le patient juste avant de démarrer cette séance (Sprint 33, 27/09/2026, Question 3) — signal déclencheur de l''avertissement avant séance, jamais un blocage serveur.';

comment on column public.sessions.fievre_avant is
  'Fièvre déclarée par le patient juste avant de démarrer cette séance (Sprint 33, 27/09/2026, Question 3) — signal déclencheur de l''avertissement avant séance, jamais un blocage serveur.';

comment on column public.sessions.symptome_inhabituel_avant is
  'Symptôme inhabituel déclaré par le patient juste avant de démarrer cette séance (Sprint 33, 27/09/2026, Question 3) — signal déclencheur de l''avertissement avant séance, jamais un blocage serveur.';

-- Recharge immédiate du cache de schéma PostgREST (leçon du Sprint 33 :
-- sans cet appel, l'API peut continuer à répondre « colonne introuvable »
-- pendant un moment après une migration DDL faite depuis le SQL Editor).
NOTIFY pgrst, 'reload schema';
