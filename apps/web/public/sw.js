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
// Depuis le correctif Sprint 33 octies (27/09/2026) : toute page/requête GET
// de même origine (pas seulement une liste figée de 4 routes) est mise en
// cache dès sa première consultation réussie en ligne, et reste donc
// consultable hors connexion ensuite — voir le commentaire dans le
// gestionnaire "fetch" plus bas pour le détail du correctif.
//
// Limite assumée et documentée (docs/DECISIONS.md, Sprint 12) : ce fichier
// n'est pas couvert par des tests automatisés (l'API Cache/Service Worker
// n'est pas disponible dans l'environnement de test Node/jsdom du projet) ;
// la logique est volontairement simple et lisible pour rester vérifiable à
// la revue de code.

const APP_SHELL_CACHE = "apa-app-shell-v3";
const RUNTIME_CACHE = "apa-runtime-v2";
const MEDIA_CACHE = "apa-media-v1";
const ALL_CACHES = [APP_SHELL_CACHE, RUNTIME_CACHE, MEDIA_CACHE];

// Coquille applicative minimale, toujours mise en cache à l'installation.
const APP_SHELL = ["/", "/manifest.webmanifest"];

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

  // Correctif Sprint 33 octies (27/09/2026, rapport direct de Dr Nikiema :
  // « en mode hors ligne, je ne peux pas me connecter ni faire quoi que ce
  // soit ») : auparavant, seules 4 routes (exercices, programme, séance,
  // tableau de bord) et leurs endpoints API étaient couvertes par la
  // stratégie "réseau d'abord, repli sur le cache" — TOUTES les autres
  // pages protégées (profil, évaluation, suivi, statistiques,
  // notifications, abonnement, mes professionnels...) n'étaient JAMAIS
  // mises en cache, donc systématiquement indisponibles hors connexion,
  // même après les avoir déjà consultées en ligne. Un utilisateur hors
  // connexion qui ouvrait l'une de ces pages tombait alors sur l'écran
  // d'erreur réseau générique du navigateur, sans jamais atteindre le
  // contenu de l'application (l'impression de « je ne peux rien faire »).
  // Désormais, toute requête GET de même origine (donc toute page, tout
  // point d'API applicatif) suit la même stratégie unique — plus besoin
  // d'une liste figée à maintenir à la main à chaque nouvel écran : n'importe
  // quelle page déjà ouverte au moins une fois avec du réseau devient donc
  // disponible hors connexion par la suite. Ne concerne jamais l'ÉCRITURE
  // hors connexion (POST/PUT/…, filtrée en tout début de fonction) ni la
  // connexion elle-même (`/connexion`) : s'authentifier exige toujours une
  // vérification serveur, impossible à froid sans réseau, quel que soit le
  // système.
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).catch(() => cached))
  );
});
