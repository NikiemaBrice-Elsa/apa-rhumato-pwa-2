"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const VOICE_STORAGE_KEY = "apa_read_aloud_voice_uri";

// Repère de genre pour les voix françaises les plus courantes (Chrome/Android,
// Windows, macOS/iOS) — purement indicatif pour étiqueter la liste de choix
// plus clairement que le nom brut du système ; n'importe quelle voix restant
// non reconnue s'affiche simplement sous son nom tel quel (jamais un genre
// deviné à tort).
const KNOWN_VOICE_GENDER: Record<string, "Homme" | "Femme"> = {
  thomas: "Homme",
  nicolas: "Homme",
  daniel: "Homme",
  paul: "Homme",
  henri: "Homme",
  guillaume: "Homme",
  yves: "Homme",
  jerome: "Homme",
  maurice: "Homme",
  claude: "Homme",
  remy: "Homme",
  lucien: "Homme",
  alain: "Homme",
  amelie: "Femme",
  audrey: "Femme",
  aurelie: "Femme",
  celine: "Femme",
  hortense: "Femme",
  julie: "Femme",
  virginie: "Femme",
  denise: "Femme",
  vivienne: "Femme",
  charline: "Femme",
  sylvie: "Femme",
  ariane: "Femme",
  brigitte: "Femme",
  celeste: "Femme",
  coralie: "Femme",
  eloise: "Femme",
  jacqueline: "Femme",
  josephine: "Femme",
  yvette: "Femme",
};

function describeVoice(voice: SpeechSynthesisVoice): string {
  const firstWord = voice.name.split(/[\s(]/)[0]?.toLowerCase() ?? "";
  const gender = KNOWN_VOICE_GENDER[firstWord];
  return gender ? `${voice.name} (${gender})` : voice.name;
}

/** Découpe un texte long en morceaux lisibles par phrase (jamais au milieu
 * d'un mot), pour contourner un bug connu des moteurs `SpeechSynthesis` de
 * plusieurs navigateurs : un unique très long énoncé (plusieurs milliers de
 * caractères, ex. la bibliothèque d'exercices avec ses 8 fiches) s'arrête
 * parfois de lui-même après quelques secondes sans déclencher d'erreur. Une
 * file de plusieurs énoncés plus courts, elle, se lit intégralement jusqu'au
 * bout — c'est le correctif standard pour ce bug. */
function splitIntoChunks(text: string, maxLength = 200): string[] {
  const sentences = text.split(/(?<=[.!?:;\n])\s+/);
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current && (current + " " + sentence).length > maxLength) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(Boolean);
}

/**
 * Lecture à haute voix (10/09/2026, ajustée le 11/09/2026) — accessibilité,
 * demandée explicitement par Dr Nikiema pour que tout patient puisse faire
 * lire n'importe quel texte de l'application (hors cahier des charges
 * initial).
 *
 * S'appuie sur l'API navigateur native `SpeechSynthesis` plutôt que sur un
 * service de synthèse vocale payant : aucun coût récurrent, aucune donnée
 * du patient envoyée à un tiers (la lecture se fait entièrement sur son
 * appareil). Limite assumée et documentée séparément (voir message à Dr
 * Nikiema du 11/09/2026 et docs/DECISIONS.md) : les voix fournies par le
 * navigateur/l'OS n'incluent aucun accent africain francophone — seulement
 * France/Belgique/Canada/Suisse selon l'appareil. Une vraie voix africaine
 * francophone exigerait un service payant tiers, décision produit à part.
 *
 * Correctif du 11/09/2026 (« ça ne marche pas dans la bibliothèque ») : le
 * texte est désormais découpé en phrases et lu comme une file de plusieurs
 * énoncés (`splitIntoChunks`) plutôt qu'un seul énoncé unique — la
 * bibliothèque d'exercices, avec ses 8 fiches, produisait un texte assez
 * long pour heurter un bug connu de plusieurs moteurs `SpeechSynthesis` qui
 * arrêtent silencieusement un énoncé trop long. Débit ralenti par défaut
 * (`rate = 0.85`, contre 1 auparavant) pour une voix plus posée, comme
 * demandé. Choix de la voix (parmi celles que propose l'appareil du
 * patient, genre indiqué quand reconnu) ajouté et mémorisé localement
 * (`localStorage`), pour laisser un choix masculin/féminin quand l'appareil
 * en propose plusieurs.
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
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(null);
  const queueRef = useRef<string[]>([]);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setSupported(true);

    try {
      setSelectedVoiceURI(window.localStorage.getItem(VOICE_STORAGE_KEY));
    } catch {
      // localStorage indisponible (navigation privée, etc.) — pas bloquant,
      // la voix par défaut du navigateur sera utilisée.
    }

    function loadVoices() {
      const french = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("fr"));
      setVoices(french);
    }
    loadVoices();
    // Chrome (entre autres) charge la liste des voix de façon asynchrone.
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  // Changer de page doit toujours arrêter une lecture en cours : ce composant
  // vit dans le layout racine et ne se démonte donc jamais entre deux pages
  // (Next.js App Router) — sans cet effet, la lecture d'une page continuerait
  // après que le patient l'a quittée.
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setSpeaking(false);
    };
  }, [pathname]);

  if (!supported) return null;

  function speakNextInQueue() {
    const next = queueRef.current.shift();
    if (!next) {
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(next);
    utterance.lang = "fr-FR";
    utterance.rate = 0.85; // « posée, sans rapidité » — demande du 11/09/2026
    const chosen = selectedVoiceURI ? voices.find((v) => v.voiceURI === selectedVoiceURI) : undefined;
    utterance.voice = chosen ?? voices[0] ?? null;
    utterance.onend = () => {
      if (!cancelledRef.current) speakNextInQueue();
    };
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  function handleClick() {
    if (speaking) {
      cancelledRef.current = true;
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    const main = document.querySelector("main");
    const text = (main?.innerText ?? document.body.innerText ?? "").trim();
    if (!text) return;

    window.speechSynthesis.cancel(); // par sécurité : ne jamais superposer deux lectures
    cancelledRef.current = false;
    queueRef.current = splitIntoChunks(text);
    setSpeaking(true);
    speakNextInQueue();
  }

  function handleSelectVoice(uri: string) {
    setSelectedVoiceURI(uri);
    try {
      window.localStorage.setItem(VOICE_STORAGE_KEY, uri);
    } catch {
      // pas bloquant si le stockage local est indisponible
    }
  }

  return (
    <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-50 flex flex-col items-end gap-2">
      {showVoicePicker && voices.length > 0 && (
        <div className="flex max-h-64 w-64 flex-col gap-1 overflow-y-auto rounded-xl border border-primary-200 bg-white p-2 shadow-lg">
          <p className="px-2 py-1 text-xs font-medium text-primary-500">Choisir une voix</p>
          {voices.map((voice) => (
            <button
              key={voice.voiceURI}
              type="button"
              onClick={() => handleSelectVoice(voice.voiceURI)}
              className={
                voice.voiceURI === (selectedVoiceURI ?? voices[0]?.voiceURI)
                  ? "rounded-lg bg-primary-700 px-3 py-2 text-left text-sm text-white"
                  : "rounded-lg px-3 py-2 text-left text-sm text-primary-700 hover:bg-primary-50"
              }
            >
              {describeVoice(voice)}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        {voices.length > 1 && (
          <button
            type="button"
            onClick={() => setShowVoicePicker((v) => !v)}
            aria-label="Choisir la voix de lecture"
            aria-expanded={showVoicePicker}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-lg text-primary-700 shadow-lg"
          >
            🎙️
          </button>
        )}
        <button
          type="button"
          onClick={handleClick}
          aria-label={speaking ? "Arrêter la lecture à haute voix" : "Lire cette page à haute voix"}
          className="flex items-center gap-2 rounded-full bg-primary-700 px-4 py-3 text-sm font-medium text-white shadow-lg"
        >
          <span aria-hidden="true">{speaking ? "⏸" : "🔊"}</span>
          {speaking ? "Arrêter la lecture" : "Lire cette page"}
        </button>
      </div>
    </div>
  );
}
