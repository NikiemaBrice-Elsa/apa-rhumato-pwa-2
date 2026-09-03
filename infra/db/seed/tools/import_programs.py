#!/usr/bin/env python3
"""
Convertit le gabarit Excel « programmes » rempli par le concepteur médical en
un fichier de seed SQL pour la table `programs` (Sprint 6, §29, §30, §67, §68
du cahier des charges).

Usage :
    python3 import_programs.py gabarit_programmes_apa_rhumato.xlsx \
        > ../0011_programs.sql

Ce script ne valide ni n'invente AUCUN contenu médical : il transcrit
fidèlement ce que le concepteur médical a saisi, EXACTEMENT comme
import_exercises.py (Sprint 5). Toute ligne dont le statut de validation
n'est pas 'validated' reste invisible des utilisateurs (RLS, migration
0006_programs.sql) — mais est tout de même importée, pour permettre une
revue interne progressive dans /admin.

Ce script ne lie AUCUN exercice au programme (table program_exercises) :
cette étape suppose une bibliothèque d'exercices déjà validée et reste
volontairement hors du périmètre de ce script.
"""
import sys
import uuid
import openpyxl

REQUIRED_COLUMNS = ["program_code", "pathology", "profile_level", "medical_validation_status"]

# Ordre exact des colonnes du gabarit (onglet "Programmes", ligne d'en-tête 3)
COLUMN_ORDER = [
    "program_code", "pathology", "profile_level", "objective",
    "duration_weeks", "frequency_per_week", "intensity",
    "aerobic_component", "strength_component", "mobility_component",
    "balance_component", "functional_component",
    "progression_rule", "regression_rule", "safety_rules",
    "scientific_references", "medical_validation_status",
]

DIRECT_COLUMNS = [
    "program_code", "pathology", "profile_level", "objective",
    "duration_weeks", "frequency_per_week", "intensity",
    "aerobic_component", "strength_component", "mobility_component",
    "balance_component", "functional_component",
    "progression_rule", "regression_rule", "safety_rules",
    "medical_validation_status",
]

INT_COLUMNS = {"duration_weeks", "frequency_per_week"}


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


def main():
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        sys.exit(1)

    wb = openpyxl.load_workbook(sys.argv[1], data_only=True)
    ws = wb["Programmes"]

    header_row = 3
    headers = {col: idx for idx, col in enumerate(COLUMN_ORDER, start=1)}

    statements = []
    skipped_example = 0
    row_count = 0
    seen_codes = set()

    for row in ws.iter_rows(min_row=header_row + 1, values_only=False):
        values = {col: row[idx - 1].value for col, idx in headers.items()}
        code = (values.get("program_code") or "").strip() if values.get("program_code") else ""

        if not code:
            continue
        if "À SUPPRIMER" in code.upper() or "EXEMPLE" in code.upper():
            skipped_example += 1
            continue

        missing = [c for c in REQUIRED_COLUMNS if not values.get(c)]
        if missing:
            print(f"-- IGNORÉ (champs obligatoires manquants : {missing}) : {code}", file=sys.stderr)
            continue

        if code in seen_codes:
            print(f"-- IGNORÉ (program_code en double dans le fichier) : {code}", file=sys.stderr)
            continue
        seen_codes.add(code)

        program_id = str(uuid.uuid4())
        cols_sql = ["program_id"]
        vals_sql = [sql_str(program_id)]

        for col in DIRECT_COLUMNS:
            cols_sql.append(col)
            v = values.get(col)
            vals_sql.append(sql_int(v) if col in INT_COLUMNS else sql_str(v))

        statements.append(
            f"insert into public.programs ({', '.join(cols_sql)}) values ({', '.join(vals_sql)});"
        )

        dois = [d.strip() for d in str(values.get("scientific_references") or "").split(",") if d.strip() and d.strip() != "(sans DOI)"]
        for doi in dois:
            statements.append(
                "insert into public.program_references (program_id, reference_id) "
                f"select {sql_str(program_id)}, id from public.scientific_references where doi = {sql_str(doi)};"
            )

        row_count += 1

    print(f"-- Généré automatiquement depuis {sys.argv[1]}")
    print(f"-- {row_count} programme(s) importé(s), {skipped_example} ligne(s) d'exemple ignorée(s).")
    print("-- Rappel : un programme n'est visible des utilisateurs que si medical_validation_status = 'validated'.")
    print("-- Rappel : aucun exercice n'est lié ici (program_exercises) — étape séparée, une fois la bibliothèque d'exercices validée.")
    print()
    for s in statements:
        print(s)

    print(f"-- {row_count} programme(s) importé(s)", file=sys.stderr)


if __name__ == "__main__":
    main()
