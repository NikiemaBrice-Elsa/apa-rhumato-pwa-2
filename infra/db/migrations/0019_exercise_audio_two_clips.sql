-- Sprint 20 (10/09/2026) : « coach vocal intégré » — priorisé par Dr Nikiema
-- devant la configuration Resend/SMTP et les notifications push (voir
-- docs/DECISIONS.md, FEUILLE_DE_ROUTE_20260821.md section 4bis).
--
-- Sa réponse du 10/09/2026 choisit deux clips audio par exercice plutôt
-- qu'un seul, conformément à la maquette initiale du document
-- "contenu audio APAS en rhumato.docx" (audio de préparation, puis audio
-- pendant l'exercice) : `audio_url` (Sprint 5, jamais rempli, jamais lu
-- côté patient) est renommé en `audio_preparation_url` et une nouvelle
-- colonne `audio_exercise_url` est ajoutée. Le renommage est sûr : la
-- colonne est vide pour les 8 exercices déjà validés (vérifié le 10/09/2026).
--
-- Périmètre V1 (voir docs/DECISIONS.md, Sprint 20) : uniquement la partie
-- principale — aucun contenu d'échauffement/retour au calme n'existe (Dr
-- Nikiema a explicitement choisi de ne pas le fournir pour l'instant,
-- Question 1 du 09/09/2026) donc aucun audio de ce type ne sera construit
-- tant qu'il ne sera pas soumis séparément et validé.
--
-- Aucun contenu audio n'est inséré par cette migration : Dr Nikiema
-- enregistrera lui-même (Question 5 du 09/09/2026) et déposera les liens via
-- l'écran d'administration des exercices, exactement comme video_url/
-- thumbnail_url depuis le Sprint 5.

alter table public.exercise_library rename column audio_url to audio_preparation_url;
alter table public.exercise_library add column if not exists audio_exercise_url text;

comment on column public.exercise_library.audio_preparation_url is 'Coach vocal (Sprint 20) : audio joué avant l''exercice ("audio de préparation" dans la maquette initiale).';
comment on column public.exercise_library.audio_exercise_url is 'Coach vocal (Sprint 20) : audio joué pendant l''exercice.';
