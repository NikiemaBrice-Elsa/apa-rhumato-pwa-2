import type { Config } from "tailwindcss";

// Palette "médicale, moderne, rassurante" (§49) — à ajuster lors d'une passe design dédiée.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eef4f6",
          100: "#d7e6ea",
          300: "#8fb9c2",
          500: "#3f7f8c",
          700: "#265961",
          900: "#173940",
        },
        accent: {
          500: "#2e6f6e",
        },
      },
      fontSize: {
        // Textes suffisamment grands par défaut (§50 accessibilité)
        base: ["1.05rem", "1.6"],
      },
    },
  },
  plugins: [],
};

export default config;
