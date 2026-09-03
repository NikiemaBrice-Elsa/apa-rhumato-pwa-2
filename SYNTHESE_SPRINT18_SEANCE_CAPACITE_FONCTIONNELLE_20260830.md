# Synthèse — Sprint 18 : structure de séance en 3 phases + capacité fonctionnelle

**30/08/2026** — suite logique à « continue donc » : les deux chantiers de la feuille de route qui demandaient du développement plutôt qu'une décision de votre part ont été avancés pendant que les deux documents précédents (relecture messages Q2-Q6, progression/régression) restent en attente de votre retour.

## 1. Structure de séance en 3 phases (réf. B8)

`exercise_library` porte désormais un champ `phase` (échauffement / partie principale / retour au calme), et l'écran de séance affiche 3 sections nommées dès que tous les exercices d'une séance sont classés — sinon il retombe sur l'affichage historique en une seule liste (jamais de classement partiel ou deviné).

Les 8 exercices déjà validés restent non classés : les classer moi-même serait un jugement clinique. Constat en préparant la question : ils sont tous « aérobique » ou « renforcement » — aucun n'est un exercice d'échauffement/retour au calme typique. Je propose de les classer en « Partie principale » par défaut, à valider ou corriger.

## 2. Capacité fonctionnelle (réf. B10)

Le **PSFS est entièrement actif** : sur la page « Mes statistiques », vous pouvez nommer 3 à 5 activités qui vous posent difficulté et les noter de 0 à 10 ; la moyenne est calculée automatiquement (méthodologie publique de l'instrument, pas un calcul inventé).

**PROMIS Physical Function (CAT) n'est pas administré.** Un test adaptatif informatisé nécessite la banque d'items et l'algorithme officiels de HealthMeasures (NIH) — je ne les détiens pas et ne dois pas les reconstituer de mémoire, sous peine de fabriquer un instrument validé sous son nom. Je vous soumets 3 options : intégrer l'API officielle, encoder un formulaire court fixe que vous fourniriez, ou reporter PROMIS (PSFS seul pour l'instant).

→ **`QUESTIONS_SEANCE_CAPACITE_FONCTIONNELLE_20260830.docx`** : les 2 questions ci-dessus, avec un tableau à corriger pour la Question 1 et 3 propositions pour la Question 2.

## Vérification effectuée

- `tsc --noEmit` propre sur les 5 packages.
- Suite de tests complète au vert : **368 tests** (148 domain, dont 13 nouveaux ; 84 rules-engine, inchangé ; 136 web, dont 3 nouveaux).
- Migrations 0014/0015 + les 15 fichiers de seed rejoués sans erreur sur une base Postgres locale jetable.
- `verify_rls.sh` étendu d'une 7ᵉ section (isolation des nouvelles tables) : **43/43** scénarios au vert (37 précédents + 6 nouveaux), aucune régression.

## Fichiers modifiés/créés

- `infra/db/migrations/0014_exercise_session_phase.sql`, `0015_functional_capacity.sql` (nouveaux)
- `packages/domain/src/exercises.ts`, `sessions.ts`, `validation.ts`, `functionalCapacity.ts` (nouveau), `index.ts` (+ tests)
- `apps/web/src/app/api/admin/exercises/route.ts` et `[id]/route.ts`, `apps/web/src/app/api/sessions/route.ts`
- `apps/web/src/app/api/functional-capacity/route.ts` et `[id]/route.ts` (nouveaux)
- `apps/web/src/components/admin/AdminExercises.tsx`, `apps/web/src/components/forms/SessionFlow.tsx`, `apps/web/src/components/forms/StatisticsFlow.tsx` (+ test fonctionnel)
- `infra/db/scripts/verify_rls.sh` (7ᵉ section)
- `docs/DECISIONS.md`, `docs/MEDICAL_VALIDATION_NEEDED.md`, `README.md`, `FEUILLE_DE_ROUTE_20260821.md`
- `QUESTIONS_SEANCE_CAPACITE_FONCTIONNELLE_20260830.docx` (nouveau)

## Ce que je fais dès réception de vos réponses

- Écrire une migration de données classant les 8 exercices selon votre réponse à la Question 1, et activer l'affichage en 3 sections dans l'écran de séance réel.
- Selon votre réponse à la Question 2 : intégrer l'API officielle, encoder le formulaire court et son barème tels que transmis, ou documenter simplement l'attente côté PROMIS.

## Récapitulatif des documents en attente de votre retour

1. `RELECTURE_MESSAGES_Q2_Q6_20260823.docx`
2. `QUESTIONS_PROGRESSION_REGRESSION_20260823.docx`
3. `QUESTIONS_SEANCE_CAPACITE_FONCTIONNELLE_20260830.docx`
