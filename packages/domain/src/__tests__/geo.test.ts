import { describe, expect, it } from "vitest";
import {
  cumulativeWalkDistanceMeters,
  formatWalkDistanceLabel,
  GPS_MAX_ACCEPTABLE_ACCURACY_METERS,
  GPS_NOISE_FLOOR_METERS,
  haversineDistanceMeters,
} from "../geo";

describe("haversineDistanceMeters (suivi de marche/vélo GPS, Sprint 25)", () => {
  it("retourne 0 pour deux points identiques", () => {
    const p = { latitudeDeg: 12.3714, longitudeDeg: -1.5197 }; // Ouagadougou
    expect(haversineDistanceMeters(p, p)).toBeCloseTo(0, 6);
  });

  it("calcule une distance connue (~1 degré de latitude ≈ 111,2 km à l'équateur)", () => {
    const a = { latitudeDeg: 0, longitudeDeg: 0 };
    const b = { latitudeDeg: 1, longitudeDeg: 0 };
    expect(haversineDistanceMeters(a, b)).toBeCloseTo(111_195, -2);
  });

  it("est symétrique (a→b = b→a)", () => {
    const a = { latitudeDeg: 12.3714, longitudeDeg: -1.5197 };
    const b = { latitudeDeg: 12.38, longitudeDeg: -1.53 };
    expect(haversineDistanceMeters(a, b)).toBeCloseTo(haversineDistanceMeters(b, a), 6);
  });

  it("calcule une petite distance réaliste (deux points à ~140 m)", () => {
    const a = { latitudeDeg: 12.3714, longitudeDeg: -1.5197 };
    const b = { latitudeDeg: 12.3726, longitudeDeg: -1.5197 };
    const distance = haversineDistanceMeters(a, b);
    expect(distance).toBeGreaterThan(100);
    expect(distance).toBeLessThan(200);
  });
});

describe("cumulativeWalkDistanceMeters", () => {
  it("retourne 0 pour 0 ou 1 point", () => {
    expect(cumulativeWalkDistanceMeters([])).toBe(0);
    expect(cumulativeWalkDistanceMeters([{ latitudeDeg: 12.37, longitudeDeg: -1.52 }])).toBe(0);
  });

  it("cumule plusieurs segments successifs", () => {
    const points = [
      { latitudeDeg: 12.3714, longitudeDeg: -1.5197 },
      { latitudeDeg: 12.3724, longitudeDeg: -1.5197 },
      { latitudeDeg: 12.3734, longitudeDeg: -1.5197 },
    ];
    const total = cumulativeWalkDistanceMeters(points);
    const seg1 = haversineDistanceMeters(points[0], points[1]);
    const seg2 = haversineDistanceMeters(points[1], points[2]);
    expect(total).toBeCloseTo(seg1 + seg2, 6);
  });

  it("ignore les segments sous le seuil de bruit GPS (patient à l'arrêt)", () => {
    const a = { latitudeDeg: 12.3714, longitudeDeg: -1.5197 };
    const bBelowNoise = { latitudeDeg: 12.371401, longitudeDeg: -1.5197 }; // ~0.1 m
    expect(haversineDistanceMeters(a, bBelowNoise)).toBeLessThan(GPS_NOISE_FLOOR_METERS);
    expect(cumulativeWalkDistanceMeters([a, bBelowNoise, a, bBelowNoise])).toBe(0);
  });
});

describe("formatWalkDistanceLabel", () => {
  it("affiche en mètres arrondis sous 1 km", () => {
    expect(formatWalkDistanceLabel(0)).toBe("0 m");
    expect(formatWalkDistanceLabel(850.4)).toBe("850 m");
    expect(formatWalkDistanceLabel(999.6)).toBe("1000 m");
  });

  it("affiche en kilomètres avec 2 décimales à partir de 1 km", () => {
    expect(formatWalkDistanceLabel(1000)).toBe("1.00 km");
    expect(formatWalkDistanceLabel(2345)).toBe("2.35 km");
  });
});

describe("GPS_MAX_ACCEPTABLE_ACCURACY_METERS (Sprint 26, correction du bug de distance)", () => {
  it("est une valeur strictement positive et raisonnable pour un GPS smartphone", () => {
    expect(GPS_MAX_ACCEPTABLE_ACCURACY_METERS).toBeGreaterThan(0);
    expect(GPS_MAX_ACCEPTABLE_ACCURACY_METERS).toBeLessThanOrEqual(100);
  });
});
