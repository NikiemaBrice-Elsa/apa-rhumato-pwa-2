-- Six modules obligatoires de la V1 (§7). Ne pas en ajouter d'autres sans
-- validation du concepteur médical.
insert into public.pathologies (code, name_fr, module_version, active) values
  ('LOMBALGIE_COMMUNE', 'Lombalgie commune / lombosciatique commune', 'V1.0', true),
  ('ARTHROSE_GENOU', 'Arthrose du genou', 'V1.0', true),
  ('ARTHROSE_HANCHE', 'Arthrose de hanche', 'V1.0', true),
  ('POLYARTHRITE_RHUMATOIDE', 'Polyarthrite rhumatoïde', 'V1.0', true),
  ('SPONDYLOARTHRITE_AXIALE', 'Spondyloarthrite axiale', 'V1.0', true),
  ('OSTEOPOROSE', 'Ostéoporose', 'V1.0', true)
on conflict (code) do nothing;
