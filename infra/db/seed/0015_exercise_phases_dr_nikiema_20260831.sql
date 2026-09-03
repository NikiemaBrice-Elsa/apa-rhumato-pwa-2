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
