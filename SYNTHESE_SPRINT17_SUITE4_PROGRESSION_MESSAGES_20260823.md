# Synthèse — Sprint 17 (suite 4) : infrastructure progression/régression + relecture messages Q2-Q6

**23/08/2026** — en réponse à : « il faut gérer : relecture des nouveaux messages de dépistage, ou règles de progression/régression. »

## 1. Relecture des messages de dépistage (Q2-Q6)

Les 7 messages orange/rouge créés le 21/08/2026 (spondyloarthrite axiale périphérique, hanche chirurgie/traumatisme, lombalgie critères qualitatifs) n'avaient jamais été soumis à une relecture formelle de leur formulation, contrairement au brouillon C1/B12 du 20/08.

→ **`RELECTURE_MESSAGES_Q2_Q6_20260823.docx`** : les 7 messages, présentés par module, avec un rappel explicite que la logique clinique (conditions, seuils, statut, action) est déjà validée et active — seule la formulation du texte affiché au patient est à relire.

## 2. Règles de progression/régression

Le mécanisme existant (`evaluateProgressionDecision`) était un squelette non fonctionnel : il renvoyait systématiquement `"maintain"` en dur, sans être câblé dans aucune route. Ce lot le rend réellement fonctionnel, **sans écrire la moindre règle clinique** :

- une règle clinique peut désormais porter une vraie décision (`progressionDecision` : progresser / maintenir / réduire / suspendre — nouvelle colonne `progression_decision`, migration 0013) ;
- le moteur applique cette décision uniquement si une règle la porte explicitement — jamais de valeur devinée par défaut (même principe que `programId` pour `allow_program`) ;
- une nouvelle fonction (`computeProgressionFacts`) calcule déjà, à partir de l'historique de séances, les faits directement chiffrés par vos réponses du 20/08/2026 (B2 : adhésion ≥ 80 %, douleur d'exercice ≤ 3/10 ; B9 : aggravation de la douleur persistant au-delà de 24h).

Ce qui manque encore, ce sont les règles elles-mêmes — comme pour `allow_program` précédemment, 4 points restent à trancher avant de pouvoir les écrire sans inventer.

→ **`QUESTIONS_PROGRESSION_REGRESSION_20260823.docx`** : 4 questions, chacune avec une ou plusieurs propositions à valider/corriger :
1. Seuil de « fatigue excessive » (non chiffré jusqu'ici, contrairement à la douleur).
2. Définition de « signal isolé et résolutif » vs « répété » (nombre de séances, fenêtre).
3. Démarrer maintenant avec les seuls critères déjà trackés, ou attendre gonflement/raideur/baisse fonctionnelle (non trackés du tout aujourd'hui).
4. Question de conception produit inédite : où et comment la décision doit-elle apparaître pour le patient (affichage informatif, bascule automatique, ou simple journalisation pour l'instant) ?

## Vérification effectuée

- `tsc --noEmit` propre sur les 5 packages.
- Suite de tests complète au vert : **347 tests** (130 domain, dont 9 nouveaux pour `computeProgressionFacts` ; 84 rules-engine, `progression.test.ts` réécrit ; 133 web, inchangé).
- Migrations + les 13 fichiers de seed (dont la nouvelle migration 0013) rejoués sans erreur sur une base Postgres locale jetable.
- `verify_rls.sh` : toujours **37/37** (cette migration n'ajoute qu'une colonne avec contrainte `check`, aucune policy RLS touchée).

## Fichiers modifiés/créés

- `packages/domain/src/rules.ts`, `validation.ts`, `sessions.ts` (+ tests)
- `infra/db/migrations/0013_clinical_rules_progression_decision.sql`
- `apps/web/src/lib/clinicalRules.ts`, `src/app/api/admin/clinical-rules/route.ts` et `[id]/route.ts`, `src/components/admin/AdminClinicalRules.tsx`
- `packages/rules-engine/src/progression.ts` (+ tests réécrits)
- `docs/DECISIONS.md`, `docs/MEDICAL_VALIDATION_NEEDED.md`, `README.md`, `FEUILLE_DE_ROUTE_20260821.md`
- `RELECTURE_MESSAGES_Q2_Q6_20260823.docx` (nouveau)
- `QUESTIONS_PROGRESSION_REGRESSION_20260823.docx` (nouveau)

## Ce que je fais dès réception de vos réponses

- Reporter vos corrections de formulation dans les 7 lignes `clinical_rules` concernées.
- Traduire vos réponses aux 4 questions en règles `adjust_progression` réelles pour les 6 pathologies.
- Câbler `evaluateProgressionDecision` dans la route appropriée, selon votre réponse à la Question 4.
- Vérifier par les tests automatisés et `verify_rls.sh` qu'aucune décision ne sort de ce que vos règles autorisent explicitement.
