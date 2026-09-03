/**
 * Système de traduction (§53). Aucun texte n'est codé en dur dans les
 * composants : tout passe par ce dictionnaire. La V1 est lancée en français ;
 * la structure est prête pour l'anglais et les langues nationales du Burkina
 * Faso (ajouter en.ts, mo.ts… et étendre `locales` dans ./index.ts).
 */
const fr = {
  app: {
    name: "APA Rhumatologie",
    tagline: "Cette application m'aide à bouger en fonction de ma maladie.",
  },
  auth: {
    signupTitle: "Créer votre compte",
    loginTitle: "Se connecter",
    firstName: "Prénom",
    lastName: "Nom (facultatif)",
    email: "Adresse email (facultatif)",
    phone: "Téléphone (facultatif)",
    password: "Mot de passe",
    consentTerms: "J'accepte les conditions d'utilisation.",
    consentDataProcessing: "J'accepte le traitement de mes données de santé pour le fonctionnement de l'application.",
    submitSignup: "Créer mon compte",
    submitLogin: "Se connecter",
    haveAccount: "Vous avez déjà un compte ?",
    noAccount: "Pas encore de compte ?",
  },
  profile: {
    title: "Mon profil",
    height: "Taille (cm)",
    weight: "Poids (kg)",
    bmi: "IMC calculé",
    waist: "Tour de taille (cm)",
    activityLevel: "Niveau d'activité physique",
    mainPathology: "Situation de santé principale",
    objectives: "Vos objectifs",
    save: "Enregistrer",
    disclaimer: "Ces informations servent à personnaliser votre accompagnement. Elles ne remplacent pas un avis médical.",
  },
  common: {
    optional: "facultatif",
    loading: "Chargement…",
    genericError: "Une erreur est survenue. Vous pouvez réessayer.",
  },
} as const;

export default fr;
export type Dictionary = typeof fr;
