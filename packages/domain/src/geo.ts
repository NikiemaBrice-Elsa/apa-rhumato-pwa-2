/**
 * Suivi de marche/vélo par GPS (Sprint 25, 20/09/2026 ; précision corrigée
 * Sprint 26, 21/09/2026) — remplace entièrement l'idée de compteur de pas
 * par capteur de mouvement, conformément à la réponse du 19/09/2026
 * (« Proposition_Pas_Chrono_Mediatheque », Question 2, réponse « c ») :
 * « Remplacer entièrement l'idée de pas par une distance/durée GPS, valable
 * sur les deux systèmes ». Ce choix a été fait après vérification (recherche
 * technique, 09/2026) que l'API de capteur de mouvement (accéléromètre /
 * Generic Sensor API) est bloquée sans contournement sur iOS Safari, alors
 * que la géolocalisation fonctionne sur Android comme sur iPhone.
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
 * Précision GPS minimale acceptée pour qu'une position soit prise en compte
 * dans le calcul de distance (mètres, correspond à `position.coords.accuracy`
 * du navigateur). En dessous de cette qualité de signal (fréquent en
 * intérieur, sous couvert dense, ou juste après activation du GPS — le
 * « premier fix » est souvent très imprécis), une position peut être décalée
 * de dizaines de mètres et fausser complètement la distance cumulée — c'est
 * la cause la plus probable du bug remonté par Dr Nikiema le 21/09/2026
 * (« la distance parcourue bugue et ne suit pas vraiment la marche »). Une
 * position sous ce seuil est ignorée pour le calcul de distance mais ne
 * bloque pas le suivi (retenue dès qu'une position suffisamment précise
 * arrive). Valeur choisie par défaut par Claude, ajustable si l'expérience
 * terrain montre qu'elle est trop stricte (distance sous-évaluée) ou trop
 * laxiste (distance encore erratique).
 */
export const GPS_MAX_ACCEPTABLE_ACCURACY_METERS = 30;

/**
 * Cumule la distance totale parcourue à partir d'une série ordonnée de
 * positions (la plus ancienne en premier). Le filtrage par précision
 * (`GPS_MAX_ACCEPTABLE_ACCURACY_METERS`) a lieu en amont, côté adaptateur
 * navigateur, avant même d'ajouter un point à la série passée ici.
 *
 * Sprint 27 (20/09/2026) — correction d'un second bug de distance remonté
 * par Dr Nikiema, après la correction de précision du Sprint 26 : sur un
 * test de marche réelle de 2 minutes, la distance affichait 50 m puis ne
 * progressait plus du tout malgré la marche continue. Cause : la version
 * précédente comparait chaque position UNIQUEMENT à la précédente
 * (`points[i-1]` à `points[i]`) et rejetait tout le segment dès qu'il
 * passait sous `GPS_NOISE_FLOOR_METERS` (3 m) — y compris pour toujours,
 * sans jamais le récupérer. Or à une allure de marche normale (~1-1,5 m/s)
 * et une fréquence de position typique du navigateur (environ 1 point par
 * seconde), l'écart entre deux positions CONSÉCUTIVES est très souvent
 * inférieur à 3 m : la quasi-totalité d'une marche lente ou régulière se
 * faisait donc rejeter en continu, alors qu'elle représentait un vrai
 * déplacement cumulé.
 *
 * Correctif : un point d'ancrage (« anchor ») ne avance que lorsqu'un
 * segment dépasse le seuil de bruit. Sous le seuil, l'ancrage reste en
 * place et le prochain point est comparé à ce même ancrage — un petit
 * déplacement réel s'accumule donc sur plusieurs positions successives
 * jusqu'à dépasser le seuil, au lieu d'être perdu à chaque fois. Une
 * position réellement immobile (bruit GPS autour d'un point fixe, va-et-
 * vient aléatoire) continue d'être ignorée, car elle ne s'éloigne pas
 * durablement de l'ancrage.
 */
export function cumulativeWalkDistanceMeters(points: GeoPoint[]): number {
  if (points.length === 0) return 0;

  let total = 0;
  let anchor = points[0];
  for (let i = 1; i < points.length; i++) {
    const segment = haversineDistanceMeters(anchor, points[i]);
    if (segment >= GPS_NOISE_FLOOR_METERS) {
      total += segment;
      anchor = points[i];
    }
    // Sinon : on ne fait PAS avancer l'ancrage, pour que ce petit
    // déplacement s'additionne avec les points suivants (voir commentaire
    // ci-dessus) au lieu d'être perdu.
  }
  return total;
}

/** Formate une distance en mètres pour affichage patient (ex. « 850 m », « 2.30 km »). */
export function formatWalkDistanceLabel(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}
