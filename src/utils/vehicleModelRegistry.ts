/**
 * DATACAR ARENA — Registro ligero (sin Three.js) de rutas `.glb`, URLs personalizadas
 * y metadatos 3D de vehículos para mantener el bundle inicial libre del motor WebGL.
 */

export type VehicleModelId =
  | 'chery-t2-pro-max'
  | 'chery-t4-pro-luxury-hev'
  | 'chevrolet-tracker-lite'
  | 'toyota-corolla-cross-seg-2027'
  | 'kia-carens-ex'
  | 'nissan-kicks-2027'
  | 'suzuki-fronx'
  | 'lamborghini-proyecto-fantasma';

export const LAMBORGHINI_PROYECTO_FANTASMA_ID = 'lamborghini-proyecto-fantasma';
export const LAMBORGHINI_BONUS_PUBLIC_PATH = '/public/models/lamborghini-bonus.glb';
export const LAMBORGHINI_BONUS_GLB_URL = '/models/lamborghini-bonus.glb';

export const VEHICLE_PUBLIC_MODEL_FILES: Record<VehicleModelId, string> = {
  'chery-t2-pro-max': '/public/models/chery-t2-pro-max.glb',
  'chery-t4-pro-luxury-hev': '/public/models/chery-t4-pro-luxury-hev.glb',
  'chevrolet-tracker-lite': '/public/models/chevrolet-tracker-lite.glb',
  'toyota-corolla-cross-seg-2027': '/public/models/toyota-corolla-cross-seg-2027.glb',
  'kia-carens-ex': '/public/models/kia-carens-ex.glb',
  'nissan-kicks-2027': '/public/models/nissan-kicks-2027.glb',
  'suzuki-fronx': '/public/models/suzuki-fronx.glb',
  'lamborghini-proyecto-fantasma': LAMBORGHINI_BONUS_PUBLIC_PATH,
};

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
  'lamborghini-proyecto-fantasma': normalizePublicModelUrl(VEHICLE_PUBLIC_MODEL_FILES['lamborghini-proyecto-fantasma']),
};

const runtimeCustomGlbUrls = new Map<string, string>();
const customUrlChangeListeners = new Set<() => void>();

export function onCustomVehicleGlbUrlChanged(listener: () => void): () => void {
  customUrlChangeListeners.add(listener);
  return () => {
    customUrlChangeListeners.delete(listener);
  };
}

export function registerCustomVehicleGlbUrl(vehicleId: string, blobOrPublicUrl: string): void {
  const prev = runtimeCustomGlbUrls.get(vehicleId);
  if (prev && prev !== blobOrPublicUrl && prev.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(prev);
    } catch {
      /* ignore */
    }
  }
  runtimeCustomGlbUrls.set(vehicleId, blobOrPublicUrl);
  for (const listener of customUrlChangeListeners) {
    try {
      listener();
    } catch {
      /* ignore */
    }
  }
}

export function unregisterCustomVehicleGlbUrl(vehicleId: string): void {
  const prev = runtimeCustomGlbUrls.get(vehicleId);
  if (prev && prev.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(prev);
    } catch {
      /* ignore */
    }
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
  publicFilePath?: string;
  glbUrl: string;
  candidateUrls?: string[];
  /** Candidatos con ruedas separadas que tienen prioridad sobre un respaldo unificado local cuando existen en el servidor/CDN */
  preferredWheeledGlbUrls?: string[];
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

export const VILLAIN_CONVERTIBLE_1966_PUBLIC_PATH =
  '/public/models/Meshy_AI_Convertible_1966_thun_1115235921_texture.glb';
export const VILLAIN_CONVERTIBLE_1966_GLB_URL = normalizePublicModelUrl(
  VILLAIN_CONVERTIBLE_1966_PUBLIC_PATH,
);

/**
 * Lista canónica de los 8 modelos `.glb` principales de DATACAR ARENA V18 desplegados en GitHub/Vercel.
 */
export const OFFICIAL_V18_GLB_URLS: readonly string[] = [
  '/models/nissan-kicks-2027.glb',
  '/models/kia-carens-ex.glb',
  '/models/toyota-corolla-cross-seg-2027-light.glb',
  '/models/tracker-rs-wheels.glb',
  '/models/chery-t4-pro-luxury-hev.glb',
  '/models/chery-t2-pro-max.glb',
  '/models/suzuki-fronx.glb',
  VILLAIN_CONVERTIBLE_1966_GLB_URL,
];

/**
 * Conjunto de binarios `.glb` incluidos físicamente en `/public/models/` del paquete base
 * para evitar peticiones `HEAD` innecesarias durante el arranque local.
 */
export const BUNDLED_DEDICATED_GLB_URLS = new Set<string>([
  '/models/toyota-corolla-cross-seg-2027-light.glb',
  '/models/tracker-rs.glb',
  '/models/presidential-limousine.glb',
  '/models/lamborghini-bonus.glb',
]);

export const DEFAULT_PROVISIONAL_WHEEL_MODEL = {
  glbUrl: '/models/tracker-rs-wheels.glb',
  fallbackGlbUrl: RESCUE_FALLBACK_GLB_URL,
} as const;

export const VEHICLE_3D_REGISTRY: Record<string, Vehicle3DConfig> = {
  'chery-t4-pro-luxury-hev': {
    modelId: 'chery-t4-pro-luxury-hev',
    name: 'Chery T4 Pro Luxury HEV',
    identificationName: 'CHERY T4 PRO HEV',
    brandColor: '#1d4ed8',
    publicFilePath: VEHICLE_PUBLIC_MODEL_FILES['chery-t4-pro-luxury-hev'],
    glbUrl: VEHICLE_GLB_PATHS['chery-t4-pro-luxury-hev'],
    candidateUrls: [
      '/models/chery-t4-pro-luxury-hev.glb',
      '/models/chery-t4-pro.glb',
      '/models/chery-t4.glb',
      '/models/chery-t4-pro-luxury-hev-wheels.glb',
      '/models/chery-t4-wheels.glb',
    ],
    fallbackGlbUrl: RESCUE_FALLBACK_GLB_URL,
    targetLengthMeters: 4.32,
    scale: 4.32 / 0.12,
    rotationY: Math.PI / 2,
    verticalOffset: 0,
    isUnifiedMesh: false,
    isProvisional3D: true,
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
      '/models/chery-t2-pro-max.glb',
      '/models/chery-t2.glb',
      '/models/chery-t2-pro-max-wheels.glb',
      '/models/chery-t2-wheels.glb',
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
      '/models/suzuki-fronx.glb',
      '/models/fronx.glb',
      '/models/suzuki-fronx-wheels.glb',
      '/models/fronx-wheels.glb',
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
      '/models/toyota-corolla-cross-seg-2027-light.glb',
      '/models/toyota-corolla-cross.glb',
      '/models/corolla-cross.glb',
      VEHICLE_GLB_PATHS['toyota-corolla-cross-seg-2027'],
      '/models/toyota-corolla-cross-seg-2027-wheels.glb',
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
      '/models/nissan-kicks-2027.glb',
      '/models/nissan-kicks.glb',
      '/models/kicks.glb',
      '/models/nissan-kicks-2027-wheels.glb',
      '/models/nissan-kicks-wheels.glb',
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
      '/models/kia-carens-ex.glb',
      '/models/kia-carens.glb',
      '/models/carens.glb',
      '/models/kia-carens-ex-wheels.glb',
      '/models/kia-carens-wheels.glb',
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
    preferredWheeledGlbUrls: [
      '/models/tracker-rs-wheels.glb',
      '/models/chevrolet-tracker-wheels.glb',
    ],
    candidateUrls: [
      '/models/tracker-rs.glb',
      '/models/tracker-rs-wheels.glb',
      '/models/chevrolet-tracker.glb',
      VEHICLE_GLB_PATHS['chevrolet-tracker-lite'],
      '/models/chevrolet-tracker-wheels.glb',
    ],
    fallbackGlbUrl: RESCUE_FALLBACK_GLB_URL,
    targetLengthMeters: 4.27,
    scale: 4.27 / 0.12,
    rotationY: Math.PI / 2,
    verticalOffset: 0,
    isUnifiedMesh: true,
    isProvisional3D: false,
    blenderNotes: 'Prioriza /models/tracker-rs-wheels.glb (ruedas separadas) en Vercel/GitHub con respaldo local en tracker-rs.glb.',
  },
  'lamborghini-proyecto-fantasma': {
    modelId: 'lamborghini-proyecto-fantasma',
    name: 'Lamborghini Proyecto Fantasma',
    identificationName: 'PROYECTO FANTASMA',
    brandColor: '#f59e0b',
    publicFilePath: VEHICLE_PUBLIC_MODEL_FILES['lamborghini-proyecto-fantasma'],
    glbUrl: VEHICLE_GLB_PATHS['lamborghini-proyecto-fantasma'],
    candidateUrls: [
      '/models/lamborghini-bonus.glb',
      '/models/lamborghini.glb',
    ],
    fallbackGlbUrl: '/models/lamborghini-bonus.glb',
    targetLengthMeters: 4.52,
    scale: 4.52 / 0.12,
    rotationY: Math.PI / 2,
    verticalOffset: 0,
    isUnifiedMesh: false,
    isProvisional3D: false,
    blenderNotes: 'Vehículo prototipo secreto Proyecto Fantasma en /public/models/lamborghini-bonus.glb.',
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

export interface VehicleRegistryValidationEntry {
  vehicleId: string;
  primaryGlbUrl: string;
  normalizedCandidates: string[];
  valid: boolean;
}

/**
 * Valida que todos los identificadores oficiales del catálogo tengan rutas `.glb` normalizadas y sin duplicados vacíos.
 */
export function validateVehicleModelRegistry(): VehicleRegistryValidationEntry[] {
  return Object.entries(VEHICLE_3D_REGISTRY).map(([vehicleId, cfg]) => {
    const rawList = [
      ...(cfg.preferredWheeledGlbUrls ?? []),
      ...(cfg.candidateUrls && cfg.candidateUrls.length > 0 ? cfg.candidateUrls : [cfg.glbUrl]),
    ];
    const normalizedCandidates = Array.from(
      new Set(rawList.map((u) => normalizePublicModelUrl(u)).filter(Boolean)),
    );
    const primaryGlbUrl = normalizedCandidates[0] ?? normalizePublicModelUrl(cfg.glbUrl);
    const valid =
      Boolean(vehicleId) &&
      primaryGlbUrl.startsWith('/models/') &&
      primaryGlbUrl.endsWith('.glb') &&
      normalizedCandidates.every((u) => u.startsWith('/models/') && u.endsWith('.glb')) &&
      (cfg.targetLengthMeters ?? 0) > 3.0;
    return {
      vehicleId,
      primaryGlbUrl,
      normalizedCandidates,
      valid,
    };
  });
}
