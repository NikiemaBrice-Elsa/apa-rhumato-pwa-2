import type { PathologyCode } from "./pathologies";
import type { ObjectiveCode } from "./objectives";

export type UserRole = "patient" | "professional" | "admin";
export type Sex = "female" | "male" | "other" | "undisclosed";

/** Reflète la table `users` (données applicatives ; l'authentification
 * elle-même — mot de passe, sessions — est déléguée à Supabase Auth). */
export interface AppUser {
  id: string;
  firstName: string;
  lastName?: string | null;
  birthDate?: string | null;
  sex?: Sex | null;
  email?: string | null;
  phone?: string | null;
  role: UserRole;
  locale: string;
  consentTermsAcceptedAt?: string | null;
  consentDataProcessingAcceptedAt?: string | null;
  status: "active" | "suspended" | "deleted";
  createdAt: string;
  updatedAt: string;
}

/** Reflète la table `patient_profiles` (§13). */
export interface PatientProfile {
  id: string;
  userId: string;
  heightCm?: number | null;
  weightKg?: number | null;
  bmi?: number | null;
  waistCircumferenceCm?: number | null;
  physicalActivityLevel?: 1 | 2 | 3 | 4 | 5 | null;
  /** Sprint 32 (23/09/2026) : remplace l'ancien champ `mainPathology`
   * (une seule pathologie) — un patient peut être suivi pour plusieurs
   * pathologies à la fois (instruction directe de Dr Nikiema). */
  mainPathologies: PathologyCode[];
  objectives: ObjectiveCode[];
  functionalLimitations?: string | null;
  painBaseline?: number | null; // 0-10
  fatigueBaseline?: number | null; // 0-10
  trackCardioParams: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScientificReference {
  id: string;
  title: string;
  authors: string;
  journal?: string | null;
  year: number;
  doi?: string | null;
  url?: string | null;
  organization: string;
  pathologies: PathologyCode[];
  recommendationSummary: string;
  evidenceLevel?: string | null;
  lastChecked: string;
}
