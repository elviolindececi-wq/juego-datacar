/**
 * DATACAR ARENA — Reglas urbanas interactivas (semáforos, límites de velocidad
 * máxima/mínima, tránsito 3D de mano contraria disciplinado en avenida ancha,
 * cinturón de seguridad y alerta ADAS lateral).
 * Módulo puro en TypeScript sin dependencia de Three.js para compatibilidad con Node tests.
 *
 * Convención de ejes en vista de persecución (avance hacia +Z) en Avenida Urbana Ancha (21 m):
 * - Derecha de pantalla (carriles amplios de avance del jugador y rivales): X ∈ [-10.5 .. 0.0] (3 carriles de 3.5 m)
 * - Doble línea amarilla divisoria central simétrica: X = 0.0
 * - Izquierda de pantalla (mano contraria avanzando hacia -Z): X ∈ [0.0 .. +10.5] (3 carriles amplios: +2.0, +5.2, +8.4)
 */
import type { RaceTrackConfig, Vehicle } from '../types/vehicle.ts';
import { getAsuncionStreetDetails } from './asuncionStreetData.ts';
import { hasVerifiedSystem } from './vehicleSafetySystems.ts';

export const URBAN_ROAD_WIDTH = 21.0;
export const URBAN_HALF_WIDTH = URBAN_ROAD_WIDTH * 0.5; // 10.5 m por lado (21.0 m totales)
export const DOUBLE_YELLOW_X = 0.0;
export const FORWARD_LANE_OPTIONS = [-8.4, -6.2, -4.0, -1.8] as const;
export const ONCOMING_LANES_X = [2.0, 5.2, 8.4] as const;
export const CROSSWALK_OFFSET_Z = -2.2;
export const PEDESTRIANS_PER_CROSSWALK = 4;

export interface CrosswalkPedestrianState {
  id: string;
  lightId: string;
  crosswalkLabel: string;
  x: number;
  z: number;
  headingYawOffset: number;
  walking: boolean;
  stridePhase: number;
  inRoadway: boolean;
  heightScale: number;
}

/**
 * Paleta automotriz realista para SUVs del tránsito urbano:
 * negro obsidiana, plata metálico, blanco perlado, azul marino oscuro y gris carbón (charcoal).
 */
export const REALISTIC_TRAFFIC_SUV_PALETTE = [
  '#0d1016', // Black (Negro Obsidiana)
  '#bcc4ce', // Silver (Plata Metálico)
  '#eef2f7', // White (Blanco Perlado)
  '#102648', // Dark Blue (Azul Marino Profundo)
  '#2b313a', // Charcoal (Gris Carbón Grafito)
] as const;

export const TRAFFIC_3D_CATALOG_SPECS: ReadonlyArray<{
  modelId: string;
  lengthM: number;
  widthM: number;
  tintHex: string;
}> = [
  { modelId: 'toyota-corolla-cross-seg-2027', lengthM: 4.46, widthM: 1.825, tintHex: '#eef2f7' },
  { modelId: 'chery-t4-pro-luxury-hev', lengthM: 4.52, widthM: 1.845, tintHex: '#0d1016' },
  { modelId: 'nissan-kicks-2027', lengthM: 4.38, widthM: 1.82, tintHex: '#bcc4ce' },
  { modelId: 'kia-carens-ex', lengthM: 4.56, widthM: 1.835, tintHex: '#102648' },
  { modelId: 'chevrolet-tracker-lite', lengthM: 4.41, widthM: 1.83, tintHex: '#2b313a' },
  { modelId: 'chery-t2-pro-max', lengthM: 4.48, widthM: 1.875, tintHex: '#0d1016' },
  { modelId: 'suzuki-fronx', lengthM: 4.39, widthM: 1.825, tintHex: '#bcc4ce' },
];

export type TrafficSignalPhase = 'green' | 'yellow' | 'red';

export interface TrafficLightNode {
  id: string;
  z: number;
  label: string;
  cycleSec: number;
  greenSec: number;
  yellowSec: number;
  phaseOffsetSec: number;
}

export interface TrafficLightLiveState {
  node: TrafficLightNode;
  phase: TrafficSignalPhase;
  remainingSec: number;
  forwardStopZ: number;
  oncomingStopZ: number;
}

export interface SpeedLimitZone {
  id: string;
  fromZ: number;
  toZ: number;
  signZ: number;
  maxKmh: number;
  minKmh: number;
  label: string;
}

export interface OncomingTrafficCar {
  id: string;
  modelId: string;
  laneX: number;
  x: number;
  z: number;
  speedMps: number;
  desiredSpeedMps: number;
  lengthM: number;
  widthM: number;
  color: string;
  wheelAngle: number;
  distanceTraveledM: number;
  braking: boolean;
}

export type TrafficNoticeKind = 'warning' | 'penalty' | 'ok' | 'adas';

export interface TrafficRuleNotice {
  seq: number;
  kind: TrafficNoticeKind;
  code:
    | 'seatbelt'
    | 'red_light'
    | 'max_speed'
    | 'min_speed'
    | 'wrong_way'
    | 'seatbelt_ok'
    | 'pedestrian_arrest'
    | 'motorcycle_collision'
    | 'collision';
  title: string;
  subtitle: string;
  pointsDelta: number;
  createdAtSec: number;
}

export interface BlindSpotFlankState {
  equipped: boolean;
  leftAlert: boolean;
  rightAlert: boolean;
  leftDistanceM: number | null;
  rightDistanceM: number | null;
}

export interface WetSplashEvent {
  seq: number;
  carId: string;
  x: number;
  z: number;
  intensity: number;
  timeSec: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function hasVerifiedBlindSpotAdas(vehicle: Vehicle): boolean {
  return (
    hasVerifiedSystem(vehicle, 'blindSpot') ||
    hasVerifiedSystem(vehicle, 'laneChangeAssist')
  );
}

export function buildTrafficLights(track: RaceTrackConfig): TrafficLightNode[] {
  const dist = track.distanceMeters;
  if (dist < 320) return [];
  const details = track.cityCircuitId
    ? getAsuncionStreetDetails(track.routeHazardProfile, dist)
    : { crossings: [], speedBumps: [] };

  const rawPositions: { z: number; label: string }[] = [];
  const step = track.routeHazardProfile === 'traffic' ? 360 : 340;
  let idx = 1;
  for (let z = 250; z < dist - 115; z += step) {
    const nearbyCross = details.crossings.find(c => Math.abs(c.z - z) < 95);
    const snappedZ = nearbyCross ? nearbyCross.z - 8 : z;
    if (snappedZ < 150 || snappedZ > dist - 95) continue;
    if (rawPositions.some(p => Math.abs(p.z - snappedZ) < 155)) continue;
    rawPositions.push({
      z: Math.round(snappedZ),
      label: nearbyCross ? `Cruce ${nearbyCross.transverse}` : `Intersección ${idx}`,
    });
    idx++;
  }

  // Calibrar desfase para que el jugador encuentre semáforos reales en ROJO
  // en las intersecciones impares (1.ª, 3.ª...) tanto a ritmo urbano (55-65 km/h)
  // como acelerando fuerte, obligando a poner a prueba los frenos reales.
  const greenSec = 8.0;
  const yellowSec = 2.4;
  const redSec = 8.0;
  const cycleSec = greenSec + yellowSec + redSec; // 18.4 s

  return rawPositions.map((pos, i) => {
    const expectedArrivalSec = 1.6 + pos.z / 19.5;
    // Ventana ROJA: [10.4 .. 18.4]. Apuntamos a 13.8s para tener amplio margen en rojo.
    const targetCycleMoment = i % 2 === 0 ? greenSec + yellowSec + 3.4 : greenSec - 1.4;
    const rawOffset = ((targetCycleMoment - (expectedArrivalSec % cycleSec)) % cycleSec + cycleSec) % cycleSec;
    return {
      id: `semaforo-${i + 1}`,
      z: pos.z,
      label: pos.label,
      cycleSec,
      greenSec,
      yellowSec,
      phaseOffsetSec: Number(rawOffset.toFixed(2)),
    };
  });
}

export function getTrafficLightState(node: TrafficLightNode, timeSec: number): TrafficLightLiveState {
  const t = ((timeSec + node.phaseOffsetSec) % node.cycleSec + node.cycleSec) % node.cycleSec;
  let phase: TrafficSignalPhase = 'red';
  let remainingSec = 0;
  if (t < node.greenSec) {
    phase = 'green';
    remainingSec = node.greenSec - t;
  } else if (t < node.greenSec + node.yellowSec) {
    phase = 'yellow';
    remainingSec = node.greenSec + node.yellowSec - t;
  } else {
    phase = 'red';
    remainingSec = node.cycleSec - t;
  }
  return {
    node,
    phase,
    remainingSec,
    forwardStopZ: node.z - 5.5,
    oncomingStopZ: node.z + 5.8,
  };
}

export function findUpcomingTrafficLight(
  nodes: readonly TrafficLightNode[],
  z: number,
  timeSec: number,
  maxLookaheadM = 135,
): (TrafficLightLiveState & { distanceToStopM: number }) | null {
  for (const node of nodes) {
    const state = getTrafficLightState(node, timeSec);
    const dist = state.forwardStopZ - z;
    if (dist >= -4.5 && dist <= maxLookaheadM) {
      return { ...state, distanceToStopM: dist };
    }
  }
  return null;
}

export function buildSpeedLimitZones(track: RaceTrackConfig): SpeedLimitZone[] {
  const dist = track.distanceMeters;
  const fastAve = track.routeHazardProfile === 'traffic';
  const floodOrCobbles = track.routeHazardProfile === 'flood' || track.routeHazardProfile === 'cobbles';

  const templates: { maxKmh: number; minKmh: number; label: string }[] = fastAve
    ? [
        { maxKmh: 70, minKmh: 35, label: 'Avenida rápida' },
        { maxKmh: 50, minKmh: 25, label: 'Zona comercial' },
        { maxKmh: 80, minKmh: 40, label: 'Tramo ágil' },
        { maxKmh: 60, minKmh: 30, label: 'Cruce regulado' },
      ]
    : floodOrCobbles
      ? [
          { maxKmh: 50, minKmh: 25, label: 'Calzada delicada' },
          { maxKmh: 40, minKmh: 20, label: 'Precaución urbana' },
          { maxKmh: 60, minKmh: 30, label: 'Tramo principal' },
        ]
      : [
          { maxKmh: 60, minKmh: 30, label: 'Urbano principal' },
          { maxKmh: 45, minKmh: 25, label: 'Zona de cruces' },
          { maxKmh: 65, minKmh: 30, label: 'Corredor fluido' },
          { maxKmh: 50, minKmh: 25, label: 'Tramo controlado' },
        ];

  const segmentLen = 390;
  const count = Math.max(2, Math.ceil(dist / segmentLen));
  const zones: SpeedLimitZone[] = [];

  for (let i = 0; i < count; i++) {
    const fromZ = i * segmentLen;
    const toZ = i === count - 1 ? dist + 150 : (i + 1) * segmentLen;
    const tpl = templates[i % templates.length];
    zones.push({
      id: `vel-zone-${i + 1}`,
      fromZ,
      toZ,
      signZ: Math.min(dist - 40, Math.max(28, fromZ + 28)),
      maxKmh: tpl.maxKmh,
      minKmh: tpl.minKmh,
      label: tpl.label,
    });
  }
  return zones;
}

export function getActiveSpeedLimitZone(
  zones: readonly SpeedLimitZone[],
  z: number,
): SpeedLimitZone {
  const safeZ = Math.max(0, z);
  for (const zone of zones) {
    if (safeZ >= zone.fromZ && safeZ < zone.toZ) return zone;
  }
  return zones[zones.length - 1] ?? {
    id: 'default-zone',
    fromZ: 0,
    toZ: 99999,
    signZ: 30,
    maxKmh: 60,
    minKmh: 30,
    label: 'Urbano',
  };
}

export function createOncomingTrafficPool(track: RaceTrackConfig): OncomingTrafficCar[] {
  const dist = track.distanceMeters;
  // Pool acotado de 7 a 9 vehículos 3D GLB reales reciclados frente al jugador para 60 FPS estables
  const count = clamp(Math.round(dist / 225), 7, 9);
  const spacing = Math.max(58, Math.min(105, dist / count));
  const cars: OncomingTrafficCar[] = [];

  for (let i = 0; i < count; i++) {
    const laneX = ONCOMING_LANES_X[i % ONCOMING_LANES_X.length];
    const spec = TRAFFIC_3D_CATALOG_SPECS[i % TRAFFIC_3D_CATALOG_SPECS.length];
    // Distribuir desde z=42 m para que ya se vean en movimiento desde la vista dron previa a largar
    const startZ = 42 + i * spacing;
    const baseSpeedMps = (44 + (i % 3) * 5) / 3.6;
    cars.push({
      id: `oncoming-${i + 1}`,
      modelId: spec.modelId,
      laneX,
      x: laneX,
      z: startZ,
      speedMps: baseSpeedMps,
      desiredSpeedMps: baseSpeedMps,
      lengthM: spec.lengthM,
      widthM: spec.widthM,
      color: spec.tintHex,
      wheelAngle: 0,
      distanceTraveledM: 0,
      braking: false,
    });
  }
  return cars;
}

/**
 * Actualiza los vehículos 3D que circulan en sentido contrario (-Z) por los 3 carriles
 * izquierdos (+2.0, +5.2 y +8.4). Respetan estrictamente límites de velocidad,
 * semáforos en rojo/amarillo y distancia entre sí, sin salirse jamás de su mano.
 */
export function stepOncomingTraffic(
  cars: OncomingTrafficCar[],
  lights: readonly TrafficLightNode[],
  speedZones: readonly SpeedLimitZone[],
  timeSec: number,
  dt: number,
  playerZ: number,
  trackDistanceM: number,
): void {
  for (let i = 0; i < cars.length; i++) {
    const car = cars[i];
    car.x = car.laneX; // Disciplina absoluta de carril: nunca invade la mano del jugador

    const zone = getActiveSpeedLimitZone(speedZones, car.z);
    // Respetan entre el 78% y 90% de la máxima permitida y nunca bajan de la mínima en verde
    const maxAllowedMps = (zone.maxKmh * 0.86) / 3.6;
    const minAllowedMps = (zone.minKmh * 1.06) / 3.6;
    let targetSpeed = clamp(maxAllowedMps, minAllowedMps, 21);
    let braking = false;

    // 1. Respeto de semáforos (avanzando hacia -Z: se detienen en oncomingStopZ = node.z + 5.8)
    for (const node of lights) {
      const st = getTrafficLightState(node, timeSec);
      if (st.phase === 'green') continue;
      const distToStop = car.z - st.oncomingStopZ;
      if (distToStop >= -0.8 && distToStop <= 46) {
        if (distToStop <= 2.2) {
          targetSpeed = 0;
          braking = true;
        } else {
          const safeApproach = Math.sqrt(2 * 4.2 * Math.max(0, distToStop - 1.5));
          if (safeApproach < targetSpeed) {
            targetSpeed = safeApproach;
            braking = true;
          }
        }
      }
    }

    // 2. Distancia de seguridad con otro auto de frente que vaya delante de él (menor Z en el mismo carril)
    for (let j = 0; j < cars.length; j++) {
      if (i === j) continue;
      const ahead = cars[j];
      if (Math.abs(ahead.laneX - car.laneX) > 0.6) continue;
      const gap = car.z - ahead.z - (car.lengthM + ahead.lengthM) * 0.5;
      if (gap > 0 && gap < 24) {
        const matchSpeed = gap < 5.8 ? 0 : Math.min(targetSpeed, ahead.speedMps * clamp((gap - 4.2) / 14, 0, 1));
        if (matchSpeed < targetSpeed) {
          targetSpeed = matchSpeed;
          braking = true;
        }
      }
    }

    const accelRate = targetSpeed < car.speedMps ? 6.8 : 3.2;
    car.speedMps = clamp(
      car.speedMps + clamp(targetSpeed - car.speedMps, -accelRate * dt, accelRate * dt),
      0,
      25,
    );
    if (targetSpeed === 0 && car.speedMps < 0.08) car.speedMps = 0;
    car.braking = braking;
    const stepDist = car.speedMps * dt;
    car.z -= stepDist;
    car.distanceTraveledM += stepDist;
    car.wheelAngle = (car.wheelAngle + stepDist / 0.34) % (Math.PI * 2);

    // Reciclaje continuo por delante del horizonte visual del jugador para mantener flujo en todas las vueltas
    if (car.z < playerZ - 65) {
      let maxAheadZ = playerZ + 185;
      for (const other of cars) {
        if (Math.abs(other.laneX - car.laneX) < 0.6 && other.z > maxAheadZ) {
          maxAheadZ = other.z;
        }
      }
      const respawnZ = Math.max(playerZ + 195 + (i % 4) * 34, maxAheadZ + 52);
      if (respawnZ <= trackDistanceM + 170) {
        car.z = respawnZ;
        car.speedMps = Math.min(maxAllowedMps, 13.5);
      }
    }
  }
}

/**
 * Evalúa sensores ADAS laterales (Blind Spot / Asistencia de cambio de carril)
 * SOLO si el vehículo elegido tiene el sistema confirmado en ficha.
 * Izquierda de pantalla = dx > 0; Derecha de pantalla = dx < 0.
 */
export function evaluateBlindSpotFlanks(
  playerVehicle: Vehicle,
  playerX: number,
  playerZ: number,
  rivals: ReadonlyArray<{ id: string; x: number; z: number }>,
  oncoming: ReadonlyArray<{ x: number; z: number }>,
  playerId: string,
): BlindSpotFlankState {
  const equipped = hasVerifiedBlindSpotAdas(playerVehicle);
  if (!equipped) {
    return {
      equipped: false,
      leftAlert: false,
      rightAlert: false,
      leftDistanceM: null,
      rightDistanceM: null,
    };
  }

  let leftDist: number | null = null;
  let rightDist: number | null = null;

  const inspectTarget = (tx: number, tz: number, forwardLookM: number, rearLookM: number) => {
    const dz = tz - playerZ;
    if (dz < -rearLookM || dz > forwardLookM) return;
    const dx = tx - playerX;
    const euclid = Math.hypot(dx, dz);
    // dx > 0 es IZQUIERDA del conductor; dx < 0 es DERECHA del conductor (adaptado a avenida de 21 m)
    if (dx > 0.95 && dx <= 12.2) {
      if (leftDist === null || euclid < leftDist) leftDist = euclid;
    } else if (dx < -0.95 && dx >= -9.8) {
      if (rightDist === null || euclid < rightDist) rightDist = euclid;
    }
  };

  for (const r of rivals) {
    if (r.id === playerId) continue;
    inspectTarget(r.x, r.z, 13.5, 16.5);
  }
  for (const oc of oncoming) {
    // Autos de frente se aproximan rápido por la izquierda: ventana frontal mayor (40m)
    inspectTarget(oc.x, oc.z, 40, 9);
  }

  return {
    equipped: true,
    leftAlert: leftDist !== null,
    rightAlert: rightDist !== null,
    leftDistanceM: leftDist !== null ? Math.round(leftDist) : null,
    rightDistanceM: rightDist !== null ? Math.round(rightDist) : null,
  };
}

/**
 * Calcula la posición determinista de los peatones en cada franja peatonal semaforizada.
 * - Cuando el semáforo vehicular está en ROJO (luz verde peatonal), los peatones cruzan
 *   caminando por las cebras blancas de vereda a vereda.
 * - Cuando el semáforo vehicular está en VERDE o AMARILLO, aguardan seguros sobre la vereda.
 * Reutiliza el arreglo `out` para 0 asignaciones (0 GC) tanto en física como en Three.js.
 */
export function evaluateCrosswalkPedestrians(
  lights: readonly TrafficLightNode[],
  timeSec: number,
  halfRoad = URBAN_HALF_WIDTH,
  out: CrosswalkPedestrianState[] = [],
): CrosswalkPedestrianState[] {
  const total = lights.length * PEDESTRIANS_PER_CROSSWALK;
  out.length = total;
  const curbWaitX = halfRoad + 2.15;
  const zOffsets = [-0.78, 0.32, -0.28, 0.78];

  let idx = 0;
  for (let l = 0; l < lights.length; l++) {
    const node = lights[l];
    const st = getTrafficLightState(node, timeSec);
    const redDuration = Math.max(4.0, node.cycleSec - node.greenSec - node.yellowSec);
    const redElapsed = st.phase === 'red' ? redDuration - st.remainingSec : -1;
    const baseCrossZ = node.z + CROSSWALK_OFFSET_Z;

    for (let k = 0; k < PEDESTRIANS_PER_CROSSWALK; k++) {
      const fromRightCurb = k < 2;
      const startX = fromRightCurb ? -curbWaitX : curbWaitX;
      const endX = -startX;
      const startDelay = 0.22 + (k % 2) * 0.45;
      const walkDuration = Math.max(4.8, redDuration - 1.25);

      let u = 0;
      let walking = false;
      if (st.phase === 'red') {
        u = clamp((redElapsed - startDelay) / walkDuration, 0, 1);
        walking = u > 0.005 && u < 0.995;
      }

      const x = startX + (endX - startX) * u;
      const z = baseCrossZ + zOffsets[k];
      const headingYawOffset = fromRightCurb ? Math.PI * 0.5 : -Math.PI * 0.5;
      const stridePhase = walking ? timeSec * 7.8 + l * 1.3 + k * 1.7 : 0;
      const inRoadway = Math.abs(x) < halfRoad + 0.45;
      const heightScale = 0.93 + ((l + k) % 3) * 0.045;

      const existing = out[idx];
      if (existing) {
        existing.lightId = node.id;
        existing.crosswalkLabel = node.label;
        existing.x = x;
        existing.z = z;
        existing.headingYawOffset = headingYawOffset;
        existing.walking = walking;
        existing.stridePhase = stridePhase;
        existing.inRoadway = inRoadway;
        existing.heightScale = heightScale;
      } else {
        out[idx] = {
          id: `cw-ped-${node.id}-${k + 1}`,
          lightId: node.id,
          crosswalkLabel: node.label,
          x,
          z,
          headingYawOffset,
          walking,
          stridePhase,
          inRoadway,
          heightScale,
        };
      }
      idx++;
    }
  }
  return out;
}
