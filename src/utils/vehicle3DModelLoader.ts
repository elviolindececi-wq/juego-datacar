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

import {
  BUNDLED_DEDICATED_GLB_URLS,
  DEFAULT_PROVISIONAL_WHEEL_MODEL,
  GENERIC_CUSTOM_CAR_GLB_URL,
  GENERIC_CUSTOM_CAR_MODEL_ID,
  GENERIC_CUSTOM_CAR_PUBLIC_PATH,
  RESCUE_FALLBACK_GLB_URL,
  SECONDARY_FALLBACK_GLB_URL,
  VEHICLE_3D_REGISTRY,
  VEHICLE_GLB_PATHS,
  VEHICLE_PUBLIC_MODEL_FILES,
  getCustomVehicleGlbUrl,
  getVehicle3DConfig,
  getVehicleGlbPath,
  hasVehicle3DModel,
  normalizePublicModelUrl,
  onCustomVehicleGlbUrlChanged,
  registerCustomVehicleGlbUrl,
  unregisterCustomVehicleGlbUrl,
  type Vehicle3DConfig,
  type VehicleModelId,
} from './vehicleModelRegistry.ts';

export {
  BUNDLED_DEDICATED_GLB_URLS,
  DEFAULT_PROVISIONAL_WHEEL_MODEL,
  GENERIC_CUSTOM_CAR_GLB_URL,
  GENERIC_CUSTOM_CAR_MODEL_ID,
  GENERIC_CUSTOM_CAR_PUBLIC_PATH,
  RESCUE_FALLBACK_GLB_URL,
  SECONDARY_FALLBACK_GLB_URL,
  VEHICLE_3D_REGISTRY,
  VEHICLE_GLB_PATHS,
  VEHICLE_PUBLIC_MODEL_FILES,
  getCustomVehicleGlbUrl,
  getVehicle3DConfig,
  getVehicleGlbPath,
  hasVehicle3DModel,
  normalizePublicModelUrl,
  registerCustomVehicleGlbUrl,
  unregisterCustomVehicleGlbUrl,
};
export type { Vehicle3DConfig, VehicleModelId };

// ============================================================================
// MOTOR DE CARGA DINÁMICA EFICIENTE (Caché LRU + Cola de Concurrencia + Draco)
// ============================================================================

export interface VehicleLoaderRuntimeConfig {
  headTimeoutMs: number;
  loadTimeoutMs: number;
  maxRetries: number;
  retryBaseDelayMs: number;
  negativeCacheTtlMs: number;
  enableConsoleTelemetry: boolean;
}

export const DEFAULT_VEHICLE_LOADER_CONFIG: Readonly<VehicleLoaderRuntimeConfig> = Object.freeze({
  headTimeoutMs: 6000,
  loadTimeoutMs: 45000,
  maxRetries: 2,
  retryBaseDelayMs: 650,
  negativeCacheTtlMs: 8000,
  enableConsoleTelemetry: false,
});

let runtimeLoaderConfig: VehicleLoaderRuntimeConfig = {
  ...DEFAULT_VEHICLE_LOADER_CONFIG,
};

export function configureVehicleModelLoader(
  overrides: Partial<VehicleLoaderRuntimeConfig>,
): VehicleLoaderRuntimeConfig {
  runtimeLoaderConfig = {
    ...runtimeLoaderConfig,
    ...overrides,
    headTimeoutMs: Math.max(250, overrides.headTimeoutMs ?? runtimeLoaderConfig.headTimeoutMs),
    loadTimeoutMs: Math.max(500, overrides.loadTimeoutMs ?? runtimeLoaderConfig.loadTimeoutMs),
    maxRetries: Math.max(0, Math.min(5, Math.floor(overrides.maxRetries ?? runtimeLoaderConfig.maxRetries))),
    retryBaseDelayMs: Math.max(20, overrides.retryBaseDelayMs ?? runtimeLoaderConfig.retryBaseDelayMs),
    negativeCacheTtlMs: Math.max(0, overrides.negativeCacheTtlMs ?? runtimeLoaderConfig.negativeCacheTtlMs),
  };
  return { ...runtimeLoaderConfig };
}

export function getVehicleModelLoaderConfig(): VehicleLoaderRuntimeConfig {
  return { ...runtimeLoaderConfig };
}

export function resetVehicleModelLoaderConfig(): VehicleLoaderRuntimeConfig {
  runtimeLoaderConfig = { ...DEFAULT_VEHICLE_LOADER_CONFIG };
  return { ...runtimeLoaderConfig };
}

export type VehicleModelLifecycleStage =
  | 'requested'
  | 'provisional_active'
  | 'downloading'
  | 'decoded'
  | 'rendered_glb'
  | 'fallback_retained';

export interface VehicleModelDiagnosticEntry {
  vehicleId: string;
  requestedCandidates: string[];
  activeUrl: string | null;
  stage: VehicleModelLifecycleStage;
  loadedBytes: number;
  totalBytes: number;
  progressPercent: number;
  attempts: number;
  rawMeshCount: number;
  embeddedAnimationCount: number;
  wheelRigMode: string | null;
  wheelCount: number;
  groundMinY: number | null;
  calibratedLengthM: number | null;
  lastError: string | null;
  updatedAtMs: number;
}

const vehicleModelDiagnostics = new Map<string, VehicleModelDiagnosticEntry>();

function syncWindowDiagnostics(): void {
  if (typeof window === 'undefined') return;
  (
    window as Window & {
      __DATACAR_GLB_DIAGNOSTICS__?: Record<string, VehicleModelDiagnosticEntry>;
    }
  ).__DATACAR_GLB_DIAGNOSTICS__ = Object.fromEntries(vehicleModelDiagnostics.entries());
}

export function recordVehicleModelDiagnostic(
  vehicleId: string,
  patch: Partial<Omit<VehicleModelDiagnosticEntry, 'vehicleId' | 'updatedAtMs'>>,
): VehicleModelDiagnosticEntry {
  const prev = vehicleModelDiagnostics.get(vehicleId);
  const next: VehicleModelDiagnosticEntry = {
    vehicleId,
    requestedCandidates: patch.requestedCandidates ?? prev?.requestedCandidates ?? [],
    activeUrl: patch.activeUrl !== undefined ? patch.activeUrl : (prev?.activeUrl ?? null),
    stage: patch.stage ?? prev?.stage ?? 'requested',
    loadedBytes: patch.loadedBytes ?? prev?.loadedBytes ?? 0,
    totalBytes: patch.totalBytes ?? prev?.totalBytes ?? 0,
    progressPercent: patch.progressPercent ?? prev?.progressPercent ?? 0,
    attempts: patch.attempts ?? prev?.attempts ?? 0,
    rawMeshCount: patch.rawMeshCount ?? prev?.rawMeshCount ?? 0,
    embeddedAnimationCount: patch.embeddedAnimationCount ?? prev?.embeddedAnimationCount ?? 0,
    wheelRigMode: patch.wheelRigMode !== undefined ? patch.wheelRigMode : (prev?.wheelRigMode ?? null),
    wheelCount: patch.wheelCount ?? prev?.wheelCount ?? 0,
    groundMinY: patch.groundMinY !== undefined ? patch.groundMinY : (prev?.groundMinY ?? null),
    calibratedLengthM:
      patch.calibratedLengthM !== undefined ? patch.calibratedLengthM : (prev?.calibratedLengthM ?? null),
    lastError: patch.lastError !== undefined ? patch.lastError : (prev?.lastError ?? null),
    updatedAtMs: Date.now(),
  };
  vehicleModelDiagnostics.set(vehicleId, next);
  syncWindowDiagnostics();
  if (
    runtimeLoaderConfig.enableConsoleTelemetry &&
    patch.stage &&
    patch.stage !== prev?.stage
  ) {
    console.info(
      `[DATACAR GLB] ${vehicleId} -> ${next.stage} (${next.activeUrl ?? 'provisional'}) intentos=${next.attempts} ruedas=${next.wheelCount}`,
    );
  }
  return next;
}

export function getVehicleModelDiagnostics(): Record<string, VehicleModelDiagnosticEntry> {
  return Object.fromEntries(vehicleModelDiagnostics.entries());
}

export function getVehicleModelDiagnostic(vehicleId: string): VehicleModelDiagnosticEntry | undefined {
  return vehicleModelDiagnostics.get(vehicleId);
}

export function clearVehicleModelDiagnostics(): void {
  vehicleModelDiagnostics.clear();
  syncWindowDiagnostics();
}

interface AvailabilityCacheRecord {
  available: boolean;
  expiresAtMs: number;
}

interface CachedGLTFEntry {
  gltf: GLTF;
  lastAccessedAt: number;
  byteLength: number;
}

const MAX_CACHED_GLB_MODELS = 12;
const MAX_CONCURRENT_GLB_DOWNLOADS = 3;
const ESTIMATED_GLB_BYTES_FALLBACK = 19_500_000;

const glbAvailabilityCache = new Map<string, AvailabilityCacheRecord>();
const glbProbeInFlight = new Map<string, Promise<boolean>>();
const gltfCache = new Map<string, CachedGLTFEntry>();
const loadingPromises = new Map<string, Promise<GLTF>>();

onCustomVehicleGlbUrlChanged(() => {
  gltfCache.clear();
  loadingPromises.clear();
  glbAvailabilityCache.clear();
  glbProbeInFlight.clear();
});

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

function touchCacheEntry(url: string, gltf: GLTF, byteLength = 0): void {
  gltfCache.set(url, { gltf, lastAccessedAt: performance.now(), byteLength });
  if (gltfCache.size <= MAX_CACHED_GLB_MODELS) return;

  let oldestKey: string | null = null;
  let oldestTime = Infinity;
  for (const [key, entry] of gltfCache.entries()) {
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

export function isValidGlbBinaryHeader(bytes: ArrayBuffer | Uint8Array): boolean {
  const view =
    bytes instanceof Uint8Array
      ? bytes.byteLength >= 4
        ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
        : null
      : bytes.byteLength >= 4
        ? new DataView(bytes)
        : null;
  if (!view) return false;
  return view.getUint32(0, true) === 0x46546c67;
}

function countSceneMeshes(root: THREE.Object3D): number {
  let count = 0;
  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) count += 1;
  });
  return count;
}

function waitDelay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

async function probeRangeBinaryGlb(url: string, timeoutMs: number): Promise<'available' | 'missing' | 'transient'> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? globalThis.setTimeout(() => controller.abort(), timeoutMs) : 0;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-19' },
      cache: 'default',
      signal: controller?.signal,
    });
    const contentType = (res.headers?.get?.('content-type') || '').toLowerCase();
    if (res.status === 404 || res.status === 410 || contentType.includes('text/html')) {
      controller?.abort();
      return 'missing';
    }
    if (!res.ok && res.status !== 206) {
      controller?.abort();
      return res.status >= 500 || res.status === 429 ? 'transient' : 'missing';
    }
    if (res.body && typeof res.body.getReader === 'function') {
      const reader = res.body.getReader();
      const first = await reader.read();
      void reader.cancel().catch(() => {});
      if (first.value && first.value.byteLength >= 4) {
        return isValidGlbBinaryHeader(first.value) ? 'available' : 'missing';
      }
      return 'available';
    }
    if (typeof res.arrayBuffer === 'function') {
      const buf = await res.arrayBuffer();
      if (buf.byteLength >= 4) {
        return isValidGlbBinaryHeader(buf) ? 'available' : 'missing';
      }
    }
    return 'available';
  } catch {
    return 'transient';
  } finally {
    if (timeoutId) globalThis.clearTimeout(timeoutId);
  }
}

/**
 * Comprueba dinámicamente si el binario `.glb` está disponible en `/public/models/` o Vercel CDN:
 * - Usa `headTimeoutMs` configurable (por defecto 6000 ms, apto para 4G/CDN frío).
 * - Si `HEAD` falla por bloqueo (`405`/`501`) o micro-corte/timeout, verifica mediante `GET Range: bytes=0-19` + cabecera mágica `glTF`.
 * - NUNCA bloquea permanentemente un vehículo por un error temporal de red: los fallos transitorios no envenenan la caché y los `404` expiran tras `negativeCacheTtlMs`.
 */
export function probeGlbUrlAvailable(
  rawUrl: string,
  options?: { headTimeoutMs?: number },
): Promise<boolean> {
  const url = normalizePublicModelUrl(rawUrl);
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return Promise.resolve(true);
  }
  if (BUNDLED_DEDICATED_GLB_URLS.has(url) || gltfCache.has(url)) {
    return Promise.resolve(true);
  }

  const now = Date.now();
  const cached = glbAvailabilityCache.get(url);
  if (cached) {
    if (cached.available || now < cached.expiresAtMs) {
      return Promise.resolve(cached.available);
    }
    glbAvailabilityCache.delete(url);
  }

  if (typeof fetch === 'undefined') {
    return Promise.resolve(true);
  }
  if (typeof window === 'undefined' && (globalThis as { __DATACAR_FORCE_FETCH_IN_NODE__?: boolean }).__DATACAR_FORCE_FETCH_IN_NODE__ !== true) {
    return Promise.resolve(true);
  }

  const inFlight = glbProbeInFlight.get(url);
  if (inFlight) return inFlight;

  const headTimeoutMs = Math.max(250, options?.headTimeoutMs ?? runtimeLoaderConfig.headTimeoutMs);

  const probePromise = (async (): Promise<boolean> => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? globalThis.setTimeout(() => controller.abort(), headTimeoutMs) : 0;
    let outcome: 'available' | 'missing' | 'transient' = 'transient';

    try {
      const res = await fetch(url, {
        method: 'HEAD',
        cache: 'default',
        signal: controller?.signal,
      });
      const contentType = (res.headers?.get?.('content-type') || '').toLowerCase();
      if (res.ok && !contentType.includes('text/html')) {
        outcome = 'available';
      } else if (res.status === 405 || res.status === 501 || res.status === 403) {
        outcome = await probeRangeBinaryGlb(url, headTimeoutMs);
      } else if (res.status === 404 || res.status === 410 || contentType.includes('text/html')) {
        outcome = 'missing';
      } else {
        outcome = await probeRangeBinaryGlb(url, headTimeoutMs);
      }
    } catch {
      // Si HEAD expiró por latencia inicial de CDN/móvil, dar una oportunidad con Range binario
      outcome = await probeRangeBinaryGlb(url, headTimeoutMs);
    } finally {
      if (timeoutId) globalThis.clearTimeout(timeoutId);
    }

    if (outcome === 'available') {
      glbAvailabilityCache.set(url, { available: true, expiresAtMs: Number.POSITIVE_INFINITY });
      return true;
    }
    if (outcome === 'missing' && runtimeLoaderConfig.negativeCacheTtlMs > 0) {
      glbAvailabilityCache.set(url, {
        available: false,
        expiresAtMs: Date.now() + runtimeLoaderConfig.negativeCacheTtlMs,
      });
    }
    // Si outcome === 'transient', NO guardar false en glbAvailabilityCache para permitir reintento inmediato
    return false;
  })().finally(() => {
    glbProbeInFlight.delete(url);
  });

  glbProbeInFlight.set(url, probePromise);
  return probePromise;
}

/**
 * Limpia la caché de disponibilidad (y opcionalmente de modelos) para detectar nuevos `.glb` o forzar reintento limpio.
 */
export function clearGlbAvailabilityCache(alsoClearModels = false): void {
  glbAvailabilityCache.clear();
  glbProbeInFlight.clear();
  if (alsoClearModels) {
    gltfCache.clear();
    loadingPromises.clear();
  }
}

class NonRetryableGlbMissingError extends Error {
  public readonly isConfirmedMissing = true;
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableGlbMissingError';
  }
}

async function fetchGlbBufferWithProgress(
  url: string,
  timeoutMs: number,
  onProgress?: (loadedBytes: number, totalBytes: number) => void,
): Promise<ArrayBuffer> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timedOut = false;
  const timer = globalThis.setTimeout(() => {
    timedOut = true;
    controller?.abort();
  }, timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      cache: 'default',
      signal: controller?.signal,
    });
    const contentType = (res.headers?.get?.('content-type') || '').toLowerCase();
    if (res.status === 404 || res.status === 410 || contentType.includes('text/html')) {
      throw new NonRetryableGlbMissingError(
        `[Vehicle3DLoader] Archivo GLB no encontrado o respuesta HTML (${res.status}) en ${url}`,
      );
    }
    if (!res.ok) {
      throw new Error(`[Vehicle3DLoader] Respuesta HTTP ${res.status} descargando ${url}`);
    }

    const headerLen = Number(res.headers?.get?.('content-length') || '0');
    const knownTotal = Number.isFinite(headerLen) && headerLen > 0 ? headerLen : 0;

    if (res.body && typeof res.body.getReader === 'function') {
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let loaded = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.byteLength > 0) {
          chunks.push(value);
          loaded += value.byteLength;
          if (onProgress) {
            if (knownTotal > 0) {
              onProgress(loaded, Math.max(loaded, knownTotal));
            } else {
              const dynamicTotal = Math.max(loaded + 1_200_000, ESTIMATED_GLB_BYTES_FALLBACK);
              onProgress(loaded, dynamicTotal);
            }
          }
        }
      }

      const merged = new Uint8Array(loaded);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
      }
      if (!isValidGlbBinaryHeader(merged)) {
        throw new NonRetryableGlbMissingError(
          `[Vehicle3DLoader] El recurso descargado no tiene cabecera binaria glTF 2.0 válida: ${url}`,
        );
      }
      onProgress?.(loaded, loaded);
      return merged.buffer;
    }

    const buffer = await res.arrayBuffer();
    if (!isValidGlbBinaryHeader(buffer)) {
      throw new NonRetryableGlbMissingError(
        `[Vehicle3DLoader] El recurso descargado no tiene cabecera binaria glTF 2.0 válida: ${url}`,
      );
    }
    onProgress?.(buffer.byteLength, buffer.byteLength);
    return buffer;
  } catch (err) {
    if (timedOut) {
      throw new Error(`[Vehicle3DLoader] Tiempo de espera agotado (${timeoutMs}ms) descargando ${url}`);
    }
    throw err;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

export interface LoadVehicleGLTFOptions {
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  vehicleId?: string;
}

/**
 * Carga dinámica, deduplicada, con progreso real en bytes, reintentos controlados con backoff
 * y caché LRU de un archivo `.glb` sin bloquear permanentemente ante errores temporales.
 */
export async function loadVehicleGLTF(
  rawUrl: string,
  onProgress?: (loadedBytes: number, totalBytes: number) => void,
  timeoutMsOrOptions?: number | LoadVehicleGLTFOptions,
): Promise<GLTF> {
  const url = normalizePublicModelUrl(rawUrl);
  const opts: LoadVehicleGLTFOptions =
    typeof timeoutMsOrOptions === 'number'
      ? { timeoutMs: timeoutMsOrOptions }
      : (timeoutMsOrOptions ?? {});

  const timeoutMs = Math.max(500, opts.timeoutMs ?? runtimeLoaderConfig.loadTimeoutMs);
  const maxRetries = Math.max(0, opts.maxRetries ?? runtimeLoaderConfig.maxRetries);
  const retryBaseDelayMs = Math.max(20, opts.retryBaseDelayMs ?? runtimeLoaderConfig.retryBaseDelayMs);

  const cached = gltfCache.get(url);
  if (cached) {
    cached.lastAccessedAt = performance.now();
    const total = cached.byteLength || 1;
    onProgress?.(total, total);
    return cached.gltf;
  }

  if (loadingPromises.has(url)) {
    return loadingPromises.get(url)!;
  }

  const taskPromise = (async (): Promise<GLTF> => {
    await acquireDownloadSlot();
    try {
      const recheck = gltfCache.get(url);
      if (recheck) {
        recheck.lastAccessedAt = performance.now();
        const total = recheck.byteLength || 1;
        onProgress?.(total, total);
        return recheck.gltf;
      }

      let lastError: unknown = null;
      const totalAllowedAttempts = 1 + maxRetries;

      for (let attempt = 1; attempt <= totalAllowedAttempts; attempt++) {
        try {
          if (opts.vehicleId) {
            recordVehicleModelDiagnostic(opts.vehicleId, {
              activeUrl: url,
              stage: 'downloading',
              attempts: attempt,
              lastError: null,
            });
          }

          if (typeof fetch === 'function' && !url.startsWith('data:')) {
            const arrayBuffer = await fetchGlbBufferWithProgress(
              url,
              timeoutMs,
              (loaded, total) => {
                onProgress?.(loaded, total);
                if (opts.vehicleId) {
                  const pct = total > 0 ? Math.min(99, Math.round((loaded / total) * 100)) : 0;
                  recordVehicleModelDiagnostic(opts.vehicleId, {
                    activeUrl: url,
                    stage: 'downloading',
                    loadedBytes: loaded,
                    totalBytes: total,
                    progressPercent: pct,
                    attempts: attempt,
                  });
                }
              },
            );

            const loader = getSharedGLTFLoader();
            const lastSlash = url.lastIndexOf('/');
            const resourcePath = url.startsWith('blob:')
              ? '/'
              : lastSlash >= 0
                ? url.slice(0, lastSlash + 1)
                : '/models/';

            const gltf = await new Promise<GLTF>((resolve, reject) => {
              loader.parse(arrayBuffer, resourcePath, resolve, reject);
            });

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

            glbAvailabilityCache.set(url, {
              available: true,
              expiresAtMs: Number.POSITIVE_INFINITY,
            });
            touchCacheEntry(url, gltf, arrayBuffer.byteLength);

            if (opts.vehicleId) {
              recordVehicleModelDiagnostic(opts.vehicleId, {
                activeUrl: url,
                stage: 'decoded',
                loadedBytes: arrayBuffer.byteLength,
                totalBytes: arrayBuffer.byteLength,
                progressPercent: 100,
                attempts: attempt,
                rawMeshCount: countSceneMeshes(gltf.scene),
                embeddedAnimationCount: Array.isArray(gltf.animations) ? gltf.animations.length : 0,
                lastError: null,
              });
            }
            return gltf;
          }

          // Respaldo para entornos con data: URLs
          const gltf = await new Promise<GLTF>((resolve, reject) => {
            const loader = getSharedGLTFLoader();
            let isSettled = false;
            const timer = globalThis.setTimeout(() => {
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
              (loadedGltf) => {
                if (isSettled) return;
                isSettled = true;
                globalThis.clearTimeout(timer);
                touchCacheEntry(url, loadedGltf);
                resolve(loadedGltf);
              },
              (xhr) => {
                if (!isSettled && onProgress && xhr.total > 0) {
                  onProgress(xhr.loaded, xhr.total);
                }
              },
              (err) => {
                if (isSettled) return;
                isSettled = true;
                globalThis.clearTimeout(timer);
                reject(err);
              },
            );
          });
          return gltf;
        } catch (err) {
          lastError = err;
          const isConfirmedMissing =
            err instanceof NonRetryableGlbMissingError ||
            Boolean((err as { isConfirmedMissing?: boolean })?.isConfirmedMissing);

          if (isConfirmedMissing) {
            if (runtimeLoaderConfig.negativeCacheTtlMs > 0) {
              glbAvailabilityCache.set(url, {
                available: false,
                expiresAtMs: Date.now() + runtimeLoaderConfig.negativeCacheTtlMs,
              });
            }
            break;
          }

          // Error transitorio (timeout, micro-corte 4G, 502/503 CDN): NO envenenar glbAvailabilityCache
          glbAvailabilityCache.delete(url);
          if (attempt < totalAllowedAttempts) {
            await waitDelay(retryBaseDelayMs * attempt);
          }
        }
      }

      if (opts.vehicleId) {
        recordVehicleModelDiagnostic(opts.vehicleId, {
          lastError: lastError instanceof Error ? lastError.message : String(lastError),
        });
      }
      throw lastError instanceof Error
        ? lastError
        : new Error(`[Vehicle3DLoader] No se pudo cargar ${url}`);
    } finally {
      loadingPromises.delete(url);
      releaseDownloadSlot();
    }
  })();

  loadingPromises.set(url, taskPromise);
  return taskPromise;
}

/**
 * Devuelve síncronamente el modelo `.glb` dedicado si ya se encuentra en la caché en memoria.
 * Prioriza siempre los candidatos con ruedas separadas (`preferredWheeledGlbUrls`).
 */
export function getCachedDedicatedVehicleGLTF(
  vehicleId: string,
): { gltf: GLTF; url: string; config: Vehicle3DConfig } | null {
  const config = getVehicle3DConfig(vehicleId);
  if (!config) return null;

  const customUrl = getCustomVehicleGlbUrl(vehicleId);
  const rawCandidates = [
    ...(customUrl ? [customUrl] : []),
    ...(config.preferredWheeledGlbUrls ?? []),
    ...(config.candidateUrls && config.candidateUrls.length > 0
      ? config.candidateUrls
      : [config.glbUrl]),
  ];

  for (const candidate of rawCandidates) {
    const url = normalizePublicModelUrl(candidate);
    const cached = gltfCache.get(url);
    if (cached) {
      cached.lastAccessedAt = performance.now();
      return {
        gltf: cached.gltf,
        url,
        config: { ...config, glbUrl: url, isProvisional3D: false },
      };
    }
  }

  return null;
}

/**
 * Resuelve dinámicamente el `.glb` definitivo de un vehículo por su ID:
 * 1. Si el vehículo define `preferredWheeledGlbUrls` (p. ej. `tracker-rs-wheels.glb` en Vercel/GitHub),
 *    verifica y descarga primero esa variante segmentada con 4 ruedas reales.
 * 2. Si existe un binario incluido en el paquete local (`BUNDLED_DEDICATED_GLB_URLS`), lo carga sin `HEAD` extra.
 * 3. Si no está incluido localmente, sondea y descarga con reintentos controlados cada candidato de `candidateUrls`.
 */
export async function resolveDedicatedVehicleGLTF(
  vehicleId: string,
  onProgress?: (loadedBytes: number, totalBytes: number) => void,
  overrideUrl?: string,
): Promise<{ gltf: GLTF; url: string; config: Vehicle3DConfig } | null> {
  const config = getVehicle3DConfig(vehicleId);
  if (!config) return null;

  if (overrideUrl) {
    const normalizedOverride = encodeURI(normalizePublicModelUrl(overrideUrl));
    const cachedOverride = gltfCache.get(normalizedOverride);
    if (cachedOverride?.gltf) {
      const total = cachedOverride.byteLength || 1;
      onProgress?.(total, total);
      return {
        gltf: cachedOverride.gltf,
        url: normalizedOverride,
        config: { ...config, glbUrl: normalizedOverride, isProvisional3D: false },
      };
    }
    try {
      const gltf = await loadVehicleGLTF(normalizedOverride, onProgress, {
        vehicleId,
        timeoutMs: 120000,
      });
      return {
        gltf,
        url: normalizedOverride,
        config: { ...config, glbUrl: normalizedOverride, isProvisional3D: false },
      };
    } catch {
      // Si falla la URL explícita, continuar con los candidatos estándar del vehículo
    }
  }

  const cachedImmediate = getCachedDedicatedVehicleGLTF(vehicleId);
  if (cachedImmediate) {
    const total = gltfCache.get(cachedImmediate.url)?.byteLength || 1;
    onProgress?.(total, total);
    recordVehicleModelDiagnostic(vehicleId, {
      activeUrl: cachedImmediate.url,
      stage: 'decoded',
      loadedBytes: total,
      totalBytes: total,
      progressPercent: 100,
      rawMeshCount: countSceneMeshes(cachedImmediate.gltf.scene),
      embeddedAnimationCount: Array.isArray(cachedImmediate.gltf.animations)
        ? cachedImmediate.gltf.animations.length
        : 0,
      lastError: null,
    });
    return cachedImmediate;
  }

  const customUrl = getCustomVehicleGlbUrl(vehicleId);
  const preferredWheeled = (config.preferredWheeledGlbUrls ?? []).map((c) =>
    normalizePublicModelUrl(c),
  );
  const rawCandidates =
    config.candidateUrls && config.candidateUrls.length > 0
      ? config.candidateUrls
      : [config.glbUrl];
  const orderedCandidates = Array.from(
    new Set([
      ...(customUrl ? [normalizePublicModelUrl(customUrl)] : []),
      ...preferredWheeled,
      ...rawCandidates.map((c) => normalizePublicModelUrl(c)),
    ]),
  );

  recordVehicleModelDiagnostic(vehicleId, {
    requestedCandidates: orderedCandidates,
    stage: 'requested',
    progressPercent: 0,
    lastError: null,
  });

  if (customUrl) {
    try {
      const normalizedCustom = normalizePublicModelUrl(customUrl);
      const gltf = await loadVehicleGLTF(normalizedCustom, onProgress, { vehicleId });
      return {
        gltf,
        url: normalizedCustom,
        config: { ...config, glbUrl: normalizedCustom, isProvisional3D: false },
      };
    } catch {
      // Continuar con candidatos estándar si fallara la URL personalizada
    }
  }

  // 1. Prioridad máxima: variantes con ruedas separadas (`tracker-rs-wheels.glb`, etc.) cuando existen en GitHub/Vercel
  for (const wheeledUrl of preferredWheeled) {
    const available = await probeGlbUrlAvailable(wheeledUrl);
    if (!available) continue;
    try {
      const gltf = await loadVehicleGLTF(wheeledUrl, onProgress, { vehicleId });
      return {
        gltf,
        url: wheeledUrl,
        config: {
          ...config,
          glbUrl: wheeledUrl,
          isUnifiedMesh: false,
          isProvisional3D: false,
        },
      };
    } catch {
      // Continuar al siguiente candidato
    }
  }

  const candidates = Array.from(
    new Set(rawCandidates.map((c) => normalizePublicModelUrl(c))),
  );

  // 2. Vía rápida: si existe un binario incluido físicamente en `/public/models/`, cargarlo directo sin HEAD extra
  const bundledCandidate = candidates.find((url) => BUNDLED_DEDICATED_GLB_URLS.has(url));
  if (bundledCandidate) {
    try {
      const gltf = await loadVehicleGLTF(bundledCandidate, onProgress, { vehicleId });
      return {
        gltf,
        url: bundledCandidate,
        config: { ...config, glbUrl: bundledCandidate, isProvisional3D: false },
      };
    } catch {
      // Continuar con el resto de candidatos si fallara
    }
  }

  // 3. Sondeo + descarga con reintentos para los 8 modelos desplegados en Vercel/GitHub
  const triedUrls = new Set<string>([
    ...preferredWheeled,
    ...(bundledCandidate ? [bundledCandidate] : []),
  ]);

  for (const url of candidates) {
    if (triedUrls.has(url)) continue;
    const available = await probeGlbUrlAvailable(url);
    if (!available) continue;
    try {
      const gltf = await loadVehicleGLTF(url, onProgress, { vehicleId });
      return {
        gltf,
        url,
        config: { ...config, glbUrl: url, isProvisional3D: false },
      };
    } catch {
      // Intentar el siguiente alias candidato disponible
    }
  }

  recordVehicleModelDiagnostic(vehicleId, {
    stage: 'fallback_retained',
  });
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

export type VehicleMaterialRole =
  | 'baked_unified'
  | 'glass'
  | 'tire'
  | 'rim_alloy'
  | 'chrome_trim'
  | 'headlight'
  | 'taillight'
  | 'lacquer_paint';

export interface ClassifyVehicleMaterialOptions {
  hasBakedTextureMap: boolean;
  isTransparent?: boolean;
  opacity?: number;
  metalness?: number;
}

/**
 * Clasifica semánticamente el rol PBR de un material o sub-malla de vehículo
 * para calibrar pintura con barniz, llantas, neumáticos, cristales y ópticas
 * sin alterar carrocerías con textura unificada horneada (`baked_unified`).
 */
export function classifyVehicleMaterialRole(
  meshName: string,
  materialName: string,
  opts: ClassifyVehicleMaterialOptions,
): VehicleMaterialRole {
  const token = `${meshName} ${materialName}`.toLowerCase();
  if (/(headlight|farol|faro|drl|projector|headlamp)/i.test(token)) {
    return 'headlight';
  }
  if (/(taillight|tail_lamp|brake|stop|rear_lamp|trasera)/i.test(token)) {
    return 'taillight';
  }
  if (/(glass|window|windshield|windscreen|cristal|vidrio|parabrisa|luneta)/i.test(token)) {
    return 'glass';
  }
  if (/(tire|tyre|neumatico|rubber|goma|caucho)/i.test(token)) {
    return 'tire';
  }
  if (/(?:^|[^a-z])rim(?:s)?(?:[^a-z]|$)|alloy|llanta|spoke|wheel_metal|caliper|disc/i.test(token)) {
    return 'rim_alloy';
  }
  if (/(chrome|cromo|trim|grille|parrilla|badge|emblem|exhaust|escape)/i.test(token)) {
    return 'chrome_trim';
  }
  if (!opts.hasBakedTextureMap && opts.isTransparent && (opts.opacity ?? 1) < 0.92) {
    return 'glass';
  }
  if (opts.hasBakedTextureMap) {
    return 'baked_unified';
  }
  if ((opts.metalness ?? 0) >= 0.85) {
    return 'chrome_trim';
  }
  return 'lacquer_paint';
}

export interface CreateCalibratedVehicleOptions {
  maxAnisotropy?: number;
}

/**
 * Clona una instancia del modelo 3D calibrado listo para colocar en la escena.
 * Preserva íntegramente mallas, UV y materiales horneados de GLB unificados,
 * y calibra reflejos, barniz clearcoat, cristales, llantas y neumáticos PBR en piezas separadas.
 */
export function createCalibratedVehicle3DInstance(
  config: Vehicle3DConfig,
  gltf: GLTF,
  envMap?: THREE.Texture | null,
  options: CreateCalibratedVehicleOptions = {},
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

  const targetAnisotropy = Math.max(1, Math.floor(options.maxAnisotropy ?? (isSoftwareGlLoader ? 1 : 8)));
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

        const role = classifyVehicleMaterialRole(label, stdMat.name || '', {
          hasBakedTextureMap: Boolean(stdMat.map),
          isTransparent: stdMat.transparent,
          opacity: stdMat.opacity,
          metalness: stdMat.metalness,
        });

        // Clonar el material PBR original del archivo .glb preservando íntegramente sus
        // texturas baseColor, metallicRoughness, normalMap, aoMap y factores originales.
        let calibratedMat: THREE.MeshStandardMaterial;
        if (role === 'lacquer_paint' || role === 'glass' || role === 'rim_alloy') {
          const physMat = new THREE.MeshPhysicalMaterial({
            name: stdMat.name,
            color: stdMat.color.clone(),
            map: stdMat.map,
            normalMap: stdMat.normalMap,
            normalScale: stdMat.normalScale?.clone(),
            roughnessMap: stdMat.roughnessMap,
            metalnessMap: stdMat.metalnessMap,
            aoMap: stdMat.aoMap,
            aoMapIntensity: stdMat.aoMapIntensity,
            emissive: stdMat.emissive.clone(),
            emissiveMap: stdMat.emissiveMap,
            emissiveIntensity: stdMat.emissiveIntensity,
            transparent: stdMat.transparent,
            opacity: stdMat.opacity,
            side: stdMat.side,
          });
          if (role === 'lacquer_paint') {
            physMat.metalness = THREE.MathUtils.clamp(stdMat.metalness || 0.42, 0.25, 0.72);
            physMat.roughness = THREE.MathUtils.clamp(stdMat.roughness || 0.20, 0.14, 0.30);
            physMat.clearcoat = 1.0;
            physMat.clearcoatRoughness = 0.06;
            physMat.ior = 1.52;
            physMat.envMapIntensity = 1.05;
          } else if (role === 'glass') {
            physMat.color.lerp(new THREE.Color('#0a1522'), 0.65);
            physMat.metalness = 0.08;
            physMat.roughness = 0.05;
            physMat.clearcoat = 1.0;
            physMat.clearcoatRoughness = 0.04;
            physMat.reflectivity = 0.96;
            physMat.envMapIntensity = 1.35;
          } else {
            // rim_alloy
            physMat.metalness = 0.90;
            physMat.roughness = 0.19;
            physMat.clearcoat = 0.72;
            physMat.clearcoatRoughness = 0.12;
            physMat.envMapIntensity = 1.15;
          }
          calibratedMat = physMat;
        } else {
          calibratedMat = stdMat.clone();
        }

        if (calibratedMat.map && calibratedMat.map instanceof THREE.Texture) {
          calibratedMat.map.colorSpace = THREE.SRGBColorSpace;
          calibratedMat.map.anisotropy = targetAnisotropy;
        }
        if (calibratedMat.emissiveMap && calibratedMat.emissiveMap instanceof THREE.Texture) {
          calibratedMat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
        }
        if (!mesh.geometry?.attributes.uv) {
          calibratedMat.normalMap = null;
        }
        if (calibratedMat.aoMap && mesh.geometry?.attributes.uv && !mesh.geometry.attributes.uv2) {
          mesh.geometry.setAttribute('uv2', mesh.geometry.attributes.uv);
        }

        if (role === 'baked_unified') {
          // En modelos GLB con baseColorTexture horneado (p.ej. Tracker RS negro / Corolla Cross blanco),
          // preservamos el 95%+ del pigmento real manteniendo metalness <= 0.05 y envMapIntensity <= 0.10.
          if (calibratedMat.map) {
            calibratedMat.metalness = Math.min(calibratedMat.metalness, 0.05);
          }
          if (!calibratedMat.roughnessMap && calibratedMat.roughness < 0.14 && !calibratedMat.transparent) {
            calibratedMat.roughness = 0.22;
          }
          calibratedMat.envMapIntensity = calibratedMat.map
            ? (isWheelPart ? 0.08 : 0.10)
            : (isWheelPart ? 0.38 : 0.45);
        } else if (role === 'tire') {
          if (!calibratedMat.map) {
            calibratedMat.color.lerp(new THREE.Color('#13161b'), 0.5);
          }
          calibratedMat.metalness = 0.03;
          calibratedMat.roughness = Math.max(calibratedMat.roughness || 0.88, 0.86);
          calibratedMat.envMapIntensity = calibratedMat.map ? 0.12 : 0.24;
        } else if (role === 'chrome_trim') {
          calibratedMat.metalness = 0.94;
          calibratedMat.roughness = 0.14;
          calibratedMat.envMapIntensity = 1.25;
        } else if (role === 'headlight') {
          calibratedMat.roughness = 0.09;
          calibratedMat.metalness = 0.12;
          calibratedMat.emissiveIntensity = Math.max(calibratedMat.emissiveIntensity || 0, 1.35);
          calibratedMat.envMapIntensity = 1.15;
        } else if (role === 'taillight') {
          calibratedMat.roughness = 0.12;
          calibratedMat.metalness = 0.10;
          calibratedMat.emissiveIntensity = Math.max(calibratedMat.emissiveIntensity || 0, 0.85);
          calibratedMat.envMapIntensity = 0.95;
        }

        calibratedMat.envMap = envMap || stdMat.envMap || null;
        calibratedMat.needsUpdate = true;

        clonedMaterials.push(calibratedMat);
        return calibratedMat;
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

