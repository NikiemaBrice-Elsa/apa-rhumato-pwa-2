/**
 * Espace administrateur (§42, §43, §45, §46, §64, §65 — Sprint 13).
 *
 * Logique PURE uniquement : aucun accès réseau ni base de données ici (voir
 * apps/web/src/lib/adminAuth.ts pour le contrôle d'accès serveur réel, et
 * apps/web/src/lib/auditLog.ts pour l'écriture effective des journaux). Ce
 * fichier ne fait que décider ce qui est permis, ce qui reste testable de
 * façon déterministe — même discipline que packages/rules-engine et
 * apps/web/src/lib/offlineQueue.ts (Sprint 12).
 */

import type { MedicalValidationStatus } from "./exercises";
import type { UserRole } from "./types";

/**
 * §46 : « ne jamais faire confiance uniquement aux contrôles frontend » —
 * un seul rôle donne accès à l'espace administrateur. `professional` (§41)
 * est un rôle distinct, prévu dans l'architecture mais dont les droits ne
 * sont pas ceux de l'administration (§41 : à ne pas développer complètement
 * en V1).
 */
export const ADMIN_ROLE: UserRole = "admin";

export const USER_ROLES: readonly UserRole[] = ["patient", "professional", "admin"];

export function isAdminRole(role: string | null | undefined): boolean {
  return role === ADMIN_ROLE;
}

/** Reflète la colonne `users.status` (migration 0001). */
export const USER_STATUSES = ["active", "suspended", "deleted"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/**
 * Transitions qu'un ADMINISTRATEUR a le droit de déclencher sur le statut
 * d'un compte. `deleted` est volontairement absent des cibles autorisées :
 * c'est l'état terminal de la suppression de compte demandée par
 * l'utilisateur lui-même (§45 « possibilité de suppression du compte »),
 * jamais une action administrateur, et il n'est pas réversible depuis
 * l'espace admin (§78 : sécurité et confiance du patient avant tout).
 */
const ADMIN_ALLOWED_USER_STATUS_TRANSITIONS: Record<UserStatus, readonly UserStatus[]> = {
  active: ["suspended"],
  suspended: ["active"],
  deleted: [],
};

export function canAdminSetUserStatus(from: UserStatus, to: UserStatus): boolean {
  return ADMIN_ALLOWED_USER_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Transitions de validation médicale (§57, §59) applicables aux exercices et
 * programmes (`medical_validation_status`, Sprints 5/6). La publication
 * (passage à `validated`) passe TOUJOURS par `pending_validation` — jamais
 * directement depuis `draft` — pour garantir une étape de relecture
 * délibérée. Le retrait (`validated` -> `draft` ou `pending_validation`) est
 * en revanche autorisé dans les deux sens depuis `validated`, pour permettre
 * un retrait immédiat en cas de doute, sans étape intermédiaire imposée
 * (priorité §78 : la sécurité du patient prime sur le confort du workflow).
 */
const VALIDATION_STATUS_TRANSITIONS: Record<MedicalValidationStatus, readonly MedicalValidationStatus[]> = {
  draft: ["pending_validation"],
  pending_validation: ["draft", "validated"],
  validated: ["draft", "pending_validation"],
};

export function canTransitionValidationStatus(
  from: MedicalValidationStatus,
  to: MedicalValidationStatus
): boolean {
  if (from === to) return true; // pas un changement : toujours accepté (idempotent), pas d'audit inutile
  return VALIDATION_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

const VERSION_PATTERN = /^V(\d+)\.(\d+)$/;

/**
 * §43, §66 : incrémente la version MINEURE (V1.0 -> V1.1) à chaque
 * modification de contenu d'une règle/d'un exercice/d'un programme. Ne
 * devine JAMAIS un numéro à partir d'un format non reconnu : une version
 * mal formée doit être corrigée explicitement par l'administrateur plutôt
 * que d'être silencieusement réinitialisée (ce qui effacerait l'historique
 * réel de révision).
 */
export function bumpMinorVersion(currentVersion: string): string {
  const match = VERSION_PATTERN.exec(currentVersion.trim());
  if (!match) {
    throw new Error(
      `Format de version non reconnu ("${currentVersion}") : attendu "V<majeur>.<mineur>", ex. "V1.0". Corrigez la version manuellement avant de continuer.`
    );
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return `V${major}.${minor + 1}`;
}

/**
 * §66 : passage à une version MAJEURE (V1.x -> V2.0), réservé aux
 * changements de fond (ex. révision scientifique complète), déclenché
 * explicitement par l'administrateur — jamais automatique.
 */
export function bumpMajorVersion(currentVersion: string): string {
  const match = VERSION_PATTERN.exec(currentVersion.trim());
  if (!match) {
    throw new Error(
      `Format de version non reconnu ("${currentVersion}") : attendu "V<majeur>.<mineur>", ex. "V1.0". Corrigez la version manuellement avant de continuer.`
    );
  }
  const major = Number(match[1]);
  return `V${major + 1}.0`;
}

/**
 * §45, §65 : construit un diff avant/après pour la journalisation d'audit,
 * en ne conservant que les champs réellement modifiés (comparaison par
 * valeur JSON, insensible à l'ordre des clés d'un même objet imbriqué tant
 * que sa sérialisation est stable). Utilisé pour CHAQUE écriture
 * administrative sensible, jamais seulement pour les règles cliniques.
 */
export function buildAuditDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  const keys = new Set<string>([...(before ? Object.keys(before) : []), ...Object.keys(after)]);

  for (const key of keys) {
    const fromValue = before ? before[key] ?? null : null;
    const toValue = after[key] ?? null;
    if (JSON.stringify(fromValue) !== JSON.stringify(toValue)) {
      diff[key] = { from: fromValue, to: toValue };
    }
  }

  return diff;
}

/** true si le diff ne porte que sur des champs "administratifs" (ex. simple
 * bascule `active`), jamais sur du contenu scientifique — sert à décider si
 * une modification doit déclencher un incrément de version (§43) ou non. */
export function diffTouchesOnlyFields(
  diff: Record<string, { from: unknown; to: unknown }>,
  administrativeFields: readonly string[]
): boolean {
  const changedKeys = Object.keys(diff);
  if (changedKeys.length === 0) return true;
  return changedKeys.every((key) => administrativeFields.includes(key));
}

/**
 * §64 : définitions PRODUIT (non cliniques) utilisées pour le tableau de
 * bord administrateur — documentées ici plutôt que choisies implicitement
 * dans une requête SQL, pour rester transparentes et modifiables (§79).
 */
export const ADMIN_DASHBOARD_ACTIVE_USER_WINDOW_DAYS = 30;
export const ADMIN_DASHBOARD_NEW_USER_WINDOW_DAYS = 7;

export interface AdminDashboardStats {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  sessionsCompleted: number;
  programsPracticed: number;
  adherence: { averagePercent: number | null; usersWithData: number };
  topPathologies: Array<{ pathology: string; count: number }>;
  topExercises: Array<{ exerciseId: string; count: number }>;
  /** §64 demande « abonnements »/« revenus » : structure non implémentable
   * tant que les tables `subscriptions`/`payments` du Sprint 14 n'existent
   * pas — `null` explicite plutôt qu'un chiffre inventé (§57, §59, §79). */
  subscriptions: null;
  revenue: null;
  /** Idem pour les erreurs techniques : aucune infrastructure de
   * journalisation d'erreurs n'a été mise en place dans ce scaffold. */
  technicalErrors: null;
}

/**
 * Assemble les statistiques déjà agrégées par les requêtes SQL (comptages,
 * regroupements) en la forme attendue par le tableau de bord (§64). Ne fait
 * AUCUN calcul métier supplémentaire au-delà du tri/troncature des listes —
 * l'agrégation brute reste dans les requêtes, ce qui rend cette fonction
 * testable avec des faits déjà connus.
 */
export function computeAdminDashboardStats(facts: {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  sessionsCompleted: number;
  programsPracticed: number;
  adherence: { averagePercent: number | null; usersWithData: number };
  pathologyCounts: Array<{ pathology: string; count: number }>;
  exerciseCounts: Array<{ exerciseId: string; count: number }>;
}): AdminDashboardStats {
  return {
    totalUsers: facts.totalUsers,
    activeUsers: facts.activeUsers,
    newUsers: facts.newUsers,
    sessionsCompleted: facts.sessionsCompleted,
    programsPracticed: facts.programsPracticed,
    adherence: facts.adherence,
    topPathologies: [...facts.pathologyCounts].sort((a, b) => b.count - a.count).slice(0, 10),
    topExercises: [...facts.exerciseCounts].sort((a, b) => b.count - a.count).slice(0, 10),
    subscriptions: null,
    revenue: null,
    technicalErrors: null,
  };
}
