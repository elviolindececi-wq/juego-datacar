import * as THREE from 'three';
import type { RaceTrackConfig } from '../types/vehicle.ts';
import type { CurvedRoadPath } from './curvedRoadPath.ts';
import {
  getActiveSpeedLimitZone,
  getTrafficLightState,
  type SpeedLimitZone,
  type TrafficLightNode,
} from './urbanTrafficRules.ts';

/**
 * DATACAR ARENA — Tránsito Urbano de Motociclistas en el Carril de Ida (§11)
 * Presencia cotidiana del tránsito paraguayo circulando en el sentido de ida (+Z):
 * - Respetan los carriles de ida (X ∈ [-9.1 .. -1.4] m; jamás cruzan el paseo central X=0 ni invaden mano contraria).
 * - Aparición progresiva y reciclaje seguro (>= 62 m delante al inicio; nunca a menos de 24 m del jugador).
 * - Respetan semáforos en rojo/amarillo y límites de velocidad urbanos.
 * - Esquivan suavemente al jugador y otros autos dentro de los carriles de ida sin atravesarlos.
 * - Modelo 3D compuesto (10 piezas por unidad: chasis/tanque, asiento, horquilla/guardabarros,
 *   2 ruedas animadas con llanta, manillar, faro LED delantero, luz de freno trasera,
 *   conductor articulado, casco integral con visor y sombra de contacto).
 * - Módulo independiente que NO altera las físicas del jugador ni el motor de colisiones protegido.
 */

export const FORWARD_MOTO_SUBLANES_X = [-8.6, -6.5, -4.4, -2.3] as const;

export interface ForwardMotorcycleActor {
  id: string;
  preferredLaneX: number;
  x: number;
  targetX: number;
  z: number;
  speedMps: number;
  desiredSpeedMps: number;
  wheelAngleRad: number;
  leanAngleRad: number;
  braking: boolean;
  lengthM: number;
  widthM: number;
  bikeColorHex: string;
  jacketColorHex: string;
  helmetColorHex: string;
  downedTimerSec: number;
  collisionCooldownSec: number;
  fallSide: -1 | 1;
  skidVx: number;
  skidVz: number;
  riderSlideOffset: number;
}

export interface MotorcycleCollisionEvent {
  motoId: string;
  x: number;
  z: number;
  impactSpeedMps: number;
}

const MOTO_PALETTES: ReadonlyArray<{
  bike: string;
  jacket: string;
  helmet: string;
}> = [
  { bike: '#dc2626', jacket: '#1e293b', helmet: '#f8fafc' },
  { bike: '#2563eb', jacket: '#0f172a', helmet: '#eab308' },
  { bike: '#111827', jacket: '#334155', helmet: '#ef4444' },
  { bike: '#0284c7', jacket: '#1f2937', helmet: '#e2e8f0' },
  { bike: '#ea580c', jacket: '#0f172a', helmet: '#38bdf8' },
];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function createForwardMotorcyclePool(track: RaceTrackConfig): ForwardMotorcycleActor[] {
  // Solo en circuitos urbanos de doble mano con flujo vehicular real
  if (!track.cityCircuitId || track.distanceMeters < 350) {
    return [];
  }

  const dist = track.distanceMeters;
  // Densidad equilibrada (4 a 6 motocicletas activas) para fluidez mobile y cero saturación
  const count = clamp(Math.round(dist / 360), 4, 6);
  const spacing = Math.max(68, Math.min(115, (dist - 120) / count));
  const actors: ForwardMotorcycleActor[] = [];

  for (let i = 0; i < count; i++) {
    const laneX = FORWARD_MOTO_SUBLANES_X[i % FORWARD_MOTO_SUBLANES_X.length];
    const palette = MOTO_PALETTES[i % MOTO_PALETTES.length];
    // Aparición progresiva siempre >= 64 m delante de la largada (z=0), jamás encima del jugador
    const startZ = 64 + i * spacing;
    const baseSpeedMps = (42 + (i % 3) * 4.5) / 3.6;

    actors.push({
      id: `moto-ida-${i + 1}`,
      preferredLaneX: laneX,
      x: laneX,
      targetX: laneX,
      z: startZ,
      speedMps: baseSpeedMps,
      desiredSpeedMps: baseSpeedMps,
      wheelAngleRad: 0,
      leanAngleRad: 0,
      braking: false,
      lengthM: 2.08,
      widthM: 0.78,
      bikeColorHex: palette.bike,
      jacketColorHex: palette.jacket,
      helmetColorHex: palette.helmet,
      downedTimerSec: 0,
      collisionCooldownSec: 0,
      fallSide: 1,
      skidVx: 0,
      skidVz: 0,
      riderSlideOffset: 0,
    });
  }

  return actors;
}

export interface ForwardTrafficObstacleCar {
  id: string;
  x: number;
  z: number;
  speedMps: number;
  lengthM?: number;
  widthM?: number;
}

/**
 * Avanza las motocicletas en el sentido de ida (+Z) respetando carriles, semáforos,
 * otros vehículos y distancias seguras respecto del jugador.
 */
export function stepForwardMotorcycles(args: {
  motorcycles: ForwardMotorcycleActor[];
  lights: readonly TrafficLightNode[];
  speedZones: readonly SpeedLimitZone[];
  forwardCars: readonly ForwardTrafficObstacleCar[];
  playerX: number;
  playerZ: number;
  playerSpeedMps: number;
  playerLengthM?: number;
  playerWidthM?: number;
  timeSec: number;
  dt: number;
  trackDistanceM: number;
}): MotorcycleCollisionEvent[] {
  const {
    motorcycles,
    lights,
    speedZones,
    forwardCars,
    playerX,
    playerZ,
    playerSpeedMps,
    playerLengthM,
    playerWidthM,
    timeSec,
    dt,
    trackDistanceM,
  } = args;

  const collisionEvents: MotorcycleCollisionEvent[] = [];
  const safeDt = clamp(dt, 0, 0.1);
  if (safeDt <= 0 || motorcycles.length === 0) return collisionEvents;

  const playerHalfLen = (playerLengthM ?? 4.4) * 0.5;
  const playerHalfWid = (playerWidthM ?? 1.82) * 0.5;

  for (let i = 0; i < motorcycles.length; i++) {
    const moto = motorcycles[i];
    moto.collisionCooldownSec = Math.max(0, moto.collisionCooldownSec - safeDt);

    // 0. Detección de atropello / impacto del jugador contra la moto y el motociclista
    if (
      moto.downedTimerSec <= 0 &&
      moto.collisionCooldownSec <= 0 &&
      Math.abs(playerSpeedMps) > 1.0 &&
      Math.abs(playerZ - moto.z) < playerHalfLen + moto.lengthM * 0.46 &&
      Math.abs(playerX - moto.x) < playerHalfWid + moto.widthM * 0.52
    ) {
      const fallSide: -1 | 1 = moto.x <= playerX ? -1 : 1;
      const impactSpeedMps = Math.max(4.5, Math.abs(playerSpeedMps - moto.speedMps));
      moto.downedTimerSec = 6.0;
      moto.collisionCooldownSec = 8.5;
      moto.fallSide = fallSide;
      moto.skidVx = fallSide * clamp(2.8 + Math.abs(playerSpeedMps) * 0.16, 2.8, 6.2);
      moto.skidVz = Math.max(moto.speedMps * 0.72, Math.abs(playerSpeedMps) * 0.58);
      moto.braking = true;
      collisionEvents.push({
        motoId: moto.id,
        x: moto.x,
        z: moto.z,
        impactSpeedMps,
      });
    }

    // Si la moto fue impactada: derrapa volcada hacia la banquina y el motociclista cae a un costado
    if (moto.downedTimerSec > 0) {
      moto.downedTimerSec = Math.max(0, moto.downedTimerSec - safeDt);
      moto.skidVx = THREE.MathUtils.damp(moto.skidVx, 0, 3.2, safeDt);
      moto.skidVz = THREE.MathUtils.damp(moto.skidVz, 0, 2.6, safeDt);
      moto.x = clamp(moto.x + moto.skidVx * safeDt, -10.1, -1.1);
      moto.z += Math.max(0, moto.skidVz) * safeDt;
      moto.speedMps = Math.max(0, moto.skidVz);
      moto.leanAngleRad = THREE.MathUtils.damp(
        moto.leanAngleRad,
        moto.fallSide * 1.34,
        11,
        safeDt,
      );
      moto.riderSlideOffset = THREE.MathUtils.damp(
        moto.riderSlideOffset,
        moto.fallSide * 0.96,
        8.5,
        safeDt,
      );
      moto.braking = true;
      if (moto.downedTimerSec <= 0) {
        moto.skidVx = 0;
        moto.skidVz = 0;
        moto.targetX = clamp(moto.x, -9.2, -1.4);
      }
      if (moto.z < playerZ - 58 || moto.z > trackDistanceM + 90) {
        moto.downedTimerSec = 0;
        moto.collisionCooldownSec = 0;
        moto.riderSlideOffset = 0;
        moto.leanAngleRad = 0;
        moto.x = moto.preferredLaneX;
        moto.targetX = moto.preferredLaneX;
        moto.z = Math.max(playerZ + 135 + (i % 4) * 32, 65);
      }
      continue;
    }

    moto.riderSlideOffset = THREE.MathUtils.damp(moto.riderSlideOffset, 0, 7, safeDt);

    const zone = getActiveSpeedLimitZone(speedZones, moto.z);
    const maxUrbanMps = (zone.maxKmh * 0.84) / 3.6;
    const minUrbanMps = (zone.minKmh * 1.02) / 3.6;
    let targetSpeed = clamp(maxUrbanMps, minUrbanMps, 19.5);
    let braking = false;
    let desiredX = moto.preferredLaneX;

    // 1. Respeto estricto de semáforos en sentido de ida (+Z, se detienen en forwardStopZ)
    for (let l = 0; l < lights.length; l++) {
      const st = getTrafficLightState(lights[l], timeSec);
      if (st.phase === 'green') continue;
      const distToStop = st.forwardStopZ - moto.z;
      if (distToStop >= -0.6 && distToStop <= 42) {
        if (distToStop <= 2.0) {
          targetSpeed = 0;
          braking = true;
        } else {
          const decelProfile = Math.sqrt(2 * 4.4 * Math.max(0, distToStop - 1.4));
          if (decelProfile < targetSpeed) {
            targetSpeed = decelProfile;
            braking = true;
          }
        }
      }
    }

    // 2. Evitar atravesar o bloquear bruscamente otros vehículos del carril de ida (incluido el jugador)
    const evaluateSameDirectionBody = (
      otherX: number,
      otherZ: number,
      otherSpeedMps: number,
      otherHalfLen: number,
      otherHalfWid: number,
    ) => {
      const dz = otherZ - moto.z;
      const dx = moto.x - otherX;
      const minLatClearance = otherHalfWid + 0.85;

      // Vehículo delante de la moto en su misma franja lateral -> frenar o cambiar suavemente de subcarril
      if (dz > -0.5 && dz < 22 && Math.abs(dx) < minLatClearance) {
        const gap = dz - otherHalfLen - moto.lengthM * 0.5;
        // Buscar subcarril libre dentro de [-9.1 .. -1.4] sin cruzar jamás al paseo central
        const altRight = clamp(otherX - (minLatClearance + 0.75), -9.2, -1.4);
        const altLeft = clamp(otherX + (minLatClearance + 0.75), -9.2, -1.4);
        const canGoRight = Math.abs(altRight - otherX) >= minLatClearance;
        const canGoLeft = Math.abs(altLeft - otherX) >= minLatClearance;
        if (dz > 5.5 && (canGoRight || canGoLeft)) {
          desiredX = canGoRight ? altRight : altLeft;
        } else {
          const safeFollow =
            gap <= 3.6
              ? 0
              : Math.min(targetSpeed, otherSpeedMps * clamp((gap - 2.4) / 11, 0, 1));
          if (safeFollow < targetSpeed) {
            targetSpeed = safeFollow;
            braking = true;
          }
        }
      }

      // Si el jugador se acerca rápido por detrás en la misma línea, ceder ligeramente el borde derecho/izquierdo del carril sin crear obstáculo inevitable
      if (dz < 0 && dz > -16 && Math.abs(dx) < minLatClearance && otherSpeedMps > moto.speedMps + 2.5) {
        const yieldDir = dx >= 0 ? 1 : -1;
        desiredX = clamp(otherX + yieldDir * (minLatClearance + 0.65), -9.2, -1.4);
      }
    };

    evaluateSameDirectionBody(playerX, playerZ, playerSpeedMps, 2.25, 0.95);
    for (let c = 0; c < forwardCars.length; c++) {
      const fc = forwardCars[c];
      evaluateSameDirectionBody(
        fc.x,
        fc.z,
        fc.speedMps,
        (fc.lengthM ?? 4.35) * 0.5,
        (fc.widthM ?? 1.82) * 0.5,
      );
    }

    // 3. Espaciamiento longitudinal y lateral entre motocicletas
    for (let j = 0; j < motorcycles.length; j++) {
      if (i === j) continue;
      const peer = motorcycles[j];
      if (Math.abs(peer.x - moto.x) > 0.95) continue;
      const gap = peer.z - moto.z - moto.lengthM;
      if (gap > 0 && gap < 14) {
        const matchSpeed = gap < 3.4 ? 0 : Math.min(targetSpeed, peer.speedMps * clamp((gap - 2.2) / 9, 0, 1));
        if (matchSpeed < targetSpeed) {
          targetSpeed = matchSpeed;
          braking = true;
        }
      }
    }

    // Integrar cambio lateral suave estrictamente dentro de los carriles de ida [-9.2 .. -1.4]
    moto.targetX = clamp(desiredX, -9.2, -1.4);
    const prevX = moto.x;
    const maxLatStep = 2.4 * safeDt;
    moto.x = clamp(
      moto.x + clamp(moto.targetX - moto.x, -maxLatStep, maxLatStep),
      -9.2,
      -1.4,
    );
    const lateralVel = (moto.x - prevX) / safeDt;
    moto.leanAngleRad = THREE.MathUtils.damp(
      moto.leanAngleRad,
      clamp(-lateralVel * 0.11, -0.24, 0.24),
      8,
      safeDt,
    );

    // Integrar velocidad longitudinal siempre >= 0 (sentido de ida +Z)
    const accelRate = targetSpeed < moto.speedMps ? 7.2 : 3.6;
    moto.speedMps = clamp(
      moto.speedMps + clamp(targetSpeed - moto.speedMps, -accelRate * safeDt, accelRate * safeDt),
      0,
      23,
    );
    if (targetSpeed === 0 && moto.speedMps < 0.08) moto.speedMps = 0;
    moto.braking = braking && moto.speedMps > 0.15;

    const stepZ = moto.speedMps * safeDt;
    moto.z += stepZ;
    moto.wheelAngleRad = (moto.wheelAngleRad + stepZ / 0.29) % (Math.PI * 2);

    // Reciclaje progresivo y seguro cuando queda muy atrás del jugador (> 58 m detrás)
    // o supera el final de la pista: reaparece lejos por delante sin invadir a otros actores
    if (moto.z < playerZ - 58 || moto.z > trackDistanceM + 90) {
      let candidateZ = Math.max(playerZ + 125 + (i % 4) * 32, 65);
      // Asegurar distancia segura con el jugador, rivales y otras motos
      for (let guard = 0; guard < 6; guard++) {
        const clashMoto = motorcycles.some(
          (other, idx) =>
            idx !== i &&
            Math.abs(other.preferredLaneX - moto.preferredLaneX) < 1.1 &&
            Math.abs(other.z - candidateZ) < 26,
        );
        const clashCar = forwardCars.some(
          fc =>
            Math.abs(fc.x - moto.preferredLaneX) < 1.6 &&
            Math.abs(fc.z - candidateZ) < 22,
        );
        const clashPlayer = Math.abs(playerZ - candidateZ) < 48;
        if (!clashMoto && !clashCar && !clashPlayer) break;
        candidateZ += 28;
      }

      if (candidateZ <= trackDistanceM + 75) {
        moto.z = candidateZ;
        moto.x = moto.preferredLaneX;
        moto.targetX = moto.preferredLaneX;
        moto.leanAngleRad = 0;
        moto.downedTimerSec = 0;
        moto.collisionCooldownSec = 0;
        moto.riderSlideOffset = 0;
        moto.skidVx = 0;
        moto.skidVz = 0;
        moto.speedMps = clamp(maxUrbanMps * 0.9, 8.5, 14.5);
      }
    }
  }

  return collisionEvents;
}

interface MotorcycleMeshRig {
  root: THREE.Group;
  leanPivot: THREE.Group;
  riderGroup: THREE.Group;
  frontWheel: THREE.Mesh;
  rearWheel: THREE.Mesh;
  tailLightMat: THREE.MeshStandardMaterial;
}

export interface ForwardMotorcyclesVisualsController {
  group: THREE.Group;
  update: (actors: readonly ForwardMotorcycleActor[]) => void;
  dispose: () => void;
}

/**
 * Construye las mallas 3D compuestas (10 partes) para los motociclistas de ida,
 * compartiendo geometrías base para mínimo impacto en memoria y draw calls.
 */
export function createForwardMotorcyclesVisuals3D(args: {
  roadPath: CurvedRoadPath;
  actors: readonly ForwardMotorcycleActor[];
}): ForwardMotorcyclesVisualsController {
  const group = new THREE.Group();
  group.name = 'forward_motorcycles_3d';

  const disposableGeos: THREE.BufferGeometry[] = [];
  const disposableMats: THREE.Material[] = [];

  const regGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposableGeos.push(g);
    return g;
  };
  const regMat = <T extends THREE.Material>(m: T): T => {
    disposableMats.push(m);
    return m;
  };

  if (args.actors.length === 0) {
    return {
      group,
      update: () => {},
      dispose: () => {},
    };
  }

  // Geometrías compartidas (proporciones reales ~2.05 m largo, ruedas Ø 0.58 m)
  const tireGeo = regGeo(new THREE.TorusGeometry(0.27, 0.065, 10, 20));
  tireGeo.rotateY(Math.PI / 2);
  const rimHubGeo = regGeo(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 10));
  rimHubGeo.rotateZ(Math.PI / 2);

  const frameTankGeo = regGeo(new THREE.BoxGeometry(0.32, 0.34, 0.96));
  const engineBlockGeo = regGeo(new THREE.BoxGeometry(0.28, 0.28, 0.42));
  const seatTailGeo = regGeo(new THREE.BoxGeometry(0.28, 0.14, 0.72));
  const forkGeo = regGeo(new THREE.CylinderGeometry(0.035, 0.03, 0.68, 8));
  const handlebarGeo = regGeo(new THREE.CylinderGeometry(0.022, 0.022, 0.68, 8));
  handlebarGeo.rotateZ(Math.PI / 2);
  const headlightGeo = regGeo(new THREE.CylinderGeometry(0.085, 0.075, 0.09, 12));
  headlightGeo.rotateX(Math.PI / 2);
  const tailLightGeo = regGeo(new THREE.BoxGeometry(0.16, 0.065, 0.05));

  // Conductor + casco con visor
  const torsoGeo = regGeo(new THREE.CapsuleGeometry(0.16, 0.40, 6, 10));
  const legGeo = regGeo(new THREE.CapsuleGeometry(0.075, 0.36, 4, 8));
  const armGeo = regGeo(new THREE.CapsuleGeometry(0.055, 0.32, 4, 8));
  const helmetGeo = regGeo(new THREE.SphereGeometry(0.155, 14, 12));
  const visorGeo = regGeo(new THREE.BoxGeometry(0.21, 0.085, 0.12));
  const shadowDiscGeo = regGeo(new THREE.PlaneGeometry(0.95, 2.25));
  shadowDiscGeo.rotateX(-Math.PI / 2);

  // Materiales compartidos
  const tireMat = regMat(
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.88, metalness: 0.08 }),
  );
  const metalMat = regMat(
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.32, metalness: 0.78 }),
  );
  const seatMat = regMat(
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.76, metalness: 0.06 }),
  );
  const pantsMat = regMat(
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.82, metalness: 0.05 }),
  );
  const visorMat = regMat(
    new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.12, metalness: 0.88 }),
  );
  const headlightMat = regMat(
    new THREE.MeshStandardMaterial({
      color: 0xfef9c3,
      emissive: 0xfef08a,
      emissiveIntensity: 1.55,
      roughness: 0.2,
    }),
  );
  const shadowMat = regMat(
    new THREE.MeshBasicMaterial({
      color: 0x04070e,
      transparent: true,
      opacity: 0.44,
      depthWrite: false,
    }),
  );

  const rigs: MotorcycleMeshRig[] = args.actors.map(actor => {
    const root = new THREE.Group();
    root.name = actor.id;

    const shadow = new THREE.Mesh(shadowDiscGeo, shadowMat);
    shadow.position.set(0, 0.016, 0);
    root.add(shadow);

    const leanPivot = new THREE.Group();
    root.add(leanPivot);

    const bikeMat = regMat(
      new THREE.MeshStandardMaterial({
        color: actor.bikeColorHex,
        roughness: 0.28,
        metalness: 0.56,
      }),
    );
    const jacketMat = regMat(
      new THREE.MeshStandardMaterial({
        color: actor.jacketColorHex,
        roughness: 0.72,
        metalness: 0.08,
      }),
    );
    const helmetMat = regMat(
      new THREE.MeshStandardMaterial({
        color: actor.helmetColorHex,
        roughness: 0.18,
        metalness: 0.38,
      }),
    );
    const tailLightMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xdc2626,
        emissive: 0xef4444,
        emissiveIntensity: 0.85,
        roughness: 0.3,
      }),
    );

    // 1. Ruedas delantera (+Z) y trasera (-Z) con maza metálica
    const frontWheel = new THREE.Mesh(tireGeo, tireMat);
    frontWheel.position.set(0, 0.33, 0.72);
    const frontHub = new THREE.Mesh(rimHubGeo, metalMat);
    frontWheel.add(frontHub);

    const rearWheel = new THREE.Mesh(tireGeo, tireMat);
    rearWheel.position.set(0, 0.33, -0.68);
    const rearHub = new THREE.Mesh(rimHubGeo, metalMat);
    rearWheel.add(rearHub);
    leanPivot.add(frontWheel, rearWheel);

    // 2. Motor metálico + tanque/carenado principal + colín/asiento
    const engineMesh = new THREE.Mesh(engineBlockGeo, metalMat);
    engineMesh.position.set(0, 0.44, 0.02);

    const tankMesh = new THREE.Mesh(frameTankGeo, bikeMat);
    tankMesh.position.set(0, 0.72, 0.14);
    tankMesh.rotation.x = -0.14;

    const seatMesh = new THREE.Mesh(seatTailGeo, seatMat);
    seatMesh.position.set(0, 0.77, -0.44);
    seatMesh.rotation.x = 0.10;

    // 3. Horquilla delantera, manillar, faro LED y óptica trasera roja
    const forkLeft = new THREE.Mesh(forkGeo, metalMat);
    forkLeft.position.set(0.11, 0.62, 0.58);
    forkLeft.rotation.x = -0.34;
    const forkRight = new THREE.Mesh(forkGeo, metalMat);
    forkRight.position.set(-0.11, 0.62, 0.58);
    forkRight.rotation.x = -0.34;

    const handlebar = new THREE.Mesh(handlebarGeo, metalMat);
    handlebar.position.set(0, 0.98, 0.44);

    const headlight = new THREE.Mesh(headlightGeo, headlightMat);
    headlight.position.set(0, 0.88, 0.66);

    const tailLight = new THREE.Mesh(tailLightGeo, tailLightMat);
    tailLight.position.set(0, 0.82, -0.84);

    // 4. Motociclista con torso inclinado hacia el manillar, piernas, brazos y casco con visor
    const torso = new THREE.Mesh(torsoGeo, jacketMat);
    torso.position.set(0, 1.14, -0.16);
    torso.rotation.x = 0.28;

    const legL = new THREE.Mesh(legGeo, pantsMat);
    legL.position.set(0.19, 0.68, -0.12);
    legL.rotation.x = -0.55;
    const legR = new THREE.Mesh(legGeo, pantsMat);
    legR.position.set(-0.19, 0.68, -0.12);
    legR.rotation.x = -0.55;

    const armL = new THREE.Mesh(armGeo, jacketMat);
    armL.position.set(0.22, 1.08, 0.14);
    armL.rotation.x = 1.05;
    armL.rotation.z = -0.16;
    const armR = new THREE.Mesh(armGeo, jacketMat);
    armR.position.set(-0.22, 1.08, 0.14);
    armR.rotation.x = 1.05;
    armR.rotation.z = 0.16;

    const helmet = new THREE.Mesh(helmetGeo, helmetMat);
    helmet.position.set(0, 1.48, -0.04);
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 1.48, 0.08);

    leanPivot.add(
      engineMesh,
      tankMesh,
      seatMesh,
      forkLeft,
      forkRight,
      handlebar,
      headlight,
      tailLight,
    );

    // Grupo independiente para el motociclista: acompaña la inclinación normal en marcha,
    // pero si sufre un impacto se desplaza a un costado en postura sentada de resguardo.
    const riderGroup = new THREE.Group();
    riderGroup.add(torso, legL, legR, armL, armR, helmet, visor);
    root.add(riderGroup);

    group.add(root);

    return {
      root,
      leanPivot,
      riderGroup,
      frontWheel,
      rearWheel,
      tailLightMat,
    };
  });

  const update = (actors: readonly ForwardMotorcycleActor[]) => {
    const count = Math.min(rigs.length, actors.length);
    const blinkOn = Math.floor(Date.now() / 220) % 2 === 0;
    for (let i = 0; i < count; i++) {
      const actor = actors[i];
      const rig = rigs[i];
      const worldPt = args.roadPath.world(actor.z, actor.x);
      rig.root.position.set(worldPt.x, 0, worldPt.z);
      rig.root.rotation.set(0, worldPt.yaw, 0);

      const fallProgress = clamp(Math.abs(actor.riderSlideOffset) / 0.96, 0, 1);
      rig.leanPivot.rotation.z = actor.leanAngleRad;
      rig.leanPivot.position.y = -0.18 * fallProgress;

      if (actor.downedTimerSec > 0 || fallProgress > 0.03) {
        rig.riderGroup.position.set(
          actor.riderSlideOffset,
          -0.44 * fallProgress,
          -0.34 * fallProgress,
        );
        rig.riderGroup.rotation.set(
          -0.25 * fallProgress,
          0,
          actor.fallSide * 0.36 * fallProgress,
        );
      } else {
        rig.riderGroup.position.set(0, 0, 0);
        rig.riderGroup.rotation.set(0, 0, actor.leanAngleRad);
      }

      rig.frontWheel.rotation.x = actor.wheelAngleRad;
      rig.rearWheel.rotation.x = actor.wheelAngleRad;
      rig.tailLightMat.emissiveIntensity =
        actor.downedTimerSec > 0
          ? blinkOn
            ? 3.2
            : 0.4
          : actor.braking
            ? 2.6
            : 0.75;
    }
  };

  update(args.actors);

  return {
    group,
    update,
    dispose: () => {
      for (const g of disposableGeos) g.dispose();
      for (const m of disposableMats) m.dispose();
    },
  };
}
