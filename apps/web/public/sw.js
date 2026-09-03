// Service worker (§54, §10) — Sprint 12.
//
// §54 : mettre en cache l'interface, les exercices, les programmes actifs,
// les vidéos sélectionnées et les données nécessaires à la séance.
// §10 (minimum hors connexion) : consultation des programmes déjà
// téléchargés, consultation des exercices, réalisation d'une séance.
//
// Les ÉCRITURES hors connexion (démarrer/clôturer une séance, saisir une
// mesure) ne passent PAS par ce service worker : elles sont mises en file
// côté client (src/lib/offlineQueue.ts + offlineStorage.ts) et rejouées
// quand la connexion revient. Ce fichier ne gère que la LECTURE (GET).
//
// Limite assumée et documentée (docs/DECISIONS.md, Sprint 12) : ce fichier
// n'est pas couvert par des tests automatisés (l'API Cache/Service Worker
// n'est pas disponible dans l'environnement de test Node/jsdom du projet) ;
// la logique est volontairement simple et lisible pour rester vérifiable à
// la revue de code.

const APP_SHELL_CACHE = "apa-app-shell-v2";
const RUNTIME_CACHE = "apa-runtime-v1";
const MEDIA_CACHE = "apa-media-v1";
const ALL_CACHES = [APP_SHELL_CACHE, RUNTIME_CACHE, MEDIA_CACHE];

// Coquille applicative minimale, toujours mise en cache à l'installation.
const APP_SHELL = ["/", "/manifest.webmanifest"];

// Pages et endpoints dont la dernière réponse réussie doit rester
// consultable hors connexion (§54 : exercices, programmes actifs, données
// de séance). Stratégie "réseau d'abord, repli sur le cache" : toujours la
// donnée la plus fraîche possible quand il y a du réseau, jamais une page
// blanche quand il n'y en a pas.
const NETWORK_FIRST_PATTERNS = [
  /^\/exercices(\/|$)/,
  /^\/programme(\/|$)/,
  /^\/seance(\/|$)/,
  /^\/tableau-de-bord(\/|$)/,
  /^\/api\/exercises(\/|$)/,
  /^\/api\/programs(\/|$)/,
  /^\/api\/sessions(\/|$)/,
];

function matchesNetworkFirst(pathname) {
  return NETWORK_FIRST_PATTERNS.some((pattern) => pattern.test(pathname));
}

// Vidéos/images (exercices, y compris hébergées ailleurs que sur ce domaine,
// ex. stockage Supabase) : une fois chargées, elles ne changent
// pratiquement jamais -> cache d'abord.
function isMediaRequest(request, url) {
  if (request.destination === "video" || request.destination === "audio" || request.destination === "image") {
    return true;
  }
  return /\.(mp4|webm|ogg|mp3|jpg|jpeg|png|webp|gif|svg)$/i.test(url.pathname);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => !ALL_CACHES.includes(key)).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  // Une réponse "opaque" (cross-origin sans CORS) reste cachable : on ne
  // peut juste pas inspecter son statut, donc on la met en cache telle quelle.
  if (response && (response.ok || response.type === "opaque")) {
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (isMediaRequest(request, url)) {
    event.respondWith(cacheFirst(request, MEDIA_CACHE));
    return;
  }

  if (url.origin === self.location.origin && matchesNetworkFirst(url.pathname)) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).catch(() => cached))
  );
});
