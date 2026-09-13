-- Sprint 23 : rappel quotidien à une heure choisie par le patient (§39).
--
-- Réponse de Dr Nikiema (13/09/2026, Q5 de Feuille_de_route_prioritaire_20260912.docx) :
-- « Rappel quotidien à une heure qui sera précisée par le patient lui-même »,
-- plutôt qu'une heure fixe imposée par l'administrateur. Stockée en texte
-- "HH:MM" (et non le type `time` de Postgres) : la comparaison applicative se
-- fait entre deux chaînes "heure murale" du patient (voir
-- `isReminderTimeReached`, packages/domain/src/notifications.ts), jamais par
-- conversion en instant absolu — cette table ne connaît pas le fuseau
-- horaire du patient, et ne doit pas prétendre le déduire de l'heure serveur.
alter table public.patient_profiles
  add column if not exists reminder_time text not null default '09:00'
  check (reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

comment on column public.patient_profiles.reminder_time is
  'Heure locale (HH:MM) à laquelle le patient souhaite recevoir son rappel quotidien de séance (§39, Sprint 23, 13/09/2026). Comparée à l''heure locale transmise par le client — jamais à l''heure serveur (UTC).';
