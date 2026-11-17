import * as THREE from 'three';
import type { WeatherMode } from './weatherDynamics.ts';

/**
 * DATACAR ARENA V14 — Efectos sutiles de velocidad, aerodinámica y neumáticos (0 GC)
 * - Estelas periféricas sutiles a alta velocidad (>= 105 km/h), sin tapar el centro de la pista ni generar desenfoque global.
 * - Humo de caucho o spray de agua desde las ruedas traseras bajo deslizamiento / frenado brusco.
 */

export interface SpeedStreakParticle {
  sideSign: -1 | 1;
  radialX: number;
  radialY: number;
  zOffset: number;
  speedMult: number;
  lengthScale: number;
}

export interface TirePlumeParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  maxAge: number;
  scale: number;
  isWetSpray: boolean;
}

export function createSpeedStreakPool(count = 32): SpeedStreakParticle[] {
  const pool: SpeedStreakParticle[] = [];
  let s = 1402026;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const sideSign: -1 | 1 = i % 2 === 0 ? -1 : 1;
    pool.push({
      sideSign,
      // Mantener siempre las estelas en los bordes laterales (|x| >= 2.9m), dejando despejada la vista central
      radialX: sideSign * (2.9 + rand() * 5.2),
      radialY: 0.45 + rand() * 3.1,
      zOffset: -4 + rand() * 26,
      speedMult: 0.85 + rand() * 0.45,
      lengthScale: 0.7 + rand() * 0.8,
    });
  }
  return pool;
}

export function stepSpeedStreakPool(
  pool: SpeedStreakParticle[],
  speedMps: number,
  dt: number,
): void {
  const clampedDt = Math.min(0.05, Math.max(0, dt));
  const flowSpeed = Math.max(12, speedMps * 1.15);
  for (let i = 0; i < pool.length; i++) {
    const p = pool[i];
    p.zOffset -= flowSpeed * p.speedMult * clampedDt;
    if (p.zOffset < -5) {
      p.zOffset += 27;
    }
  }
}

export function createTirePlumePool(count = 48): TirePlumeParticle[] {
  const pool: TirePlumeParticle[] = [];
  for (let i = 0; i < count; i++) {
    pool.push({
      active: false,
      x: 0,
      y: -10,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      age: 0,
      maxAge: 0.6,
      scale: 0.35,
      isWetSpray: false,
    });
  }
  return pool;
}

export interface StepTirePlumeArgs {
  pool: TirePlumeParticle[];
  cursor: number;
  rearLeftX: number;
  rearLeftZ: number;
  rearRightX: number;
  rearRightZ: number;
  carSpeedMps: number;
  slipIntensity01: number;
  wetRoad: boolean;
  dt: number;
  spawnBudget: number;
}

export function stepTirePlumePool(args: StepTirePlumeArgs): number {
  const {
    pool,
    rearLeftX,
    rearLeftZ,
    rearRightX,
    rearRightZ,
    carSpeedMps,
    slipIntensity01,
    wetRoad,
    dt,
    spawnBudget,
  } = args;
  const clampedDt = Math.min(0.05, Math.max(0, dt));
  let cursor = args.cursor % Math.max(1, pool.length);

  for (let i = 0; i < pool.length; i++) {
    const p = pool[i];
    if (!p.active) continue;
    p.age += clampedDt;
    if (p.age >= p.maxAge) {
      p.active = false;
      continue;
    }
    p.x += p.vx * clampedDt;
    p.y += p.vy * clampedDt;
    p.z += p.vz * clampedDt;
    p.vy = p.isWetSpray ? p.vy - 1.9 * clampedDt : Math.min(1.4, p.vy + 0.45 * clampedDt);
    p.scale += (p.isWetSpray ? 0.55 : 0.85) * clampedDt;
  }

  const shouldEmit =
    spawnBudget > 0 &&
    ((slipIntensity01 > 0.16 && carSpeedMps > 4.0) || (wetRoad && carSpeedMps > 16.0));
  if (!shouldEmit) return cursor;

  const emitCount = Math.min(spawnBudget, slipIntensity01 > 0.45 ? 4 : 2);
  for (let n = 0; n < emitCount; n++) {
    const p = pool[cursor];
    const isLeft = (cursor & 1) === 0;
    const jitter = ((cursor % 7) - 3) * 0.045;
    p.active = true;
    p.x = (isLeft ? rearLeftX : rearRightX) + jitter;
    p.y = 0.14;
    p.z = (isLeft ? rearLeftZ : rearRightZ) + jitter;
    p.vx = (isLeft ? -0.35 : 0.35) + jitter * 2.2;
    p.vy = wetRoad ? 0.75 + (cursor % 3) * 0.22 : 0.38 + (cursor % 3) * 0.14;
    p.vz = -Math.max(1.0, carSpeedMps * 0.18);
    p.age = 0;
    p.maxAge = wetRoad ? 0.42 : 0.65;
    p.scale = wetRoad ? 0.26 : 0.32;
    p.isWetSpray = wetRoad;
    cursor = (cursor + 1) % pool.length;
  }
  return cursor;
}

export interface SpeedAndTireEffectsController {
  group: THREE.Group;
  update: (args: {
    carX: number;
    carY: number;
    carZ: number;
    carYaw: number;
    carSpeedMps: number;
    slipIntensity01: number;
    isBrakingHard: boolean;
    weatherMode: WeatherMode;
    camera: THREE.Camera;
    enabled: boolean;
    particleDensity: number;
    dt: number;
  }) => void;
  dispose: () => void;
}

export function createSpeedAndTireEffectsController(): SpeedAndTireEffectsController {
  const group = new THREE.Group();
  group.name = 'v14_speed_and_tire_effects';

  // 1. Estelas periféricas sutiles de velocidad
  const streakCount = 32;
  const streakPool = createSpeedStreakPool(streakCount);
  const streakPositions = new Float32Array(streakCount * 6);
  const streakGeo = new THREE.BufferGeometry();
  streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPositions, 3));
  const streakMat = new THREE.LineBasicMaterial({
    color: '#ffe8bf',
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const streakLines = new THREE.LineSegments(streakGeo, streakMat);
  streakLines.name = 'v14_peripheral_speed_streaks';
  streakLines.frustumCulled = false;
  group.add(streakLines);

  // 2. Nube acotada de humo/spray tras neumáticos (InstancedMesh liviano 0 GC)
  const plumeCount = 48;
  const plumePool = createTirePlumePool(plumeCount);
  let plumeCursor = 0;
  const plumeGeo = new THREE.IcosahedronGeometry(0.32, 1);
  const plumeMat = new THREE.MeshBasicMaterial({
    color: '#d8dde3',
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
  });
  const plumeInstanced = new THREE.InstancedMesh(plumeGeo, plumeMat, plumeCount);
  plumeInstanced.name = 'v14_tire_smoke_and_spray';
  plumeInstanced.frustumCulled = false;
  plumeInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  plumeInstanced.count = 0;
  group.add(plumeInstanced);

  const _mat = new THREE.Matrix4();
  const _pos = new THREE.Vector3();
  const _quat = new THREE.Quaternion();
  const _scale = new THREE.Vector3();
  const _camForward = new THREE.Vector3();
  const _camRight = new THREE.Vector3();
  const _camUp = new THREE.Vector3();

  return {
    group,
    update: ({
      carX,
      carY,
      carZ,
      carYaw,
      carSpeedMps,
      slipIntensity01,
      isBrakingHard,
      weatherMode,
      camera,
      enabled,
      particleDensity,
      dt,
    }) => {
      if (!enabled || particleDensity <= 0.05) {
        streakLines.visible = false;
        plumeInstanced.count = 0;
        return;
      }

      const speedKmh = carSpeedMps * 3.6;
      const streakAlpha = THREE.MathUtils.clamp((speedKmh - 105) / 85, 0, 1);
      if (streakAlpha > 0.02) {
        streakLines.visible = true;
        stepSpeedStreakPool(streakPool, carSpeedMps, dt);
        camera.getWorldDirection(_camForward);
        _camUp.set(0, 1, 0);
        _camRight.crossVectors(_camForward, _camUp).normalize();
        _camUp.crossVectors(_camRight, _camForward).normalize();

        const activeStreaks = Math.max(4, Math.floor(streakCount * particleDensity));
        const streakLen = 0.9 + streakAlpha * 2.1;
        const posAttr = streakGeo.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < streakCount; i++) {
          const p = streakPool[i];
          if (i >= activeStreaks) {
            posAttr.setXYZ(i * 2, 0, -999, 0);
            posAttr.setXYZ(i * 2 + 1, 0, -999, 0);
            continue;
          }
          const baseZ = 3.2 + p.zOffset;
          const x0 =
            camera.position.x +
            _camForward.x * baseZ +
            _camRight.x * p.radialX +
            _camUp.x * (p.radialY - 1.2);
          const y0 =
            camera.position.y +
            _camForward.y * baseZ +
            _camRight.y * p.radialX +
            _camUp.y * (p.radialY - 1.2);
          const z0 =
            camera.position.z +
            _camForward.z * baseZ +
            _camRight.z * p.radialX +
            _camUp.z * (p.radialY - 1.2);
          const len = streakLen * p.lengthScale;
          posAttr.setXYZ(i * 2, x0, y0, z0);
          posAttr.setXYZ(
            i * 2 + 1,
            x0 - _camForward.x * len,
            y0 - _camForward.y * len,
            z0 - _camForward.z * len,
          );
        }
        posAttr.needsUpdate = true;
        streakMat.opacity = streakAlpha * 0.24 * particleDensity;
      } else {
        streakLines.visible = false;
      }

      // Spray / humo trasero
      const sinYaw = Math.sin(carYaw);
      const cosYaw = Math.cos(carYaw);
      const rearDist = 1.45;
      const trackHalf = 0.82;
      const rearCenterX = carX - sinYaw * rearDist;
      const rearCenterZ = carZ - cosYaw * rearDist;
      const rearLeftX = rearCenterX - cosYaw * trackHalf;
      const rearLeftZ = rearCenterZ + sinYaw * trackHalf;
      const rearRightX = rearCenterX + cosYaw * trackHalf;
      const rearRightZ = rearCenterZ - sinYaw * trackHalf;

      const wetRoad = weatherMode === 'rain' || weatherMode === 'storm' || weatherMode === 'flood';
      const combinedSlip = Math.max(slipIntensity01, isBrakingHard && carSpeedMps > 6 ? 0.55 : 0);
      const spawnBudget = Math.max(0, Math.round(4 * particleDensity));

      plumeCursor = stepTirePlumePool({
        pool: plumePool,
        cursor: plumeCursor,
        rearLeftX,
        rearLeftZ,
        rearRightX,
        rearRightZ,
        carSpeedMps,
        slipIntensity01: combinedSlip,
        wetRoad,
        dt,
        spawnBudget,
      });

      plumeMat.color.set(wetRoad ? '#c7d8e6' : '#cfd4da');
      plumeMat.opacity = wetRoad ? 0.24 : 0.22;

      let activeIdx = 0;
      for (let i = 0; i < plumeCount; i++) {
        const p = plumePool[i];
        if (!p.active) continue;
        const lifeT = THREE.MathUtils.clamp(p.age / p.maxAge, 0, 1);
        const fadeScale = p.scale * (1.0 - lifeT * 0.45);
        _pos.set(p.x, carY + p.y, p.z);
        _scale.setScalar(Math.max(0.05, fadeScale));
        _mat.compose(_pos, _quat, _scale);
        plumeInstanced.setMatrixAt(activeIdx++, _mat);
      }
      plumeInstanced.count = activeIdx;
      if (activeIdx > 0) {
        plumeInstanced.instanceMatrix.needsUpdate = true;
      }
    },
    dispose: () => {
      streakGeo.dispose();
      streakMat.dispose();
      plumeGeo.dispose();
      plumeMat.dispose();
    },
  };
}
