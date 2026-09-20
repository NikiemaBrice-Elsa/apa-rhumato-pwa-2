/**
 * Suivi de marche par GPS (Sprint 25, 20/09/2026) — remplace entièrement
 * l'idée de compteur de pas par capteur de mouvement, conformément à la
 * réponse du 19/09/2026 (« Proposition_Pas_Chrono_Mediatheque », Question 2,
 * réponse « c ») : « Remplacer entièrement l'idée de pas par une
 * distance/durée GPS, valable sur les deux systèmes ». Ce choix a été fait
 * après vérification (recherche technique, 09/2026) que l'API de capteur de
 * mouvement (accéléromètre / Generic Sensor API) est bloquée sans
 * contournement sur iOS Safari, alors que la géolocalisation fonctionne sur
 * Android comme sur iPhone.
 *
 * Fonction PURE : aucun accès à `navigator.geolocation` ici (l'adaptateur
 * navigateur vit dans apps/web/src/components/activite/WalkTracker.tsx) —
 * même discipline que offlineQueue.ts et packages/rules-engine (logique pure
 * testée, adaptateur navigateur mince séparé).
 */

export interface GeoPoint {
  latitudeDeg: number;
  longitudeDeg: number;
}

/** Rayon moyen de la Terre, en mètres (valeur standard de la formule de Haversine). */
const EARTH_RADIUS_METERS = 6_371_000;

/**
 * Distance à vol d'oiseau entre deux points GPS (formule de Haversine), en
 * mètres. Utilisée pour cumuler la distance parcourue à partir d'une série
 * de positions successives (`watchPosition`) — la somme des segments
 * consécutifs approxime la distance réellement parcourue.
 */
export function haversineDistanceMeters(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitudeDeg - a.latitudeDeg);
  const dLon = toRad(b.longitudeDeg - a.longitudeDeg);
  const lat1 = toRad(a.latitudeDeg);
  const lat2 = toRad(b.latitudeDeg);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Filtre le « bruit GPS » : à l'arrêt ou en intérieur, deux positions
 * successives peuvent différer de quelques mètres sans déplacement réel.
 * Seuil de 3 m par défaut (précision GPS smartphone usuelle en extérieur
 * ≈ 5-10 m, donc un segment mesuré en dessous de 3 m n'est pas fiable) — un
 * simple filtre de bruit de mesure technique, pas une valeur médicale.
 */
export const GPS_NOISE_FLOOR_METERS = 3;

/**
 * Cumule la distance totale parcourue à partir d'une série ordonnée de
 * positions (la plus ancienne en premier). Ignore les segments sous le
 * seuil de bruit GPS pour éviter de gonfler artificiellement la distance
 * mesurée à l'arrêt (patient immobile, dérive GPS).
 */
export function cumulativeWalkDistanceMeters(points: GeoPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const segment = haversineDistanceMeters(points[i - 1], points[i]);
    if (segment >= GPS_NOISE_FLOOR_METERS) {
      total += segment;
    }
  }
  return total;
}
