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
    forgotPasswordLink: "Mot de passe oublié ?",
    forgotPasswordTitle: "Mot de passe oublié",
    forgotPasswordInstructions:
      "Indiquez l'adresse email de votre compte : nous vous enverrons un lien pour choisir un nouveau mot de passe.",
    submitForgotPassword: "Envoyer le lien",
    forgotPasswordSuccess:
      "Si un compte existe avec cette adresse, un email contenant un lien de réinitialisation vient de lui être envoyé. Pensez à vérifier vos courriers indésirables.",
    backToLogin: "Retour à la connexion",
    resetPasswordTitle: "Choisir un nouveau mot de passe",
    newPassword: "Nouveau mot de passe",
    confirmPassword: "Confirmer le mot de passe",
    submitResetPassword: "Enregistrer le nouveau mot de passe",
    resetPasswordSuccess: "Votre mot de passe a été mis à jour. Vous pouvez maintenant vous connecter.",
    passwordMismatch: "Les deux mots de passe ne correspondent pas.",
    resetLinkExpired:
      "Ce lien de réinitialisation n'est plus valable (il a expiré ou a déjà été utilisé). Demandez-en un nouveau ci-dessous.",
    resetLinkChecking: "Vérification du lien en cours…",
  },
  profile: {
    title: "Mon profil",
    height: "Taille (cm)",
    weight: "Poids (kg)",
    bmi: "IMC calculé",
    waist: "Tour de taille (cm)",
    activityLevel: "Niveau d'activité physique",
    // Pluriel depuis le Sprint 32 (23/09/2026, instruction directe de
    // Dr Nikiema : « on ne peut pas choisir plusieurs pathologies
    // actuellement. Il faut modifier pour qu'un choix multiple soit
    // possible ») — voir PatientProfileForm.tsx (cases à cocher au lieu
    // d'un menu déroulant à choix unique).
    mainPathology: "Situations de santé suivies",
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
