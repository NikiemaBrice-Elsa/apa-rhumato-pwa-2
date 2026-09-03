#!/usr/bin/env python3
"""
Construit infra/db/seed/tools/gabarit_programmes_apa_rhumato.xlsx : gabarit de
saisie du contenu FITT-VP des programmes (§29, §30, §67, §68 du cahier des
charges), sur le même modèle que gabarit_exercices_apa_rhumato.xlsx (Sprint 5)
et gabarit_seuils_cliniques.xlsx (Sprint 6bis).

Ce script ne pré-remplit AUCUN contenu médical : seules les colonnes
structurelles (code programme, pathologie, niveau) sont pré-remplies, parce
qu'elles découlent directement de packages/domain/src/pathologies.ts et
packages/domain/src/programs.ts (PROFILE_LEVELS), pas d'un jugement clinique.

Usage : python3 build_gabarit_programmes.py
(régénère gabarit_programmes_apa_rhumato.xlsx dans le dossier courant)
"""
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.worksheet.datavalidation import DataValidation

PATHOLOGIES = [
    ("LOMBALGIE_COMMUNE", "Lombalgie commune / lombosciatique commune"),
    ("ARTHROSE_GENOU", "Arthrose du genou"),
    ("ARTHROSE_HANCHE", "Arthrose de hanche"),
    ("POLYARTHRITE_RHUMATOIDE", "Polyarthrite rhumatoïde"),
    ("SPONDYLOARTHRITE_AXIALE", "Spondyloarthrite axiale"),
    ("OSTEOPOROSE", "Ostéoporose"),
]

LEVELS = [
    ("debutant", "Débutant"),
    ("intermediaire", "Intermédiaire"),
    ("avance", "Avancé"),
]

OBJECTIVES = [
    ("REDUIRE_SEDENTARITE", "Diminuer la sédentarité"),
    ("AMELIORER_MOBILITE", "Améliorer la mobilité"),
    ("AMELIORER_FORCE", "Améliorer la force"),
    ("AMELIORER_ENDURANCE", "Améliorer l'endurance"),
    ("AMELIORER_EQUILIBRE", "Améliorer l'équilibre"),
    ("AMELIORER_CAPACITE_FONCTIONNELLE", "Améliorer la capacité fonctionnelle"),
    ("REPRENDRE_ACTIVITE_PROGRESSIVEMENT", "Reprendre progressivement une activité physique"),
    ("AMELIORER_CONDITION_PHYSIQUE", "Améliorer la condition physique"),
    ("MAINTENIR_AUTONOMIE", "Maintenir l'autonomie"),
    ("AMELIORER_CONFIANCE_MOUVEMENT", "Améliorer la confiance dans le mouvement"),
]

STATUSES = [
    ("draft", "Brouillon — pas encore relu"),
    ("pending_validation", "En cours de validation par le concepteur médical"),
    ("validated", "Validé — deviendra visible des patients"),
]

HEADERS = [
    "Code programme *",
    "Pathologie *",
    "Niveau *",
    "Objectif principal (code)",
    "Durée du programme (semaines)",
    "Fréquence (séances / semaine)",
    "Intensité cible",
    "Composante aérobique (FITT-VP)",
    "Composante renforcement (FITT-VP)",
    "Composante mobilité (FITT-VP)",
    "Composante équilibre (FITT-VP)",
    "Composante fonctionnelle (FITT-VP)",
    "Règle de progression",
    "Règle de régression",
    "Règles de sécurité spécifiques",
    "Références (DOI, virgule)",
    "Statut de validation *",
]

TEAL = "FF265961"
WHITE = "FFFFFFFF"
EXAMPLE_FILL = "FFEAF2F1"


def style_header(ws, row, ncols):
    for c in range(1, ncols + 1):
        cell = ws.cell(row=row, column=c)
        cell.font = Font(bold=True, color=WHITE, size=10)
        cell.fill = PatternFill("solid", fgColor=TEAL)
        cell.alignment = Alignment(wrap_text=True, vertical="top")


def main():
    wb = openpyxl.Workbook()

    # --- Onglet Instructions ---
    ins = wb.active
    ins.title = "Instructions"
    lines = [
        ("APA Rhumatologie — Gabarit de saisie du contenu des programmes (FITT-VP)", True, 12),
        (None, False, 10),
        ("Objet (§29, §30, §67, §68 du cahier des charges)", True, 10),
        (
            "Ce fichier sert à faire remonter le contenu réel des programmes d'activité physique "
            "adaptée : une ligne = une combinaison pathologie × niveau. Rien de ce contenu n'a été "
            "inventé côté développement — la table `programs` est vide tant que ce gabarit n'est pas "
            "rempli et importé (packages/domain/src/programs.ts : « aucun programme réel n'est fourni "
            "par le code, cette interface décrit la FORME des données »).",
            False, 10,
        ),
        (None, False, 10),
        ("Ce qui est déjà pré-rempli, et ce qui reste à compléter", True, 10),
        (
            "Les colonnes « Code programme », « Pathologie » et « Niveau » sont pré-remplies pour les "
            "18 combinaisons possibles (6 pathologies × 3 niveaux) — elles découlent directement du "
            "code, pas d'un jugement clinique. Toutes les autres colonnes sont à votre discrétion : "
            "laissez une ligne quasiment vide si une combinaison n'a pas lieu d'exister en V1 (le statut "
            "de validation restera alors sur draft/pending_validation, elle ne sera jamais visible des "
            "patients).",
            False, 10,
        ),
        (None, False, 10),
        ("Rappel de vos réponses déjà données (document Q1-Q6 et questionnaire du 20/08/2026)", True, 10),
        (
            "B4 — matrice décisionnelle narrative pour l'attribution : le statut de dépistage (vert/orange) "
            "est le premier filtre, le niveau initial fixe la dose de départ, la douleur module ensuite "
            "l'accès et l'adaptation. Ce gabarit fournit le CONTENU des programmes eux-mêmes ; la "
            "traduction de B4 en règles `allow_program` (quelle combinaison pathologie/niveau/douleur "
            "pointe vers quel programme) est une étape séparée, une fois ce gabarit rempli.",
            False, 10,
        ),
        (
            "B5 — chaque combinaison pathologie + niveau doit avoir une fiche FITT-VP complète : c'est "
            "exactement l'objet des colonnes « Composante aérobique/renforcement/mobilité/équilibre/"
            "fonctionnelle » ci-contre (Fréquence, Intensité, Temps/durée, Type, Volume, Progression).",
            False, 10,
        ),
        (
            "B6 — intensité cible : Borg CR10 ou Borg 6-20 en mesure principale, complétée par la "
            "fréquence cardiaque et le « talk test » quand pertinent/disponible ; la FC max seule ne doit "
            "jamais être utilisée comme critère unique. Un rappel figure dans l'en-tête de la colonne "
            "« Intensité cible », mais la valeur précise par combinaison reste à votre charge.",
            False, 10,
        ),
        (
            "B9 — critères de régression par défaut (déjà répondus, applicables à toute combinaison sauf "
            "précision contraire dans la colonne dédiée) : aggravation de la douleur au-delà de 24h, "
            "symptômes répétés, gonflement/raideur nouveaux, baisse fonctionnelle, fatigue excessive ou "
            "incapacité à réaliser l'exercice — un signal isolé et résolutif reste une simple alerte, pas "
            "une régression automatique. Indiquez dans la colonne « Règle de régression » si une "
            "combinaison a besoin d'un critère différent ou complémentaire ; sinon, vous pouvez écrire "
            "« Par défaut (B9) ».",
            False, 10,
        ),
        (None, False, 10),
        ("Comment remplir", True, 10),
        ("1. Une ligne = une combinaison pathologie × niveau. La ligne 4 de l'onglet « Programmes » est un EXEMPLE (fond bleu clair) : à supprimer avant l'import.", False, 10),
        ("2. Les colonnes marquées * sont obligatoires (elles sont déjà pré-remplies).", False, 10),
        ("3. « Objectif principal » : un seul code, voir l'onglet « Listes de référence ». Laisser vide si non applicable.", False, 10),
        ("4. « Statut de validation » : laisser sur draft ou pending_validation tant que le programme n'est pas définitivement approuvé. Seules les lignes « validated » seront un jour visibles par les utilisateurs.", False, 10),
        ("5. « Références (DOI) » : uniquement des DOI déjà présents dans la base documentaire (onglet « Listes de référence »). Ne pas inventer de DOI (§32). Laisser vide si non applicable.", False, 10),
        ("6. Les exercices précis de chaque programme (table program_exercises) ne sont PAS saisis ici : cette étape viendra une fois la bibliothèque d'exercices validée (§25-§27), pour lier des exercice_id réels et déjà approuvés.", False, 10),
        (None, False, 10),
        ("Ce qui se passe ensuite", True, 10),
        ("Le fichier rempli est reconverti en seed SQL via infra/db/seed/tools/import_programs.py, sur le même principe qu'import_exercises.py (Sprint 5). Aucun programme n'apparaît dans l'application tant que son statut n'est pas 'validated'.", False, 10),
    ]
    for i, (text, bold, size) in enumerate(lines, start=1):
        cell = ins.cell(row=i, column=1, value=text)
        cell.font = Font(bold=bold, size=size)
        cell.alignment = Alignment(wrap_text=True, vertical="top")
    ins.column_dimensions["A"].width = 130

    # --- Onglet Listes de référence ---
    ref = wb.create_sheet("Listes de référence")
    r = 1
    ref.cell(row=r, column=1, value="Pathologies (§7) — colonne « Pathologie »").font = Font(bold=True)
    r += 1
    for code, label in PATHOLOGIES:
        ref.cell(row=r, column=1, value=code)
        ref.cell(row=r, column=2, value=label)
        r += 1
    r += 1
    ref.cell(row=r, column=1, value="Niveaux (§30) — colonne « Niveau »").font = Font(bold=True)
    r += 1
    for code, label in LEVELS:
        ref.cell(row=r, column=1, value=code)
        ref.cell(row=r, column=2, value=label)
        r += 1
    r += 1
    ref.cell(row=r, column=1, value="Objectifs (§22) — colonne « Objectif principal »").font = Font(bold=True)
    r += 1
    for code, label in OBJECTIVES:
        ref.cell(row=r, column=1, value=code)
        ref.cell(row=r, column=2, value=label)
        r += 1
    r += 1
    ref.cell(row=r, column=1, value="Statut de validation médicale — colonne « Statut de validation »").font = Font(bold=True)
    r += 1
    for code, label in STATUSES:
        ref.cell(row=r, column=1, value=code)
        ref.cell(row=r, column=2, value=label)
        r += 1
    r += 1
    ref.cell(row=r, column=1, value="Références scientifiques déjà en base (DOI) — voir infra/db/seed/0002_scientific_references.sql pour le détail complet").font = Font(bold=True)
    ref.column_dimensions["A"].width = 40
    ref.column_dimensions["B"].width = 55

    # --- Onglet Programmes ---
    ws = wb.create_sheet("Programmes")
    ws.cell(
        row=1, column=1,
        value="Légende : ligne 4 (fond bleu clair) = exemple à supprimer avant import. Colonnes marquées * = obligatoires, déjà pré-remplies pour les 18 combinaisons.",
    ).font = Font(italic=True, size=9)

    header_row = 3
    for c, h in enumerate(HEADERS, start=1):
        ws.cell(row=header_row, column=c, value=h)
    style_header(ws, header_row, len(HEADERS))

    example_row = header_row + 1
    example = [
        "OA_GENOU_DEBUTANT_01 (exemple, À SUPPRIMER)",
        "ARTHROSE_GENOU",
        "debutant",
        "AMELIORER_MOBILITE",
        "À définir",
        "À définir",
        "À définir (rappel B6 : Borg CR10 ou Borg 6-20 + FC/talk test, jamais FC max seule)",
        "À définir",
        "À définir",
        "À définir",
        "À définir",
        "À définir",
        "À définir (peut renvoyer aux principes déjà donnés, ex. progression sur 4-6 semaines EULAR)",
        "Par défaut (B9), sauf précision contraire",
        "À définir par le concepteur médical",
        "10.1002/acr.24131",
        "draft",
    ]
    for c, v in enumerate(example, start=1):
        cell = ws.cell(row=example_row, column=c, value=v)
        cell.fill = PatternFill("solid", fgColor=EXAMPLE_FILL)
        cell.alignment = Alignment(wrap_text=True, vertical="top")

    data_start = example_row + 1
    row = data_start
    for path_code, _ in PATHOLOGIES:
        for level_code, _ in LEVELS:
            program_code = f"{path_code}_{level_code.upper()}_01"
            ws.cell(row=row, column=1, value=program_code)
            ws.cell(row=row, column=2, value=path_code)
            ws.cell(row=row, column=3, value=level_code)
            ws.cell(row=row, column=17, value="draft")
            row += 1
    last_row = row - 1

    widths = [30, 24, 14, 30, 16, 16, 42, 30, 30, 30, 30, 30, 36, 36, 30, 22, 18]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[ws.cell(row=header_row, column=i).column_letter].width = w

    # Data validations (listes déroulantes)
    dv_pathology = DataValidation(type="list", formula1='"' + ",".join(p[0] for p in PATHOLOGIES) + '"', allow_blank=False)
    dv_level = DataValidation(type="list", formula1='"' + ",".join(l[0] for l in LEVELS) + '"', allow_blank=False)
    dv_objective = DataValidation(type="list", formula1='"' + ",".join(o[0] for o in OBJECTIVES) + '"', allow_blank=True)
    dv_status = DataValidation(type="list", formula1='"' + ",".join(s[0] for s in STATUSES) + '"', allow_blank=False)
    for dv in (dv_pathology, dv_level, dv_objective, dv_status):
        ws.add_data_validation(dv)
    dv_pathology.add(f"B{example_row}:B{last_row}")
    dv_level.add(f"C{example_row}:C{last_row}")
    dv_objective.add(f"D{example_row}:D{last_row}")
    dv_status.add(f"Q{example_row}:Q{last_row}")

    wb.save("gabarit_programmes_apa_rhumato.xlsx")
    print(f"OK : gabarit_programmes_apa_rhumato.xlsx généré, {last_row - data_start + 1} lignes pré-remplies (+1 exemple).")


if __name__ == "__main__":
    main()
