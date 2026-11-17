import { useEffect, useState } from 'react';
import { JAIL_PENALTY_MS } from './comparatorHelpers.ts';

export type RaceModeVariant = 'city_trial' | 'speed_pro';
export type RaceModeId = RaceModeVariant | 'practice_free';

export const JAIL_DURATION_MS = JAIL_PENALTY_MS; // 30 segundos exactos de sanción
export const CITY_UNLOCK_MIN_IQ = 700; // Puntaje mínimo en Fase 1 (sobre 1000) para desbloquear Fase 2

export type WenoCircuitCampaignStatus = 'pending' | 'in_progress' | 'completed';

export interface CareerProgressionState {
  speedModeUnlocked: boolean;
  bestCityIqScore: number;
  completedCityCircuits: string[];
  jailUntilMs: number;
  jailCircuitName: string | null;
  arrestCount: number;
  wenoCompletedCircuits: string[];
  wenoBestTimesSec: Record<string, number>;
  wenoElitePilotUnlocked: boolean;
  wenoCampaignCompletedAt: number | null;
}

export interface WenoCampaignCircuitItem {
  circuitId: string;
  name: string;
  orderIndex: number;
  status: WenoCircuitCampaignStatus;
  completed: boolean;
  bestTimeSec: number | null;
}

export interface WenoCampaignOverview {
  completedCount: number;
  totalCount: number;
  pendingCount: number;
  progressPercent: number;
  isCampaignComplete: boolean;
  eliteBadgeUnlocked: boolean;
  nextPendingCircuitId: string | null;
  items: WenoCampaignCircuitItem[];
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
  wenoCompletedCircuits: [],
  wenoBestTimesSec: {},
  wenoElitePilotUnlocked: false,
  wenoCampaignCompletedAt: null,
};

function sanitizeCircuitId(raw?: string | null): string {
  if (!raw) return '';
  const trimmed = raw.trim().toLowerCase();
  return trimmed.startsWith('circuit-') ? trimmed.slice('circuit-'.length) : trimmed;
}

function sanitizeBestTimesRecord(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const cleanKey = sanitizeCircuitId(key);
    const num = Number(val);
    if (cleanKey && Number.isFinite(num) && num > 0) {
      out[cleanKey] = num;
    }
  }
  return out;
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadCareerProgression(): CareerProgressionState {
  if (!canUseStorage()) {
    return {
      ...DEFAULT_STATE,
      completedCityCircuits: [],
      wenoCompletedCircuits: [],
      wenoBestTimesSec: {},
    };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        ...DEFAULT_STATE,
        completedCityCircuits: [],
        wenoCompletedCircuits: [],
        wenoBestTimesSec: {},
      };
    }
    const parsed = JSON.parse(raw) as Partial<CareerProgressionState>;
    const wenoCompletedCircuits = Array.isArray(parsed.wenoCompletedCircuits)
      ? Array.from(
          new Set(
            parsed.wenoCompletedCircuits
              .filter((x): x is string => typeof x === 'string')
              .map((x) => sanitizeCircuitId(x))
              .filter(Boolean),
          ),
        )
      : [];
    return {
      speedModeUnlocked: Boolean(parsed.speedModeUnlocked),
      bestCityIqScore: Number(parsed.bestCityIqScore) || 0,
      completedCityCircuits: Array.isArray(parsed.completedCityCircuits)
        ? parsed.completedCityCircuits.filter((x): x is string => typeof x === 'string')
        : [],
      jailUntilMs: Number(parsed.jailUntilMs) || 0,
      jailCircuitName: typeof parsed.jailCircuitName === 'string' ? parsed.jailCircuitName : null,
      arrestCount: Number(parsed.arrestCount) || 0,
      wenoCompletedCircuits,
      wenoBestTimesSec: sanitizeBestTimesRecord(parsed.wenoBestTimesSec),
      wenoElitePilotUnlocked: Boolean(parsed.wenoElitePilotUnlocked),
      wenoCampaignCompletedAt:
        typeof parsed.wenoCampaignCompletedAt === 'number' && Number.isFinite(parsed.wenoCampaignCompletedAt)
          ? parsed.wenoCampaignCompletedAt
          : null,
    };
  } catch {
    return {
      ...DEFAULT_STATE,
      completedCityCircuits: [],
      wenoCompletedCircuits: [],
      wenoBestTimesSec: {},
    };
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

export function clearJailStatus(): CareerProgressionState {
  const current = loadCareerProgression();
  const next: CareerProgressionState = {
    ...current,
    jailUntilMs: 0,
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

export interface WenoCampaignAttemptArgs {
  circuitId?: string | null;
  won: boolean;
  finishTimeSec?: number | null;
  raceMode?: RaceModeId;
  availableCircuitIds: readonly string[];
  nowMs?: number;
}

export interface WenoCampaignAttemptResult {
  nextState: CareerProgressionState;
  newlyWonCircuit: boolean;
  newlyCompletedCampaign: boolean;
  isCampaignComplete: boolean;
  completedCount: number;
  totalCount: number;
  nextPendingCircuitId: string | null;
}

/**
 * Evaluación pura de intento de misión en la campaña Operación Weno Bank:
 * - Calcula el total dinámicamente desde `availableCircuitIds` (nunca hardcodea 6).
 * - Excluye `practice_free` (práctica libre nunca suma victorias de campaña).
 * - Perder un circuito o repetir un circuito ya completado JAMÁS borra victorias previas.
 * - Cuando `completedCount === totalCount` (con `totalCount > 0`), desbloquea `PILOTO ÉLITE DATACAR`.
 */
export function evaluateWenoCampaignAttemptPure(
  current: CareerProgressionState,
  args: WenoCampaignAttemptArgs,
): WenoCampaignAttemptResult {
  const normalizedAvailable = Array.from(
    new Set(args.availableCircuitIds.map((id) => sanitizeCircuitId(id)).filter(Boolean)),
  );
  const totalCount = normalizedAvailable.length;
  const completedSet = new Set(
    (current.wenoCompletedCircuits ?? []).map((id) => sanitizeCircuitId(id)).filter(Boolean),
  );
  const bestTimes: Record<string, number> = { ...(current.wenoBestTimesSec ?? {}) };

  const countValidBefore = normalizedAvailable.filter((id) => completedSet.has(id)).length;
  const wasCompleteBefore = totalCount > 0 && countValidBefore === totalCount;

  const cleanCircuitId = sanitizeCircuitId(args.circuitId);
  const isPractice = args.raceMode === 'practice_free';
  let newlyWonCircuit = false;

  if (!isPractice && args.won && cleanCircuitId) {
    if (!completedSet.has(cleanCircuitId)) {
      newlyWonCircuit = true;
      completedSet.add(cleanCircuitId);
    }
    if (
      typeof args.finishTimeSec === 'number' &&
      Number.isFinite(args.finishTimeSec) &&
      args.finishTimeSec > 0
    ) {
      const prevBest = bestTimes[cleanCircuitId];
      if (prevBest == null || args.finishTimeSec < prevBest) {
        bestTimes[cleanCircuitId] = Number(args.finishTimeSec.toFixed(3));
      }
    }
  }

  const completedCount = normalizedAvailable.filter((id) => completedSet.has(id)).length;
  const isCampaignComplete = totalCount > 0 && completedCount === totalCount;
  const newlyCompletedCampaign = !wasCompleteBefore && isCampaignComplete;
  const nowMs = args.nowMs ?? Date.now();

  let nextPendingCircuitId: string | null = null;
  if (cleanCircuitId && normalizedAvailable.includes(cleanCircuitId)) {
    const startIdx = normalizedAvailable.indexOf(cleanCircuitId);
    for (let offset = 1; offset <= totalCount; offset++) {
      const candidate = normalizedAvailable[(startIdx + offset) % totalCount];
      if (!completedSet.has(candidate)) {
        nextPendingCircuitId = candidate;
        break;
      }
    }
  } else {
    nextPendingCircuitId = normalizedAvailable.find((id) => !completedSet.has(id)) ?? null;
  }

  const nextState: CareerProgressionState = {
    ...current,
    wenoCompletedCircuits: Array.from(completedSet),
    wenoBestTimesSec: bestTimes,
    wenoElitePilotUnlocked: Boolean(current.wenoElitePilotUnlocked || isCampaignComplete),
    wenoCampaignCompletedAt:
      current.wenoCampaignCompletedAt ?? (isCampaignComplete ? nowMs : null),
  };

  return {
    nextState,
    newlyWonCircuit,
    newlyCompletedCampaign,
    isCampaignComplete,
    completedCount,
    totalCount,
    nextPendingCircuitId,
  };
}

/**
 * Predice de forma pura si ganar `candidateCircuitId` completaría el 100% de la campaña
 * (útil en `Race3DPerspectiveView` al cruzar la meta para activar la cinemática final).
 */
export function willCompleteWenoCampaign(
  state: Pick<CareerProgressionState, 'wenoCompletedCircuits'>,
  candidateCircuitId: string | null | undefined,
  availableCircuitIds: readonly string[],
): boolean {
  const normalizedAvailable = Array.from(
    new Set(availableCircuitIds.map((id) => sanitizeCircuitId(id)).filter(Boolean)),
  );
  if (normalizedAvailable.length === 0) return false;
  const completedSet = new Set(
    (state.wenoCompletedCircuits ?? []).map((id) => sanitizeCircuitId(id)).filter(Boolean),
  );
  const cleanCandidate = sanitizeCircuitId(candidateCircuitId);
  if (cleanCandidate) {
    completedSet.add(cleanCandidate);
  }
  return normalizedAvailable.every((id) => completedSet.has(id));
}

export function recordWenoBankCircuitAttempt(
  args: WenoCampaignAttemptArgs,
): WenoCampaignAttemptResult {
  const current = loadCareerProgression();
  const evaluated = evaluateWenoCampaignAttemptPure(current, args);
  if (args.raceMode !== 'practice_free') {
    saveCareerProgression(evaluated.nextState);
  }
  return evaluated;
}

export function getWenoCampaignOverview(
  circuits: ReadonlyArray<{ id: string; name: string }>,
  state: Pick<
    CareerProgressionState,
    'wenoCompletedCircuits' | 'wenoBestTimesSec' | 'wenoElitePilotUnlocked'
  >,
  activeCircuitId?: string | null,
  isInProgress = false,
): WenoCampaignOverview {
  const completedSet = new Set(
    (state.wenoCompletedCircuits ?? []).map((id) => sanitizeCircuitId(id)).filter(Boolean),
  );
  const bestTimes = state.wenoBestTimesSec ?? {};
  const cleanActive = sanitizeCircuitId(activeCircuitId);

  const items: WenoCampaignCircuitItem[] = circuits.map((circuit, index) => {
    const cleanId = sanitizeCircuitId(circuit.id);
    const completed = completedSet.has(cleanId);
    const status: WenoCircuitCampaignStatus =
      isInProgress && cleanActive === cleanId
        ? 'in_progress'
        : completed
        ? 'completed'
        : 'pending';
    return {
      circuitId: cleanId,
      name: circuit.name,
      orderIndex: index,
      status,
      completed,
      bestTimeSec: typeof bestTimes[cleanId] === 'number' ? bestTimes[cleanId] : null,
    };
  });

  const totalCount = items.length;
  const completedCount = items.filter((item) => item.completed).length;
  const pendingCount = Math.max(0, totalCount - completedCount);
  const isCampaignComplete = totalCount > 0 && completedCount === totalCount;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  let nextPendingCircuitId: string | null = null;
  if (pendingCount > 0) {
    const activeIndex = items.findIndex((item) => item.circuitId === cleanActive);
    if (activeIndex >= 0) {
      for (let offset = 1; offset <= totalCount; offset++) {
        const candidate = items[(activeIndex + offset) % totalCount];
        if (!candidate.completed) {
          nextPendingCircuitId = candidate.circuitId;
          break;
        }
      }
    } else {
      nextPendingCircuitId = items.find((item) => !item.completed)?.circuitId ?? null;
    }
  }

  return {
    completedCount,
    totalCount,
    pendingCount,
    progressPercent,
    isCampaignComplete,
    eliteBadgeUnlocked: Boolean(state.wenoElitePilotUnlocked || isCampaignComplete),
    nextPendingCircuitId,
    items,
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
