/**
 * Affichage instantané pendant le chargement des données serveur d'une page
 * de l'espace connecté (retour recette du 07/09/2026 : « lenteur quand je
 * clique sur un onglet »). Next.js affiche ce composant immédiatement à la
 * navigation, avant même que les requêtes Supabase de la page cible ne se
 * terminent — la navigation paraît alors instantanée au lieu de figer
 * l'écran précédent le temps de la récupération des données.
 */
export default function DashboardLoading() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 py-12">
      <div
        className="h-8 w-8 animate-spin rounded-full border-4 border-primary-100 border-t-primary-700"
        role="status"
        aria-label="Chargement"
      />
      <p className="text-sm text-primary-500">Chargement…</p>
    </main>
  );
}
