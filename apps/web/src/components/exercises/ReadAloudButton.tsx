"use client";

import { useEffect, useState } from "react";

/**
 * Sprint 28 (20/09/2026) — « lecture du texte » demandée par Dr Nikiema pour
 * la description brève d'un exercice, dans le nouvel affichage de la
 * bibliothèque (pathologie → types → exercices → détail).
 *
 * Utilise l'API navigateur native `speechSynthesis` (Web Speech API) : lit
 * le texte à voix haute directement sur l'appareil du patient, sans aucun
 * appel serveur ni fichier audio à générer/héberger — à ne pas confondre
 * avec le « coach vocal » (`AudioCoach.tsx`, Sprint 20), qui joue des clips
 * pré-enregistrés par Dr Nikiema lui-même pour un usage différent (consignes
 * d'exécution pendant l'effort). Ici, il s'agit de rendre la description de
 * l'exercice accessible à l'oral, à la demande.
 *
 * Support navigateur variable (voix disponibles, qualité) : si l'API est
 * absente, un message discret l'indique plutôt qu'un bouton qui ne ferait
 * rien silencieusement (§79 — expliquer plutôt que laisser un doute).
 */
export function ReadAloudButton({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!supported) {
    return (
      <p className="text-xs text-primary-500">
        La lecture à voix haute n&apos;est pas prise en charge par ce navigateur.
      </p>
    );
  }

  function handleClick() {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "fr-FR";
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-fit items-center gap-1 rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100"
    >
      {speaking ? "⏸ Arrêter la lecture" : "🔊 Écouter la description"}
    </button>
  );
}
