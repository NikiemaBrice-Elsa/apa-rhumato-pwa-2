/**
 * Les six modules de la V1 (cahier des charges §7).
 * Aucune pathologie supplémentaire ne doit être ajoutée sans validation
 * du concepteur médical (contrainte explicite du §7).
 */
export const PATHOLOGY_CODES = [
  "LOMBALGIE_COMMUNE",
  "ARTHROSE_GENOU",
  "ARTHROSE_HANCHE",
  "POLYARTHRITE_RHUMATOIDE",
  "SPONDYLOARTHRITE_AXIALE",
  "OSTEOPOROSE",
] as const;

export type PathologyCode = (typeof PATHOLOGY_CODES)[number];

export const PATHOLOGY_LABELS_FR: Record<PathologyCode, string> = {
  LOMBALGIE_COMMUNE: "Lombalgie commune / lombosciatique commune",
  ARTHROSE_GENOU: "Arthrose du genou",
  ARTHROSE_HANCHE: "Arthrose de hanche",
  POLYARTHRITE_RHUMATOIDE: "Polyarthrite rhumatoïde",
  SPONDYLOARTHRITE_AXIALE: "Spondyloarthrite axiale",
  OSTEOPOROSE: "Ostéoporose",
};
