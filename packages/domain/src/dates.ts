/**
 * Sprint 27 (20/09/2026) — correction du bug remonté par Dr Nikiema : une
 * activité physique enregistrée le jour même de la génération du rapport
 * n'apparaissait pas dans le rapport PDF (« Aucune activité physique
 * enregistrée... » alors qu'une marche et une séance d'aérobie venaient
 * d'être enregistrées quelques minutes plus tôt). Le même bug affectait en
 * silence les séances et les mesures dès que la période demandée se
 * terminait « aujourd'hui ».
 *
 * Cause : les champs de date des formulaires (`<input type="date">`, voir
 * ReportFlow.tsx et ProfessionalDashboard.tsx) fournissent une chaîne
 * "AAAA-MM-JJ" sans heure. `new Date("2026-09-20")` est interprété par
 * JavaScript comme minuit UTC en DÉBUT de journée. Utilisée telle quelle
 * comme borne de fin de période (`to`) dans `buildPatientReportData`
 * (comparaison `.lte("started_at", to)`), toute activité/séance/mesure
 * enregistrée plus tard ce même jour (l'après-midi, le soir) se retrouvait
 * après cette borne et donc exclue du rapport — alors qu'en choisissant
 * « 20/09/2026 » comme date de fin, l'utilisateur s'attend à voir toute la
 * journée du 20 incluse.
 *
 * Correctif : construire explicitement le début (00:00:00.000) et la fin
 * (23:59:59.999) de la journée choisie, dans le fuseau horaire local du
 * navigateur (aucun suffixe « Z » dans la chaîne fournie à `new Date(...)`,
 * donc interprétation en heure locale), pour que la période affichée à
 * l'écran (« Du ... au ... ») corresponde exactement à ce qui est
 * effectivement inclus dans le rapport.
 */
export function startOfDayIso(dateInput: string): string {
  return new Date(`${dateInput}T00:00:00.000`).toISOString();
}

export function endOfDayIso(dateInput: string): string {
  return new Date(`${dateInput}T23:59:59.999`).toISOString();
}
