import { detectMobilePerformanceMode } from './mobilePerformanceProfile.ts';

/**
 * DATACAR ARENA V14 — Perfiles Gráficos Adaptativos (inspirado en escalado GPU móvil de alta fidelidad)
 * Controla EXCLUSIVAMENTE parámetros visuales (DPR, antialiasing, sombras, post-procesado,
 * sondas de reflexión, anisotropía, distancias LOD y densidad de partículas).
 * Nunca modifica físicas de conducción, tiempos, circuitos, catálogo ni progresión.
 */

export type GraphicsQualityPreset = 'auto' | 'performance' | 'balanced' | 'quality';
export type ResolvedGraphicsTier = 'performance' | 'balanced' | 'quality';
export type PostProcessingMode = 'off' | 'grade_only' | 'full_bloom';
export type ReflectionProbeMode = 'off' | 'low' | 'high';

export interface GraphicsQualityOptionMeta {
  id: GraphicsQualityPreset;
  label: string;
  shortLabel: string;
  description: string;
}

export const GRAPHICS_QUALITY_OPTIONS: readonly GraphicsQualityOptionMeta[] = [
  {
    id: 'auto',
    label: 'AUTOMÁTICO',
    shortLabel: 'Auto',
    description: 'Ajusta el nivel visual en tiempo real con histéresis según tus FPS.',
  },
  {
    id: 'performance',
    label: 'RENDIMIENTO',
    shortLabel: 'Rend.',
    description: 'Prioriza fluidez: DPR contenido, sin sombras costosas ni bloom multipase.',
  },
  {
    id: 'balanced',
    label: 'EQUILIBRADO',
    shortLabel: 'Equil.',
    description: 'Materiales PBR mejorados, sombras optimizadas y reflejos controlados.',
  },
  {
    id: 'quality',
    label: 'CALIDAD',
    shortLabel: 'Calidad',
    description: 'Máximo detalle visual, sombras 2048px, reflejos altos y post-procesado completo.',
  },
] as const;

export const GRAPHICS_QUALITY_STORAGE_KEY = 'datacar_graphics_profile_v1';

const VALID_PRESETS = new Set<GraphicsQualityPreset>([
  'auto',
  'performance',
  'balanced',
  'quality',
]);

type PresetListener = (preset: GraphicsQualityPreset) => void;
const presetListeners = new Set<PresetListener>();

export function isValidGraphicsQualityPreset(value: unknown): value is GraphicsQualityPreset {
  return typeof value === 'string' && VALID_PRESETS.has(value as GraphicsQualityPreset);
}

export function getStoredGraphicsQualityPreset(): GraphicsQualityPreset {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return 'auto';
  }
  try {
    const raw = window.localStorage.getItem(GRAPHICS_QUALITY_STORAGE_KEY);
    if (isValidGraphicsQualityPreset(raw)) return raw;
  } catch {
    // Almacenamiento bloqueado o privado
  }
  return 'auto';
}

export function setStoredGraphicsQualityPreset(preset: GraphicsQualityPreset): GraphicsQualityPreset {
  const safePreset: GraphicsQualityPreset = isValidGraphicsQualityPreset(preset) ? preset : 'auto';
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      window.localStorage.setItem(GRAPHICS_QUALITY_STORAGE_KEY, safePreset);
    } catch {
      // Ignorar errores de cuota
    }
  }
  presetListeners.forEach((cb) => {
    try {
      cb(safePreset);
    } catch {
      // No propagar errores de suscriptores UI
    }
  });
  return safePreset;
}

export function subscribeGraphicsQualityPreset(listener: PresetListener): () => void {
  presetListeners.add(listener);
  return () => {
    presetListeners.delete(listener);
  };
}

export interface ResolvedGraphicsSettings {
  preset: GraphicsQualityPreset;
  resolvedTier: ResolvedGraphicsTier;
  maxDpr: number;
  minAdaptiveDpr: number;
  antialias: boolean;
  shadowsEnabled: boolean;
  shadowMapSize: 512 | 1024 | 2048;
  postProcessingMode: PostProcessingMode;
  reflectionProbeMode: ReflectionProbeMode;
  reflectionProbeSize: 64 | 96 | 160;
  reflectionProbeIntervalSec: number;
  maxAnisotropy: 1 | 2 | 4 | 8 | 16;
  lodDistanceScale: number;
  particleDensity: number;
  speedEffectsEnabled: boolean;
  fogDensityMultiplier: number;
}

export function resolveInitialAutoTier(args: {
  isMobilePerf: boolean;
  isSoftwareGl: boolean;
  hardwareConcurrency?: number;
}): ResolvedGraphicsTier {
  if (args.isSoftwareGl) return 'performance';
  if (args.isMobilePerf) {
    const cores = args.hardwareConcurrency ?? 4;
    return cores >= 6 ? 'balanced' : 'performance';
  }
  // Conservador al inicio: arranca en EQUILIBRADO y sube a CALIDAD si la GPU sostiene >= 56 FPS
  return 'balanced';
}

export function resolveGraphicsSettings(args: {
  preset: GraphicsQualityPreset;
  autoTier?: ResolvedGraphicsTier;
  isMobilePerf?: boolean;
  isSoftwareGl?: boolean;
  compact?: boolean;
  devicePixelRatio?: number;
  hardwareConcurrency?: number;
}): ResolvedGraphicsSettings {
  const isMobilePerf = args.isMobilePerf ?? detectMobilePerformanceMode();
  const isSoftwareGl = Boolean(args.isSoftwareGl);
  const dpr = Math.max(1, args.devicePixelRatio ?? 1);

  const resolvedTier: ResolvedGraphicsTier =
    args.preset === 'auto'
      ? args.autoTier ??
        resolveInitialAutoTier({
          isMobilePerf,
          isSoftwareGl,
          hardwareConcurrency: args.hardwareConcurrency,
        })
      : args.preset;

  if (resolvedTier === 'performance') {
    return {
      preset: args.preset,
      resolvedTier,
      maxDpr: isSoftwareGl ? 1 : Math.min(dpr, isMobilePerf ? 1.15 : 1.1),
      minAdaptiveDpr: 0.75,
      antialias: false,
      shadowsEnabled: false,
      shadowMapSize: 512,
      postProcessingMode: 'off',
      reflectionProbeMode: 'off',
      reflectionProbeSize: 64,
      reflectionProbeIntervalSec: 3.5,
      maxAnisotropy: isSoftwareGl ? 1 : 2,
      lodDistanceScale: 0.72,
      particleDensity: 0.35,
      speedEffectsEnabled: false,
      fogDensityMultiplier: isMobilePerf ? 1.12 : 1.04,
    };
  }

  if (resolvedTier === 'balanced') {
    return {
      preset: args.preset,
      resolvedTier,
      maxDpr: isSoftwareGl
        ? 1
        : Math.min(dpr, args.compact ? 1.25 : isMobilePerf ? 1.4 : 1.5),
      minAdaptiveDpr: 0.82,
      antialias: !isSoftwareGl && (!isMobilePerf || dpr < 1.5),
      shadowsEnabled: !isSoftwareGl,
      shadowMapSize: 1024,
      postProcessingMode: isSoftwareGl || isMobilePerf ? 'grade_only' : 'full_bloom',
      reflectionProbeMode: isSoftwareGl ? 'off' : 'low',
      reflectionProbeSize: 96,
      reflectionProbeIntervalSec: 0.7,
      maxAnisotropy: isSoftwareGl ? 1 : 4,
      lodDistanceScale: 1.0,
      particleDensity: 0.72,
      speedEffectsEnabled: true,
      fogDensityMultiplier: isMobilePerf ? 1.08 : 1.0,
    };
  }

  // 'quality'
  return {
    preset: args.preset,
    resolvedTier,
    maxDpr: isSoftwareGl ? 1 : Math.min(dpr, isMobilePerf ? 1.75 : 2.0),
    minAdaptiveDpr: 0.9,
    antialias: !isSoftwareGl,
    shadowsEnabled: !isSoftwareGl,
    shadowMapSize: isMobilePerf ? 1024 : 2048,
    postProcessingMode: 'full_bloom',
    reflectionProbeMode: isSoftwareGl ? 'off' : 'high',
    reflectionProbeSize: isMobilePerf ? 96 : 160,
    reflectionProbeIntervalSec: isMobilePerf ? 0.55 : 0.32,
    maxAnisotropy: isSoftwareGl ? 1 : isMobilePerf ? 8 : 16,
    lodDistanceScale: isMobilePerf ? 1.12 : 1.28,
    particleDensity: 1.0,
    speedEffectsEnabled: true,
    fogDensityMultiplier: 1.0,
  };
}

// ============================================================================
// AUTO-ESCALADOR CON HISTÉRESIS PARA MODO "AUTOMÁTICO"
// ============================================================================

export interface AutoQualityScalerState {
  tier: ResolvedGraphicsTier;
  lowPerfStreak: number;
  highPerfStreak: number;
  lastTransitionAtMs: number;
  lastDowngradeAtMs: number;
}

export function createAutoQualityScalerState(
  initialTier: ResolvedGraphicsTier = 'balanced',
  nowMs = 0,
): AutoQualityScalerState {
  return {
    tier: initialTier,
    lowPerfStreak: 0,
    highPerfStreak: 0,
    lastTransitionAtMs: nowMs,
    lastDowngradeAtMs: -Infinity,
  };
}

export interface AutoQualityStepResult {
  tier: ResolvedGraphicsTier;
  changed: boolean;
  direction: 'none' | 'downgrade' | 'upgrade';
}

/**
 * Evalúa ventana de FPS y frame time real con histéresis estricta para evitar oscilaciones:
 * - Baja tras 2 ventanas seguidas < 36 FPS o > 28 ms (cooldown mínimo 4.5s).
 * - Sube tras 5 ventanas seguidas >= 56 FPS y <= 18.5 ms (cooldown >= 10s tras una bajada).
 */
export function stepAutoQualityScaler(
  state: AutoQualityScalerState,
  sample: {
    fps: number;
    avgFrameTimeMs: number;
    nowMs: number;
    isSoftwareGl?: boolean;
  },
): AutoQualityStepResult {
  if (sample.isSoftwareGl) {
    const changed = state.tier !== 'performance';
    state.tier = 'performance';
    state.lowPerfStreak = 0;
    state.highPerfStreak = 0;
    return { tier: state.tier, changed, direction: changed ? 'downgrade' : 'none' };
  }

  const isStruggling = sample.fps < 36 || sample.avgFrameTimeMs > 28.0;
  const hasHeadroom = sample.fps >= 56 && sample.avgFrameTimeMs <= 18.5;

  if (isStruggling) {
    state.lowPerfStreak += 1;
    state.highPerfStreak = 0;
  } else if (hasHeadroom) {
    state.highPerfStreak += 1;
    state.lowPerfStreak = 0;
  } else {
    state.lowPerfStreak = Math.max(0, state.lowPerfStreak - 1);
    state.highPerfStreak = Math.max(0, state.highPerfStreak - 1);
  }

  const sinceTransition = sample.nowMs - state.lastTransitionAtMs;
  if (state.lowPerfStreak >= 2 && sinceTransition >= 4500 && state.tier !== 'performance') {
    state.tier = state.tier === 'quality' ? 'balanced' : 'performance';
    state.lowPerfStreak = 0;
    state.highPerfStreak = 0;
    state.lastTransitionAtMs = sample.nowMs;
    state.lastDowngradeAtMs = sample.nowMs;
    return { tier: state.tier, changed: true, direction: 'downgrade' };
  }

  const sinceDowngrade = sample.nowMs - state.lastDowngradeAtMs;
  if (
    state.highPerfStreak >= 5 &&
    sinceTransition >= 6000 &&
    sinceDowngrade >= 10000 &&
    state.tier !== 'quality'
  ) {
    state.tier = state.tier === 'performance' ? 'balanced' : 'quality';
    state.lowPerfStreak = 0;
    state.highPerfStreak = 0;
    state.lastTransitionAtMs = sample.nowMs;
    return { tier: state.tier, changed: true, direction: 'upgrade' };
  }

  return { tier: state.tier, changed: false, direction: 'none' };
}

// ============================================================================
// DIAGNÓSTICO DE COMPRESIÓN DE ACTIVOS (Draco + KTX2/Basis Readiness)
// ============================================================================

export interface AssetCompressionReadiness {
  dracoDecoderPath: string;
  dracoActive: boolean;
  ktx2TranscoderPath: string | null;
  ktx2Ready: boolean;
  offlineProceduralTextures: boolean;
  recommendation: string;
}

export function getAssetCompressionReadiness(hasLocalBasisTranscoder = false): AssetCompressionReadiness {
  return {
    dracoDecoderPath: '/draco/gltf/',
    dracoActive: true,
    ktx2TranscoderPath: hasLocalBasisTranscoder ? '/basis/' : null,
    ktx2Ready: hasLocalBasisTranscoder,
    offlineProceduralTextures: true,
    recommendation: hasLocalBasisTranscoder
      ? 'Draco y KTX2/Basis activos en local.'
      : 'Draco local activo en /draco/gltf/. Para reducir VRAM de GLB externos (17–22 MB), transcodificar off-line a KTX2 ETC1S/UASTC con gltf-transform y hospedar /public/basis/.',
  };
}
