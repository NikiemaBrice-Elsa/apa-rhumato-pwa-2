// Variables d'environnement factices pour les tests unitaires/fonctionnels :
// permettent d'instancier un client Supabase sans dépendre d'un vrai projet.
// Aucun appel réseau réel n'est nécessaire pour les scénarios testés (accès
// non authentifié, validation d'entrée).
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://test-project.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";
