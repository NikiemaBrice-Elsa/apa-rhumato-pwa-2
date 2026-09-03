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
