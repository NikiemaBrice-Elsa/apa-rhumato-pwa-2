-- Références scientifiques déjà fournies par le concepteur médical au §81
-- du cahier des charges. Reprises telles quelles — aucun DOI inventé (§32).

insert into public.scientific_references
  (title, authors, journal, year, doi, organization, pathologies, recommendation_summary, last_checked)
values
  (
    'World Health Organization 2020 guidelines on physical activity and sedentary behaviour',
    'Bull FC, et al.',
    'British Journal of Sports Medicine',
    2020,
    '10.1136/bjsports-2020-102955',
    'OMS',
    '{}',
    'Référence générale : l''activité physique doit être régulière, progressive et adaptée aux capacités de la personne (§3.1).',
    current_date
  ),
  (
    'EULAR recommendations for physical activity in people with inflammatory arthritis and osteoarthritis: 2025 update',
    'Rausch Osthoff AK, et al.',
    'Annals of the Rheumatic Diseases',
    2026,
    '10.1016/j.ard.2026.03.006',
    'EULAR',
    '{ARTHROSE_GENOU,ARTHROSE_HANCHE,POLYARTHRITE_RHUMATOIDE,SPONDYLOARTHRITE_AXIALE}',
    'Référence majeure pour arthrose, polyarthrite rhumatoïde, spondyloarthrite/inflammation articulaire, activité physique, réduction de la sédentarité, interventions numériques, personnalisation et progression (§4).',
    current_date
  ),
  (
    '2019 American College of Rheumatology/Arthritis Foundation Guideline for the Management of Osteoarthritis of the Hand, Hip, and Knee',
    'Kolasinski SL, et al.',
    'Arthritis Care & Research',
    2020,
    '10.1002/acr.24131',
    'ACR',
    '{ARTHROSE_GENOU,ARTHROSE_HANCHE}',
    'Recommandations ACR/Arthritis Foundation pour l''arthrose de la main, de la hanche et du genou (§5.1).',
    current_date
  ),
  (
    '2022 American College of Rheumatology Guideline for Exercise, Rehabilitation, Diet, and Additional Integrative Interventions for Rheumatoid Arthritis',
    'England BR, et al.',
    'Arthritis Care & Research',
    2023,
    '10.1002/acr.25117',
    'ACR',
    '{POLYARTHRITE_RHUMATOIDE}',
    'L''ACR recommande fortement l''engagement régulier dans l''exercice chez les personnes atteintes de polyarthrite rhumatoïde (§5.2).',
    current_date
  ),
  (
    'ASAS-EULAR recommendations for the management of axial spondyloarthritis: 2022 update',
    'Ramiro S, et al.',
    'Annals of the Rheumatic Diseases',
    2023,
    '10.1136/ard-2022-223296',
    'ASAS-EULAR',
    '{SPONDYLOARTHRITE_AXIALE}',
    'Référence de prise en charge de la spondyloarthrite axiale (§81).',
    current_date
  ),
  (
    'WHO guideline for non-surgical management of chronic primary low back pain in adults in primary and community care settings',
    'World Health Organization',
    null,
    2023,
    null,
    'OMS',
    '{LOMBALGIE_COMMUNE}',
    'Un programme d''exercice structuré peut être proposé aux adultes présentant une lombalgie chronique primaire (§6).',
    current_date
  ),
  (
    'Interventions for the Management of Acute and Chronic Low Back Pain: Revision 2021',
    'George SZ, et al.',
    'Journal of Orthopaedic & Sports Physical Therapy',
    2021,
    '10.2519/jospt.2021.0304',
    'JOSPT',
    '{LOMBALGIE_COMMUNE}',
    'Complète la référence OMS lombalgie (§6).',
    current_date
  ),
  (
    'Low back pain',
    'Knezevic NN, et al.',
    'Lancet',
    2021,
    '10.1016/S0140-6736(21)00733-9',
    'Lancet',
    '{LOMBALGIE_COMMUNE}',
    'Revue de référence sur la lombalgie (§6).',
    current_date
  ),
  (
    'The clinician''s guide to prevention and treatment of osteoporosis',
    'LeBoff MS, et al.',
    'Osteoporosis International',
    2022,
    '10.1007/s00198-021-05900-y',
    'Société savante (ostéoporose)',
    '{OSTEOPOROSE}',
    'Guide clinique de prévention et traitement de l''ostéoporose (§81).',
    current_date
  ),
  (
    'Exercise and the prevention of major osteoporotic fractures in adults',
    'Hoffmann I, et al.',
    'Osteoporosis International',
    2023,
    '10.1007/s00198-022-06592-8',
    'Société savante (ostéoporose)',
    '{OSTEOPOROSE}',
    'Exercice et prévention des fractures ostéoporotiques majeures (§81).',
    current_date
  );
