"use client";

import { useEffect, useState } from "react";

/**
 * Invitation à installer l'application (PWA) — Sprint 39 (04/10/2026,
 * instruction directe de Dr Nikiema : « je veux que pour cette appli, la
 * notification pour l'installation s'affiche réellement comme sur l'image que
 * j'ai jointe à titre d'exemple » — carte « Installer <app> / <adresse> /
 * Installer » en haut de l'écran d'un téléphone Android sous Chrome).
 *
 * Pourquoi un composant plutôt que le seul comportement du navigateur : la
 * carte native de Chrome est décidée par le navigateur (critères
 * d'engagement, historique de visites, refus précédents) et ne peut pas être
 * déclenchée à volonté. Chrome/Edge/Samsung Internet émettent toutefois
 * l'événement `beforeinstallprompt` dès que l'application est installable ;
 * on l'intercepte (`preventDefault`, ce qui retire la mini-barre native pour
 * éviter un doublon) et on affiche NOTRE carte, au même emplacement et avec la
 * même structure que l'exemple fourni, dont le bouton « Installer » appelle
 * `prompt()` sur l'événement mis de côté.
 *
 * iOS (Safari) n'émet jamais cet événement et n'autorise aucune installation
 * par programme : la carte affiche alors la seule procédure possible
 * (Partager → « Sur l'écran d'accueil »).
 *
 * Jamais affichée : une fois l'application déjà installée (mode
 * `standalone`), ni pendant 7 jours après un « Fermer ». Aucune donnée
 * personnelle n'est lue ni enregistrée (seulement la date du dernier refus,
 * en stockage local, sans effet si le stockage est indisponible).
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISSED_KEY = "apa-install-dismissed-at";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function wasRecentlyDismissed(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    if (!raw) return false;
    const at = Number(raw);
    return Number.isFinite(at) && Date.now() - at < DISMISS_DURATION_MS;
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    // Stockage indisponible (navigation privée...) : sans conséquence.
  }
}

function isStandalone(): boolean {
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIosSafari(): boolean {
  const ua = window.navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  // Chrome/Firefox/Edge sur iOS (CriOS/FxiOS/EdgiOS) ne proposent pas la même
  // procédure : on ne l'affiche que pour Safari.
  const isOtherBrowser = /CriOS|FxiOS|EdgiOS/i.test(ua);
  return isIos && !isOtherBrowser;
}

export function InstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [host, setHost] = useState("");

  useEffect(() => {
    setHost(window.location.host);
    if (isStandalone() || wasRecentlyDismissed()) return;

    if (isIosSafari()) {
      setShowIosHelp(true);
      setHidden(false);
    }

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
      setHidden(false);
    }

    function onInstalled() {
      setDeferredEvent(null);
      setShowIosHelp(false);
      setHidden(true);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    const choice = await deferredEvent.userChoice.catch(() => null);
    setDeferredEvent(null);
    setHidden(true);
    if (choice?.outcome === "dismissed") rememberDismissal();
  }

  function dismiss() {
    rememberDismissal();
    setHidden(true);
  }

  if (hidden || (!deferredEvent && !showIosHelp)) return null;

  return (
    <div
      role="region"
      aria-label="Installer l'application"
      className="fixed inset-x-3 top-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-primary-200 bg-white px-4 py-3 shadow-lg"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-primary-900">Installer APA Rhumatologie</p>
        {deferredEvent ? (
          <p className="truncate text-sm text-primary-500">{host}</p>
        ) : (
          <p className="text-sm text-primary-700">
            Appuyez sur « Partager », puis « Sur l&apos;écran d&apos;accueil ».
          </p>
        )}
      </div>
      {deferredEvent && (
        <button type="button" onClick={install} className="shrink-0 px-2 py-1 font-medium text-primary-700">
          Installer
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fermer"
        className="shrink-0 px-2 py-1 text-xl leading-none text-primary-500"
      >
        ×
      </button>
    </div>
  );
}
