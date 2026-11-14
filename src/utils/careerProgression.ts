import { useEffect, useState } from 'react';

export type RaceModeVariant = 'city_trial' | 'speed_pro';
export type RaceModeId = RaceModeVariant | 'practice_free';

export const JAIL_DURATION_MS = 2 * 60 * 1000; // 2 minutos exactos sin poder jugar
export const CITY_UNLOCK_MIN_IQ = 700; // Puntaje mínimo en Fase 1 (sobre 1000) para desbloquear Fase 2

export interface CareerProgressionState {
  speedModeUnlocked: boolean;
  bestCityIqScore: number;
  completedCityCircuits: string[];
  jailUntilMs: number;
  jailCircuitName: string | null;
  arrestCount: number;
}

const STORAGE_KEY = 'datacar_arena_progression_v1';
const CHANGE_EVENT = 'datacar-progression-updated';

const DEFAULT_STATE: CareerProgressionState = {
  speedModeUnlocked: false,
  bestCityIqScore: 0,
  completedCityCircuits: [],
  jailUntilMs: 0,
  jailCircuitName: null,
  arrestCount: 0,
};

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadCareerProgression(): CareerProgressionState {
  if (!canUseStorage()) return { ...DEFAULT_STATE };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<CareerProgressionState>;
    return {
      speedModeUnlocked: Boolean(parsed.speedModeUnlocked),
      bestCityIqScore: Number(parsed.bestCityIqScore) || 0,
      completedCityCircuits: Array.isArray(parsed.completedCityCircuits)
        ? parsed.completedCityCircuits.filter((x): x is string => typeof x === 'string')
        : [],
      jailUntilMs: Number(parsed.jailUntilMs) || 0,
      jailCircuitName: typeof parsed.jailCircuitName === 'string' ? parsed.jailCircuitName : null,
      arrestCount: Number(parsed.arrestCount) || 0,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveCareerProgression(next: CareerProgressionState): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    // Ignore storage quota errors
  }
}

export function getRemainingJailSeconds(nowMs = Date.now()): number {
  const st = loadCareerProgression();
  if (!st.jailUntilMs || st.jailUntilMs <= nowMs) return 0;
  return Math.ceil((st.jailUntilMs - nowMs) / 1000);
}

export function isPlayerCurrentlyJailed(nowMs = Date.now()): boolean {
  return getRemainingJailSeconds(nowMs) > 0;
}

export function formatJailCountdown(seconds: number): string {
  const safe = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function triggerPedestrianArrest(circuitName?: string): CareerProgressionState {
  const current = loadCareerProgression();
  const next: CareerProgressionState = {
    ...current,
    jailUntilMs: Date.now() + JAIL_DURATION_MS,
    jailCircuitName: circuitName || 'Asunción',
    arrestCount: current.arrestCount + 1,
  };
  saveCareerProgression(next);
  return next;
}

export function evaluateCityTrialCompletion(args: {
  completed?: boolean;
  finished?: boolean;
  isDnf?: boolean;
  pedestrianHit: boolean;
  motorcycleCollisions?: number;
  iqScore1000: number;
  redLightViolations: number;
  circuitId?: string;
  raceMode?: RaceModeId;
}): {
  newlyUnlocked: boolean;
  speedModeUnlocked: boolean;
  qualifiesThisRun: boolean;
} {
  const current = loadCareerProgression();
  // La Pista de Pruebas (Sin Puntos) nunca otorga puntos ni desbloquea Fase 2
  if (args.raceMode === 'practice_free') {
    return {
      newlyUnlocked: false,
      speedModeUnlocked: current.speedModeUnlocked,
      qualifiesThisRun: false,
    };
  }

  const didCompleteCleanly =
    Boolean(args.completed ?? args.finished) && !args.isDnf;
  // "Hacer bien la primera fase en ciudad": llegar a meta sin chocar peatones ni motociclistas,
  // respetando razonablemente los semáforos (<= 1 infracción roja) y con Driving IQ >= 700.
  const qualifiesThisRun =
    didCompleteCleanly &&
    !args.pedestrianHit &&
    (args.motorcycleCollisions ?? 0) === 0 &&
    args.redLightViolations <= 1 &&
    args.iqScore1000 >= CITY_UNLOCK_MIN_IQ;

  const wasUnlocked = current.speedModeUnlocked;
  const speedModeUnlocked = wasUnlocked || qualifiesThisRun;
  const completedSet = new Set(current.completedCityCircuits);
  if (qualifiesThisRun && args.circuitId) {
    completedSet.add(args.circuitId);
  }

  const next: CareerProgressionState = {
    ...current,
    speedModeUnlocked,
    bestCityIqScore: Math.max(current.bestCityIqScore, didCompleteCleanly ? args.iqScore1000 : 0),
    completedCityCircuits: Array.from(completedSet),
  };
  saveCareerProgression(next);

  return {
    newlyUnlocked: !wasUnlocked && speedModeUnlocked,
    speedModeUnlocked,
    qualifiesThisRun,
  };
}

export function useCareerProgression() {
  const [state, setState] = useState<CareerProgressionState>(() => loadCareerProgression());
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const sync = () => {
      setState(loadCareerProgression());
      setNowMs(Date.now());
    };
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const jailRemainingSec =
    state.jailUntilMs > nowMs ? Math.ceil((state.jailUntilMs - nowMs) / 1000) : 0;

  useEffect(() => {
    if (state.jailUntilMs <= Date.now()) return;
    const interval = window.setInterval(() => {
      const currentNow = Date.now();
      setNowMs(currentNow);
      if (currentNow >= state.jailUntilMs) {
        window.clearInterval(interval);
      }
    }, 250);
    return () => window.clearInterval(interval);
  }, [state.jailUntilMs]);

  return {
    ...state,
    lastJailReasonCircuit: state.jailCircuitName ?? undefined,
    jailRemainingSec,
    isJailed: jailRemainingSec > 0,
  };
}
