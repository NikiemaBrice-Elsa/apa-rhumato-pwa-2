# Synthèse — Les règles d'attribution automatique sont actives (23/08/2026)

Vos réponses aux 2 dernières questions ont débloqué la dernière pièce manquante : un patient peut désormais recevoir un programme réel de bout en bout, sans intervention humaine.

## Ce qui a été fait à partir de vos réponses

**Q1 (niveau initial).** Votre niveau d'activité physique déclaré à l'inscription (1 à 5) détermine maintenant automatiquement le niveau de départ : 1-2 → débutant, 3 → intermédiaire, 4-5 → avancé, exactement comme vous l'avez confirmé (Proposition A). En cas de dépistage orange, le niveau est automatiquement plafonné à débutant, quel que soit le niveau d'activité déclaré — comme vous l'avez précisé.

**Q2 (accès en dépistage orange).** Un dépistage orange autorise désormais l'attribution automatique d'un programme, mais exclusivement au niveau débutant. Le programme débutant déjà validé (avec ses propres critères de sécurité) constitue l'« adaptation de sécurité » — je n'ai rien ajouté au-delà de ce que vous avez décrit, pour ne pas inventer une granularité que vous n'avez pas fournie. Si vous souhaitiez une adaptation plus fine selon le motif précis de l'alerte, dites-le-moi et nous en discutons.

## Ce qui a changé techniquement

18 règles réelles (une par programme déjà validé) décident maintenant, à partir du dépistage et du niveau initial, quel programme proposer. Une sécurité supplémentaire a été ajoutée de mon initiative, au-delà de la lettre de votre réponse : même si un bug venait un jour affecter le calcul du niveau initial, la règle elle-même empêche qu'un dépistage orange déclenche autre chose qu'un programme débutant — deux protections indépendantes plutôt qu'une seule.

Concrètement, pour un patient authentifié : dépistage → niveau initial → programme, entièrement automatique, dans le respect strict de vos garanties (rouge bloque tout, orange reste au plus prudent).

## Vérifications effectuées

18/18 règles chargées, actives, toutes rattachées à un programme réel (aucune orpheline). J'ai aussi simulé le parcours complet sur une dizaine de cas concrets (activité 5 + vert → programme avancé ; activité 3 + vert → intermédiaire ; activité 5 + orange → plafonné débutant ; dépistage rouge, en attente, ou activité physique inconnue → jamais d'attribution ; et un scénario délibérément forcé pour vérifier que la seconde protection fonctionne bien indépendamment) : tous les résultats sont conformes à vos réponses. La suite de tests automatisés (332 tests, dont 11 nouveaux pour cette classification) reste entièrement au vert, et le contrôle de sécurité des permissions (37 scénarios) ne montre aucune régression.

## Ce qui reste ouvert

Les trois éléments qui bloquaient l'attribution d'un programme réel (exercices, contenu des programmes, règles d'attribution) sont désormais tous en place. La suite naturelle, si vous le souhaitez, porte sur les points plus légers de la feuille de route : relecture formelle des nouveaux messages de dépistage, ou traduction de vos règles de progression/régression (réf. B2, B9) en mécanisme actif.
