# Analyse des réponses au questionnaire de validation médicale (20/08/2026)

Document de travail — synthèse de vos réponses à `APA_Questionnaire_Validation_Medicale_20260820.docx`, de ce qui a déjà été intégré dans le code/la base, et de ce qui reste à faire. Les détails complets de chaque réponse restent dans le fichier Word que vous avez renvoyé ; ce document sert de tableau de bord, pas de duplication.

## 1. Ce qui a été intégré immédiatement (sans aucune interprétation nécessaire)

| Réf. | Décision | Où c'est fait |
|---|---|---|
| A1 | Approbation telle quelle : arthrite septique suspectée (genou, hanche, PR — Coakley et al. 2006) | `infra/db/seed/0006_validation_medicale_dr_nikiema_20260820.sql` — 3 règles passées `active = true` |
| A2 | Approbation telle quelle : traumatisme récent → risque de fracture rachidienne (spondyloarthrite axiale — Shah et al. 2019) | même fichier — 1 règle activée |
| G3 | Reformulation validée du message « fracture récente signalée » | `packages/domain/src/screening.ts` + le même fichier seed (message mis à jour en base) |
| B14 (partiel) | Rappel d'absence d'activité ramené de 7 à 4 jours (milieu de votre fourchette 3-5 jours) | `packages/domain/src/notifications.ts` |
| D3 (partiel) | Seuil de douleur genou (vert 0-3, orange 4-5, rouge > 5) transcrit dans le gabarit Excel et converti en 2 propositions (toujours `active = false`, à valider comme le reste) | `infra/db/seed/tools/gabarit_seuils_cliniques.xlsx` + `infra/db/seed/0007_proposed_thresholds_douleur_genou.sql` |

**289 tests automatisés rejoués après ces changements — tous au vert, aucune régression.** `docs/MEDICAL_VALIDATION_NEEDED.md` a été mis à jour ligne par ligne pour refléter l'état réel de chacun de vos points de réponse (A1-G3).

Ces 5 points sont les seuls à avoir été traduits en code ou en données ce jour, parce que ce sont les seuls dont l'interprétation technique ne laisse aucune place au doute. Tout le reste de vos réponses est extrêmement riche mais nécessite soit une clarification de votre part (section 2), soit un travail d'implémentation qui dépasse une simple mise à jour de contenu (section 3).

## 2. Un point à trancher avant d'aller plus loin

Trois de vos réponses donnent des seuils numériques différents pour la même échelle de douleur 0-10 :

- **B1** (transversal, « toutes les pathologies ») : vert 0-3, orange 4-6, rouge > 6.
- **C3** (spécifique lombalgie) : vert ≤ 4, orange ≥ 5.
- **D3** (spécifique arthrose du genou) : vert 0-3, orange 4-5, rouge > 5.

Je n'ai tranché aucun des trois moi-même — les trois valeurs restent en attente en base (aucune n'est activée), documentées dans `docs/MEDICAL_VALIDATION_NEEDED.md`. Pourriez-vous préciser : le seuil B1 est-il la règle par défaut, avec C3 et D3 comme exceptions spécifiques à leur pathologie ? Ou souhaitez-vous harmoniser les trois sur une seule valeur ?

## 3. Ce qui reste à construire (candidat pour un prochain sprint)

Vos réponses B2 à B13, C1-C2, D1-D2, E1-E2, F1-F2 et G1-G2 sont toutes des décisions cliniques claires et exploitables — mais leur traduction en code va au-delà d'une simple activation de règle. Elles nécessitent, selon les cas :

- une évolution du schéma de données (ex. B13 : distinguer séance commencée/partielle/complète/reportée/annulée-sécurité — le champ n'existe pas encore dans la table `sessions`) ;
- une fonctionnalité entièrement nouvelle (ex. B11 : « séance du jour » planifiée à l'avance — n'existe pas aujourd'hui ; B10 : intégrer les questionnaires PROMIS Physical Function et PSFS) ;
- l'écriture de nombreuses règles cliniques réelles à partir de vos critères narratifs (ex. F1 : statuts vert/orange/rouge complets pour la spondyloarthrite axiale ; G1/G2 : risque de chute et mouvements contre-indiqués en ostéoporose ; D1/D2 : nouvelles questions de dépistage post-chirurgie/traumatisme genou-hanche) ;
- une passe de reformulation patient-facing, item par item (C1 : les 11 items de dépistage lombalgie ; B12 : messages orange par module).

Rien de tout cela n'a été inventé en attendant : chaque point reste documenté fidèlement dans `docs/MEDICAL_VALIDATION_NEEDED.md`, avec le contenu exact de votre réponse à portée de main pour l'implémentation à venir.

**Comment souhaitez-vous procéder ?** Je peux soit démarrer directement ce travail d'implémentation (à traiter comme un nouveau sprint, probablement découpé en plusieurs livraisons vu le volume), soit attendre votre retour sur le point de la section 2 avant de commencer, soit prioriser un sous-ensemble particulier si certains points vous semblent plus urgents que d'autres (par exemple : activer les seuils de douleur en premier, ou construire la « séance du jour » avant le reste).
