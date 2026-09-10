"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Lecture à haute voix (10/09/2026) — accessibilité, demandée explicitement
 * par Dr Nikiema pour que tout patient puisse faire lire n'importe quel
 * texte de l'application (hors cahier des charges initial).
 *
 * S'appuie sur l'API navigateur native `SpeechSynthesis` plutôt que sur un
 * service de synthèse vocale payant : aucun coût récurrent, aucune donnée
 * du patient envoyée à un tiers (la lecture se fait entièrement sur son
 * appareil), mais qualité et disponibilité de la voix française variables
 * selon le navigateur/l'appareil (absente sur certains anciens appareils
 * Android) — limite connue et assumée, même discipline que la limite
 * documentée pour le service worker (Sprint 12). Si cette qualité s'avère
 * insuffisante à l'usage, un service de synthèse vocale payant (ex. Google
 * Cloud TTS) resterait une évolution possible — décision produit à prendre
 * séparément si le besoin se confirme, pas anticipée ici.
 *
 * Un bouton par page (choix explicite du 10/09/2026, plutôt qu'un bouton
 * par section) : lit l'intégralité du texte visible de la page en cours
 * (le contenu de sa balise `<main>`). Jamais de lecture automatique —
 * uniquement sur action volontaire du patient (même principe que le coach
 * vocal, Sprint 20). Placé une seule fois dans le layout racine
 * (`app/layout.tsx`) : disponible sur toute page de l'application,
 * publique ou connectée, sans avoir à le répéter dans chaque écran.
 */
export function ReadAloudButton() {
  const pathname = usePathname();
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  // Changer de page doit toujours arrêter une lecture en cours : ce composant
  // vit dans le layout racine et ne se démonte donc jamais entre deux pages
  // (Next.js App Router) — sans cet effet, la lecture d'une page continuerait
  // après que le patient l'a quittée.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setSpeaking(false);
    };
  }, [pathname]);

  if (!supported) return null;

  function handleClick() {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    const main = document.querySelector("main");
    const text = (main?.innerText ?? document.body.innerText ?? "").trim();
    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "fr-FR";
    const frenchVoice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("fr"));
    if (frenchVoice) utterance.voice = frenchVoice;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.cancel(); // par sécurité : ne jamais superposer deux lectures
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={speaking ? "Arrêter la lecture à haute voix" : "Lire cette page à haute voix"}
      className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-50 flex items-center gap-2 rounded-full bg-primary-700 px-4 py-3 text-sm font-medium text-white shadow-lg"
    >
      <span aria-hidden="true">{speaking ? "⏸" : "🔊"}</span>
      {speaking ? "Arrêter la lecture" : "Lire cette page"}
    </button>
  );
}
