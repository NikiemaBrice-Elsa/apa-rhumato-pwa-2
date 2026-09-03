# Synthèse — Intégration des exercices et des programmes validés (23/08/2026)

Suite à votre validation (« Je valide. Tu peux les intégrer »), les deux documents que vous avez relus sont maintenant en base, avec le statut `validated`.

## 1. Les 8 exercices sont validés et actifs

`infra/db/seed/0011_exercises_validation_dr_nikiema_20260823.sql` fait passer les 8 exercices de `pending_validation` à `validated`. Aucun champ n'a été modifié — c'est un simple changement de statut, le contenu reste exactement celui que vous avez relu dans `RELECTURE_EXERCICES_20260823_AVEC_PROPOSITIONS.docx` (y compris les propositions en bleu). Ils sont désormais visibles côté application pour un utilisateur authentifié.

## 2. Les 18 programmes sont validés et actifs

`infra/db/seed/0012_programs_validation_dr_nikiema_20260823.sql` crée les 18 lignes `programs` (6 pathologies × 3 niveaux) directement à partir du contenu de `QUESTIONS_PROGRAMMES_FITTVP_20260823_AVEC_PROPOSITIONS.docx`, statut `validated` dès l'insertion, ainsi que les 57 liens vers les références bibliographiques concernées.

Deux choix techniques à signaler, faits pour rester fidèle à votre document tout en respectant la structure de la base :

- **Durée et fréquence.** Vos réponses validées donnent des plages (« 8 à 12 semaines », « 3 à 4 séances/semaine »...), mais la base attend un nombre entier. J'ai retenu la borne basse, la plus prudente : 8 semaines pour les 3 niveaux, 2/3/4 séances par semaine pour débutant/intermédiaire/avancé. La plage complète et sa justification restent lisibles dans les champs de texte (intensité, progression...), rien n'est perdu, seule la valeur utilisée pour le calcul d'adhérence est simplifiée.
- **Répétition « Améliorer la force » (ostéoporose, niveaux intermédiaire et avancé).** Le document validé indique deux fois cet objectif pour ces deux niveaux — je l'ai conservé tel quel par fidélité au contenu que vous avez validé, plutôt que de le corriger de ma propre initiative. Si vous souhaitez un objectif différencié à ces deux niveaux, dites-le-moi et je l'ajuste.

## Ce qui change concrètement pour l'application

Les 8 exercices et les 18 programmes sont désormais visibles par un patient authentifié (la règle de sécurité qui masque tout contenu non `validated` reste appliquée automatiquement — vérifiée à nouveau ci-dessous). En revanche, **aucun patient ne peut encore se voir attribuer automatiquement l'un de ces programmes** : cela suppose des règles `allow_program` réelles, qui n'existent pas encore en base. C'est la suite logique — la traduction de votre matrice décisionnelle B4 en règles concrètes — mais elle n'a pas été entreprise dans ce lot, faute de demande explicite de votre part à ce stade.

## Vérifications effectuées

Les deux nouveaux fichiers ont été rejoués avec toutes les migrations et tous les seeds sur une base Postgres locale jetable : 8/8 exercices `validated`, 18/18 programmes `validated` (répartition exacte : 6 par niveau), 57/57 liens de références résolus sans aucun DOI orphelin. Le script de vérification de sécurité (`verify_rls.sh`) repasse 37/37 scénarios, sans régression. La suite de tests automatisés (188 tests) reste entièrement au vert — ce lot ne touche aucun fichier de code, uniquement des données.

## Documents mis à jour

`docs/DECISIONS.md`, `docs/MEDICAL_VALIDATION_NEEDED.md`, `README.md` et `FEUILLE_DE_ROUTE_20260821.md` reflètent tous ce changement de statut.

## Ce qui reste ouvert

La traduction de votre matrice B4 en règles `allow_program` réelles — c'est désormais possible techniquement (les 18 programmes ont des identifiants réels vers lesquels une règle peut pointer), mais je n'ai pas commencé ce chantier sans votre feu vert explicite, puisque c'est la dernière pièce qui manque avant qu'un patient puisse recevoir un programme concret.
