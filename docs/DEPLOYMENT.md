# Déploiement

## Prérequis

1. Un projet Supabase (base PostgreSQL + Auth) — https://supabase.com
2. Un compte Vercel (ou Netlify) pour l'hébergement de `apps/web`.
3. (Optionnel, développement uniquement) PostgreSQL 16 installé localement, pour lancer `infra/db/scripts/verify_rls.sh` (§55, Sprint 15) — voir la section « Tests » ci-dessous. Non nécessaire pour un déploiement (qui utilise la base Supabase réelle).

## Installation locale

```bash
npm install
cp infra/env/.env.example apps/web/.env.local
# renseigner les variables Supabase dans apps/web/.env.local
npm run dev
```

## Base de données

Exécuter les migrations SQL du dossier `infra/db/migrations/` dans l'éditeur SQL de Supabase (ou via la CLI Supabase), dans l'ordre numérique, puis les fichiers de `infra/db/seed/`.

```bash
# Exemple avec la CLI Supabase (si installée) :
supabase db push
```

## Tests (§55, Sprint 15)

```bash
# Suite de tests complète du monorepo (unitaires + fonctionnels + sécurité) :
npm test --workspace=@apa/domain --workspace=@apa/rules-engine --workspace=@apa/pdf-report --workspace=@apa/payment-service --workspace=apps/web

# Vérification RLS complète (nécessite PostgreSQL 16 local, voir Prérequis) —
# à lancer avant tout déploiement touchant une policy RLS, en plus de la
# suite ci-dessus (qui ne teste pas la base de données réelle) :
bash infra/db/scripts/verify_rls.sh
```

`verify_rls.sh` crée sa propre base PostgreSQL jetable (`apa_verify_rls`), y rejoue toutes les migrations et tous les seeds, exécute 37 scénarios de permissions contre chaque table protégée par RLS, puis nettoie systématiquement derrière lui (base et rôles supprimés, y compris en cas d'échec). Il ne touche jamais la base de développement/production réelle.

## Déploiement (Vercel)

1. Importer le dépôt dans Vercel.
2. Définir le « Root Directory » sur `apps/web`.
3. Renseigner les variables d'environnement (voir `infra/env/.env.example`) dans les paramètres du projet Vercel.
4. Déployer.

## Provisionner le premier administrateur (Sprint 13)

Aucun utilisateur ne peut se donner lui-même le rôle `admin` (voir migration
`0010_users_self_update_guard.sql` : un trigger bloque toute tentative
d'auto-promotion, y compris via une requête SQL directe exécutée en tant que
super-utilisateur `postgres` — seule une connexion utilisant explicitement le
rôle Postgres `service_role` y est autorisée). Après avoir créé un compte
normalement dans l'application, promouvez-le administrateur en exécutant,
dans l'éditeur SQL de Supabase :

```sql
set role service_role;
update public.users set role = 'admin' where email = 'votre-email@exemple.com';
reset role;
```

## Statut

Ce dépôt correspond au **Sprint 15** (tests complets, en plus du paiement du Sprint 14, de l'administration du Sprint 13, de l'authentification/profil du Sprint 2, de l'évaluation/dépistage du Sprint 3, du moteur de règles data-driven du Sprint 4, de la bibliothèque d'exercices du Sprint 5, des programmes du Sprint 6, des séances du Sprint 7, du suivi du Sprint 8, des statistiques du Sprint 9, du rapport PDF du Sprint 10, des notifications du Sprint 11 et du mode hors connexion du Sprint 12) tel que défini dans `docs/ARCHITECTURE_TECHNIQUE_V1.md` (§60 du cahier des charges). Les tables `exercise_library` et `programs` sont vides : voir `infra/db/seed/tools/README.md` pour le processus de contribution de contenu par le concepteur médical (gabarit Excel → script d'import → seed SQL — le même mécanisme pourra être étendu aux programmes). Aucun exercice ni programme n'est visible des utilisateurs tant qu'il n'est pas marqué `validated`, et aucun programme n'est attribué automatiquement tant qu'aucune règle `allow_program` n'est validée. La table `sessions` (Sprint 7) permet de démarrer une séance et d'enregistrer le feedback patient (§69) même sans programme validé. La table `measurements` (Sprint 8) couvre poids/tour de taille/tension/glycémie (§35-38) ; le suivi de la tension et de la glycémie n'est proposé que si l'utilisateur l'a explicitement activé dans son profil (`patient_profiles.track_cardio_params`, §13). Les routes `/api/statistics/weekly` et `/api/statistics/history` (Sprint 9) agrègent les séances déjà enregistrées et n'affichent un taux d'adhésion que si un programme validé avec fréquence cible existe — sinon `null` explicite.

Le Sprint 10 ajoute `POST /api/reports/pdf` (package `@apa/pdf-report`, basé sur `pdfkit`) : génère à la demande un PDF reprenant séances, douleur, mesures et adhésion sur une période donnée, avec l'avertissement médical obligatoire du §40 toujours présent (vérifié par test, voir `docs/DECISIONS.md`). **Point de vigilance avant mise en production sur Vercel** : `pdfkit` charge ses polices standard depuis des fichiers `.afm` embarqués dans son propre `node_modules` au moment du rendu ; cela fonctionne en local (`next build` + tests), mais le traçage de fichiers des fonctions serverless doit être vérifié après un premier déploiement réel (générer un rapport en environnement de production avant de considérer cette fonctionnalité comme fiable).

Le Sprint 11 ajoute un centre de notifications in-app (table `notifications`, routes `/api/notifications*`, page `/notifications`) : **aucun envoi push réel** n'est implémenté (pas de clés VAPID, pas de service worker `push`, pas de planification cron) — voir `docs/DECISIONS.md` pour la justification. Les notifications sont calculées à la demande (à l'ouverture de la page ou du tableau de bord) et stockées pour consultation dans l'application. Voir `docs/MEDICAL_VALIDATION_NEEDED.md`.

Le Sprint 12 ajoute le mode hors connexion (§54, §10) : une file d'écritures en attente côté client (`apps/web/src/lib/offlineQueue.ts` + `offlineStorage.ts`) permet de démarrer une séance et d'en enregistrer le feedback sans connexion, avec synchronisation et gestion des conflits (échecs HTTP 404/409/422) au retour du réseau ; un service worker réécrit (`apps/web/public/sw.js`) met en cache l'app shell, les pages/API « réseau d'abord » (exercices, programme, séance, tableau de bord) et les médias « cache d'abord ». **Points de vigilance au déploiement** :

- Le nom des caches du service worker (`apa-app-shell-v2`, `apa-runtime-v1`, `apa-media-v1`, dans `apps/web/public/sw.js`) doit être incrémenté à chaque changement de comportement du cache lui-même (pas à chaque déploiement de code) pour forcer les navigateurs déjà installés à purger l'ancien cache via le handler `activate` — sinon un utilisateur ayant déjà ouvert l'application peut continuer à voir une version mise en cache obsolète tant que le service worker n'a pas été explicitement invalidé.
- Le service worker n'est pas couvert par des tests automatisés (API Cache/Service Worker absente de l'environnement Node/jsdom) : une vérification manuelle (DevTools → Application → Service Workers, test réseau coupé) est recommandée après chaque déploiement touchant `sw.js`.
- La file d'écritures en attente vit dans `localStorage` du navigateur : elle est donc perdue si l'utilisateur vide les données du site avant une synchronisation — limite acceptée, à mentionner si besoin dans un futur écran d'aide utilisateur (non demandé par le cahier des charges à ce stade).

Le Sprint 13 ajoute l'espace administrateur (§42, `/admin`) : gestion utilisateurs, pathologies, exercices, programmes, règles cliniques, références scientifiques, tableau de bord (§64), rapport scientifique interne (§65) et journal d'audit (§45). Toutes les écritures passent par la clé **`SUPABASE_SERVICE_ROLE_KEY`** (jusqu'ici optionnelle, elle devient nécessaire pour utiliser `/admin`) — voir `apps/web/.env.local`. La migration `0010_users_self_update_guard.sql` doit être appliquée (elle referme une faille RLS découverte pendant la vérification de ce sprint, voir `docs/DECISIONS.md`) ; sans elle, un patient pourrait s'auto-promouvoir administrateur.

Le Sprint 14 ajoute l'abonnement premium (§47, §48, page `/abonnement` + `/admin/abonnements`) : un patient demande un plan, transfère lui-même via Mobile Money/Orange Money/Moov Money selon les instructions affichées, déclare la référence de transaction reçue, puis un administrateur vérifie réellement ce transfert et confirme dans `/admin/abonnements` — ce qui active la souscription. **Aucune passerelle de paiement n'est intégrée** (voir `docs/DECISIONS.md`, §47 : « ne pas coder un système de paiement fictif ») : `SUPABASE_SERVICE_ROLE_KEY` (déjà requise depuis le Sprint 13) est également utilisée par le flux de confirmation de paiement. **Action requise avant d'ouvrir de véritables inscriptions premium** : le champ « Instructions de paiement » de chaque plan premium (`payment_instructions_fr`, numéro Mobile Money/Orange Money/Moov Money réel) est laissé vide au seed — il doit être configuré via `/admin/abonnements` par le porteur de projet, faute de quoi les patients ne verront aucune instruction de paiement à l'écran. La migration `0011_subscriptions_and_payments.sql` doit être appliquée (tables `subscription_plans`, `subscriptions`, `payments`, RLS sans policy `UPDATE` pour les patients — voir `docs/DECISIONS.md`).

Le Sprint 15 ajoute une suite de tests complète (§55, §56) et corrige un bug de journalisation d'audit découvert en l'écrivant (voir `docs/DECISIONS.md`) : la migration `0012_audit_logs_entity_id_text.sql` doit être appliquée (sans elle, la journalisation d'audit continue d'échouer silencieusement pour les règles cliniques, les pathologies et les plans d'abonnement). Voir la section « Tests » ci-dessus pour lancer la suite de tests et le script de vérification RLS `infra/db/scripts/verify_rls.sh`, qui consolide en un seul artefact reproductible toutes les vérifications manuelles faites sprint après sprint depuis le Sprint 2.
