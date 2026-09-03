# Synthèse — Sprint 19 : « séance du jour » planifiée + nouvelle formule d'adhésion

**31/08/2026** — suite à votre « continue », les deux derniers chantiers de développement de la feuille de route sont construits : « séance du jour » planifiée (réf. B11) et nouvelle formule d'adhésion (réf. B13). Contrairement aux volets récents, aucune nouvelle décision de votre part n'était nécessaire — vous aviez déjà répondu aux deux le 20/08/2026, seul le travail d'implémentation manquait.

## 1. « Séance du jour » planifiée (réf. B11)

Le tableau de bord affiche désormais une carte « Séance du jour », générée automatiquement à partir de la fréquence hebdomadaire de votre programme validé, exactement comme demandé : fenêtre de réalisation flexible (pas d'heure imposée), et report libre sans pénalisation.

- Le patient peut **démarrer** la séance directement, **reporter** à une date ultérieure de son choix, ou **annuler pour raison de sécurité** — cette dernière action reste strictement volontaire, jamais déclenchée automatiquement par l'application.
- Une séance en retard (non démarrée, non reportée) reste visible tant qu'elle n'est pas traitée — rien ne disparaît silencieusement.

**Un point à noter** : répartir une fréquence de 3 séances/semaine sur des jours précis (par exemple lundi/mercredi/vendredi) demande de choisir CES jours-là — vous n'aviez chiffré que la fréquence, pas la répartition. J'ai retenu une répartition régulière automatique (comme pour les cadences de rappel déjà choisies à mi-fourchette), documentée comme un choix technique ajustable, pas une donnée clinique. Si vous préférez une autre logique (par exemple imposer un jour de repos entre deux séances pour certaines pathologies), dites-le-moi.

## 2. Nouvelle formule d'adhésion (réf. B13)

La page « Mes statistiques » affiche vos 2 indicateurs demandés : séances complètes / séances prescrites, et dose réelle / dose prescrite — avec le seuil de 80 % que vous aviez donné pour qu'une séance soit « complète ».

**Une lacune a été découverte en construisant cet indicateur** : la case à cocher permettant de savoir quels exercices un patient a réellement faits n'existait nulle part dans l'écran de séance (le champ existait en base depuis longtemps, mais rien ne l'alimentait). C'est corrigé : chaque exercice de la séance peut désormais être coché comme fait.

**Point de transparence important** : la recommandation de progression que je vous ai livrée hier continue d'utiliser l'ancienne formule d'adhésion (celle validée le 20/08). Je n'ai pas basculé cette recommandation vers la nouvelle formule sans votre confirmation explicite, pour ne rien changer silencieusement à un comportement clinique déjà validé. Si vous souhaitez que la progression utilise la nouvelle formule (plus fidèle, puisqu'elle distingue maintenant les séances vraiment complètes), dites-le-moi et je fais le changement.

## Vérification effectuée

- `tsc --noEmit` propre sur les 5 packages.
- Suite de tests complète au vert : **408 tests** (183 domain, dont 21 nouveaux ; 84 rules-engine, inchangé ; 141 web, dont 3 nouveaux).
- Migration 0016 + les 17 fichiers de seed rejoués sans erreur sur une base Postgres locale jetable.
- `verify_rls.sh` étendu d'une 8ᵉ section (isolation `planned_sessions`) : **49/49** scénarios au vert, aucune régression.

## Fichiers modifiés/créés

- `packages/domain/src/sessions.ts`, `statistics.ts`, `planning.ts` (nouveau) + tests
- `infra/db/migrations/0016_session_completion_and_planning.sql` (nouveau)
- `apps/web/src/app/api/planning/today/`, `planning/[id]/postpone/`, `planning/[id]/cancel-safety/` (nouveaux)
- `apps/web/src/app/api/sessions/route.ts`, `sessions/[id]/route.ts`, `statistics/weekly/route.ts`
- `apps/web/src/components/dashboard/PlannedSessionCard.tsx` (nouveau)
- `apps/web/src/components/forms/SessionFlow.tsx` (cases à cocher exercices), `StatisticsFlow.tsx` (2 indicateurs)
- `docs/DECISIONS.md`, `docs/MEDICAL_VALIDATION_NEEDED.md`, `README.md`, `FEUILLE_DE_ROUTE_20260821.md`

## Où en est la feuille de route

Avec ce lot, les sections 2 et 3 de `FEUILLE_DE_ROUTE_20260821.md` sont désormais **entièrement closes**. Il ne reste que la section 4 (fonctionnalités volontairement différées, aucune action requise) et la section 5 (mise en production), à mener quand vous jugerez le contenu médical suffisant pour un premier déploiement réel.
