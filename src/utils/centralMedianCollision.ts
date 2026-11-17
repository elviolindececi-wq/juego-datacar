import type { TrafficLightNode } from './urbanTrafficRules.ts';
import { CROSSWALK_OFFSET_Z } from './urbanTrafficRules.ts';

/**
 * DATACAR ARENA — Física Pura & Reglas Geométricas de Paseo Central de Cemento
 * Sin dependencia de Three.js para poder ejecutarse en el motor físico puro y tests Node.
 */

export const CENTRAL_MEDIAN_MIN_ROAD_WIDTH_M = 18.0;
export const CENTRAL_MEDIAN_HALF_WIDTH_M = 0.42;
export const CENTRAL_MEDIAN_MODULE_LEN_M = 3.6;

export interface MedianSpanSegment {
  fromS: number;
  toS: number;
}

export interface CentralMedianEligibilityInput {
  roadWidthM: number;
  trackDistanceMeters: number;
  cityCircuitId?: string;
  routeHazardProfile?: string;
  isDragStrip?: boolean;
}

export function shouldBuildCentralMedian(input: CentralMedianEligibilityInput): boolean {
  if (input.isDragStrip) return false;
  if (input.roadWidthM < CENTRAL_MEDIAN_MIN_ROAD_WIDTH_M) return false;
  if (input.trackDistanceMeters < 320) return false;
  // Calle Oliva y Piribebuy representa una arteria histórica de adoquines sin cantero central
  if (input.cityCircuitId === 'oliva' || input.routeHazardProfile === 'cobbles') {
    return false;
  }
  return true;
}

export function computeCentralMedianSpans(args: {
  trackDistanceMeters: number;
  lights: readonly TrafficLightNode[];
  crossingZs?: readonly number[];
  hazardCenters?: ReadonlyArray<{ x: number; z: number; radiusM?: number }>;
}): MedianSpanSegment[] {
  const { trackDistanceMeters, lights, crossingZs = [], hazardCenters = [] } = args;
  const startS = 22;
  const endS = trackDistanceMeters - 22;
  if (endS - startS < 20) return [];

  const exclusionZones: Array<[number, number]> = [];

  for (const light of lights) {
    const cwZ = light.z + CROSSWALK_OFFSET_Z;
    exclusionZones.push([Math.min(light.z, cwZ) - 10.5, Math.max(light.z, cwZ) + 11.5]);
  }

  for (const cz of crossingZs) {
    exclusionZones.push([cz - 11.0, cz + 11.0]);
  }

  for (const hz of hazardCenters) {
    if (Math.abs(hz.x) < 1.35) {
      const margin = (hz.radiusM ?? 1.8) + 2.4;
      exclusionZones.push([hz.z - margin, hz.z + margin]);
    }
  }

  exclusionZones.sort((a, b) => a[0] - b[0]);
  const mergedExclusions: Array<[number, number]> = [];
  for (const [lo, hi] of exclusionZones) {
    const prev = mergedExclusions[mergedExclusions.length - 1];
    if (prev && lo <= prev[1] + 4.5) {
      prev[1] = Math.max(prev[1], hi);
    } else {
      mergedExclusions.push([lo, hi]);
    }
  }

  const spans: MedianSpanSegment[] = [];
  let cursor = startS;
  for (const [exLo, exHi] of mergedExclusions) {
    const clampedLo = Math.min(endS, exLo);
    if (clampedLo - cursor >= CENTRAL_MEDIAN_MODULE_LEN_M * 2) {
      spans.push({ fromS: cursor, toS: clampedLo });
    }
    cursor = Math.max(cursor, exHi);
  }
  if (endS - cursor >= CENTRAL_MEDIAN_MODULE_LEN_M * 2) {
    spans.push({ fromS: cursor, toS: endS });
  }
  return spans;
}

export interface MedianCollisionCarState {
  z: number;
  x: number;
  speed: number;
  lateralSpeed: number;
  damage: number;
  bump: number;
  impacts: number;
  widthM?: number;
}

export interface MedianCollisionResolution {
  hit: boolean;
  hitType: 'none' | 'lateral_scrape' | 'frontal_cap';
  pushSide: -1 | 1;
  impactStrength: number;
}

/**
 * Colisión rígida elástica contra los tramos activos del paseo central de hormigón.
 * - Respeta aperturas en semáforos y cebras peatonales (`spans`).
 * - Si el impacto es en una punta del cantero, frena frontalmente el vehículo.
 * - Si el vehículo raspa lateralmente el borde del hormigón, lo deflecta hacia afuera
 *   del eje central con pérdida de velocidad controlada (Opción A: conducción fluida sin trabarse).
 */
export function resolveCentralMedianCollision(
  car: MedianCollisionCarState,
  spans: readonly MedianSpanSegment[],
  medianHalfWidth = CENTRAL_MEDIAN_HALF_WIDTH_M
): MedianCollisionResolution {
  if (!spans.length) {
    return { hit: false, hitType: 'none', pushSide: 1, impactStrength: 0 };
  }
  const activeSpan = spans.find((span) => car.z >= span.fromS - 0.35 && car.z <= span.toS + 0.35);
  if (!activeSpan) {
    return { hit: false, hitType: 'none', pushSide: 1, impactStrength: 0 };
  }

  const carHalfW = Math.max(0.75, (car.widthM ?? 1.82) * 0.46);
  const contactLimitX = medianHalfWidth + carHalfW;
  const absX = Math.abs(car.x);

  if (absX >= contactLimitX) {
    return { hit: false, hitType: 'none', pushSide: car.x < 0 ? -1 : 1, impactStrength: 0 };
  }

  const pushSide: -1 | 1 = car.x < 0 ? -1 : 1;
  const penetration = contactLimitX - absX;
  const nearEntryCap = car.speed >= 0 && car.z - activeSpan.fromS < 1.25;
  const nearExitCap = car.speed < 0 && activeSpan.toS - car.z < 1.25;
  const isFrontalNoseImpact =
    (nearEntryCap || nearExitCap) && absX < medianHalfWidth + carHalfW * 0.72;

  const impactSpeedFactor = Math.min(1, Math.abs(car.speed) / 28);

  if (isFrontalNoseImpact) {
    car.x = pushSide * (contactLimitX + 0.14);
    car.speed *= 0.24;
    car.lateralSpeed = pushSide * Math.max(2.6, Math.abs(car.lateralSpeed) * 0.65);
    car.bump = Math.max(car.bump, 0.9);
    car.damage = Math.min(0.92, car.damage + 0.045 + impactSpeedFactor * 0.055);
    car.impacts += 1;
    return {
      hit: true,
      hitType: 'frontal_cap',
      pushSide,
      impactStrength: Math.min(1, 0.45 + impactSpeedFactor * 0.55),
    };
  }

  // Roce lateral elástico: empuja el vehículo fuera del borde de hormigón sin detenerlo por completo
  car.x = pushSide * (contactLimitX + 0.07);
  car.lateralSpeed = pushSide * Math.max(1.85, Math.min(5.2, Math.abs(car.lateralSpeed) * 0.55 + penetration * 3.1));
  car.speed *= 0.87;
  car.bump = Math.max(car.bump, 0.52);
  car.damage = Math.min(0.92, car.damage + 0.02 + impactSpeedFactor * 0.03);
  car.impacts += 1;

  return {
    hit: true,
    hitType: 'lateral_scrape',
    pushSide,
    impactStrength: Math.min(1, 0.28 + impactSpeedFactor * 0.48),
  };
}
