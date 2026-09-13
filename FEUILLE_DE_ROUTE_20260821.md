# Feuille de route — ce qu'il reste avant une application pleinement fonctionnelle

Photographie au 21/08/2026. Le détail ligne par ligne reste à jour dans `docs/MEDICAL_VALIDATION_NEEDED.md` (contenu médical) et `docs/DECISIONS.md` (choix techniques, section « Ce qui n'est toujours pas fait » de chaque sprint) — ce document en est une synthèse organisée par priorité, pour répondre à « qu'est-ce qui reste, concrètement ».

## 1. Ce qui bloque aujourd'hui l'attribution d'un programme réel à un patient

C'est le point le plus important : même avec un dépistage vert fonctionnel, aucun patient ne reçoit aujourd'hui de programme concret, faute de trois éléments liés entre eux.

- **Bibliothèque d'exercices** : 8 exercices sourcés sur la littérature citée au §81, complétés par des propositions génériques (ACSM/Borg) explicitement demandées par vous. **Mise à jour du 23/08 (intégration) : validés et activés** (« Je valide. Tu peux les intégrer », `infra/db/seed/0011_exercises_validation_dr_nikiema_20260823.sql`) — `medical_validation_status = 'validated'`, désormais visibles côté client authentifié.
- **Contenu des programmes** : chaque combinaison pathologie × niveau (débutant/intermédiaire/avancé) a désormais une fiche FITT-VP complète (fréquence, intensité, temps, type, volume, progression), rédigée à partir des 10 références du §81 et complétée par des propositions génériques que vous avez explicitement demandées et validées. **Mise à jour du 23/08 (intégration) : les 18 programmes sont validés et activés** (`infra/db/seed/0012_programs_validation_dr_nikiema_20260823.sql`) — `medical_validation_status = 'validated'`, désormais visibles côté client authentifié.
- **Règles d'attribution (`allow_program`)** : le moteur qui décide quel programme proposer selon le dépistage, le niveau et la douleur est prêt et testé. **Mise à jour du 23/08 (finalisation) : les 18 règles réelles sont maintenant actives**, à partir de vos réponses à `QUESTIONS_ALLOW_PROGRAM_20260823.docx` (`infra/db/seed/0013_allow_program_rules_dr_nikiema_20260823.sql`) — le niveau initial est calculé automatiquement à partir de votre niveau d'activité déclaré, plafonné à débutant en cas de dépistage orange, comme vous l'avez précisé.

**Les trois éléments de cette section sont désormais tous en place et validés (23/08/2026).** Un patient authentifié qui complète une évaluation initiale peut maintenant recevoir un programme réel de façon entièrement automatique, dans le respect des garanties de sécurité que vous avez validées (rouge bloque tout ; orange plafonne au plus prudent).

## 2. Sécurité du dépistage — désormais close

Le dépistage de sécurité (vert/orange/rouge) est aujourd'hui fonctionnel pour les six pathologies, et les deux derniers points légers sont désormais réglés :

- **Relecture formelle des nouveaux messages** (issus de vos réponses Q2 à Q6, 21/08/2026) : soumise le 23/08/2026 (`RELECTURE_MESSAGES_Q2_Q6_20260823.docx`). **Mise à jour du 31/08 : validée sans correction** (« PAS DE CORRECTION A APPORTER ; TU PEUX INTEGRER ») — les 7 messages sont définitivement actifs tels quels.
- **Règles de progression/régression réelles** (`adjust_progression`) : les 4 points soumis le 23/08/2026 (`QUESTIONS_PROGRESSION_REGRESSION_20260823.docx`) ont reçu une réponse complète le 31/08. **Mise à jour du 31/08 : 24 règles réelles sont désormais actives** (une par décision × 6 pathologies) et affichées, en lecture seule, sur la page « Mes statistiques » — un bouton de bascule de niveau n'apparaît que lorsque la recommandation est « progresser », et reste une action volontaire de votre part (jamais automatique).

## 3. Fonctionnalités que vous avez déjà décrites, et qui sont maintenant en place

Ces quatre points avaient chacun une réponse de votre part, nécessitant une évolution du produit (nouveaux écrans, nouveaux champs de base de données) au-delà du seul contenu — **cette section est désormais entièrement close (31/08/2026)** :

- **Structure de séance** (échauffement / partie principale / retour au calme, réf. B8) : **mise à jour du 31/08 : close.** Les 8 exercices existants sont classés en « Partie principale » selon votre réponse à `QUESTIONS_SEANCE_CAPACITE_FONCTIONNELLE_20260830.docx` (Q1). Aucun exercice n'est classé échauffement/retour au calme — inventer ce contenu aurait été contraire à votre consigne explicite ; l'écran de séance affiche donc une « Partie principale » seule tant qu'un contenu réel de ce type ne vous a pas été soumis.
- **Capacité fonctionnelle** (PROMIS Physical Function + PSFS, réf. B10) : **mise à jour du 31/08 : close pour la V1.** Le PSFS est intégré et actif (page « Mes statistiques »). Votre réponse à la Question 2 (Proposition C) confirme que PROMIS reste différé : le PSFS est le seul instrument de capacité fonctionnelle de la V1, sans approximation de PROMIS à partir d'échelles génériques. PROMIS pourra être revisité si vous nous donnez accès à l'API officielle ou un formulaire court fixe.
- **« Séance du jour » planifiée** (réf. B11) : **mise à jour du 31/08 (suite) : close.** Le tableau de bord affiche désormais une carte « Séance du jour » générée automatiquement à partir de la fréquence hebdomadaire de votre programme validé, avec fenêtre de réalisation flexible et report libre sans pénalisation, comme vous l'aviez demandé. Vous pouvez aussi annuler une séance planifiée pour raison de sécurité. Seul point à noter : la répartition des JOURS précis de la semaine (ex. lundi/mercredi/vendredi pour 3 séances) est une convention technique de ma part, pas une donnée que vous nous aviez chiffrée — dites-nous si vous préférez une autre logique.
- **Nouvelle formule d'adhésion** (réf. B13) : **mise à jour du 31/08 (suite) : close.** La page « Mes statistiques » affiche désormais vos 2 indicateurs (séances complètes/prescrites, dose réelle/prescrite), avec le seuil de 80 % que vous aviez donné. Nous avons dû ajouter des cases à cocher par exercice à l'écran de séance : sans cela, il était impossible de savoir quels exercices avaient réellement été faits. Point de transparence : la recommandation de progression (celle qui vous a été livrée hier) continue d'utiliser l'ancienne formule d'adhésion — nous ne l'avons pas basculée vers la nouvelle sans votre confirmation, pour ne rien changer silencieusement à un comportement déjà validé.

## 4. Fonctionnalités prévues par le cahier des charges mais volontairement pas activées en V1

- Espace professionnel de santé pour consulter les rapports (§41). **Mise à jour du 13/09 : ACTIVÉ** (Sprint 23, `docs/DECISIONS.md`) — un professionnel de santé (compte `role = 'professional'`, attribué par vous depuis `/admin/utilisateurs`) peut désormais consulter, en lecture seule, le rapport d'un patient qui l'a explicitement invité et autorisé. Reste à faire : créer un premier compte professionnel réel pour l'essayer.
- Envoi du rapport PDF par email, et historique des rapports déjà générés (aujourd'hui, chaque génération est à la demande, rien n'est conservé).
- Envoi réel de notifications push (aujourd'hui, les notifications existent uniquement dans l'application, pas en dehors). **Mise à jour du 10/09 : repoussé après le coach vocal intégré**, à la demande explicite de Dr Nikiema.
- Passerelle de paiement réelle — le mécanisme actuel est une réconciliation manuelle (le patient transfère via Mobile Money et déclare la référence, un administrateur vérifie et confirme). **Mise à jour du 13/09 : confirmé par vous** — la réconciliation manuelle est conservée, pas de passerelle automatique prévue pour l'instant.
- Verrouillage de fonctionnalités derrière l'abonnement Premium — décision produit encore en attente de votre part, rien n'est verrouillé aujourd'hui. **Mise à jour du 13/09 : vous avez demandé qu'on définisse cela maintenant** — une proposition de fonctionnalités candidates vous sera soumise en document Word.
- Configuration Resend/SMTP pour les emails d'authentification Supabase — en attente, non commencée. **Mise à jour du 10/09 : repoussée après le coach vocal intégré**, à la demande explicite de Dr Nikiema.
- Cadence des notifications de rappel (heure du rappel quotidien). **Mise à jour du 13/09 : ACTIVÉE** (Sprint 23) — chaque patient choisit désormais sa propre heure de rappel quotidien dans son profil, plutôt qu'une heure fixe imposée.
- Échelle de difficulté/intensité des exercices (texte libre aujourd'hui) — vous avez demandé le 13/09 qu'une échelle formelle vous soit proposée ; à venir.

## 4bis. Nouveau chantier prioritaire (10/09/2026) — « Coach vocal intégré »

Dr Nikiema a validé l'ajout du « coach vocal d'APA » (mini-audios diffusés pendant la séance, voir `contenu audio APAS en rhumato.docx`) à la feuille de route, **en priorité** : ce chantier passe devant la configuration Resend/SMTP et les notifications push (section 4 ci-dessus).

- **Périmètre V1** : uniquement la partie principale (les 8 exercices déjà validés), puisqu'aucun contenu d'échauffement/retour au calme n'a été fourni (réponse « a » à la Question 1 du 09/09/2026) — aucun audio de ce type ne sera construit tant que ce contenu ne sera pas soumis séparément et validé, comme pour la structure de séance en 3 phases (Sprint 18, `docs/DECISIONS.md`).
- **Qui enregistre** : Dr Nikiema lui-même (réponse « a » à la Question 5 du 09/09/2026).
- **Deux clips par exercice**, confirmé le 10/09/2026 (audio de préparation + audio pendant l'exercice, conforme à sa maquette initiale).
- **Mise à jour du 10/09 : infrastructure technique désormais construite et déployée** (voir `docs/DECISIONS.md`, Sprint 20) : `exercise_library.audio_preparation_url`/`audio_exercise_url` (migration 0019, exécutée en production), lecteur audio natif affiché pendant la séance et dans la bibliothèque d'exercices dès qu'un lien est renseigné, écran d'administration des exercices mis à jour avec les deux champs correspondants. **Il ne reste plus qu'une étape : que Dr Nikiema enregistre et dépose ses audios via `/admin/exercices`** — dès qu'un lien est renseigné pour un exercice, il apparaît automatiquement côté patient, sans développement supplémentaire.

## 5. Mise en production — indépendant du contenu médical

Ce sont des étapes techniques, à faire une fois que vous jugez le contenu suffisant pour un premier déploiement réel :

- Créer un projet Supabase réel et renseigner les variables d'environnement.
- Exécuter les migrations puis les seeds sur cette base réelle, dans l'ordre.
- Provisionner votre premier compte administrateur (procédure documentée dans `docs/DEPLOYMENT.md`).
- ~~Renseigner un numéro Mobile Money / Orange Money / Moov Money réel avant d'ouvrir de vraies inscriptions Premium — le champ est aujourd'hui vide.~~ **Fait** : les numéros réels sont en base depuis début septembre (migration dédiée) — ce point était encore listé ici par erreur, corrigé le 13/09/2026 (voir `docs/DECISIONS.md`, Sprint 22).
- Héberger l'application (Vercel recommandé) et configurer les variables d'environnement côté hébergeur.
- Vérifier le rendu du rapport PDF une première fois en conditions réelles (point de vigilance technique connu, lié à l'environnement serverless).
- Vérifier manuellement le mode hors connexion après déploiement (non testable automatiquement).
- Lancer le script de vérification des permissions (`verify_rls.sh`) avant tout déploiement touchant les règles d'accès — aucune vérification continue automatique n'est en place, cette étape doit être faite à la main.
- Faire un test manuel de bout en bout de l'application assemblée, une fois le contenu médical jugé suffisant.

## Un ordre possible

Rien n'oblige à suivre cet ordre. **Mise à jour du 23/08 : la section 1 est désormais entièrement close** — un patient peut recevoir un programme réel de bout en bout. **Mise à jour du 31/08 : les sections 2 et 3 sont désormais entièrement closes.** Il ne reste plus, sur cette feuille de route, que la section 4 (fonctionnalités volontairement différées, pas d'action requise) et la section 5 (mise en production) — à mener dès que vous jugez le contenu médical suffisant pour un premier déploiement réel.
