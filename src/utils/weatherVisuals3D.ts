import * as THREE from 'three';
import { WEATHER_CONFIG, getWaterZones } from './weatherDynamics.ts';
import type { WeatherMode } from './weatherDynamics.ts';
import type { CurvedRoadPath } from './curvedRoadPath.ts';

export interface TriggeredLightningStrike {
  proximity01: number;
  boltSeed: number;
  offsetX: number;
  offsetZ: number;
}

export interface LightningStrikeState {
  cooldownSec: number;
  activeAgeSec: number;
  activeDurationSec: number;
  peakIntensity: number;
  strikeCount: number;
  seed: number;
}

export interface WeatherVisualStepResult {
  flashIntensity: number;
  boltOpacity: number;
  triggeredStrike: TriggeredLightningStrike | null;
}

function nextHash01(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

export function createLightningStrikeState(initialSeed = 1): LightningStrikeState {
  return {
    cooldownSec: 1.85,
    activeAgeSec: -1,
    activeDurationSec: 0.42,
    peakIntensity: 0,
    strikeCount: 0,
    seed: initialSeed,
  };
}

/**
 * Planificador determinista de centellas y relámpagos para el modo Tormenta (`storm`).
 * Produce pulsos múltiples realistas (descarga líder + retorno + resplandor en nubes).
 */
export function stepLightningStrikeState(
  state: LightningStrikeState,
  mode: WeatherMode,
  dt: number,
): WeatherVisualStepResult {
  if (mode !== 'storm') {
    state.cooldownSec = 1.85;
    state.activeAgeSec = -1;
    state.peakIntensity = 0;
    return { flashIntensity: 0, boltOpacity: 0, triggeredStrike: null };
  }

  const safeDt = Math.max(0, Math.min(0.25, dt));
  let triggeredStrike: TriggeredLightningStrike | null = null;

  if (state.activeAgeSec >= 0) {
    state.activeAgeSec += safeDt;
    if (state.activeAgeSec >= state.activeDurationSec) {
      state.activeAgeSec = -1;
    }
  } else {
    state.cooldownSec -= safeDt;
    if (state.cooldownSec <= 0) {
      state.strikeCount += 1;
      state.seed += 17.37;
      const r1 = nextHash01(state.seed);
      const r2 = nextHash01(state.seed + 5.13);
      const r3 = nextHash01(state.seed + 11.89);

      const proximity01 = 0.52 + r1 * 0.48;
      state.activeAgeSec = 0;
      state.activeDurationSec = 0.48 + r2 * 0.16;
      state.peakIntensity = 0.80 + proximity01 * 0.20;
      // Siguiente descarga eléctrica entre 4.2 s y 8.4 s
      state.cooldownSec = 4.2 + r3 * 4.2;

      triggeredStrike = {
        proximity01,
        boltSeed: state.seed,
        offsetX: (r2 - 0.5) * 96,
        offsetZ: 125 + (1 - proximity01) * 115,
      };
    }
  }

  if (state.activeAgeSec < 0) {
    return { flashIntensity: 0, boltOpacity: 0, triggeredStrike };
  }

  const t = state.activeAgeSec;
  // Pulso inicial inmediato en t=0 + segundo pulso de descarga de retorno en t=0.16s + luminiscencia de nube
  const pulse1 = Math.exp(-Math.pow(t / 0.065, 2));
  const pulse2 = Math.exp(-Math.pow((t - 0.16) / 0.055, 2)) * 0.92;
  const cloudAfterglow = t > 0.14 ? Math.exp(-(t - 0.14) * 6.8) * 0.42 : 0;

  const flashIntensity = Math.min(1, Math.max(pulse1, pulse2, cloudAfterglow) * state.peakIntensity);
  const boltOpacity = Math.min(1, Math.max(pulse1, pulse2 * 1.05) * state.peakIntensity);

  return {
    flashIntensity,
    boltOpacity,
    triggeredStrike,
  };
}

/**
 * Genera los segmentos 3D quebrados de una centella bifurcada (canal principal + ramificaciones).
 */
export function generateForkedLightningSegments(
  seed: number,
  originX: number,
  topY: number,
  groundY: number,
  originZ: number,
): { corePositions: Float32Array; branchPositions: Float32Array } {
  const mainSteps = 18;
  const coreVerts: number[] = [];
  const branchVerts: number[] = [];

  const spine: Array<{ x: number; y: number; z: number }> = [];
  let curX = originX;
  let curZ = originZ;

  for (let i = 0; i <= mainSteps; i++) {
    const u = i / mainSteps;
    const y = THREE.MathUtils.lerp(topY, groundY, u);
    if (i > 0) {
      const jitterScale = (1 - u * 0.35) * 4.8;
      curX += (nextHash01(seed + i * 3.71) - 0.48) * jitterScale;
      curZ += (nextHash01(seed + i * 7.19) - 0.5) * jitterScale * 0.45;
    }
    spine.push({ x: curX, y, z: curZ });
    if (i > 0) {
      const prev = spine[i - 1];
      coreVerts.push(prev.x, prev.y, prev.z, curX, y, curZ);
      // Halo paralelo ligeramente desplazado para dar grosor visual al plasma en WebGL
      coreVerts.push(prev.x + 0.24, prev.y, prev.z, curX + 0.24, y, curZ);
      coreVerts.push(prev.x - 0.24, prev.y, prev.z, curX - 0.24, y, curZ);
    }
  }

  // 4 ramificaciones secundarias (centellas laterales en el cielo)
  const branchIndices = [3, 6, 9, 12];
  branchIndices.forEach((idx, bIdx) => {
    const anchor = spine[idx];
    if (!anchor) return;
    const dirSign = bIdx % 2 === 0 ? 1 : -1;
    let bx = anchor.x;
    let by = anchor.y;
    let bz = anchor.z;
    const subSteps = 6;
    for (let s = 1; s <= subSteps; s++) {
      const nx = bx + dirSign * (2.2 + nextHash01(seed + bIdx * 19.3 + s * 2.9) * 3.8);
      const ny = by - (5.2 + nextHash01(seed + bIdx * 13.1 + s * 4.3) * 4.2);
      const nz = bz + (nextHash01(seed + bIdx * 23.7 + s * 5.1) - 0.5) * 3.0;
      branchVerts.push(bx, by, bz, nx, ny, nz);
      bx = nx;
      by = ny;
      bz = nz;
    }
  });

  return {
    corePositions: new Float32Array(coreVerts),
    branchPositions: new Float32Array(branchVerts),
  };
}

/** Lluvia, encharcamientos, centellas bifurcadas 3D y relámpagos en modo Tormenta. */
export function createWeatherVisuals3D(
  scene: THREE.Scene,
  distance: number,
  profile?: string,
  roadPath?: CurvedRoadPath,
) {
  const count = 350;
  const positions = new Float32Array(count * 6);
  const rainGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  const rainMaterial = new THREE.LineBasicMaterial({
    color: '#c9e3ed',
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
    toneMapped: false,
  });
  const rain = new THREE.LineSegments(rainGeometry, rainMaterial);
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);

  const drop = Array.from({ length: count }, (_, i) => ({
    x: Math.sin(i * 12.9898) * 23,
    y: 2 + (((i * 19.83) % 14) + 14) % 14,
    z: Math.cos(i * 4.445) * 29,
    speed: 16 + (i % 7) * 1.8,
  }));

  // Geometría dinámica para centellas 3D (núcleo incandescente + ramificaciones eléctricas)
  const initialBolt = generateForkedLightningSegments(1, 0, 148, 6, 165);
  const boltCoreGeo = new THREE.BufferGeometry();
  boltCoreGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(initialBolt.corePositions, 3).setUsage(THREE.DynamicDrawUsage),
  );
  const boltCoreMat = new THREE.LineBasicMaterial({
    color: '#f8fafc',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
  });
  const boltCoreLines = new THREE.LineSegments(boltCoreGeo, boltCoreMat);
  boltCoreLines.frustumCulled = false;
  boltCoreLines.visible = false;
  boltCoreLines.renderOrder = 8;

  const boltBranchGeo = new THREE.BufferGeometry();
  boltBranchGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(initialBolt.branchPositions, 3).setUsage(THREE.DynamicDrawUsage),
  );
  const boltBranchMat = new THREE.LineBasicMaterial({
    color: '#93c5fd',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
  });
  const boltBranchLines = new THREE.LineSegments(boltBranchGeo, boltBranchMat);
  boltBranchLines.frustumCulled = false;
  boltBranchLines.visible = false;
  boltBranchLines.renderOrder = 7;

  const lightningGroup = new THREE.Group();
  lightningGroup.name = 'tormenta_centellas_3d';
  lightningGroup.add(boltCoreLines, boltBranchLines);
  scene.add(lightningGroup);

  const strikeState = createLightningStrikeState(3.14);

  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 256;
  const ctx = cv.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 256, 256);
    const gradient = ctx.createRadialGradient(128, 128, 3, 128, 128, 126);
    gradient.addColorStop(0, 'rgba(91,128,147,.80)');
    gradient.addColorStop(0.42, 'rgba(68,103,124,.48)');
    gradient.addColorStop(0.8, 'rgba(83,109,122,.22)');
    gradient.addColorStop(1, 'rgba(92,118,131,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(190,214,223,.18)';
    ctx.lineWidth = 2;
    for (let r = 27; r < 110; r += 31) {
      ctx.beginPath();
      ctx.ellipse(128, 128, r, r * 0.7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  const waterTex = new THREE.CanvasTexture(cv);
  waterTex.colorSpace = THREE.SRGBColorSpace;
  const waterGeo = new THREE.PlaneGeometry(2, 2);
  const waterMaterial = new THREE.MeshPhysicalMaterial({
    map: waterTex,
    color: '#93c5fd',
    transparent: true,
    depthWrite: false,
    opacity: 0.72,
    roughness: 0.06,
    metalness: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.4,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const water = new THREE.Group();
  water.name = 'simulacion_raudales_y_charcos';
  const patches: THREE.Mesh[] = [];
  for (let i = 0; i < 12; i++) {
    const mesh = new THREE.Mesh(waterGeo, waterMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.05;
    mesh.visible = false;
    water.add(mesh);
    patches.push(mesh);
  }
  scene.add(water);

  let previousMode: WeatherMode | undefined;
  const changeMode = (mode: WeatherMode) => {
    if (previousMode === mode) return;
    previousMode = mode;
    const zones = getWaterZones(mode, distance, profile);
    patches.forEach((patch, i) => {
      const zone = zones[i];
      patch.visible = Boolean(zone);
      if (!zone) return;
      const actual = roadPath?.world(zone.z, zone.x);
      patch.position.set(actual?.x ?? zone.x, 0.055, actual?.z ?? zone.z);
      patch.rotation.y = actual?.yaw ?? 0;
      patch.scale.set(zone.radiusX * 1.7, zone.radiusZ * 1.8, 1);
    });
  };

  const update = (
    mode: WeatherMode,
    dt: number,
    focusX: number,
    focusZ: number,
  ): WeatherVisualStepResult => {
    changeMode(mode);
    const cfg = WEATHER_CONFIG[mode];
    rain.visible = cfg.rainIntensity > 0;

    if (rain.visible) {
      rain.position.set(focusX, 0, focusZ + 12);
      rainMaterial.opacity = 0.24 + cfg.rainIntensity * 0.18;
      const vy = cfg.rainIntensity;
      for (let i = 0; i < count; i++) {
        const d = drop[i];
        d.y -= dt * d.speed * (0.6 + vy * 0.8);
        d.x -= dt * (vy * 2.3);
        if (d.y < 0.15) {
          d.y += 14;
          d.x = Math.sin(i * 1.73 + focusZ * 0.002) * 22;
        }
        if (d.x < -24) d.x += 48;
        const n = i * 6;
        positions[n] = d.x;
        positions[n + 1] = d.y;
        positions[n + 2] = d.z;
        positions[n + 3] = d.x + 0.19 * vy;
        positions[n + 4] = d.y + 0.43 + vy * 0.42;
        positions[n + 5] = d.z + 0.04;
      }
      rainGeometry.attributes.position.needsUpdate = true;
    }

    const step = stepLightningStrikeState(strikeState, mode, dt);
    if (step.triggeredStrike) {
      const rebuilt = generateForkedLightningSegments(
        step.triggeredStrike.boltSeed,
        focusX + step.triggeredStrike.offsetX,
        148,
        5,
        focusZ + step.triggeredStrike.offsetZ,
      );
      const coreAttr = boltCoreGeo.getAttribute('position') as THREE.BufferAttribute;
      if (coreAttr.array.length === rebuilt.corePositions.length) {
        (coreAttr.array as Float32Array).set(rebuilt.corePositions);
        coreAttr.needsUpdate = true;
      }
      const branchAttr = boltBranchGeo.getAttribute('position') as THREE.BufferAttribute;
      if (branchAttr.array.length === rebuilt.branchPositions.length) {
        (branchAttr.array as Float32Array).set(rebuilt.branchPositions);
        branchAttr.needsUpdate = true;
      }
    }

    const showBolt = step.boltOpacity > 0.02;
    boltCoreLines.visible = showBolt;
    boltBranchLines.visible = showBolt;
    if (showBolt) {
      boltCoreMat.opacity = step.boltOpacity;
      boltBranchMat.opacity = step.boltOpacity * 0.76;
    }

    return step;
  };

  return {
    update,
    dispose() {
      scene.remove(rain, water, lightningGroup);
      rainGeometry.dispose();
      rainMaterial.dispose();
      boltCoreGeo.dispose();
      boltCoreMat.dispose();
      boltBranchGeo.dispose();
      boltBranchMat.dispose();
      waterGeo.dispose();
      waterMaterial.dispose();
      waterTex.dispose();
    },
  };
}
