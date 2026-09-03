# Import du contenu des exercices

1. Le concepteur médical remplit `gabarit_exercices_apa_rhumato.xlsx` (une ligne par exercice, voir l'onglet « Instructions » du fichier — un premier brouillon sourcé sur la littérature du §81 a déjà été fait, voir `docs/DECISIONS.md` Sprint 5/5bis/5ter).
2. Générer le seed SQL (adapter le numéro au prochain numéro de seed libre dans `infra/db/seed/` — ne jamais réutiliser un numéro déjà pris) :
   ```bash
   python3 import_exercises.py gabarit_exercices_apa_rhumato.xlsx > ../00NN_exercises_vX.sql
   ```
3. Relire le fichier généré (comme n'importe quelle revue de code — c'est un rappel utile avant d'exécuter des inserts).
4. Exécuter la migration/seed sur Supabase (voir `docs/DEPLOYMENT.md`).

Rappels de sécurité (§57, §59) :
- Le script ne valide ni n'invente aucun contenu médical : il transcrit fidèlement le fichier Excel.
- Un exercice n'est visible des utilisateurs que si `medical_validation_status = 'validated'` (appliqué par les policies RLS de `0005_exercise_library.sql`), quel que soit ce que contient la base.
- Les lignes dont les champs obligatoires (nom, description courte, pathologie, catégorie) sont manquants sont ignorées et signalées sur stderr — elles n'entraînent pas l'échec de l'import.

Le premier brouillon sourcé (8 exercices, Sprint 5bis/5ter) a été committé le 23/08/2026 dans `../0010_exercises_pending_validation_20260819.sql`. Il a ensuite été validé et activé par Dr Nikiema le même jour (« Je valide. Tu peux les intégrer ») via `../0011_exercises_validation_dr_nikiema_20260823.sql` (`UPDATE ... set medical_validation_status = 'validated'`, sans toucher au texte des champs) — les 8 exercices sont désormais visibles côté client authentifié.

# Import des seuils cliniques vert/orange/rouge (Sprint 6bis)

1. Le concepteur médical remplit `gabarit_seuils_cliniques.xlsx` (un onglet par pathologie sans dépistage fonctionnel — arthrose genou/hanche, polyarthrite rhumatoïde, spondyloarthrite axiale — voir l'onglet « Instructions »).
2. Générer le SQL de propositions :
   ```bash
   python3 convert_thresholds_to_rules.py gabarit_seuils_cliniques.xlsx > ../0005_proposed_thresholds.sql
   ```
3. Relire chaque condition générée (fichier `stderr` du script : avertissements sur les lignes ignorées, ex. type `text` sans condition dérivable).
4. Exécuter le seed : toutes les règles sont insérées `active = false`. Activer explicitement (`active = true`, `validated_by`, `validated_date`) UNIQUEMENT les règles validées.

Quatre propositions de red flags (arthrite septique suspectée, fracture rachidienne sur traumatisme en spondyloarthrite axiale) sont déjà rédigées à partir de littérature publiée dans `../0004_proposed_red_flags_pending_validation.sql`, avec le même mécanisme `active = false` — voir `docs/DECISIONS.md` (Sprint 6bis) pour le détail des sources.

# Import du contenu des programmes (FITT-VP, réponse à B4/B5/B6/B9)

1. Le concepteur médical remplit `gabarit_programmes_apa_rhumato.xlsx` (une ligne par combinaison pathologie × niveau — les 18 combinaisons sont déjà pré-remplies dans l'onglet « Programmes », voir l'onglet « Instructions » du fichier pour le rappel des réponses B4/B5/B6/B9 déjà données). Le fichier est régénérable via `python3 build_gabarit_programmes.py` (ne réinvente rien : ne pré-remplit que le code programme, la pathologie et le niveau — des données structurelles, pas cliniques).
2. Générer le seed SQL (adapter le numéro au prochain numéro de seed libre) :
   ```bash
   python3 import_programs.py gabarit_programmes_apa_rhumato.xlsx > ../00NN_programs.sql
   ```
3. Relire le fichier généré (même discipline que pour les exercices).
4. Exécuter le seed sur Supabase (voir `docs/DEPLOYMENT.md`).

Rappels de sécurité (§57, §59, §78), même principe que pour les exercices :
- Le script ne valide ni n'invente aucun contenu médical : il transcrit fidèlement le fichier Excel.
- Un programme n'est visible des utilisateurs que si `medical_validation_status = 'validated'` (policies RLS de `0006_programs.sql`).
- Ce script ne lie AUCUN exercice au programme (`program_exercises`) : cette étape suppose une bibliothèque d'exercices déjà validée et vient dans un second temps.
- **Fait, le 23/08/2026** : la matrice décisionnelle B4 a été traduite en 18 règles `allow_program` réelles (`../0013_allow_program_rules_dr_nikiema_20260823.sql`), après 2 questions complémentaires posées à Dr Nikiema (classification du niveau initial, portée de l'accès en dépistage orange — voir `docs/DECISIONS.md`, section « Sprint 17 (suite 3, intégration finale) »). Un programme sans règle `allow_program` validée pointant vers lui n'est jamais attribué automatiquement, même s'il est lui-même `validated` (défense en profondeur déjà en place depuis le Sprint 6).

**Écart assumé le 23/08/2026** : ce script n'a en fait pas été utilisé pour le premier remplissage réel du contenu programmes — Dr Nikiema a demandé que tout contenu relevant de sa décision lui soit transmis en document Word plutôt qu'en gabarit Excel (voir `docs/DECISIONS.md`, Sprint 17). Le contenu FITT-VP des 18 programmes a donc été rédigé directement (sourcé sur le §81 + propositions génériques ACSM/Borg qu'il a explicitement demandées), livré en `.docx` pour relecture, validé par lui le 23/08/2026 (« Je valide. Tu peux les intégrer »), puis transcrit en seed SQL dans `../0012_programs_validation_dr_nikiema_20260823.sql` (18 lignes `programs` + liens `program_references`, `medical_validation_status = 'validated'` dès l'insertion). `gabarit_programmes_apa_rhumato.xlsx` et `import_programs.py` restent disponibles pour un usage futur si la convention Excel est reprise pour un contenu ultérieur (nouvelles pathologies, révisions), mais ce n'est plus le chemin par défaut.
