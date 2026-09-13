/**
 * Espace professionnel de santé (§41) — Sprint 23 (13/09/2026), activé à la
 * demande de Dr Nikiema. Logique PURE uniquement (aucun accès réseau/BDD) —
 * même discipline que packages/domain/src/admin.ts : le contrôle d'accès
 * réel vit dans apps/web/src/lib/professionalAuth.ts et les policies RLS de
 * la migration 0021, ce fichier décide seulement CE QUI est permis.
 */

import type { UserRole } from "./types";

export const PROFESSIONAL_ROLE: UserRole = "professional";

export function isProfessionalRole(role: string | null | undefined): boolean {
  return role === PROFESSIONAL_ROLE;
}

export const PROFESSIONAL_LINK_STATUSES = ["pending", "authorized", "revoked"] as const;
export type ProfessionalLinkStatus = (typeof PROFESSIONAL_LINK_STATUSES)[number];

export const PROFESSIONAL_LINK_STATUS_LABELS_FR: Record<ProfessionalLinkStatus, string> = {
  pending: "En attente d'acceptation",
  authorized: "Accès autorisé",
  revoked: "Accès révoqué",
};

export type ProfessionalLinkActor = "patient" | "professional";

/**
 * Transitions autorisées, par acteur — reflète EXACTEMENT les policies RLS
 * de la migration 0021 (`ppl_update_patient` / `ppl_update_professional`) :
 * le patient initie et révoque, le professionnel accepte ou décline/se
 * retire. Ni l'un ni l'autre ne peut s'auto-autoriser depuis le mauvais
 * rôle — testé isolément ici, et re-vérifié en base par `verify_rls.sh`.
 */
const LINK_STATUS_TRANSITIONS: Record<
  ProfessionalLinkStatus,
  Partial<Record<ProfessionalLinkActor, readonly ProfessionalLinkStatus[]>>
> = {
  pending: { patient: ["revoked"], professional: ["authorized", "revoked"] },
  authorized: { patient: ["revoked"], professional: ["revoked"] },
  revoked: { patient: ["pending"], professional: [] },
};

export function canTransitionProfessionalLinkStatus(
  from: ProfessionalLinkStatus,
  to: ProfessionalLinkStatus,
  actor: ProfessionalLinkActor
): boolean {
  return LINK_STATUS_TRANSITIONS[from]?.[actor]?.includes(to) ?? false;
}
