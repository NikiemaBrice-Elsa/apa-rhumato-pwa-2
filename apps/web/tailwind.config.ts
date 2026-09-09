import type { Config } from "tailwindcss";

// Palette "médicale, moderne, rassurante" (§49) — bleu APAS Rhumato, alignée
// sur le logo transmis le 07/09/2026 (retour recette, remplace le teal
// provisoire du Sprint 2).
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eaf1fb",
          100: "#d2e3f7",
          300: "#86b2ea",
          500: "#2e6fd6",
          700: "#1e4e9e",
          900: "#16355e",
        },
        accent: {
          500: "#2f9e6b",
        },
      },
      fontSize: {
        // Textes suffisamment grands par défaut (§50 accessibilité)
        base: ["1.05rem", "1.6"],
      },
      keyframes: {
        // Alerte "abonnement bientôt expiré" (tableau de bord patient,
        // demande du 09/09/2026) : un léger clignotement de fond + bordure,
        // volontairement lent (2s) pour rester perceptible sans être
        // agressif — désactivé pour les utilisateurs "prefers-reduced-motion"
        // via globals.css (§50 accessibilité).
        "subscription-blink": {
          "0%, 100%": { backgroundColor: "#fff7ed", borderColor: "#fdba74" },
          "50%": { backgroundColor: "#ffedd5", borderColor: "#f97316" },
        },
      },
      animation: {
        "subscription-blink": "subscription-blink 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
