import Link from "next/link";
import { PROFILE_LEVELS, PROFILE_LEVEL_LABELS_FR, PROFILE_LEVEL_GUIDANCE, PROGRESSION_WINDOW_WEEKS } from "@apa/domain";

/**
 * "Mes niveaux" (Sprint 33, 24/09/2026) — page d'explication des 3 niveaux
 * (débutant/intermédiaire/avancé), demandée par Dr Nikiema : « il faut que
 * chaque patient comprenne à quoi signifie niveau débutant niveau
 * intermédiaire et niveau supérieur, qu'il sache combien de séances ils
 * doivent réaliser en moyenne par semaine ». Proposition envoyée en chat
 * (combinaison retenue par Dr Nikiema le 24/09/2026) : un rappel court est
 * affiché directement dans « Mon programme » sous chaque pathologie, avec un
 * lien « En savoir plus sur les niveaux » vers cette page pour l'explication
 * complète.
 *
 * Contenu strictement repris de données déjà validées par Dr Nikiema
 * (§57, §59, §78 — jamais un contenu inventé pour cette page) :
 * `PROFILE_LEVEL_GUIDANCE` (packages/domain/src/programs.ts, document
 * « système de progression », 21/09/2026, section A) pour la fréquence et la
 * durée par niveau, et `PROGRESSION_WINDOW_WEEKS` (même document, section B)
 * pour la fenêtre d'observation avant un passage de niveau. Le seuil
 * d'adhésion exact et les autres critères de passage restent affichés une
 * seule fois, dans la jauge de progression du tableau de bord
 * (`ProgressionGaugeCard.tsx`) — non dupliqués ici pour éviter toute
 * divergence future entre les deux affichages.
 *
 * Page purement informative (aucune donnée patient chargée, aucun compte
 * requis pour son contenu) : Server Component simple, pas de "use client".
 */
export default function NiveauxPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <Link href="/programme" className="text-sm text-primary-600 underline">
          ← Retour à Mon programme
        </Link>
        <h1 className="text-2xl font-semibold text-primary-900">Mes niveaux</h1>
      </div>

      <p className="text-primary-700">
        Votre programme évolue en trois niveaux progressifs, qui adaptent l&apos;intensité des
        exercices à votre forme physique. Tout patient commence au niveau débutant. Le passage à un
        niveau supérieur n&apos;est jamais automatique : c&apos;est toujours vous qui le validez,
        depuis « Mes statistiques », lorsque vous vous sentez prêt(e).
      </p>

      <ul className="flex flex-col gap-4">
        {PROFILE_LEVELS.map((level) => {
          const guidance = PROFILE_LEVEL_GUIDANCE[level];
          return (
            <li key={level} className="rounded-xl border border-primary-300 bg-white p-4">
              <p className="font-medium text-primary-900">Niveau {PROFILE_LEVEL_LABELS_FR[level]}</p>
              <p className="text-sm text-primary-700">
                {guidance.sessionsPerWeekMin}-{guidance.sessionsPerWeekMax} séances par semaine,{" "}
                {guidance.sessionDurationMinutesMin}-{guidance.sessionDurationMinutesMax} minutes par séance.
              </p>
            </li>
          );
        })}
      </ul>

      <p className="text-sm text-primary-500">
        Ces repères sont indicatifs : vous n&apos;avez pas besoin d&apos;atteindre systématiquement
        la borne haute (durée ou nombre de séances) — la progression se fait à votre rythme, en
        augmentant petit à petit la durée puis l&apos;intensité de vos séances.
      </p>

      <div className="flex flex-col gap-2 rounded-xl border border-primary-300 bg-primary-50 p-4">
        <p className="font-medium text-primary-900">Comment passer au niveau supérieur&nbsp;?</p>
        <p className="text-sm text-primary-700">
          Vous pouvez viser le niveau suivant en réalisant régulièrement vos séances sur les{" "}
          {PROGRESSION_WINDOW_WEEKS.debutant} dernières semaines (depuis débutant) ou{" "}
          {PROGRESSION_WINDOW_WEEKS.intermediaire} dernières semaines (depuis intermédiaire), sans
          signal d&apos;alerte et avec une capacité fonctionnelle stable ou en amélioration. Votre
          avancement vers le niveau suivant est visible en temps réel sur votre tableau de bord
          (jauge de progression), et la bascule se valide depuis « Mes statistiques ».
        </p>
      </div>
    </main>
  );
}
