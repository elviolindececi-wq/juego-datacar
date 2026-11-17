import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { CorruptRivalArchetype } from './wenoBankMissions';
import {
  VILLAIN_CONVERTIBLE_1966_GLB_URL,
  VILLAIN_CONVERTIBLE_1966_PUBLIC_PATH,
  getCustomVehicleGlbUrl,
} from './vehicleModelRegistry';

export const CONVERTIBLE_1966_VILLAIN_PUBLIC_PATH = VILLAIN_CONVERTIBLE_1966_PUBLIC_PATH;
export const CONVERTIBLE_1966_VILLAIN_GLB_URL = VILLAIN_CONVERTIBLE_1966_GLB_URL;
export const PRESIDENTIAL_LIMOUSINE_GLB_URL = '/models/presidential-limousine.glb';

export const VILLAIN_GLB_CANDIDATE_URLS: readonly string[] = [
  CONVERTIBLE_1966_VILLAIN_GLB_URL,
  PRESIDENTIAL_LIMOUSINE_GLB_URL,
];

interface LoadedVillainGltfResult {
  gltf: GLTF;
  sourceUrl: string;
  isConvertible1966: boolean;
}

let sharedDracoLoader: DRACOLoader | null = null;
let cachedVillainGltfPromise: Promise<LoadedVillainGltfResult> | null = null;
let cachedVillainCustomUrl: string | undefined;

function getVillainGltfLoader(): GLTFLoader {
  const loader = new GLTFLoader();
  if (typeof window !== 'undefined') {
    if (!sharedDracoLoader) {
      sharedDracoLoader = new DRACOLoader();
      sharedDracoLoader.setDecoderPath('/draco/gltf/');
    }
    loader.setDRACOLoader(sharedDracoLoader);
  }
  return loader;
}

/**
 * Verifica la cabecera mágica binaria glTF 2.0 (`0x46546C67` = `"glTF"`) para evitar
 * errores de parseo cuando el servidor SPA devuelve `index.html` ante un `.glb` aún no copiado.
 */
export function isBinaryGlbBuffer(buffer: ArrayBuffer): boolean {
  if (!buffer || buffer.byteLength < 20) return false;
  const view = new DataView(buffer);
  return view.getUint32(0, true) === 0x46546c67;
}

async function fetchAndParseBinaryGlb(
  loader: GLTFLoader,
  url: string,
  maxRetries = 2,
  timeoutMs = 35000,
): Promise<GLTF | null> {
  for (let attempt = 1; attempt <= 1 + maxRetries; attempt++) {
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = globalThis.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (response.status === 404 || response.status === 410) {
        return null;
      }
      if (!response.ok) {
        if (attempt <= maxRetries && (response.status >= 500 || response.status === 429)) {
          await new Promise((r) => globalThis.setTimeout(r, 600 * attempt));
          continue;
        }
        return null;
      }
      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('text/html')) return null;
      const arrayBuffer = await response.arrayBuffer();
      if (!isBinaryGlbBuffer(arrayBuffer)) return null;
      const resourcePath = url.startsWith('blob:') ? '/' : '/models/';
      return await new Promise<GLTF>((resolve, reject) => {
        loader.parse(arrayBuffer, resourcePath, resolve, reject);
      });
    } catch {
      if ((timedOut || attempt <= maxRetries) && attempt <= maxRetries) {
        await new Promise((r) => globalThis.setTimeout(r, 600 * attempt));
        continue;
      }
      return null;
    } finally {
      globalThis.clearTimeout(timeoutId);
    }
  }
  return null;
}

function loadVillainVehicleGltf(): Promise<LoadedVillainGltfResult> {
  const customOverride = getCustomVehicleGlbUrl('corrupt-villain-convertible');
  if (cachedVillainGltfPromise && cachedVillainCustomUrl === customOverride) {
    return cachedVillainGltfPromise;
  }
  cachedVillainCustomUrl = customOverride;
  cachedVillainGltfPromise = (async (): Promise<LoadedVillainGltfResult> => {
    const loader = getVillainGltfLoader();
    const candidates: Array<{ url: string; isConvertible1966: boolean }> = [];
    if (customOverride) {
      candidates.push({ url: customOverride, isConvertible1966: true });
    }
    candidates.push(
      { url: CONVERTIBLE_1966_VILLAIN_GLB_URL, isConvertible1966: true },
      { url: PRESIDENTIAL_LIMOUSINE_GLB_URL, isConvertible1966: false },
    );

    for (const candidate of candidates) {
      const parsed = await fetchAndParseBinaryGlb(loader, candidate.url);
      if (parsed) {
        return {
          gltf: parsed,
          sourceUrl: candidate.url,
          isConvertible1966: candidate.isConvertible1966,
        };
      }
    }
    // No mantener promesas fallidas en caché permanente si hubo corte temporal de red
    cachedVillainGltfPromise = null;
    throw new Error('No se encontró un modelo .glb binario válido para el vehículo rival.');
  })();

  return cachedVillainGltfPromise;
}

export interface CorruptRivalVehicle3DOptions {
  envMap?: THREE.Texture | null;
}

export interface CorruptRivalVehicle3DHandle {
  archetype: CorruptRivalArchetype;
  group: THREE.Group;
  /** Avanza el vehículo corrupto por el carril VIP frente a la escalinata de Weno Bank */
  updateSync: (rivalProgress01: number, elapsedSec: number) => void;
  /** Fija temporalmente la pose mundial en avenida durante la cinemática previa (Toma 3) */
  setRoadPreviewPose: (x: number, z: number, yaw: number, elapsedSec?: number) => void;
  /** Restaura la jerarquía local del carril VIP de Weno Bank tras la Toma 3 */
  clearRoadPreviewPose: () => void;
  applyEnvMap: (envMap: THREE.Texture | null) => void;
  dispose: () => void;
}

interface BuiltUnitVehicle {
  root: THREE.Group;
  rollingWheels: THREE.Object3D[];
  speedStreakMats: THREE.MeshBasicMaterial[];
  strobeLeftMat: THREE.MeshBasicMaterial;
  strobeRightMat: THREE.MeshBasicMaterial;
  headLightBeamGroup: THREE.Group;
  wheelRadiusM: number;
}

export interface VillainWheelMaterials {
  tireMat: THREE.Material;
  whitewallMat: THREE.Material;
  redlinePinMat: THREE.Material;
  chromeMat: THREE.Material;
  spinnerGoldMat: THREE.Material;
  streakMat: THREE.MeshBasicMaterial;
}

export interface NormalizeAndRigVillainGlbOptions {
  isConvertible1966: boolean;
  targetLengthM: number;
  targetWidthM?: number;
  envMap?: THREE.Texture | null;
  fallbackMaterials?: {
    bodyPaintMat: THREE.Material;
    darkTintedGlassMat: THREE.Material;
    chromeMat: THREE.Material;
    headlampWhiteMat: THREE.Material;
    tailLightMat: THREE.Material;
    tireMat: THREE.Material;
  };
  wheelMaterials: VillainWheelMaterials;
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T;
}

export interface NormalizedVillainGlbRig {
  root: THREE.Group;
  rollingWheels: THREE.Object3D[];
  wheelRadiusM: number;
  lengthM: number;
  widthM: number;
  heightM: number;
  preservedTextureCount: number;
}

function buildSculptedShellGeometry(
  stations: number,
  ringPts: number,
  sampleRing: (u: number, theta: number) => [number, number, number],
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= stations; i++) {
    const u = i / stations;
    for (let j = 0; j <= ringPts; j++) {
      const theta = (j / ringPts) * Math.PI * 2;
      const [px, py, pz] = sampleRing(u, theta);
      positions.push(px, py, pz);
    }
  }
  const stride = ringPts + 1;
  for (let i = 0; i < stations; i++) {
    for (let j = 0; j < ringPts; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      indices.push(a, c, b, a, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createRoadBeamTexture(): THREE.Texture {
  if (typeof document === 'undefined') {
    const data = new Uint8Array([255, 255, 255, 190]);
    const tex = new THREE.DataTexture(data, 1, 1);
    tex.needsUpdate = true;
    return tex;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 128, 256);
    const grad = ctx.createLinearGradient(64, 256, 64, 0);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.85)');
    grad.addColorStop(0.32, 'rgba(245, 250, 255, 0.42)');
    grad.addColorStop(0.75, 'rgba(235, 246, 255, 0.10)');
    grad.addColorStop(1.0, 'rgba(235, 246, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(48, 256);
    ctx.lineTo(80, 256);
    ctx.lineTo(124, 0);
    ctx.lineTo(4, 0);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Construye una rueda 3D clásica Thunderbird 1966 de 6 piezas (neumático con tacos radiales,
 * banda blanca whitewall, sectores asimétricos redline, aro cromado, 10 rayos de alambre
 * cromados + mariposa knock-off de 3 orejas y estela cinética reactiva) para que el giro
 * sea inequívocamente visible incluso en modelos `.glb` unificados de Meshy AI.
 */
function createClassic1966SpinningWheelGroup(
  side: -1 | 1,
  wheelR: number,
  wheelW: number,
  mats: VillainWheelMaterials,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
): THREE.Group {
  const wheelPivot = new THREE.Group();
  wheelPivot.name = `classic_1966_spinning_wheel_${side < 0 ? 'L' : 'R'}`;

  const tireGeo = trackGeo(new THREE.CylinderGeometry(wheelR, wheelR, wheelW, 24));
  tireGeo.rotateZ(Math.PI * 0.5);
  const tireMesh = new THREE.Mesh(tireGeo, mats.tireMat);
  tireMesh.castShadow = true;
  wheelPivot.add(tireMesh);

  // 10 tacos radiales en la banda de rodadura para lectura clara de rotación a corta y media distancia
  const lugGeo = trackGeo(new THREE.BoxGeometry(wheelW * 0.92, wheelR * 0.075, wheelR * 0.14));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const lug = new THREE.Mesh(lugGeo, mats.tireMat);
    lug.position.set(0, Math.cos(a) * (wheelR * 0.985), Math.sin(a) * (wheelR * 0.985));
    lug.rotation.x = -a;
    wheelPivot.add(lug);
  }

  const outX = side * (wheelW * 0.5 + 0.008);

  // Banda blanca clásica 1966 (whitewall) sobre la cara exterior
  const whitewallGeo = trackGeo(new THREE.RingGeometry(wheelR * 0.64, wheelR * 0.84, 28));
  const whitewall = new THREE.Mesh(whitewallGeo, mats.whitewallMat);
  whitewall.rotation.y = side > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
  whitewall.position.x = outX;
  wheelPivot.add(whitewall);

  // Dos arcos asimétricos estilo Redline 1966 para percibir el giro desde ángulos lejanos
  for (const baseAngle of [0, Math.PI]) {
    const arcGeo = trackGeo(new THREE.RingGeometry(wheelR * 0.80, wheelR * 0.865, 12, 1, baseAngle, Math.PI * 0.42));
    const arcMesh = new THREE.Mesh(arcGeo, mats.redlinePinMat);
    arcMesh.rotation.y = side > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
    arcMesh.position.x = outX + side * 0.002;
    wheelPivot.add(arcMesh);
  }

  // Aro profundo cromado
  const rimDiskGeo = trackGeo(new THREE.CylinderGeometry(wheelR * 0.63, wheelR * 0.63, wheelW * 0.82, 20));
  rimDiskGeo.rotateZ(Math.PI * 0.5);
  const rimDisk = new THREE.Mesh(rimDiskGeo, mats.chromeMat);
  wheelPivot.add(rimDisk);

  // 10 rayos cromados estilo turbina Kelsey-Hayes 1966
  const spokeGeo = trackGeo(new THREE.BoxGeometry(0.022, wheelR * 1.12, 0.032));
  for (let s = 0; s < 5; s++) {
    const spoke = new THREE.Mesh(spokeGeo, mats.chromeMat);
    spoke.position.x = outX + side * 0.006;
    spoke.rotation.x = (s / 5) * Math.PI;
    wheelPivot.add(spoke);
  }

  // Taza central + mariposa knock-off de 3 orejas giratoria
  const hubConeGeo = trackGeo(new THREE.CylinderGeometry(wheelR * 0.11, wheelR * 0.21, 0.055, 14));
  hubConeGeo.rotateZ(side > 0 ? -Math.PI * 0.5 : Math.PI * 0.5);
  const hubCone = new THREE.Mesh(hubConeGeo, mats.chromeMat);
  hubCone.position.x = outX + side * 0.026;
  wheelPivot.add(hubCone);

  const earGeo = trackGeo(new THREE.BoxGeometry(0.018, wheelR * 0.34, 0.026));
  for (let e = 0; e < 3; e++) {
    const ear = new THREE.Mesh(earGeo, mats.spinnerGoldMat);
    ear.position.x = outX + side * 0.044;
    ear.rotation.x = (e / 3) * Math.PI;
    wheelPivot.add(ear);
  }

  // Estela circular cinética que se intensifica con la velocidad angular
  const streakGeo = trackGeo(new THREE.RingGeometry(wheelR * 0.32, wheelR * 0.78, 18, 1, 0.25, Math.PI * 1.35));
  const streakMesh = new THREE.Mesh(streakGeo, mats.streakMat);
  streakMesh.name = 'wheel_motion_streak';
  streakMesh.rotation.y = side > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
  streakMesh.position.x = outX + side * 0.014;
  wheelPivot.add(streakMesh);

  return wheelPivot;
}

function detectWheelContactCentersFromMesh(
  alignedRoot: THREE.Object3D,
  lengthM: number,
  widthM: number,
  heightM: number,
): {
  frontZ: number;
  rearZ: number;
  halfTrackX: number;
} {
  alignedRoot.updateMatrixWorld(true);
  const maxContactY = Math.max(0.08, heightM * 0.16);
  const quadrants: Record<'FL' | 'FR' | 'RL' | 'RR', { xs: number[]; zs: number[] }> = {
    FL: { xs: [], zs: [] },
    FR: { xs: [], zs: [] },
    RL: { xs: [], zs: [] },
    RR: { xs: [], zs: [] },
  };
  const v = new THREE.Vector3();

  alignedRoot.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const pos = mesh.geometry.attributes.position;
    if (!pos) return;
    const step = Math.max(1, Math.floor(pos.count / 1800));
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      if (v.y > maxContactY) continue;
      if (Math.abs(v.x) < widthM * 0.22 || Math.abs(v.z) < lengthM * 0.12) continue;
      const key = v.z >= 0 ? (v.x < 0 ? 'FL' : 'FR') : v.x < 0 ? 'RL' : 'RR';
      quadrants[key].xs.push(Math.abs(v.x));
      quadrants[key].zs.push(v.z);
    }
  });

  const avg = (arr: number[]): number | null =>
    arr.length >= 3 ? arr.reduce((sum, n) => sum + n, 0) / arr.length : null;

  const frontZDetected =
    avg([...quadrants.FL.zs, ...quadrants.FR.zs]) ?? lengthM * 0.295;
  const rearZDetected =
    avg([...quadrants.RL.zs, ...quadrants.RR.zs]) ?? -lengthM * 0.285;
  const halfXDetected =
    avg([...quadrants.FL.xs, ...quadrants.FR.xs, ...quadrants.RL.xs, ...quadrants.RR.xs]) ??
    widthM * 0.455;

  return {
    frontZ: THREE.MathUtils.clamp(frontZDetected, lengthM * 0.20, lengthM * 0.38),
    rearZ: THREE.MathUtils.clamp(rearZDetected, -lengthM * 0.38, -lengthM * 0.20),
    halfTrackX: THREE.MathUtils.clamp(halfXDetected, widthM * 0.36, widthM * 0.49),
  };
}

/**
 * Normaliza escala, orientación longitudinal (+Z), apoyo sobre el asfalto (`min.y = 0`),
 * fidelidad PBR (`SRGBColorSpace` en texturas Meshy AI sin teñirlas de negro) e incorpora
 * 4 ruedas 3D articuladas con giro real cuando el `.glb` viene unificado en una sola malla.
 */
export function normalizeAndRigVillainGlb(
  rawScene: THREE.Object3D,
  options: NormalizeAndRigVillainGlbOptions,
): NormalizedVillainGlbRig {
  const rigRoot = new THREE.Group();
  rigRoot.name = options.isConvertible1966
    ? 'convertible_1966_villain_glb_instance'
    : 'presidential_limousine_glb_instance';

  const modelClone = rawScene.clone(true);
  const alignPivot = new THREE.Group();
  alignPivot.add(modelClone);

  // 1. Alinear el eje horizontal más largo del modelo con el eje longitudinal +Z de DATACAR
  alignPivot.updateMatrixWorld(true);
  const rawBox = new THREE.Box3().setFromObject(alignPivot);
  const rawSize = new THREE.Vector3();
  rawBox.getSize(rawSize);
  if (rawSize.x > rawSize.z * 1.15) {
    modelClone.rotation.y += Math.PI * 0.5;
    alignPivot.updateMatrixWorld(true);
    rawBox.setFromObject(alignPivot);
    rawBox.getSize(rawSize);
  }

  // 2. Escalar uniformemente (o con ajuste suave de ancho en la limusina ejecutiva) a longitud real
  const safeRawLength = Math.max(0.05, rawSize.z);
  const uniformScale = options.targetLengthM / safeRawLength;
  const scaleX =
    !options.isConvertible1966 && options.targetWidthM && rawSize.x > 0.05
      ? options.targetWidthM / rawSize.x
      : uniformScale;
  alignPivot.scale.set(scaleX, uniformScale, uniformScale);

  // 3. Centrar en X/Z y apoyar neumáticos al ras del asfalto (`min.y = 0`)
  alignPivot.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(alignPivot);
  const scaledCenter = new THREE.Vector3();
  const scaledSize = new THREE.Vector3();
  scaledBox.getCenter(scaledCenter);
  scaledBox.getSize(scaledSize);
  alignPivot.position.set(-scaledCenter.x, -scaledBox.min.y, -scaledCenter.z);
  alignPivot.updateMatrixWorld(true);

  rigRoot.add(alignPivot);

  // 4. Preservar texturas horneadas Meshy AI (sRGB + blanco neutro) y buscar nodos de ruedas nativos
  const namedWheels: THREE.Object3D[] = [];
  let preservedTextureCount = 0;

  modelClone.traverse((obj) => {
    if (
      /^(Wheel_|wheel|rueda|tire|rim|llanta)/i.test(obj.name) &&
      !/steering|volante/i.test(obj.name)
    ) {
      namedWheels.push(obj);
    }
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const updatedMats = mats.map((mat) => {
      if (!mat) return mat;
      const stdMat = mat as THREE.MeshStandardMaterial;
      if (stdMat.map) {
        preservedTextureCount += 1;
        stdMat.map.colorSpace = THREE.SRGBColorSpace;
        if (stdMat.color) stdMat.color.setHex(0xffffff);
        stdMat.envMap = options.envMap ?? null;
        stdMat.envMapIntensity = options.envMap ? 1.18 : 0.35;
        if (typeof stdMat.metalness === 'number') {
          stdMat.metalness = Math.min(stdMat.metalness, options.envMap ? 0.58 : 0.24);
        }
        if (typeof stdMat.roughness === 'number') {
          stdMat.roughness = THREE.MathUtils.clamp(stdMat.roughness, 0.2, 0.76);
        }
        stdMat.needsUpdate = true;
        return stdMat;
      }

      if (options.fallbackMaterials) {
        const matName = mat.name || '';
        if (matName.includes('ArmoredObsidianPaint')) return options.fallbackMaterials.bodyPaintMat;
        if (matName.includes('VIPPrivacyGlass')) return options.fallbackMaterials.darkTintedGlassMat;
        if (matName.includes('ExecutiveChrome') || matName.includes('PolishedAlloyRim')) {
          return options.fallbackMaterials.chromeMat;
        }
        if (matName.includes('WhiteLEDHeadlamp')) return options.fallbackMaterials.headlampWhiteMat;
        if (matName.includes('RedLEDTaillamp')) return options.fallbackMaterials.tailLightMat;
        if (matName.includes('PerformanceTireRubber')) return options.fallbackMaterials.tireMat;
      }
      return mat;
    });

    mesh.material = Array.isArray(mesh.material) ? updatedMats : updatedMats[0];
  });

  const lengthM = Math.max(3.8, scaledSize.z);
  const widthM = Math.max(1.65, scaledSize.x);
  const heightM = Math.max(1.15, scaledSize.y);
  const wheelRadiusM = THREE.MathUtils.clamp(heightM * 0.255, 0.32, 0.39);
  const wheelWidthM = 0.21;

  const rollingWheels: THREE.Object3D[] = [...namedWheels];

  // 5. Si el .glb es malla única (ej. Meshy_AI_Convertible_1966_thun_1115235921_texture.glb) o es el
  // convertible 1966, acoplamos las 4 ruedas clásicas 3D giratorias calibradas sobre los pasarruedas.
  if (options.isConvertible1966 || namedWheels.length < 4) {
    const contact = detectWheelContactCentersFromMesh(alignPivot, lengthM, widthM, heightM);
    const wheelMountX = Math.max(contact.halfTrackX, widthM * 0.455);
    for (const wz of [contact.frontZ, contact.rearZ]) {
      for (const side of [-1, 1] as const) {
        const wheelGroup = createClassic1966SpinningWheelGroup(
          side,
          wheelRadiusM,
          wheelWidthM,
          options.wheelMaterials,
          options.trackGeo,
        );
        wheelGroup.position.set(side * wheelMountX, wheelRadiusM, wz);
        rigRoot.add(wheelGroup);
        rollingWheels.push(wheelGroup);
      }
    }
  }

  return {
    root: rigRoot,
    rollingWheels,
    wheelRadiusM,
    lengthM,
    widthM,
    heightM,
    preservedTextureCount,
  };
}

const ARCHETYPE_ACCENT_HEX: Record<CorruptRivalArchetype, string> = {
  limo_blindada: '#fbbf24',
  sedan_ejecutivo: '#e2e8f0',
  suv_blindada: '#f59e0b',
  camioneta_vip: '#cbd5e1',
  oficial_oscuro: '#ef4444',
  caravana_vip: '#fbbf24',
};

export function createCorruptRivalVehicle3D(
  archetype: CorruptRivalArchetype,
  options?: CorruptRivalVehicle3DOptions,
): CorruptRivalVehicle3DHandle {
  const accentHex = ARCHETYPE_ACCENT_HEX[archetype] ?? '#fbbf24';
  const group = new THREE.Group();
  group.name = `corrupt_rival_${archetype}`;
  group.visible = false;

  // Contenedor hijo [0] que recorre la bahía VIP frente a la escalinata de Weno Bank (x: -19.5 -> -3.8)
  const carrierGroup = new THREE.Group();
  carrierGroup.name = 'corrupt_vip_lane_carrier';
  carrierGroup.position.set(-19.5, 0.16, 13.1);
  carrierGroup.rotation.set(0, Math.PI * 0.5, 0);
  group.add(carrierGroup);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  let currentEnvMap: THREE.Texture | null = options?.envMap ?? null;
  let disposed = false;

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    textures.push(t);
    return t;
  };

  const isSuvOrPickup = archetype === 'suv_blindada' || archetype === 'camioneta_vip';
  const bodyPaintMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: isSuvOrPickup ? '#0c121c' : '#05070c',
      roughness: 0.14,
      metalness: 0.72,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      reflectivity: 0.96,
      envMap: currentEnvMap,
      envMapIntensity: 1.45,
    }),
  );
  const darkTintedGlassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: '#050b14',
      roughness: 0.05,
      metalness: 0.24,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      envMap: currentEnvMap,
      envMapIntensity: 1.75,
    }),
  );
  const chromeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#e8eef5',
      roughness: 0.12,
      metalness: 0.96,
      envMap: currentEnvMap,
      envMapIntensity: 1.55,
    }),
  );
  const accentTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: accentHex,
      emissive: accentHex,
      emissiveIntensity: 0.35,
      roughness: 0.24,
      metalness: 0.72,
    }),
  );
  const tireMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#111318',
      roughness: 0.84,
      metalness: 0.06,
    }),
  );
  const whitewallMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      roughness: 0.42,
      metalness: 0.05,
      side: THREE.DoubleSide,
    }),
  );
  const redlinePinMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: '#ef4444',
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  const spinnerGoldMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#fbbf24',
      roughness: 0.18,
      metalness: 0.92,
      envMap: currentEnvMap,
      envMapIntensity: 1.4,
    }),
  );
  const wheelStreakMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: '#e2e8f0',
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    }),
  );

  const headlampWhiteMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(3.8, 3.85, 4.0),
      toneMapped: false,
    }),
  );
  const tailLightMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(3.4, 0.12, 0.10),
      toneMapped: false,
    }),
  );
  const beamTex = trackTex(createRoadBeamTexture());
  const beamRoadMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: beamTex,
      color: new THREE.Color(1.45, 1.50, 1.60),
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );

  const strobeBlueMat = trackMat(new THREE.MeshBasicMaterial({ color: '#38bdf8', toneMapped: false }));
  const strobeRedMat = trackMat(new THREE.MeshBasicMaterial({ color: '#f43f5e', toneMapped: false }));

  const wheelMaterials: VillainWheelMaterials = {
    tireMat,
    whitewallMat,
    redlinePinMat,
    chromeMat,
    spinnerGoldMat,
    streakMat: wheelStreakMat,
  };

  const addVipAccessoriesAndBeams = (
    car: THREE.Group,
    lengthM: number,
    widthM: number,
    roofTopY: number,
    isConvertible = false,
  ): THREE.Group => {
    if (!isConvertible) {
      for (const side of [-1, 1]) {
        const accentStrip = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.022, 0.032, lengthM * 0.78)),
          accentTrimMat,
        );
        accentStrip.position.set(side * (widthM * 0.495), 0.78, 0);
        car.add(accentStrip);
      }
    }

    // Baliza estroboscópica VIP discreta (en el convertible va sobre el marco del parabrisas)
    const strobeBar = new THREE.Group();
    strobeBar.name = 'vip_strobe_bar';
    const barBase = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.56, 0.048, 0.15)),
      chromeMat,
    );
    const leftLight = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.23, 0.056, 0.16)),
      strobeBlueMat,
    );
    leftLight.position.x = -0.14;
    const rightLight = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.23, 0.056, 0.16)),
      strobeRedMat,
    );
    rightLight.position.x = 0.14;
    strobeBar.add(barBase, leftLight, rightLight);
    strobeBar.position.set(
      0,
      isConvertible ? roofTopY + 0.02 : roofTopY + 0.04,
      isConvertible ? lengthM * 0.11 : 0.32,
    );
    car.add(strobeBar);

    // Conos de faros blancos delanteros proyectados sobre el asfalto
    const beamGroup = new THREE.Group();
    beamGroup.name = 'rival_white_headlight_beams';
    for (const side of [-1, 1]) {
      const roadCone = new THREE.Mesh(
        trackGeo(new THREE.PlaneGeometry(1.45, 7.6)),
        beamRoadMat,
      );
      roadCone.rotation.x = -Math.PI * 0.5;
      roadCone.position.set(side * (widthM * 0.30), 0.045, lengthM * 0.5 + 3.85);
      roadCone.renderOrder = 3;
      beamGroup.add(roadCone);
    }
    car.add(beamGroup);
    return beamGroup;
  };

  const buildSculptedFallbackUnit = (
    lengthM: number,
    widthM: number,
    cabinHeightM: number,
    wheelBaseRatio = 0.65,
  ): BuiltUnitVehicle => {
    const car = new THREE.Group();
    const halfL = lengthM * 0.5;
    const halfW = widthM * 0.5;
    const wheelR = 0.37;
    const wheelW = 0.22;
    const clearY = 0.20;
    const beltY = 0.94;
    const roofY = 0.90 + cabinHeightM;
    const axleZ = lengthM * (wheelBaseRatio * 0.5);

    const bodyGeo = trackGeo(
      buildSculptedShellGeometry(28, 22, (u, theta) => {
        const z = THREE.MathUtils.lerp(-halfL + 0.03, halfL - 0.03, u);
        let w = halfW * 0.96;
        if (u < 0.09) w *= 0.88 + 0.12 * Math.sin((u / 0.09) * Math.PI * 0.5);
        if (u > 0.88) w *= 0.86 + 0.14 * Math.sin(((1 - u) / 0.12) * Math.PI * 0.5);
        const topY = u > 0.74 ? THREE.MathUtils.lerp(beltY, beltY - 0.07, (u - 0.74) / 0.26) : beltY;
        const c = Math.cos(theta);
        const s = Math.sin(theta);
        const x = (Math.sign(c) || 1) * Math.pow(Math.abs(c), 0.60) * w;
        const midY = (clearY + topY) * 0.5;
        const y = midY + (Math.sign(s) || 1) * Math.pow(Math.abs(s), 0.64) * ((topY - clearY) * 0.5);
        return [x, y, z];
      }),
    );
    const lowerBody = new THREE.Mesh(bodyGeo, bodyPaintMat);
    lowerBody.castShadow = true;
    lowerBody.receiveShadow = true;
    car.add(lowerBody);

    const cabinStartZ = -lengthM * 0.37;
    const cabinEndZ = lengthM * 0.25;
    const cabinGeo = trackGeo(
      buildSculptedShellGeometry(20, 18, (u, theta) => {
        const z = THREE.MathUtils.lerp(cabinStartZ, cabinEndZ, u);
        let localRoof = roofY;
        if (u < 0.18) localRoof = THREE.MathUtils.lerp(beltY + 0.02, roofY, u / 0.18);
        else if (u > 0.76) localRoof = THREE.MathUtils.lerp(beltY + 0.02, roofY, (1 - u) / 0.24);
        const c = Math.cos(theta);
        const s = Math.sin(theta);
        const h01 = THREE.MathUtils.clamp((s + 1) * 0.5, 0, 1);
        const w = THREE.MathUtils.lerp(halfW * 0.84, halfW * 0.69, h01);
        const x = (Math.sign(c) || 1) * Math.pow(Math.abs(c), 0.68) * w;
        const midY = (beltY - 0.02 + localRoof) * 0.5;
        const y = midY + (Math.sign(s) || 1) * Math.pow(Math.abs(s), 0.72) * ((localRoof - beltY + 0.02) * 0.5);
        return [x, y, z];
      }),
    );
    const cabin = new THREE.Mesh(cabinGeo, darkTintedGlassMat);
    cabin.castShadow = true;
    car.add(cabin);

    const grille = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(widthM * 0.46, 0.38, 0.06)),
      chromeMat,
    );
    grille.position.set(0, 0.60, halfL - 0.01);
    car.add(grille);

    for (const side of [-1, 1]) {
      const head = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.30, 0.095, 0.065)),
        headlampWhiteMat,
      );
      head.position.set(side * (widthM * 0.34), 0.73, halfL - 0.02);
      car.add(head);

      const tail = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.36, 0.105, 0.065)),
        tailLightMat,
      );
      tail.position.set(side * (widthM * 0.33), 0.80, -halfL + 0.02);
      car.add(tail);
    }
    const tailBar = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(widthM * 0.68, 0.036, 0.05)),
      tailLightMat,
    );
    tailBar.position.set(0, 0.82, -halfL + 0.018);
    car.add(tailBar);

    const rollingWheels: THREE.Object3D[] = [];
    for (const wz of [-axleZ, axleZ]) {
      for (const side of [-1, 1] as const) {
        const wheelPivot = createClassic1966SpinningWheelGroup(
          side,
          wheelR,
          wheelW,
          wheelMaterials,
          trackGeo,
        );
        wheelPivot.position.set(side * (halfW - wheelW * 0.35), wheelR, wz);
        car.add(wheelPivot);
        rollingWheels.push(wheelPivot);
      }
    }

    const headLightBeamGroup = addVipAccessoriesAndBeams(car, lengthM, widthM, roofY, false);

    return {
      root: car,
      rollingWheels,
      speedStreakMats: [wheelStreakMat],
      strobeLeftMat: strobeBlueMat,
      strobeRightMat: strobeRedMat,
      headLightBeamGroup,
      wheelRadiusM: wheelR,
    };
  };

  const units: BuiltUnitVehicle[] = [];

  if (archetype === 'limo_blindada') {
    units.push(buildSculptedFallbackUnit(6.36, 1.96, 0.58, 0.65));
  } else if (archetype === 'suv_blindada') {
    units.push(buildSculptedFallbackUnit(5.25, 2.04, 0.74, 0.62));
  } else if (archetype === 'camioneta_vip') {
    units.push(buildSculptedFallbackUnit(5.38, 2.02, 0.72, 0.63));
  } else if (archetype === 'sedan_ejecutivo' || archetype === 'oficial_oscuro') {
    units.push(buildSculptedFallbackUnit(5.24, 1.92, 0.56, 0.62));
  } else {
    const lead = buildSculptedFallbackUnit(6.24, 1.96, 0.58, 0.65);
    lead.root.position.set(0, 0, 0);
    const escort = buildSculptedFallbackUnit(4.95, 1.98, 0.70, 0.62);
    escort.root.position.set(0.28, 0, -7.2);
    units.push(lead, escort);
  }

  for (const u of units) {
    carrierGroup.add(u.root);
  }

  // En navegador, intenta primero sustituir al rival por `Meshy_AI_Convertible_1966_thun_1115235921_texture.glb`
  // en TODOS los circuitos, con respaldo a `presidential-limousine.glb`.
  if (typeof window !== 'undefined') {
    loadVillainVehicleGltf()
      .then((loaded) => {
        if (disposed) return;
        if (!loaded.isConvertible1966 && isSuvOrPickup) {
          return;
        }
        const targetUnit = units[0];
        if (!targetUnit) return;

        const prevPos = targetUnit.root.position.clone();
        carrierGroup.remove(targetUnit.root);

        const targetLengthM = loaded.isConvertible1966
          ? 5.22
          : archetype === 'sedan_ejecutivo' || archetype === 'oficial_oscuro'
            ? 5.24
            : archetype === 'caravana_vip'
              ? 6.24
              : 6.36;
        const targetWidthM = loaded.isConvertible1966
          ? undefined
          : archetype === 'sedan_ejecutivo' || archetype === 'oficial_oscuro'
            ? 1.92
            : 1.96;

        const rigged = normalizeAndRigVillainGlb(loaded.gltf.scene, {
          isConvertible1966: loaded.isConvertible1966,
          targetLengthM,
          targetWidthM,
          envMap: currentEnvMap,
          fallbackMaterials: {
            bodyPaintMat,
            darkTintedGlassMat,
            chromeMat,
            headlampWhiteMat,
            tailLightMat,
            tireMat,
          },
          wheelMaterials,
          trackGeo,
        });

        rigged.root.position.copy(prevPos);
        const glbBeams = addVipAccessoriesAndBeams(
          rigged.root,
          rigged.lengthM,
          rigged.widthM,
          rigged.heightM,
          loaded.isConvertible1966,
        );

        targetUnit.root = rigged.root;
        targetUnit.rollingWheels = rigged.rollingWheels;
        targetUnit.wheelRadiusM = rigged.wheelRadiusM;
        targetUnit.headLightBeamGroup = glbBeams;
        carrierGroup.add(rigged.root);

        if (currentEnvMap) {
          bodyPaintMat.envMap = currentEnvMap;
          darkTintedGlassMat.envMap = currentEnvMap;
          chromeMat.envMap = currentEnvMap;
          spinnerGoldMat.envMap = currentEnvMap;
          bodyPaintMat.needsUpdate = true;
          darkTintedGlassMat.needsUpdate = true;
          chromeMat.needsUpdate = true;
          spinnerGoldMat.needsUpdate = true;
        }
      })
      .catch(() => {
        // Conserva la carrocería 3D esculpida con ruedas giratorias si ningún GLB está disponible
      });
  }

  const vipStartLocalX = -19.5;
  const vipStopLocalX = -3.8;
  const vipLaneLocalY = 0.16;
  const vipLaneLocalZ = 13.1;

  let inRoadPreview = false;
  let lastTrackCoordA = vipStartLocalX;
  let lastTrackCoordB = vipLaneLocalZ;
  let lastElapsedSec = 0;
  let totalWheelDistanceM = 0;

  const updateStrobeAndWheels = (elapsedSec: number, stepDistMeters: number, isMoving = true) => {
    const dt = Math.max(0, elapsedSec - lastElapsedSec);
    lastElapsedSec = elapsedSec;

    const strobePhase = Math.floor(elapsedSec * 8.5) % 2 === 0;
    for (const u of units) {
      u.strobeLeftMat.color.set(strobePhase ? '#38bdf8' : '#082f49');
      u.strobeRightMat.color.set(!strobePhase ? '#f43f5e' : '#4c0519');
    }

    const effectiveStepM =
      stepDistMeters > 0 && stepDistMeters < 18
        ? stepDistMeters
        : isMoving && dt > 0 && dt < 0.5
          ? dt * 4.5
          : 0;

    if (effectiveStepM > 0) {
      totalWheelDistanceM += effectiveStepM;
    }

    const estimatedSpeedMps = dt > 0.001 ? effectiveStepM / dt : effectiveStepM * 60;
    const streakOpacity = isMoving
      ? THREE.MathUtils.clamp((estimatedSpeedMps - 1.2) / 18, 0.12, 0.52)
      : 0;

    for (const u of units) {
      const wheelAngle = totalWheelDistanceM / Math.max(0.2, u.wheelRadiusM);
      for (const w of u.rollingWheels) {
        w.rotation.x = wheelAngle;
      }
      for (const sm of u.speedStreakMats) {
        sm.opacity = streakOpacity;
      }
    }
  };

  return {
    archetype,
    group,
    updateSync(rivalProgress01: number, elapsedSec: number) {
      if (inRoadPreview) return;
      const p = THREE.MathUtils.clamp(
        Number.isFinite(rivalProgress01) ? rivalProgress01 : 0,
        0,
        1,
      );
      if (p <= 0.12) {
        group.visible = false;
        carrierGroup.position.set(vipStartLocalX, vipLaneLocalY, vipLaneLocalZ);
        carrierGroup.rotation.set(0, Math.PI * 0.5, 0);
        lastTrackCoordA = vipStartLocalX;
        lastTrackCoordB = vipLaneLocalZ;
        return;
      }

      group.visible = true;
      const normalizedApproach = THREE.MathUtils.clamp((p - 0.12) / 0.88, 0, 1);
      const easedApproach = normalizedApproach * normalizedApproach * (3 - 2 * normalizedApproach);
      const nextLocalX = THREE.MathUtils.lerp(vipStartLocalX, vipStopLocalX, easedApproach);
      const stepDist = Math.abs(nextLocalX - lastTrackCoordA);
      lastTrackCoordA = nextLocalX;
      lastTrackCoordB = vipLaneLocalZ;

      carrierGroup.position.set(nextLocalX, vipLaneLocalY, vipLaneLocalZ);
      carrierGroup.rotation.set(0, Math.PI * 0.5, 0);
      updateStrobeAndWheels(elapsedSec, stepDist, normalizedApproach < 0.995);
    },
    setRoadPreviewPose(x: number, z: number, yaw: number, elapsedSec = 0) {
      const stepDist = inRoadPreview
        ? Math.hypot(x - lastTrackCoordA, z - lastTrackCoordB)
        : 0.55;
      inRoadPreview = true;
      lastTrackCoordA = x;
      lastTrackCoordB = z;

      group.visible = true;
      group.position.set(x, 0, z);
      group.rotation.set(0, yaw, 0);
      carrierGroup.position.set(0, 0, 0);
      carrierGroup.rotation.set(0, 0, 0);
      updateStrobeAndWheels(elapsedSec, stepDist, true);
    },
    clearRoadPreviewPose() {
      if (!inRoadPreview && group.position.x === 0 && group.position.z === 0 && group.rotation.y === 0) {
        return;
      }
      inRoadPreview = false;
      group.position.set(0, 0, 0);
      group.rotation.set(0, 0, 0);
      carrierGroup.position.set(vipStartLocalX, vipLaneLocalY, vipLaneLocalZ);
      carrierGroup.rotation.set(0, Math.PI * 0.5, 0);
      lastTrackCoordA = vipStartLocalX;
      lastTrackCoordB = vipLaneLocalZ;
    },
    applyEnvMap(envMap: THREE.Texture | null) {
      currentEnvMap = envMap;
      bodyPaintMat.envMap = envMap;
      darkTintedGlassMat.envMap = envMap;
      chromeMat.envMap = envMap;
      spinnerGoldMat.envMap = envMap;
      bodyPaintMat.needsUpdate = true;
      darkTintedGlassMat.needsUpdate = true;
      chromeMat.needsUpdate = true;
      spinnerGoldMat.needsUpdate = true;
    },
    dispose() {
      disposed = true;
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
