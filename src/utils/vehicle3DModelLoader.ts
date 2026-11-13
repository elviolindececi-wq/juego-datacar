import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Habilitar caché interna de recursos de Three.js para sub-recursos compartidos
THREE.Cache.enabled = true;

const isSoftwareGlLoader = (() => {
  if (typeof document === 'undefined') return false;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
})();

/**
 * Identificadores oficiales de los 7 vehículos del catálogo DATACAR ARENA.
 */
export type VehicleModelId =
  | 'chery-t2-pro-max'
  | 'chery-t4-pro-luxury-hev'
  | 'chevrolet-tracker-lite'
  | 'toyota-corolla-cross-seg-2027'
  | 'kia-carens-ex'
  | 'nissan-kicks-2027'
  | 'suzuki-fronx';

/**
 * Mapeo canónico de los 7 IDs de vehículos hacia sus rutas en `/public/models/`.
 * Nota: En Vite/Express, los archivos alojados en `/public/models/*.glb` se sirven en `/models/*.glb`.
 * `normalizePublicModelUrl()` convierte automáticamente cualquier ruta con prefijo `/public/` a su URL pública.
 */
export const VEHICLE_PUBLIC_MODEL_FILES: Record<VehicleModelId, string> = {
  'chery-t2-pro-max': '/public/models/chery-t2-pro-max.glb',
  'chery-t4-pro-luxury-hev': '/public/models/chery-t4-pro-luxury-hev.glb',
  'chevrolet-tracker-lite': '/public/models/chevrolet-tracker-lite.glb',
  'toyota-corolla-cross-seg-2027': '/public/models/toyota-corolla-cross-seg-2027.glb',
  'kia-carens-ex': '/public/models/kia-carens-ex.glb',
  'nissan-kicks-2027': '/public/models/nissan-kicks-2027.glb',
  'suzuki-fronx': '/public/models/suzuki-fronx.glb',
};

/**
 * Normaliza rutas de disco (`/public/models/x.glb`) a URLs HTTP servidas por Vite (`/models/x.glb`).
 */
export function normalizePublicModelUrl(pathOrUrl: string): string {
  const trimmed = pathOrUrl.trim();
  if (trimmed.startsWith('/public/')) {
    return trimmed.slice('/public'.length);
  }
  if (trimmed.startsWith('public/')) {
    return `/${trimmed.slice('public/'.length)}`;
  }
  return trimmed;
}

/**
 * Rutas HTTP públicas normalizadas (`/models/<id>.glb`) para carga dinámica directa.
 */
export const GENERIC_CUSTOM_CAR_MODEL_ID = 'custom-generic-car';
export const GENERIC_CUSTOM_CAR_PUBLIC_PATH = '/public/models/generic-custom-car.glb';
export const GENERIC_CUSTOM_CAR_GLB_URL = normalizePublicModelUrl(GENERIC_CUSTOM_CAR_PUBLIC_PATH);

export const VEHICLE_GLB_PATHS: Record<VehicleModelId, string> = {
  'chery-t2-pro-max': normalizePublicModelUrl(VEHICLE_PUBLIC_MODEL_FILES['chery-t2-pro-max']),
  'chery-t4-pro-luxury-hev': normalizePublicModelUrl(VEHICLE_PUBLIC_MODEL_FILES['chery-t4-pro-luxury-hev']),
  'chevrolet-tracker-lite': normalizePublicModelUrl(VEHICLE_PUBLIC_MODEL_FILES['chevrolet-tracker-lite']),
  'toyota-corolla-cross-seg-2027': normalizePublicModelUrl(VEHICLE_PUBLIC_MODEL_FILES['toyota-corolla-cross-seg-2027']),
  'kia-carens-ex': normalizePublicModelUrl(VEHICLE_PUBLIC_MODEL_FILES['kia-carens-ex']),
  'nissan-kicks-2027': normalizePublicModelUrl(VEHICLE_PUBLIC_MODEL_FILES['nissan-kicks-2027']),
  'suzuki-fronx': normalizePublicModelUrl(VEHICLE_PUBLIC_MODEL_FILES['suzuki-fronx']),
};

const runtimeCustomGlbUrls = new Map<string, string>();

export function registerCustomVehicleGlbUrl(vehicleId: string, blobOrPublicUrl: string): void {
  const prev = runtimeCustomGlbUrls.get(vehicleId);
  if (prev && prev !== blobOrPublicUrl && prev.startsWith('blob:')) {
    try { URL.revokeObjectURL(prev); } catch { /* ignore */ }
  }
  runtimeCustomGlbUrls.set(vehicleId, blobOrPublicUrl);
  gltfCache.clear();
  loadingPromises.clear();
  glbAvailabilityCache.clear();
}

export function unregisterCustomVehicleGlbUrl(vehicleId: string): void {
  const prev = runtimeCustomGlbUrls.get(vehicleId);
  if (prev && prev.startsWith('blob:')) {
    try { URL.revokeObjectURL(prev); } catch { /* ignore */ }
  }
  runtimeCustomGlbUrls.delete(vehicleId);
}

export function getCustomVehicleGlbUrl(vehicleId: string): string | undefined {
  return runtimeCustomGlbUrls.get(vehicleId);
}

export interface Vehicle3DConfig {
  modelId: VehicleModelId | string;
  name: string;
  identificationName: string;
  brandColor: string;
  /** Ruta en el sistema de archivos del proyecto (`/public/models/*.glb`) */
  publicFilePath?: string;
  /** Ruta HTTP servida en tiempo de ejecución (`/models/*.glb`) */
  glbUrl: string;
  /** Rutas candidatas ordenadas por prioridad para resolución dinámica */
  candidateUrls?: string[];
  scale: number;
  targetLengthMeters?: number;
  rotationY: number;
  verticalOffset: number;
  isUnifiedMesh: boolean;
  isProvisional3D: boolean;
  fallbackGlbUrl?: string;
  blenderNotes?: string;
}

export const RESCUE_FALLBACK_GLB_URL = '/models/tracker-rs.glb';
export const SECONDARY_FALLBACK_GLB_URL = '/models/tracker-rs-wheels.glb';

export const DEFAULT_PROVISIONAL_WHEEL_MODEL = {
  glbUrl: '/models/tracker-rs-wheels.glb',
  fallbackGlbUrl: RESCUE_FALLBACK_GLB_URL,
} as const;

/**
 * Registro centralizado de configuración física, visual y rutas `.glb` de los 7 vehículos.
 */
export const VEHICLE_3D_REGISTRY: Record<string, Vehicle3DConfig> = {
  'chery-t4-pro-luxury-hev': {
    modelId: 'chery-t4-pro-luxury-hev',
    name: 'Chery T4 Pro Luxury HEV',
    identificationName: 'CHERY T4 PRO HEV',
    brandColor: '#1d4ed8',
    publicFilePath: VEHICLE_PUBLIC_MODEL_FILES['chery-t4-pro-luxury-hev'],
    glbUrl: VEHICLE_GLB_PATHS['chery-t4-pro-luxury-hev'],
    candidateUrls: [
      VEHICLE_GLB_PATHS['chery-t4-pro-luxury-hev'],
      '/models/chery-t4-pro.glb',
      '/models/chery-t4-pro-luxury-hev-wheels.glb',
      '/models/chery-t4-wheels.glb',
      '/models/chery-t4.glb',
    ],
    fallbackGlbUrl: RESCUE_FALLBACK_GLB_URL,
    targetLengthMeters: 4.32,
    scale: 4.32 / 0.12,
    rotationY: Math.PI / 2,
    verticalOffset: 0,
    isUnifiedMesh: false,
    isProvisional3D:true,
    blenderNotes: 'Archivo esperado en /public/models/chery-t4-pro-luxury-hev.glb con split de ruedas.',
  },
  'chery-t2-pro-max': {
    modelId: 'chery-t2-pro-max',
    name: 'Chery T2 Pro Max',
    identificationName: 'CHERY T2 PRO MAX',
    brandColor: '#ef4444',
    publicFilePath: VEHICLE_PUBLIC_MODEL_FILES['chery-t2-pro-max'],
    glbUrl: VEHICLE_GLB_PATHS['chery-t2-pro-max'],
    candidateUrls: [
      VEHICLE_GLB_PATHS['chery-t2-pro-max'],
      '/models/chery-t2-pro-max-wheels.glb',
      '/models/chery-t2-wheels.glb',
      '/models/chery-t2.glb',
    ],
    fallbackGlbUrl: RESCUE_FALLBACK_GLB_URL,
    targetLengthMeters: 4.20,
    scale: 4.20 / 0.12,
    rotationY: Math.PI / 2,
    verticalOffset: 0,
    isUnifiedMesh: false,
    isProvisional3D: true,
    blenderNotes: 'Archivo esperado en /public/models/chery-t2-pro-max.glb con split de ruedas.',
  },
  'suzuki-fronx': {
    modelId: 'suzuki-fronx',
    name: 'Suzuki Fronx',
    identificationName: 'SUZUKI FRONX',
    brandColor: '#f97316',
    publicFilePath: VEHICLE_PUBLIC_MODEL_FILES['suzuki-fronx'],
    glbUrl: VEHICLE_GLB_PATHS['suzuki-fronx'],
    candidateUrls: [
      VEHICLE_GLB_PATHS['suzuki-fronx'],
      '/models/suzuki-fronx-wheels.glb',
      '/models/fronx-wheels.glb',
      '/models/fronx.glb',
    ],
    fallbackGlbUrl: RESCUE_FALLBACK_GLB_URL,
    targetLengthMeters: 3.995,
    scale: 3.995 / 0.12,
    rotationY: Math.PI / 2,
    verticalOffset: 0,
    isUnifiedMesh: false,
    isProvisional3D: true,
    blenderNotes: 'Archivo esperado en /public/models/suzuki-fronx.glb con split de ruedas.',
  },
  'toyota-corolla-cross-seg-2027': {
    modelId: 'toyota-corolla-cross-seg-2027',
    name: 'Toyota Corolla Cross SEG 2027',
    identificationName: 'TOYOTA COROLLA CROSS',
    brandColor: '#f8fafc',
    publicFilePath: VEHICLE_PUBLIC_MODEL_FILES['toyota-corolla-cross-seg-2027'],
    glbUrl: VEHICLE_GLB_PATHS['toyota-corolla-cross-seg-2027'],
    candidateUrls: [
      VEHICLE_GLB_PATHS['toyota-corolla-cross-seg-2027'],
      '/models/toyota-corolla-cross-seg-2027-wheels.glb',
      '/models/toyota-corolla-cross-seg-2027-light.glb',
      '/models/toyota-corolla-cross.glb',
      '/models/corolla-cross.glb',
    ],
    fallbackGlbUrl: '/models/toyota-corolla-cross-seg-2027-light.glb',
    targetLengthMeters: 4.46,
    scale: 4.46 / 0.12,
    rotationY: Math.PI / 2,
    verticalOffset: 0,
    isUnifiedMesh: false,
    isProvisional3D: false,
    blenderNotes: 'Archivo principal en /public/models/toyota-corolla-cross-seg-2027.glb (respaldo activo: -light.glb).',
  },
  'nissan-kicks-2027': {
    modelId: 'nissan-kicks-2027',
    name: 'Nissan Kicks',
    identificationName: 'NISSAN KICKS',
    brandColor: '#eab308',
    publicFilePath: VEHICLE_PUBLIC_MODEL_FILES['nissan-kicks-2027'],
    glbUrl: VEHICLE_GLB_PATHS['nissan-kicks-2027'],
    candidateUrls: [
      VEHICLE_GLB_PATHS['nissan-kicks-2027'],
      '/models/nissan-kicks-2027-wheels.glb',
      '/models/nissan-kicks-wheels.glb',
      '/models/nissan-kicks.glb',
      '/models/kicks.glb',
    ],
    fallbackGlbUrl: RESCUE_FALLBACK_GLB_URL,
    targetLengthMeters: 4.31,
    scale: 4.31 / 0.12,
    rotationY: Math.PI / 2,
    verticalOffset: 0,
    isUnifiedMesh: false,
    isProvisional3D: true,
    blenderNotes: 'Archivo esperado en /public/models/nissan-kicks-2027.glb con split de ruedas.',
  },
  'kia-carens-ex': {
    modelId: 'kia-carens-ex',
    name: 'Kia Carens',
    identificationName: 'KIA CARENS',
    brandColor: '#06b6d4',
    publicFilePath: VEHICLE_PUBLIC_MODEL_FILES['kia-carens-ex'],
    glbUrl: VEHICLE_GLB_PATHS['kia-carens-ex'],
    candidateUrls: [
      VEHICLE_GLB_PATHS['kia-carens-ex'],
      '/models/kia-carens-ex-wheels.glb',
      '/models/kia-carens-wheels.glb',
      '/models/kia-carens.glb',
      '/models/carens.glb',
    ],
    fallbackGlbUrl: RESCUE_FALLBACK_GLB_URL,
    targetLengthMeters: 4.54,
    scale: 4.54 / 0.12,
    rotationY: Math.PI / 2,
    verticalOffset: 0,
    isUnifiedMesh: false,
    isProvisional3D: true,
    blenderNotes: 'Archivo esperado en /public/models/kia-carens-ex.glb con split de ruedas.',
  },
  'chevrolet-tracker-lite': {
    modelId: 'chevrolet-tracker-lite',
    name: 'Chevrolet Tracker',
    identificationName: 'CHEVROLET TRACKER',
    brandColor: '#3b82f6',
    publicFilePath: VEHICLE_PUBLIC_MODEL_FILES['chevrolet-tracker-lite'],
    glbUrl: VEHICLE_GLB_PATHS['chevrolet-tracker-lite'],
    candidateUrls: [
      VEHICLE_GLB_PATHS['chevrolet-tracker-lite'],
      '/models/chevrolet-tracker-wheels.glb',
      '/models/tracker-rs-wheels.glb',
      '/models/chevrolet-tracker.glb',
      '/models/tracker-rs.glb',
    ],
    fallbackGlbUrl: RESCUE_FALLBACK_GLB_URL,
    targetLengthMeters: 4.27,
    scale: 4.27 / 0.12,
    rotationY: Math.PI / 2,
    verticalOffset: 0,
    isUnifiedMesh: false,
    isProvisional3D: false,
    blenderNotes: 'Archivo principal en /public/models/chevrolet-tracker-lite.glb (respaldo activo: tracker-rs.glb).',
  },
};

export function hasVehicle3DModel(vehicleId: string): boolean {
  return vehicleId in VEHICLE_3D_REGISTRY;
}

export function getVehicle3DConfig(vehicleId: string): Vehicle3DConfig | undefined {
  return VEHICLE_3D_REGISTRY[vehicleId];
}

export function getVehicleGlbPath(vehicleId: string): string | undefined {
  const config = VEHICLE_3D_REGISTRY[vehicleId];
  return config ? config.glbUrl : undefined;
}

// ============================================================================
// MOTOR DE CARGA DINÁMICA EFICIENTE (Caché LRU + Cola de Concurrencia + Draco)
// ============================================================================

interface CachedGLTFEntry {
  gltf: GLTF;
  lastAccessedAt: number;
}

const MAX_CACHED_GLB_MODELS = 12;
const MAX_CONCURRENT_GLB_DOWNLOADS = 3;

const glbAvailabilityCache = new Map<string, Promise<boolean>>();
const gltfCache = new Map<string, CachedGLTFEntry>();
const loadingPromises = new Map<string, Promise<GLTF>>();

let activeDownloadCount = 0;
const downloadWaitQueue: Array<() => void> = [];

function acquireDownloadSlot(): Promise<void> {
  if (activeDownloadCount < MAX_CONCURRENT_GLB_DOWNLOADS) {
    activeDownloadCount++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    downloadWaitQueue.push(() => {
      activeDownloadCount++;
      resolve();
    });
  });
}

function releaseDownloadSlot(): void {
  activeDownloadCount = Math.max(0, activeDownloadCount - 1);
  const next = downloadWaitQueue.shift();
  if (next) next();
}

let sharedDracoLoader: DRACOLoader | null = null;
let sharedGltfLoader: GLTFLoader | null = null;

function getSharedGLTFLoader(): GLTFLoader {
  if (sharedGltfLoader) return sharedGltfLoader;
  const loader = new GLTFLoader();
  if (typeof window !== 'undefined') {
    if (!sharedDracoLoader) {
      sharedDracoLoader = new DRACOLoader();
      sharedDracoLoader.setDecoderPath('/draco/gltf/');
    }
    loader.setDRACOLoader(sharedDracoLoader);
  }
  sharedGltfLoader = loader;
  return loader;
}

function disposeCachedGLTF(gltf: GLTF): void {
  gltf.scene.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        if (!mat) continue;
        const stdMat = mat as THREE.MeshStandardMaterial;
        stdMat.map?.dispose();
        stdMat.normalMap?.dispose();
        stdMat.roughnessMap?.dispose();
        stdMat.metalnessMap?.dispose();
        stdMat.aoMap?.dispose();
        stdMat.emissiveMap?.dispose();
        mat.dispose();
      }
    }
  });
}

function touchCacheEntry(url: string, gltf: GLTF): void {
  gltfCache.set(url, { gltf, lastAccessedAt: performance.now() });
  if (gltfCache.size <= MAX_CACHED_GLB_MODELS) return;

  let oldestKey: string | null = null;
  let oldestTime = Infinity;
  for (const [key, entry] of gltfCache.entries()) {
    // Conservar siempre el modelo liviano de rescate en caché
    if (key === RESCUE_FALLBACK_GLB_URL || key === url) continue;
    if (entry.lastAccessedAt < oldestTime) {
      oldestTime = entry.lastAccessedAt;
      oldestKey = key;
    }
  }
  if (oldestKey) {
    const evicted = gltfCache.get(oldestKey);
    gltfCache.delete(oldestKey);
    if (evicted) {
      disposeCachedGLTF(evicted.gltf);
    }
  }
}

/**
 * Comprueba dinámicamente mediante una petición `HEAD` ligera si el binario `.glb` existe
 * en `/public/models/` (descartando respuestas `text/html` del fallback SPA de Vite).
 */
export function probeGlbUrlAvailable(rawUrl: string): Promise<boolean> {
  const url = normalizePublicModelUrl(rawUrl);
  if (gltfCache.has(url)) return Promise.resolve(true);
  if (glbAvailabilityCache.has(url)) return glbAvailabilityCache.get(url)!;
  if (typeof window === 'undefined' || typeof fetch === 'undefined') {
    return Promise.resolve(true);
  }

  const probePromise = fetch(url, { method: 'HEAD', cache: 'no-cache' })
    .then((res) => {
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      return res.ok && !contentType.includes('text/html');
    })
    .catch(() => false);

  glbAvailabilityCache.set(url, probePromise);
  return probePromise;
}

/**
 * Limpia la caché de disponibilidad para detectar nuevos `.glb` agregados en caliente sin recargar la página.
 */
export function clearGlbAvailabilityCache(): void {
  glbAvailabilityCache.clear();
}

/**
 * Carga dinámica, deduplicada, con control de concurrencia y caché LRU de un archivo `.glb`.
 */
export async function loadVehicleGLTF(
  rawUrl: string,
  onProgress?: (loadedBytes: number, totalBytes: number) => void,
  timeoutMs = 15000,
): Promise<GLTF> {
  const url = normalizePublicModelUrl(rawUrl);

  const cached = gltfCache.get(url);
  if (cached) {
    cached.lastAccessedAt = performance.now();
    onProgress?.(1, 1);
    return cached.gltf;
  }

  if (loadingPromises.has(url)) {
    return loadingPromises.get(url)!;
  }

  const available = await probeGlbUrlAvailable(url);
  if (!available) {
    throw new Error(`[Vehicle3DLoader] Archivo GLB aún no disponible en /public/models: ${url}`);
  }

  const taskPromise = (async (): Promise<GLTF> => {
    await acquireDownloadSlot();
    try {
      const recheck = gltfCache.get(url);
      if (recheck) {
        recheck.lastAccessedAt = performance.now();
        return recheck.gltf;
      }

      return await new Promise<GLTF>((resolve, reject) => {
        const loader = getSharedGLTFLoader();
        let isSettled = false;
        const timer = setTimeout(() => {
          if (!isSettled) {
            isSettled = true;
            reject(
              new Error(
                `[Vehicle3DLoader] Tiempo de espera agotado (${timeoutMs}ms) descargando ${url}`,
              ),
            );
          }
        }, timeoutMs);

        loader.load(
          url,
          (gltf) => {
            if (isSettled) return;
            isSettled = true;
            clearTimeout(timer);
            gltf.scene.traverse((node) => {
              if ((node as THREE.Mesh).isMesh) {
                const mesh = node as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                if (mesh.geometry && !mesh.geometry.attributes.normal) {
                  mesh.geometry.computeVertexNormals();
                }
              }
            });
            touchCacheEntry(url, gltf);
            resolve(gltf);
          },
          (xhr) => {
            if (!isSettled && onProgress && xhr.total > 0) {
              onProgress(xhr.loaded, xhr.total);
            }
          },
          (error) => {
            if (isSettled) return;
            isSettled = true;
            clearTimeout(timer);
            glbAvailabilityCache.set(url, Promise.resolve(false));
            reject(error);
          },
        );
      });
    } finally {
      loadingPromises.delete(url);
      releaseDownloadSlot();
    }
  })();

  loadingPromises.set(url, taskPromise);
  return taskPromise;
}

/**
 * Resuelve dinámicamente el `.glb` propio de un vehículo por su ID probando sus rutas candidatas en paralelo ligero.
 */
export async function resolveDedicatedVehicleGLTF(
  vehicleId: string,
  onProgress?: (loadedBytes: number, totalBytes: number) => void,
): Promise<{ gltf: GLTF; url: string; config: Vehicle3DConfig } | null> {
  const config = getVehicle3DConfig(vehicleId);
  if (!config) return null;

  const candidates =
    config.candidateUrls && config.candidateUrls.length > 0
      ? config.candidateUrls
      : [config.glbUrl];

  // Sondear disponibilidad de candidatos en paralelo (HEAD ultraligero en caché)
  const availability = await Promise.all(
    candidates.map((candidate) => probeGlbUrlAvailable(candidate)),
  );

  for (let i = 0; i < candidates.length; i++) {
    if (!availability[i]) continue;
    const url = normalizePublicModelUrl(candidates[i]);
    try {
      const gltf = await loadVehicleGLTF(url, onProgress);
      return {
        gltf,
        url,
        config: { ...config, glbUrl: url, isProvisional3D: false },
      };
    } catch {
      // Continuar con el siguiente candidato disponible
    }
  }

  return null;
}

export interface DynamicVehicleLoadOptions {
  allowFallback?: boolean;
  onProgress?: (loadedBytes: number, totalBytes: number) => void;
}

export interface LoadedVehicleModelResult {
  gltf: GLTF;
  url: string;
  config: Vehicle3DConfig;
  usedFallback: boolean;
}

/**
 * API unificada de carga dinámica por ID de vehículo (`VehicleModelId`).
 */
export async function loadVehicleModelById(
  vehicleId: string,
  options: DynamicVehicleLoadOptions = {},
): Promise<LoadedVehicleModelResult | null> {
  const dedicated = await resolveDedicatedVehicleGLTF(vehicleId, options.onProgress);
  if (dedicated) {
    return { ...dedicated, usedFallback: false };
  }

  if (!options.allowFallback) {
    return null;
  }

  const baseConfig = getVehicle3DConfig(vehicleId);
  const fallbackUrl = baseConfig?.fallbackGlbUrl || RESCUE_FALLBACK_GLB_URL;
  const { gltf } = await loadVehicleGLTFWithRescue(
    fallbackUrl,
    RESCUE_FALLBACK_GLB_URL,
    options.onProgress,
  );

  const resolvedConfig: Vehicle3DConfig = baseConfig
    ? { ...baseConfig, glbUrl: fallbackUrl, isProvisional3D: true }
    : {
        modelId: vehicleId,
        name: vehicleId,
        identificationName: vehicleId.toUpperCase(),
        brandColor: '#38bdf8',
        publicFilePath: `/public${RESCUE_FALLBACK_GLB_URL}`,
        glbUrl: RESCUE_FALLBACK_GLB_URL,
        candidateUrls: [RESCUE_FALLBACK_GLB_URL],
        targetLengthMeters: 4.3,
        scale: 4.3 / 0.12,
        rotationY: Math.PI / 2,
        verticalOffset: 0,
        isUnifiedMesh: false,
        isProvisional3D: true,
      };

  return {
    gltf,
    url: resolvedConfig.glbUrl,
    config: resolvedConfig,
    usedFallback: true,
  };
}

/**
 * Precarga dinámica de múltiples vehículos por ID con reporte de progreso agregado (0..1).
 */
export async function preloadVehicleModels(
  vehicleIds: string[],
  options: {
    allowFallback?: boolean;
    onProgress?: (overallFraction: number) => void;
  } = {},
): Promise<void> {
  const uniqueIds = Array.from(new Set(vehicleIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    options.onProgress?.(1);
    return;
  }

  const progressById = new Map<string, number>(uniqueIds.map((id) => [id, 0]));
  const emitProgress = () => {
    if (!options.onProgress) return;
    const sum = Array.from(progressById.values()).reduce((acc, v) => acc + v, 0);
    options.onProgress(sum / uniqueIds.length);
  };

  await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        await loadVehicleModelById(id, {
          allowFallback: options.allowFallback,
          onProgress: (loaded, total) => {
            if (total > 0) {
              progressById.set(id, Math.min(0.96, (loaded / total) * 0.96));
              emitProgress();
            }
          },
        });
      } catch {
        // Si un modelo opcional aún no existe y allowFallback=false, continuar sin bloquear
      } finally {
        progressById.set(id, 1);
        emitProgress();
      }
    }),
  );
}

/**
 * Programa la precarga silenciosa en tiempo ocioso del navegador (`requestIdleCallback`)
 * para los vehículos adyacentes en un carrusel sin competir con el render principal.
 */
export function scheduleIdleVehiclePreload(vehicleIds: string[]): () => void {
  if (typeof window === 'undefined') return () => {};
  let cancelled = false;

  const run = () => {
    if (cancelled) return;
    void preloadVehicleModels(vehicleIds, { allowFallback: false });
  };

  const win = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

  if (typeof win.requestIdleCallback === 'function') {
    const handle = win.requestIdleCallback(run, { timeout: 1200 });
    return () => {
      cancelled = true;
      win.cancelIdleCallback?.(handle);
    };
  }

  const timer = window.setTimeout(run, 280);
  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}

/**
 * Carga con sistema de rescate automático (auto-fallback) para la carrera 3D.
 */
export async function loadVehicleGLTFWithRescue(
  primaryUrl: string,
  fallbackUrl = RESCUE_FALLBACK_GLB_URL,
  onProgress?: (loadedBytes: number, totalBytes: number) => void,
): Promise<{ gltf: GLTF; usedFallback: boolean }> {
  try {
    const gltf = await loadVehicleGLTF(primaryUrl, onProgress);
    return { gltf, usedFallback: false };
  } catch {
    try {
      const gltf = await loadVehicleGLTF(fallbackUrl, onProgress);
      return { gltf, usedFallback: true };
    } catch {
      const gltf = await loadVehicleGLTF(RESCUE_FALLBACK_GLB_URL, onProgress);
      return { gltf, usedFallback: true };
    }
  }
}

/**
 * Clona una instancia del modelo 3D calibrado listo para colocar en la escena.
 * Preserva íntegramente mallas, UV, brillo y materiales PBR originales del GLB.
 */
export function createCalibratedVehicle3DInstance(
  config: Vehicle3DConfig,
  gltf: GLTF,
  envMap?: THREE.Texture | null,
): THREE.Group {
  const container = new THREE.Group();
  container.name = `vehicle_3d_${config.modelId}`;

  const model = gltf.scene.clone(true);

  const rawBox = new THREE.Box3().setFromObject(model);
  const rawSize = rawBox.getSize(new THREE.Vector3());
  const rawLength = Math.max(rawSize.x, rawSize.z) || 0.12;

  const targetLength =
    config.targetLengthMeters ||
    (config.scale > 0 && config.scale < 6 ? config.scale * 1.996 : config.scale * 0.12) ||
    4.27;
  const actualScale = targetLength / rawLength;
  const verticalOffset = -rawBox.min.y * actualScale;

  model.scale.set(actualScale, actualScale, actualScale);

  const effectiveRotationY = rawSize.x >= rawSize.z ? config.rotationY : 0;
  model.rotation.y = effectiveRotationY;
  model.position.y = verticalOffset;

  const clonedMaterials: THREE.Material[] = [];

  model.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      if (mesh.geometry && !mesh.geometry.attributes.normal) {
        mesh.geometry.computeVertexNormals();
      }

      const label = `${mesh.name} ${mesh.parent?.name || ''}`.toLowerCase();
      const isWheelPart = /(wheel|rueda|tire|tyre|neumatico)/i.test(label);

      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const upgraded = materials.map((mat) => {
        if (!mat) return mat;
        const stdMat = mat as THREE.MeshStandardMaterial;
        if (!stdMat.isMeshStandardMaterial) {
          const fallbackClone = mat.clone();
          clonedMaterials.push(fallbackClone);
          return fallbackClone;
        }

        // Clonar el material PBR original del archivo .glb preservando íntegramente sus
        // texturas baseColor, metallicRoughness, normalMap, aoMap y factores originales.
        const clonedMat = stdMat.clone();

        if (clonedMat.map && clonedMat.map instanceof THREE.Texture) {
          clonedMat.map.colorSpace = THREE.SRGBColorSpace;
          clonedMat.map.anisotropy = isSoftwareGlLoader ? 1 : 8;
        }
        if (clonedMat.emissiveMap && clonedMat.emissiveMap instanceof THREE.Texture) {
          clonedMat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
        }
        if (!mesh.geometry?.attributes.uv) {
          clonedMat.normalMap = null;
        }
        if (clonedMat.aoMap && mesh.geometry?.attributes.uv && !mesh.geometry.attributes.uv2) {
          mesh.geometry.setAttribute('uv2', mesh.geometry.attributes.uv);
        }

        // En modelos GLB con baseColorTexture horneado (p.ej. Tracker RS negro / Corolla Cross blanco),
        // los generadores 3D suelen grabar B=255 (metalness=1.0) y G=0 (roughness=0.0) en metallicRoughnessTexture.
        // Bajo IBL (RoomEnvironment con paredes blancas), incluso metalness=0.26 + roughness=0 refleja un velo gris/plateado
        // sobre carrocerías negras. Con metalness <= 0.05 y envMapIntensity <= 0.10 preservamos el 95%+ del pigmento real
        // de baseColorTexture mientras las luces direccionales mantienen brillos especulares nítidos.
        if (clonedMat.map) {
          clonedMat.metalness = Math.min(clonedMat.metalness, 0.05);
        }
        if (!clonedMat.roughnessMap && clonedMat.roughness < 0.14 && !clonedMat.transparent) {
          clonedMat.roughness = 0.22;
        }

        clonedMat.envMap = envMap || stdMat.envMap || null;
        clonedMat.envMapIntensity = clonedMat.map ? (isWheelPart ? 0.08 : 0.10) : (isWheelPart ? 0.38 : 0.45);
        clonedMat.needsUpdate = true;

        clonedMaterials.push(clonedMat);
        return clonedMat;
      });

      mesh.material = Array.isArray(mesh.material) ? upgraded : upgraded[0];
    }
  });

  container.userData.disposeMaterials = () => {
    clonedMaterials.forEach((m) => m.dispose());
  };
  container.add(model);
  return container;
}
