/**
 * Moteur de règles médicales déterministe (§30, §31 du cahier des charges).
 *
 * - `engine.ts` : interpréteur générique de conditions/règles, sans contenu médical.
 * - `screening/` : dépistage de sécurité (§15), piloté par les données de `clinical_rules`.
 * - `program-selection.ts` (Sprint 6) : sélection de programme, pilotée par les
 *   règles `allow_program` de `clinical_rules`. Retourne `MEDICAL_PARAMETER_REQUIRED`
 *   tant qu'aucune règle `allow_program` validée (avec `programId`) n'existe.
 * - `progression.ts` : squelette prêt pour le Sprint 8, retourne
 *   `MEDICAL_PARAMETER_REQUIRED` tant qu'aucune règle de progression n'a été validée.
 *
 * Conformément au §57 : « Si une information n'est pas disponible dans le
 * cahier des charges, NE PAS l'inventer. »
 */
export * from "./constants";
export * from "./engine";
export * from "./screening";
export * from "./program-selection";
export * from "./progression";
