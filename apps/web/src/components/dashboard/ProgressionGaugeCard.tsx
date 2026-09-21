import { PATHOLOGY_LABELS_FR, PROFILE_LEVEL_LABELS_FR, type PathologyCode } from "@apa/domain";
import type { PathologyProgressionResult } from "@/lib/progression";

/**
 * §29, §58 — document « système de progression » (21/09/2026, section A) :
 * « Je veux une jauge de progression vers le niveau suivant, sur la page
 * d'accueil, qui évolue en fonction des critères de progressions ». Server
 * Component pur (pas de "use client") : les données viennent déjà calculées
 * par `computePathologyProgressionResult` (apps/web/src/lib/progression.ts),
 * appelé depuis `tableau-de-bord/page.tsx` — même logique que
 * `GET /api/statistics/progression`, sans aller-retour réseau supplémentaire
 * puisque le tableau de bord est déjà un Server Component.
 *
 * N'affiche rien pour une pathologie sans jauge (`gauge: null` — niveau déjà
 * `avance`, ou pas de fenêtre de progression applicable). Si AUCUNE
 * pathologie suivie n'a de jauge, le composant entier ne s'affiche pas
 * plutôt que d'afficher une carte vide.
 */
export function ProgressionGaugeCard({ results }: { results: PathologyProgressionResult[] }) {
  const withGauge = results.filter((r) => r.gauge !== null);
  if (withGauge.length === 0) return null;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-primary-300 bg-white p-4">
      <h2 className="font-semibold text-primary-900">Progression vers le niveau supérieur</h2>
      {withGauge.map((result) => {
        const gauge = result.gauge!;
        const percent = gauge.adherenceWindowPercent ?? 0;
        const pathologyLabel = PATHOLOGY_LABELS_FR[result.pathology as PathologyCode] ?? result.pathology;

        return (
          <div key={result.pathology} className="flex flex-col gap-2 border-t border-primary-100 pt-3 first:border-t-0 first:pt-0">
            <p className="text-sm font-medium text-primary-900">
              {pathologyLabel} — vers {PROFILE_LEVEL_LABELS_FR[gauge.nextLevel]}
            </p>

            <div className="h-2 w-full overflow-hidden rounded-full bg-primary-100">
              <div
                className="h-full rounded-full bg-primary-600 transition-all"
                style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
              />
            </div>
            <p className="text-xs text-primary-500">
              {gauge.adherenceWindowPercent === null
                ? `Adhésion sur ${gauge.windowWeeks} semaines : pas encore assez de données`
                : `Adhésion sur ${gauge.windowWeeks} semaines : ${gauge.adherenceWindowPercent}% (objectif ${gauge.adherenceTargetPercent}%)`}
            </p>

            <ul className="flex flex-col gap-0.5 text-xs text-primary-600">
              <li>
                {gauge.noAlertSignal === null ? "◦" : gauge.noAlertSignal ? "✅" : "❌"} Aucun signal d&apos;alerte récent
              </li>
              <li>
                {gauge.functionalCapacityOk === null ? "◦" : gauge.functionalCapacityOk ? "✅" : "❌"} Capacité
                fonctionnelle stable ou améliorée
              </li>
            </ul>

            {result.decision === "progress" && (
              <p className="text-xs font-medium text-green-700">
                Niveau supérieur accessible — rendez-vous dans « Mes statistiques » pour valider le passage.
              </p>
            )}
          </div>
        );
      })}
    </section>
  );
}
