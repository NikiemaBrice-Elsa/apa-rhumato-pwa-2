# Synthèse — Priorité n°1 de la feuille de route : exercices et programmes (23/08/2026)

En suivant l'ordre de priorité de `FEUILLE_DE_ROUTE_20260821.md`, ce lot avance les deux actions possibles sans attendre de nouvelle réponse de votre part — tout le reste de la section 1 dépend directement d'un contenu que je ne peux pas inventer (§57, §59).

## 1. Les 8 exercices brouillon sont maintenant chargés en base

Le gabarit `gabarit_exercices_apa_rhumato.xlsx` était rempli et documenté depuis le 19/08/2026 (Sprint 5bis/5ter), mais sa conversion en seed SQL n'avait jamais été committée — les 8 exercices restaient donc invisibles, même en revue interne. C'est corrigé : ils sont désormais consultables et modifiables dans `/admin/exercices`, tous encore au statut `pending_validation` (aucun n'est visible des patients tant que vous ne les validez pas un par un). Aucun contenu n'a changé, c'est une pure question de mise en base de ce qui existait déjà.

## 2. Nouveau gabarit pour le contenu des programmes (FITT-VP)

Sur le même principe que les gabarits exercices et seuils cliniques déjà utilisés : `gabarit_programmes_apa_rhumato.xlsx` (joint à ce message) propose les 18 combinaisons pathologie × niveau (6 pathologies × débutant/intermédiaire/avancé), avec uniquement le code programme, la pathologie et le niveau déjà remplis — le reste vous appartient. L'onglet Instructions rappelle vos réponses déjà données : B4 (la logique d'attribution), B5 (une fiche FITT-VP par combinaison), B6 (Borg CR10/6-20 + FC + talk test) et B9 (critères de régression par défaut, réutilisables tels quels si rien de spécifique). Une ligne peut rester quasiment vide si une combinaison n'a pas lieu d'exister en V1.

Un script `import_programs.py` est prêt à convertir le fichier une fois rempli — testé avec succès sur le squelette actuel (18 lignes chargées sans erreur sur une base de test).

## Pourquoi pas les règles `allow_program` dans ce même lot

Elles dépendent du point 2 : une règle d'attribution doit pointer vers un programme réel (`program_id`), qui n'existe pas encore. Dès que vous aurez rempli le gabarit programmes, l'étape suivante sera de traduire votre matrice B4 en règles concrètes.

## Vérifications effectuées

334 tests toujours au vert (ce lot ne touche aucun fichier TypeScript), `tsc --noEmit` propre sur les 5 packages. Le nouveau seed d'exercices a été rejoué avec toutes les migrations et tous les seeds sur une base Postgres locale : 0 erreur SQL, exactement 8 exercices `pending_validation` avec leurs liens pathologie/objectif/référence correctement résolus (aucune référence DOI orpheline). `verify_rls.sh` repasse 37/37, y compris le scénario dédié qui confirme que `service_role` (le chemin admin réel) voit bien les exercices `draft` et `validated`. Le script `import_programs.py` a été testé séparément sur le gabarit programmes fraîchement généré.

## Ce qui reste ouvert

Deux relectures vous attendent, chacune indépendante de l'autre : valider (ou corriger) les 8 exercices dans `/admin/exercices`, et remplir le contenu FITT-VP du gabarit programmes joint. Une fois l'un ou l'autre avancé, je peux enchaîner sur la suite de la feuille de route.
