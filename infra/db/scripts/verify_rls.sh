#!/usr/bin/env bash
#
# §55 (« Tests sécurité » : accès non autorisé, permissions, exposition des
# données) — Sprint 15.
#
# Jusqu'ici, chaque sprint ayant touché une policy RLS (Sprints 2, 5, 6, 7,
# 8, 9, 11, 13, 14) a été vérifié à la main sur une base Postgres locale
# jetable (mêmes étapes répétées : schéma `auth` factice, rôles `app_user`/
# `service_role`, deux utilisateurs fixtures, scénarios d'isolation). Ce
# script REMPLACE cette procédure jetable par un artefact permanent,
# reproductible, versionné avec le dépôt — la RLS n'est plus vérifiée
# seulement « à un instant donné » par le développeur, elle est vérifiable
# par n'importe qui, à tout moment, avec une seule commande :
#
#   bash infra/db/scripts/verify_rls.sh
#
# Le script crée une base PostgreSQL 16 locale jetable, y rejoue TOUTES les
# migrations et TOUS les seeds, exécute une batterie de scénarios contre
# CHAQUE table protégée par RLS dans le schéma (pas seulement celle du
# dernier sprint), puis nettoie systématiquement derrière lui (base, rôles),
# y compris en cas d'échec (trap EXIT).
#
# Prérequis : PostgreSQL 16 installé localement, `sudo service postgresql
# start` déjà exécuté (ou le script le fait lui-même si possible), extension
# pgcrypto disponible.
#
# §57, §59 : les règles cliniques utilisées ici sont soit les VRAIES lignes
# seedées (infra/db/seed/0003_clinical_rules.sql), soit des lignes de test
# neutres sans contenu médical inventé (ex. un exercice/programme fictif
# juste pour exercer le statut de validation) — jamais une règle clinique
# fabriquée pour l'occasion.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
DB="apa_verify_rls"
PGPASSWORD_TEST="test1234"
PASS=0
FAIL=0
FAILED_CHECKS=()

pass() { PASS=$((PASS + 1)); echo "  OK   - $1"; }
fail() { FAIL=$((FAIL + 1)); FAILED_CHECKS+=("$1"); echo "  FAIL - $1"; }

cleanup() {
  echo ""
  echo "--- Nettoyage ---"
  sudo -u postgres psql -q -c "drop database if exists ${DB};" >/dev/null 2>&1
  sudo -u postgres psql -q -c "drop role if exists app_user;" >/dev/null 2>&1
  sudo -u postgres psql -q -c "drop role if exists service_role;" >/dev/null 2>&1
  echo "Base et rôles de vérification supprimés."
}
trap cleanup EXIT

# psql_as <role> <user_id> <client_role> <sql>
# Exécute <sql> dans la MÊME session psql qu'un SET des GUC qui pilotent les
# fonctions auth.uid()/auth.role() factices (voir le bloc "auth stub"
# ci-dessous) — reproduit un utilisateur authentifié Supabase.
psql_as() {
  local role="$1" user_id="$2" client_role="$3" sql="$4"
  PGPASSWORD="$PGPASSWORD_TEST" psql -X -U "$role" -h localhost -d "$DB" \
    -c "set app.current_user_id = '${user_id}'; set app.current_client_role = '${client_role}';" \
    -c "${sql}" 2>&1
}

# psql_service <sql> — service_role (BYPASSRLS), pas besoin de GUC.
psql_service() {
  PGPASSWORD="$PGPASSWORD_TEST" psql -X -U service_role -h localhost -d "$DB" -c "$1" 2>&1
}

expect_error() {
  local desc="$1" role="$2" user_id="$3" client_role="$4" sql="$5"
  local out
  out=$(psql_as "$role" "$user_id" "$client_role" "$sql")
  if echo "$out" | grep -q "ERROR"; then
    pass "$desc"
  else
    fail "$desc (attendu une ERREUR RLS, obtenu : $(echo "$out" | tr '\n' ' ' | head -c 200))"
  fi
}

expect_update_zero() {
  local desc="$1" role="$2" user_id="$3" client_role="$4" sql="$5"
  local out
  out=$(psql_as "$role" "$user_id" "$client_role" "$sql")
  if echo "$out" | grep -q "UPDATE 0"; then
    pass "$desc"
  else
    fail "$desc (attendu UPDATE 0, obtenu : $(echo "$out" | tr '\n' ' ' | head -c 200))"
  fi
}

expect_success() {
  local desc="$1" role="$2" user_id="$3" client_role="$4" sql="$5"
  local out
  out=$(psql_as "$role" "$user_id" "$client_role" "$sql")
  if echo "$out" | grep -qE "ERROR"; then
    fail "$desc (attendu un succès, obtenu : $(echo "$out" | tr '\n' ' ' | head -c 200))"
  else
    pass "$desc"
  fi
}

# expect_row_count <desc> <role> <user_id> <client_role> <sql select scalaire> <valeur attendue>
expect_row_count() {
  local desc="$1" role="$2" user_id="$3" client_role="$4" sql="$5" expected="$6"
  local out
  out=$(PGPASSWORD="$PGPASSWORD_TEST" psql -X -tA -U "$role" -h localhost -d "$DB" \
    -c "set app.current_user_id = '${user_id}'; set app.current_client_role = '${client_role}';" \
    -c "${sql}" 2>&1 | tail -1 | tr -d '[:space:]')
  if [ "$out" = "$expected" ]; then
    pass "$desc"
  else
    fail "$desc (attendu '$expected', obtenu '$out')"
  fi
}

echo "=== §55 : vérification RLS complète (Sprint 15) ==="
echo ""
echo "--- Préparation de la base de vérification ---"

sudo service postgresql start >/dev/null 2>&1 || true
sleep 1

sudo -u postgres psql -q -c "drop database if exists ${DB};" >/dev/null
sudo -u postgres psql -q -c "create database ${DB};" >/dev/null
sudo -u postgres psql -q -d "$DB" -c "create extension if not exists pgcrypto;" >/dev/null

# Schéma auth factice, piloté par des GUC de session (voir psql_as ci-dessus).
sudo -u postgres psql -q -d "$DB" <<'SQL' >/dev/null
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text);
create or replace function auth.uid() returns uuid as $$
  select nullif(current_setting('app.current_user_id', true), '')::uuid;
$$ language sql stable;
create or replace function auth.role() returns text as $$
  select coalesce(nullif(current_setting('app.current_client_role', true), ''), 'anon');
$$ language sql stable;
SQL

for f in "$REPO_ROOT"/infra/db/migrations/*.sql; do
  sudo -u postgres psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$f" >/dev/null
  if [ $? -ne 0 ]; then
    echo "ÉCHEC : migration $f n'a pas pu être appliquée."
    exit 1
  fi
done

for f in "$REPO_ROOT"/infra/db/seed/*.sql; do
  sudo -u postgres psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$f" >/dev/null
done

sudo -u postgres psql -q -d "$DB" <<SQL >/dev/null
do \$\$
begin
  if not exists (select from pg_roles where rolname = 'app_user') then
    create role app_user login password '${PGPASSWORD_TEST}';
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role login password '${PGPASSWORD_TEST}' bypassrls;
  else
    alter role service_role bypassrls;
  end if;
end \$\$;
grant usage on schema public, auth to app_user, service_role;
grant select, insert, update, delete on all tables in schema public to app_user, service_role;
grant select on all tables in schema auth to app_user, service_role;
grant execute on all functions in schema auth to app_user, service_role;
SQL

# Deux patients fixtures (A = 111…, B = 222…), sans aucun contenu médical
# inventé — uniquement des identifiants et un nom de test.
sudo -u postgres psql -q -d "$DB" <<'SQL' >/dev/null
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local');
insert into public.users (id, email, first_name, last_name, role, status) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local', 'A', 'Test', 'patient', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local', 'B', 'Test', 'patient', 'active');
SQL

# Un exercice et un programme fictifs (draft, jamais validated) pour vérifier
# la défense en profondeur "validated only" — contenu neutre, pas de donnée
# clinique.
sudo -u postgres psql -q -d "$DB" <<'SQL' >/dev/null
insert into public.exercise_library (exercise_id, name, short_description, category, medical_validation_status)
values ('33333333-3333-3333-3333-333333333333', 'Exercice test (draft)', 'test', 'mobilite', 'draft');
insert into public.exercise_library (exercise_id, name, short_description, category, medical_validation_status)
values ('44444444-4444-4444-4444-444444444444', 'Exercice test (validated)', 'test', 'mobilite', 'validated');
insert into public.programs (program_id, program_code, pathology, profile_level, medical_validation_status)
values ('55555555-5555-5555-5555-555555555555', 'TEST_DRAFT', 'ARTHROSE_GENOU', 'debutant', 'draft');
insert into public.programs (program_id, program_code, pathology, profile_level, medical_validation_status)
values ('66666666-6666-6666-6666-666666666666', 'TEST_VALIDATED', 'ARTHROSE_GENOU', 'debutant', 'validated');
SQL

A="11111111-1111-1111-1111-111111111111"
B="22222222-2222-2222-2222-222222222222"

echo ""
echo "--- 1. Tables de référence en lecture authentifiée seule ---"

# Compte réel de pathologies pour comparer proprement (au lieu d'un nombre en dur).
PATHOLOGY_COUNT=$(sudo -u postgres psql -tA -d "$DB" -c "select count(*) from public.pathologies;" | tr -d '[:space:]')
expect_row_count "pathologies : un patient authentifié voit les ${PATHOLOGY_COUNT} pathologies" app_user "$A" authenticated \
  "select count(*) from public.pathologies;" "$PATHOLOGY_COUNT"
expect_update_zero "pathologies : un patient ne peut PAS modifier une pathologie" app_user "$A" authenticated \
  "update public.pathologies set active = false where code = 'LOMBALGIE_COMMUNE';"

expect_update_zero "clinical_rules : un patient ne peut PAS modifier une règle clinique" app_user "$A" authenticated \
  "update public.clinical_rules set active = false where rule_id = 'LBP_RED_FLAG_QUEUE_DE_CHEVAL';"

expect_update_zero "subscription_plans : un patient ne peut PAS modifier un plan" app_user "$A" authenticated \
  "update public.subscription_plans set price_amount = 1 where plan_code = 'premium_monthly';"

echo ""
echo "--- 2. Contenu 'validated only' (exercise_library, programs) ---"
expect_row_count "exercise_library : un patient ne voit QUE les exercices validated" app_user "$A" authenticated \
  "select count(*) from public.exercise_library where exercise_id in ('33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444');" "1"
expect_row_count "programs : un patient ne voit QUE les programmes validated" app_user "$A" authenticated \
  "select count(*) from public.programs where program_id in ('55555555-5555-5555-5555-555555555555','66666666-6666-6666-6666-666666666666');" "1"

OUT=$(PGPASSWORD="$PGPASSWORD_TEST" psql -X -tA -U service_role -h localhost -d "$DB" \
  -c "select count(*) from public.exercise_library where exercise_id in ('33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444');" 2>&1 | tail -1 | tr -d '[:space:]')
if [ "$OUT" = "2" ]; then pass "service_role : voit exercices draft ET validated (chemin admin réel)"; else fail "service_role exercises visibility (obtenu $OUT)"; fi

echo ""
echo "--- 3. Isolation par utilisateur (own-row) ---"

# patient_profiles : select/insert/update own
expect_success "patient_profiles : A peut créer son propre profil" app_user "$A" authenticated \
  "insert into public.patient_profiles (user_id, main_pathology) values ('$A', 'LOMBALGIE_COMMUNE');"
expect_error "patient_profiles : A ne peut PAS créer un profil pour B" app_user "$A" authenticated \
  "insert into public.patient_profiles (user_id, main_pathology) values ('$B', 'LOMBALGIE_COMMUNE');"
expect_row_count "patient_profiles : A ne voit que son propre profil" app_user "$A" authenticated \
  "select count(*) from public.patient_profiles;" "1"

# clinical_assessments : select/insert own, immuable (pas d'update)
expect_success "clinical_assessments : A peut créer sa propre évaluation" app_user "$A" authenticated \
  "insert into public.clinical_assessments (user_id, pathology, responses, safety_status, message, engine_version) values ('$A', 'LOMBALGIE_COMMUNE', '{}'::jsonb, 'pending_validation', 'test', 'test');"
expect_error "clinical_assessments : A ne peut PAS créer une évaluation pour B" app_user "$A" authenticated \
  "insert into public.clinical_assessments (user_id, pathology, responses, safety_status, message, engine_version) values ('$B', 'LOMBALGIE_COMMUNE', '{}'::jsonb, 'pending_validation', 'test', 'test');"
expect_update_zero "clinical_assessments : immuable, même pour son propre enregistrement" app_user "$A" authenticated \
  "update public.clinical_assessments set pathology = 'ARTHROSE_GENOU' where user_id = '$A';"

# sessions : select/insert/update own
expect_success "sessions : A peut démarrer sa propre séance" app_user "$A" authenticated \
  "insert into public.sessions (user_id, pathology, status) values ('$A', 'LOMBALGIE_COMMUNE', 'in_progress');"
expect_error "sessions : A ne peut PAS créer une séance pour B" app_user "$A" authenticated \
  "insert into public.sessions (user_id, pathology, status) values ('$B', 'LOMBALGIE_COMMUNE', 'in_progress');"
expect_success "sessions : A peut mettre à jour sa propre séance" app_user "$A" authenticated \
  "update public.sessions set status = 'completed' where user_id = '$A';"

# measurements : select/insert/update/delete own
expect_success "measurements : A peut enregistrer sa propre mesure" app_user "$A" authenticated \
  "insert into public.measurements (user_id, measurement_type, weight_kg) values ('$A', 'poids', 70);"
expect_error "measurements : A ne peut PAS enregistrer une mesure pour B" app_user "$A" authenticated \
  "insert into public.measurements (user_id, measurement_type, weight_kg) values ('$B', 'poids', 70);"
expect_row_count "measurements : A ne voit que ses propres mesures" app_user "$A" authenticated \
  "select count(*) from public.measurements;" "1"

# notifications : select/insert/update/delete own
expect_success "notifications : A peut créer sa propre notification" app_user "$A" authenticated \
  "insert into public.notifications (user_id, notification_type, title, body) values ('$A', 'encouragement', 't', 'b');"
expect_error "notifications : A ne peut PAS créer une notification pour B" app_user "$A" authenticated \
  "insert into public.notifications (user_id, notification_type, title, body) values ('$B', 'encouragement', 't', 'b');"

# user_program_assignments : select/insert own, immuable
expect_success "user_program_assignments : A peut enregistrer sa propre tentative" app_user "$A" authenticated \
  "insert into public.user_program_assignments (user_id, pathology, status, engine_version) values ('$A', 'LOMBALGIE_COMMUNE', 'pending_validation', 'test');"
expect_error "user_program_assignments : A ne peut PAS en créer une pour B" app_user "$A" authenticated \
  "insert into public.user_program_assignments (user_id, pathology, status, engine_version) values ('$B', 'LOMBALGIE_COMMUNE', 'pending_validation', 'test');"

echo ""
echo "--- 4. Faille corrigée en migration 0010 : auto-élévation de rôle/statut ---"
expect_error "users : A ne peut PAS s'auto-promouvoir admin" app_user "$A" authenticated \
  "update public.users set role = 'admin' where id = '$A';"

# Suspend A via service_role (seul chemin légitime) avant de vérifier qu'A
# ne peut pas s'auto-réactiver — sinon l'update serait un no-op (status déjà
# 'active') et ne prouverait rien.
psql_service "update public.users set status = 'suspended' where id = '$A';" >/dev/null
expect_error "users : A ne peut PAS lever sa propre suspension" app_user "$A" authenticated \
  "update public.users set status = 'active' where id = '$A';"
psql_service "update public.users set status = 'active' where id = '$A';" >/dev/null
expect_success "users : A peut modifier un champ ordinaire de son profil" app_user "$A" authenticated \
  "update public.users set first_name = 'Nouveau nom' where id = '$A';"
OUT=$(psql_service "update public.users set role = 'admin' where id = '$A'; update public.users set role = 'patient' where id = '$A';")
if echo "$OUT" | grep -q "ERROR"; then
  fail "users : service_role DOIT pouvoir changer role/status (chemin admin réel)"
else
  pass "users : service_role peut changer role/status (chemin admin réel)"
fi

echo ""
echo "--- 5. Faille de la même famille prévenue en migration 0011 : abonnements/paiements ---"
expect_success "subscriptions : A peut demander un plan (status='pending')" app_user "$A" authenticated \
  "insert into public.subscriptions (user_id, plan_code, status) values ('$A', 'premium_monthly', 'pending');"
expect_error "subscriptions : A ne peut PAS s'auto-activer" app_user "$A" authenticated \
  "insert into public.subscriptions (user_id, plan_code, status) values ('$A', 'premium_yearly', 'active');"
expect_error "subscriptions : A ne peut PAS en créer une pour B" app_user "$A" authenticated \
  "insert into public.subscriptions (user_id, plan_code, status) values ('$B', 'premium_monthly', 'pending');"
expect_update_zero "subscriptions : A n'a AUCUNE capacité de mise à jour, même sur sa propre ligne" app_user "$A" authenticated \
  "update public.subscriptions set status = 'active' where user_id = '$A';"

expect_success "payments : A peut déclarer un paiement (status='pending')" app_user "$A" authenticated \
  "insert into public.payments (user_id, provider, amount, external_reference, status) values ('$A', 'orange_money', 2000, 'TX-RLS-TEST', 'pending');"
expect_error "payments : A ne peut PAS s'auto-confirmer un paiement" app_user "$A" authenticated \
  "insert into public.payments (user_id, provider, amount, external_reference, status) values ('$A', 'orange_money', 2000, 'TX-RLS-TEST-2', 'confirmed');"
expect_update_zero "payments : A n'a AUCUNE capacité de mise à jour, même sur sa propre ligne" app_user "$A" authenticated \
  "update public.payments set status = 'confirmed' where user_id = '$A';"

OUT=$(psql_service "update public.subscriptions set status = 'active', started_at = now() where user_id = '$A' and plan_code = 'premium_monthly';")
if echo "$OUT" | grep -qE "UPDATE 1"; then
  pass "subscriptions : service_role peut activer (chemin admin réel)"
else
  fail "subscriptions : service_role DEVRAIT pouvoir activer (obtenu : $OUT)"
fi

echo ""
echo "--- 6. audit_logs : aucun accès direct depuis le client ---"
expect_row_count "audit_logs : un patient ne voit RIEN (aucune policy select)" app_user "$A" authenticated \
  "select count(*) from public.audit_logs;" "0"
expect_error "audit_logs : un patient ne peut PAS écrire directement" app_user "$A" authenticated \
  "insert into public.audit_logs (actor_user_id, action, entity_type) values ('$A', 'test', 'test');"

echo ""
echo "--- 7. functional_capacity_assessments / psfs_activities (§33, Sprint 18) : isolation par utilisateur ---"

expect_success "functional_capacity_assessments : A peut enregistrer sa propre évaluation PSFS" app_user "$A" authenticated \
  "insert into public.functional_capacity_assessments (id, user_id, instrument) values ('77777777-7777-7777-7777-777777777777', '$A', 'psfs');"
expect_error "functional_capacity_assessments : A ne peut PAS enregistrer une évaluation pour B" app_user "$A" authenticated \
  "insert into public.functional_capacity_assessments (user_id, instrument) values ('$B', 'psfs');"
expect_row_count "functional_capacity_assessments : A ne voit que ses propres évaluations" app_user "$A" authenticated \
  "select count(*) from public.functional_capacity_assessments;" "1"

expect_success "psfs_activities : A peut ajouter une activité à sa propre évaluation" app_user "$A" authenticated \
  "insert into public.psfs_activities (assessment_id, activity_label, difficulty_score) values ('77777777-7777-7777-7777-777777777777', 'Monter les escaliers', 6);"

# B tente d'ajouter une activité sur l'évaluation de A : bloqué par la policy
# d'insertion (exists check sur functional_capacity_assessments.user_id = auth.uid()).
expect_error "psfs_activities : B ne peut PAS ajouter une activité à l'évaluation de A" app_user "$B" authenticated \
  "insert into public.psfs_activities (assessment_id, activity_label, difficulty_score) values ('77777777-7777-7777-7777-777777777777', 'Intrusion', 5);"
expect_row_count "psfs_activities : B ne voit aucune activité de l'évaluation de A" app_user "$B" authenticated \
  "select count(*) from public.psfs_activities where assessment_id = '77777777-7777-7777-7777-777777777777';" "0"

echo ""
echo "--- 8. planned_sessions (§33, réf. B11, Sprint 19) : isolation par utilisateur ---"

expect_success "planned_sessions : A peut créer sa propre séance planifiée" app_user "$A" authenticated \
  "insert into public.planned_sessions (id, user_id, pathology, planned_for) values ('88888888-8888-8888-8888-888888888888', '$A', 'LOMBALGIE_COMMUNE', current_date);"
expect_error "planned_sessions : A ne peut PAS en créer une pour B" app_user "$A" authenticated \
  "insert into public.planned_sessions (user_id, pathology, planned_for) values ('$B', 'LOMBALGIE_COMMUNE', current_date);"
expect_row_count "planned_sessions : A ne voit que ses propres séances planifiées" app_user "$A" authenticated \
  "select count(*) from public.planned_sessions;" "1"
expect_row_count "planned_sessions : B ne voit aucune séance planifiée de A" app_user "$B" authenticated \
  "select count(*) from public.planned_sessions where id = '88888888-8888-8888-8888-888888888888';" "0"
expect_success "planned_sessions : A peut reporter sa propre séance planifiée" app_user "$A" authenticated \
  "update public.planned_sessions set planned_for = current_date + 1 where id = '88888888-8888-8888-8888-888888888888';"
expect_update_zero "planned_sessions : B ne peut PAS modifier une séance planifiée de A" app_user "$B" authenticated \
  "update public.planned_sessions set status = 'cancelled_safety' where id = '88888888-8888-8888-8888-888888888888';"

echo ""
echo "=== Résumé ==="
echo "  Réussis : $PASS"
echo "  Échoués : $FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Scénarios en échec :"
  for c in "${FAILED_CHECKS[@]}"; do echo "  - $c"; done
  exit 1
fi
echo ""
echo "Tous les scénarios RLS passent."
exit 0
