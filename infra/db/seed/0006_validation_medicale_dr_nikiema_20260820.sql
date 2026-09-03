-- Intégration des réponses de Dr Wendtongo Brice Florent NIKIEMA au
-- questionnaire de validation médicale du 20/08/2026 (APA_Questionnaire_
-- Validation_Medicale_20260820.docx, réponses complétées le 20/08/2026).
--
-- Portée de ce fichier : UNIQUEMENT les décisions sans aucune ambiguïté
-- d'interprétation — approbation explicite, telle quelle, d'une règle déjà
-- rédigée et sourcée (§57, §59, §78 : on n'active jamais un mécanisme de
-- sécurité sur une réponse qui laisse place à interprétation technique).
-- Les réponses plus riches (seuils gradués, formules, structure de séance,
-- etc.) sont documentées dans docs/MEDICAL_VALIDATION_NEEDED.md et
-- docs/DECISIONS.md, mais nécessitent un travail d'implémentation
-- (nouveaux champs, nouvelles règles, UI) avant de pouvoir être traduites
-- en `clinical_rules` — voir la synthèse livrée au concepteur médical.

-- Référence A1 du questionnaire : « Oui j'approuve cette règle de sécurité
-- telle quelle » pour arthrose du genou, arthrose de la hanche et
-- polyarthrite rhumatoïde (suspicion d'arthrite septique, Coakley et al.
-- 2006). Les 3 règles proposées dans 0004_proposed_red_flags_pending_
-- validation.sql sont donc activées sans aucune modification de condition
-- ni de message.
update public.clinical_rules
set active = true,
    validated_by = 'Dr Wendtongo Brice Florent NIKIEMA',
    validated_date = '2026-08-20'
where rule_id in ('PROPOSED_OA_GENOU_HOT_JOINT', 'PROPOSED_OA_HANCHE_HOT_JOINT', 'PROPOSED_PR_HOT_JOINT')
  and validated_by is null;

-- Référence A2 du questionnaire : « Oui j'approuve cette règle de sécurité
-- telle quelle » pour la spondyloarthrite axiale (traumatisme récent même
-- mineur → risque de fracture rachidienne, Shah et al. 2019).
update public.clinical_rules
set active = true,
    validated_by = 'Dr Wendtongo Brice Florent NIKIEMA',
    validated_date = '2026-08-20'
where rule_id = 'PROPOSED_AXSPA_TRAUMA_FRACTURE_RISK'
  and validated_by is null;

-- Référence G3 du questionnaire : reformulation validée du message affiché
-- en cas de fracture récente signalée (ostéoporose). La règle OSTEO_RECENT_
-- FRACTURE (0003_clinical_rules.sql) était déjà `active = true` depuis le
-- Sprint 3 (§21 du cahier des charges impose directement cette règle) mais
-- son message patient-facing restait un texte provisoire non validé — il
-- est remplacé ici par la formulation de Dr Nikiema (voir
-- packages/domain/src/screening.ts, OSTEOPOROSE_RECENT_FRACTURE_MESSAGE,
-- qui doit rester synchronisé avec cette valeur).
update public.clinical_rules
set message = 'Vous avez indiqué avoir eu une fracture récemment. Pour votre sécurité, nous ne pouvons pas vous proposer automatiquement un programme d''exercices. Avant de commencer ou de reprendre une activité physique, demandez l''avis du professionnel de santé qui vous suit. Le programme pourra être proposé progressivement après validation et selon les consignes médicales reçues. Ne modifiez pas votre traitement ou vos consignes de rééducation sur la base de cette application.',
    validated_by = 'Dr Wendtongo Brice Florent NIKIEMA',
    validated_date = '2026-08-20'
where rule_id = 'OSTEO_RECENT_FRACTURE';

-- Rappel : à partir de maintenant, ces 4 règles produisent un statut
-- « rouge » réel (orientation médicale) dès que les champs fievre /
-- gonflement+chaleur_locale (genou, hanche, PR) ou traumatisme_recent
-- (spondyloarthrite axiale) sont renseignés positivement au dépistage —
-- alors qu'auparavant ces 4 pathologies ne produisaient jamais que
-- `pending_validation` (aucun red flag actif, voir §58, Sprint 6bis).
-- Vérifier `infra/db/scripts/verify_rls.sh` et la suite de tests
-- (`packages/rules-engine`) après application de ce seed en environnement
-- de développement, puis en production.
