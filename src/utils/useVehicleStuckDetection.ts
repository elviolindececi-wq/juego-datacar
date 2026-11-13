/**
 * DATACAR ARENA — Detector Modular de Vehículo Atascado (3 Segundos, §6 y §13)
 * Observador puro de solo lectura: NO altera físicas, velocidades, colisiones ni puntajes.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface StuckDetectionConfig {
  /** Segundos consecutivos de intento de avance con desplazamiento casi nulo (por defecto 3.0s). */
  requiredStuckSeconds?: number;
  /** Desplazamiento máximo acumulado en metros reales del mundo para considerar el auto atrapado. */
  maxDisplacementMeters?: number;
  /** Velocidad máxima en km/h compatible con atasco real (evita falsos positivos a baja velocidad fluida). */
  maxStuckSpeedKmh?: number;
  /** Período de gracia tras pulsar "SEGUIR INTENTANDO" para no reabrir el modal de inmediato. */
  keepTryingGraceSeconds?: number;
}

export interface StuckDetectorState {
  anchorX: number | null;
  anchorZ: number | null;
  stuckElapsedSeconds: number;
  graceCooldownSeconds: number;
  isModalOpen: boolean;
  triggerCount: number;
}

export interface StuckDetectorSample {
  /** La carrera está activa y en curso (sin terminar ni en pantalla previa). */
  isRaceActive: boolean;
  isPaused: boolean;
  isLoading: boolean;
  isCountdown: boolean;
  isFinished: boolean;
  isDocumentHidden: boolean;
  /** Intención explícita de acelerar o retroceder del jugador. */
  hasMovementIntent: boolean;
  /** Posición real del vehículo en unidades métricas del motor. */
  positionX: number;
  positionZ: number;
  /** Velocidad actual reportada por el estado de simulación (km/h). */
  speedKmh: number;
  /** Paso temporal real en segundos. */
  dtSeconds: number;
}

const DEFAULT_CONFIG: Required<StuckDetectionConfig> = {
  requiredStuckSeconds: 3.0,
  maxDisplacementMeters: 0.55,
  maxStuckSpeedKmh: 4.8,
  keepTryingGraceSeconds: 6.0,
};

export function createStuckDetectorState(): StuckDetectorState {
  return {
    anchorX: null,
    anchorZ: null,
    stuckElapsedSeconds: 0,
    graceCooldownSeconds: 0,
    isModalOpen: false,
    triggerCount: 0,
  };
}

export function resetStuckDetectorState(state: StuckDetectorState): StuckDetectorState {
  state.anchorX = null;
  state.anchorZ = null;
  state.stuckElapsedSeconds = 0;
  state.graceCooldownSeconds = 0;
  state.isModalOpen = false;
  return state;
}

export function acknowledgeKeepTrying(
  state: StuckDetectorState,
  config?: StuckDetectionConfig,
): StuckDetectorState {
  const grace = config?.keepTryingGraceSeconds ?? DEFAULT_CONFIG.keepTryingGraceSeconds;
  state.isModalOpen = false;
  state.stuckElapsedSeconds = 0;
  state.anchorX = null;
  state.anchorZ = null;
  state.graceCooldownSeconds = Math.max(1.5, grace);
  return state;
}

/**
 * Actualiza de forma determinista el detector de atasco usando desplazamiento euclidiano real (x, z).
 * Mutación in-place libre de GC para uso seguro desde el bucle de simulación.
 */
export function stepStuckDetector(
  state: StuckDetectorState,
  sample: StuckDetectorSample,
  config?: StuckDetectionConfig,
): StuckDetectorState {
  const cfgRequired = config?.requiredStuckSeconds ?? DEFAULT_CONFIG.requiredStuckSeconds;
  const cfgMaxDisp = config?.maxDisplacementMeters ?? DEFAULT_CONFIG.maxDisplacementMeters;
  const cfgMaxSpeed = config?.maxStuckSpeedKmh ?? DEFAULT_CONFIG.maxStuckSpeedKmh;

  const dt = Number.isFinite(sample.dtSeconds) ? Math.min(Math.max(0, sample.dtSeconds), 0.25) : 0;

  // Si la simulación está suspendida, pausada, cargando, en cuenta regresiva o finalizada:
  // no acumular tiempo ni disparar falsos positivos.
  if (
    !sample.isRaceActive ||
    sample.isPaused ||
    sample.isLoading ||
    sample.isCountdown ||
    sample.isFinished ||
    sample.isDocumentHidden
  ) {
    if (sample.isFinished || !sample.isRaceActive) {
      state.isModalOpen = false;
    }
    state.stuckElapsedSeconds = 0;
    state.anchorX = null;
    state.anchorZ = null;
    return state;
  }

  // Mientras el modal ya está abierto, esperar decisión del jugador sin re-disparar.
  if (state.isModalOpen) {
    return state;
  }

  // Descontar período de gracia tras "SEGUIR INTENTANDO"
  if (state.graceCooldownSeconds > 0) {
    state.graceCooldownSeconds = Math.max(0, state.graceCooldownSeconds - dt);
    state.stuckElapsedSeconds = 0;
    state.anchorX = null;
    state.anchorZ = null;
    return state;
  }

  // Sin intención de movimiento (detención voluntaria en semáforo o inercia libre): reiniciar contador
  if (!sample.hasMovementIntent) {
    state.stuckElapsedSeconds = 0;
    state.anchorX = null;
    state.anchorZ = null;
    return state;
  }

  if (state.anchorX === null || state.anchorZ === null) {
    state.anchorX = sample.positionX;
    state.anchorZ = sample.positionZ;
    state.stuckElapsedSeconds = 0;
  }

  const displacementM = Math.hypot(
    sample.positionX - state.anchorX,
    sample.positionZ - state.anchorZ,
  );
  const absSpeedKmh = Math.abs(sample.speedKmh);

  // Si el vehículo logra desplazarse más allá del umbral o supera la velocidad mínima, reiniciar el contador
  if (displacementM >= cfgMaxDisp || absSpeedKmh >= cfgMaxSpeed) {
    state.anchorX = sample.positionX;
    state.anchorZ = sample.positionZ;
    state.stuckElapsedSeconds = 0;
    return state;
  }

  state.stuckElapsedSeconds += dt;
  if (state.stuckElapsedSeconds >= cfgRequired) {
    state.isModalOpen = true;
    state.triggerCount += 1;
    state.stuckElapsedSeconds = 0;
    state.anchorX = null;
    state.anchorZ = null;
  }

  return state;
}

export interface UseVehicleStuckDetectionResult {
  isStuckModalOpen: boolean;
  reportSimulationFrame: (sample: StuckDetectorSample) => boolean;
  handleKeepTrying: () => void;
  resetDetection: () => void;
}

/**
 * Hook React desacoplado que expone `reportSimulationFrame` (0 re-renders por frame
 * salvo cuando cambia la visibilidad del modal) y limpia observadores al desmontar.
 */
export function useVehicleStuckDetection(
  config?: StuckDetectionConfig,
): UseVehicleStuckDetectionResult {
  const [isStuckModalOpen, setIsStuckModalOpen] = useState(false);
  const detectorRef = useRef<StuckDetectorState>(createStuckDetectorState());
  const configRef = useRef<StuckDetectionConfig | undefined>(config);
  configRef.current = config;

  const resetDetection = useCallback(() => {
    resetStuckDetectorState(detectorRef.current);
    setIsStuckModalOpen(false);
  }, []);

  const handleKeepTrying = useCallback(() => {
    acknowledgeKeepTrying(detectorRef.current, configRef.current);
    setIsStuckModalOpen(false);
  }, []);

  const reportSimulationFrame = useCallback((sample: StuckDetectorSample): boolean => {
    const prevOpen = detectorRef.current.isModalOpen;
    stepStuckDetector(detectorRef.current, sample, configRef.current);
    const nextOpen = detectorRef.current.isModalOpen;
    if (prevOpen !== nextOpen) {
      setIsStuckModalOpen(nextOpen);
    }
    return nextOpen;
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        detectorRef.current.stuckElapsedSeconds = 0;
        detectorRef.current.anchorX = null;
        detectorRef.current.anchorZ = null;
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      resetStuckDetectorState(detectorRef.current);
    };
  }, []);

  return {
    isStuckModalOpen,
    reportSimulationFrame,
    handleKeepTrying,
    resetDetection,
  };
}
