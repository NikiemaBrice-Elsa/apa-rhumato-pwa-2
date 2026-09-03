# Synthèse — Sprint 18 (suite, intégration finale) : les 3 documents en attente reviennent complétés

**31/08/2026** — vous avez retourné le même jour les 3 documents Word laissés en attente. Les trois ont été intégrés dans ce lot, strictement selon vos réponses littérales.

## 1. Relecture des messages Q2-Q6 : validée sans correction

`RELECTURE_MESSAGES_Q2_Q6_20260823.docx` — « PAS DE CORRECTION A APPORTER ; TU PEUX INTEGRER ». Les 7 messages sont désormais définitivement validés (aucun fichier de code n'a été modifié, seul le statut de validation est mis à jour dans la documentation).

## 2. Progression/régression : 24 règles réelles, désormais actives

`QUESTIONS_PROGRESSION_REGRESSION_20260823.docx` — vos réponses (toutes Proposition A) : fatigue excessive = ≥ 7/10 ; 1 séance avec signal négatif isolé = maintien du programme ; le même signal répété sur 2 séances consécutives = réduction ; douleur ≥ 7/10 après séance = suspension immédiate (« tout signal rouge... prime sur les règles de progression ») ; périmètre limité à ce qui est déjà suivi (adhésion, douleur, fatigue, difficulté) ; affichage informatif uniquement.

Concrètement : la page « Mes statistiques » affiche désormais, pour chaque pathologie où vous avez un programme, une recommandation (poursuivre au niveau supérieur / maintenir / réduire / suspendre) accompagnée d'un message explicatif. Un bouton « Passer au niveau supérieur » n'apparaît QUE si la recommandation est favorable — cliquer dessus recalcule la décision côté serveur (jamais de confiance dans ce qu'affiche l'écran) avant de créer un nouveau programme assigné ; l'ancien reste conservé dans l'historique, rien n'est jamais écrasé.

Cas volontairement non couvert, par transparence : si aucun signal négatif n'est présent mais que l'adhésion de la semaine est inférieure à 80 % ou inconnue, aucune des 24 règles ne se déclenche et aucune recommandation n'est affichée — plutôt que de deviner un « maintien » par défaut pour ce cas que vos réponses ne couvrent pas explicitement.

## 3. Structure de séance et capacité fonctionnelle : les 2 dernières questions

`QUESTIONS_SEANCE_CAPACITE_FONCTIONNELLE_20260830.docx` :
- **Q1** : vos 8 exercices déjà validés sont désormais classés en « Partie principale », comme proposé. Vos deux contraintes explicites sont respectées : aucune règle générique ne déduit une phase à partir du nom/de la catégorie d'un exercice, et aucun contenu d'échauffement/retour au calme n'est fabriqué — l'écran de séance affichera une « Partie principale » seule tant que vous ne nous aurez pas fourni ce contenu.
- **Q2** (Proposition C) : PROMIS reste définitivement différé. Le PSFS est confirmé comme seul instrument de capacité fonctionnelle de la V1.

## Vérification effectuée

- `tsc --noEmit` propre sur les 5 packages.
- Suite de tests complète au vert : **384 tests** (162 domain, dont 14 nouveaux ; 84 rules-engine, inchangé ; 138 web, dont 2 nouveaux).
- Migrations + les 17 fichiers de seed (dont les 2 nouveaux, 0014 et 0015) rejoués sans erreur sur une base Postgres locale jetable.
- `verify_rls.sh` : **43/43** scénarios au vert, aucune régression (ce lot n'ajoute aucune nouvelle policy — les 2 nouvelles routes sont protégées par le même contrôle d'authentification que les routes existantes).

## Fichiers modifiés/créés

- `packages/domain/src/sessions.ts` (fait `progression_signal`), `programs.ts` (`nextProfileLevel`) + tests
- `packages/rules-engine/src/progression.ts` (version du moteur, commentaires mis à jour)
- `infra/db/seed/0014_adjust_progression_rules_dr_nikiema_20260831.sql`, `0015_exercise_phases_dr_nikiema_20260831.sql` (nouveaux)
- `apps/web/src/app/api/statistics/progression/route.ts`, `apps/web/src/app/api/programs/progress/route.ts` (nouveaux)
- `apps/web/src/lib/progression.ts` (nouveau, logique commune aux 2 routes)
- `apps/web/src/components/forms/StatisticsFlow.tsx` (section « Recommandation de progression ») + test fonctionnel
- `docs/DECISIONS.md`, `docs/MEDICAL_VALIDATION_NEEDED.md`, `README.md`, `FEUILLE_DE_ROUTE_20260821.md`

## Où en est la feuille de route

Avec ce lot, les sections 2 et 3 de `FEUILLE_DE_ROUTE_20260821.md` sont closes (hors « séance du jour » planifiée et nouvelle formule d'adhésion, qui restent à développer). Il ne reste plus aucun document en attente de votre part à ce stade — la suite se décidera selon ce que vous souhaitez prioriser (ces deux derniers points de développement, ou la mise en production).
