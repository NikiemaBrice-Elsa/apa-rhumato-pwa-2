#!/usr/bin/env python3
"""
Convertit le gabarit Excel rempli par le concepteur médical en un fichier de
seed SQL pour la table exercise_library (Sprint 5, §25-§27 du cahier des
charges).

Usage :
    python3 import_exercises.py gabarit_exercices_apa_rhumato.xlsx \
        > ../0004_exercises.sql

Ce script ne valide AUCUN contenu médical : il transcrit fidèlement ce que le
concepteur médical a saisi. Toute ligne dont le statut de validation n'est
pas 'validated' reste invisible des utilisateurs (RLS, migration
0005_exercise_library.sql) — mais est tout de même importée, pour permettre
une revue interne progressive.

Sprint 20 (10/09/2026) : la colonne « URL audio » du gabarit (position 25)
correspond désormais à `audio_preparation_url` (coach vocal, audio joué
avant l'exercice — voir migration 0019). Le second clip, `audio_exercise_url`
(audio joué pendant l'exercice), n'a volontairement PAS été ajouté au
gabarit Excel pour éviter de réorganiser les colonnes d'un fichier déjà
rempli et validé : il se saisit uniquement via l'écran d'administration des
exercices (/admin/exercices), comme c'est de toute façon le chemin attendu
pour les enregistrements audio de Dr Nikiema (il ne repasse pas par ce
gabarit pour les 8 exercices déjà validés — ce script sert à en AJOUTER,
pas à les modifier).
"""
import sys
import uuid
import openpyxl

REQUIRED_COLUMNS = ["name", "short_description", "pathologies", "category"]

COLUMN_ORDER = [
    "name", "short_description", "detailed_description", "pathologies", "objectives",
    "category", "difficulty", "starting_position", "execution_steps", "breathing_instruction",
    "duration_seconds", "repetitions", "sets", "rest_time_seconds", "frequency", "intensity",
    "progression", "regression", "contraindications", "precautions", "stop_criteria",
    "target_muscles", "equipment_required", "video_url", "audio_preparation_url", "thumbnail_url",
    "scientific_references", "last_reviewed", "medical_validation_status",
]

DIRECT_COLUMNS = [
    "name", "short_description", "detailed_description", "category", "difficulty",
    "starting_position", "execution_steps", "breathing_instruction", "duration_seconds",
    "repetitions", "sets", "rest_time_seconds", "frequency", "intensity", "progression",
    "regression", "contraindications", "precautions", "stop_criteria", "target_muscles",
    "video_url", "audio_preparation_url", "thumbnail_url", "last_reviewed", "medical_validation_status",
]

INT_COLUMNS = {"duration_seconds", "repetitions", "sets", "rest_time_seconds"}


def sql_str(value):
    if value is None or value == "":
        return "null"
    return "'" + str(value).replace("'", "''") + "'"


def sql_int(value):
    if value is None or value == "":
        return "null"
    try:
        return str(int(value))
    except (ValueError, TypeError):
        return "null"


def sql_array(value):
    if not value:
        return "'{}'"
    items = [v.strip() for v in str(value).split(",") if v.strip()]
    if not items:
        return "'{}'"
    escaped = ",".join(item.replace('"', '\\"') for item in items)
    return "'{" + escaped + "}'"


def main():
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        sys.exit(1)

    wb = openpyxl.load_workbook(sys.argv[1], data_only=True)
    ws = wb["Exercices"]

    header_row = 3
    headers = {}
    for idx, col in enumerate(COLUMN_ORDER, start=1):
        headers[col] = idx

    statements = []
    skipped_example = 0
    row_count = 0

    for row in ws.iter_rows(min_row=header_row + 1, values_only=False):
        values = {col: row[idx - 1].value for col, idx in headers.items()}
        name = (values.get("name") or "").strip() if values.get("name") else ""

        if not name:
            continue
        if "À SUPPRIMER" in name.upper() or name.upper().startswith("EXEMPLE"):
            skipped_example += 1
            continue

        missing = [c for c in REQUIRED_COLUMNS if not values.get(c)]
        if missing:
            print(f"-- IGNORÉ (champs obligatoires manquants : {missing}) : {name}", file=sys.stderr)
            continue

        exercise_id = str(uuid.uuid4())
        cols_sql = ["exercise_id"]
        vals_sql = [sql_str(exercise_id)]

        for col in DIRECT_COLUMNS:
            cols_sql.append(col)
            v = values.get(col)
            vals_sql.append(sql_int(v) if col in INT_COLUMNS else sql_str(v))

        cols_sql.append("equipment_required")
        vals_sql.append(sql_array(values.get("equipment_required")))

        statements.append(
            f"insert into public.exercise_library ({', '.join(cols_sql)}) values ({', '.join(vals_sql)});"
        )

        pathologies = [p.strip() for p in str(values.get("pathologies") or "").split(",") if p.strip()]
        for code in pathologies:
            statements.append(
                f"insert into public.exercise_pathologies (exercise_id, pathology_code) values ({sql_str(exercise_id)}, {sql_str(code)});"
            )

        objectives = [o.strip() for o in str(values.get("objectives") or "").split(",") if o.strip()]
        for code in objectives:
            statements.append(
                f"insert into public.exercise_objectives (exercise_id, objective_code) values ({sql_str(exercise_id)}, {sql_str(code)});"
            )

        dois = [d.strip() for d in str(values.get("scientific_references") or "").split(",") if d.strip() and d.strip() != "(sans DOI)"]
        for doi in dois:
            statements.append(
                "insert into public.exercise_references (exercise_id, reference_id) "
                f"select {sql_str(exercise_id)}, id from public.scientific_references where doi = {sql_str(doi)};"
            )

        row_count += 1

    print(f"-- Généré automatiquement depuis {sys.argv[1]}")
    print(f"-- {row_count} exercice(s) importé(s), {skipped_example} ligne(s) d'exemple ignorée(s).")
    print("-- Rappel : un exercice n'est visible des utilisateurs que si medical_validation_status = 'validated'.")
    print()
    for s in statements:
        print(s)

    print(f"-- {row_count} exercice(s) importé(s)", file=sys.stderr)


if __name__ == "__main__":
    main()
