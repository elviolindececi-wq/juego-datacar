import type { RaceModeId } from './careerProgression.ts';

export interface CircuitTargetTime {
  circuitId: string;
  mode: RaceModeId;
  laps: number;
  /** Meta Oro (Tiempo X): exigente pero alcanzable respetando señales/velocidad o trazada Pro. */
  targetSec: number;
  /** Límite Plata: tiempo máximo antes de penalización por demora excesiva. */
  maxLimitSec: number;
  averageTargetKmh: number;
}

export interface CircuitTimeEvaluation {
  medal: 'gold' | 'silver' | 'over_limit';
  label: string;
  iqBonus: number;
  deltaSec: number;
  target: CircuitTargetTime;
}

const CIRCUIT_DISTANCES_M: Record<string, number> = {
  avelino: 1900,
  herrera: 1700,
  'jose-felix': 1780,
  artigas: 2050,
  oliva: 1600,
  aviadores: 2300,
};

// Velocidades medias desafiantes calibradas por complejidad del circuito (km/h)
const CIRCUIT_DIFFICULTY_PACE_KMH: Record<string, { city: number; pro: number }> = {
  avelino: { city: 52, pro: 118 },
  herrera: { city: 54, pro: 122 },
  'jose-felix': { city: 56, pro: 124 },
  artigas: { city: 50, pro: 115 },
  oliva: { city: 55, pro: 120 },
  aviadores: { city: 57, pro: 128 },
};

/**
 * Calcula el Tiempo Objetivo ("Tiempo X") por circuito, cantidad de vueltas y modalidad.
 * Fase 1 ('city_trial'): incluye margen para semáforos y zonas de velocidad mínima/máxima.
 * Fase 2 ('speed_pro'): ritmo exigente sin semáforos contra rivales de élite.
 */
export function getCircuitTargetTime(
  circuitId: string | undefined,
  mode: RaceModeId = 'city_trial',
  laps = 1,
  fallbackDistanceMeters?: number
): CircuitTargetTime {
  const safeId = circuitId && CIRCUIT_DISTANCES_M[circuitId] ? circuitId : 'avelino';
  const safeLaps = Math.max(1, Math.min(3, Math.round(laps)));
  const singleLapMeters =
    fallbackDistanceMeters && fallbackDistanceMeters > 400
      ? Math.round(fallbackDistanceMeters / safeLaps)
      : CIRCUIT_DISTANCES_M[safeId] ?? 1850;
  const totalMeters = singleLapMeters * safeLaps;

  const pace = CIRCUIT_DIFFICULTY_PACE_KMH[safeId] ?? { city: 54, pro: 120 };
  const effectiveMode: 'city' | 'pro' = mode === 'speed_pro' ? 'pro' : 'city';
  const targetKmh = effectiveMode === 'pro' ? pace.pro : pace.city;

  // Semáforos + frenadas agregan ~16s por vuelta en ciudad
  const cityStopAllowanceSec = effectiveMode === 'city' ? 16 * safeLaps : 2.5 * safeLaps;
  const rawTargetSec = totalMeters / (targetKmh / 3.6) + cityStopAllowanceSec;
  const targetSec = Math.round(rawTargetSec);
  const maxLimitSec = Math.round(targetSec * (effectiveMode === 'pro' ? 1.24 : 1.32));

  return {
    circuitId: safeId,
    mode,
    laps: safeLaps,
    targetSec,
    maxLimitSec,
    averageTargetKmh: Math.round((totalMeters / targetSec) * 3.6),
  };
}

export function formatTargetMinutesSec(totalSec: number): string {
  const safe = Math.max(0, Math.round(totalSec));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function evaluateCircuitTimeResult(
  finishTimeSec: number,
  target: CircuitTargetTime
): CircuitTimeEvaluation {
  if (!Number.isFinite(finishTimeSec) || finishTimeSec <= 0) {
    return {
      medal: 'over_limit',
      label: 'Sin tiempo válido',
      iqBonus: 0,
      deltaSec: target.targetSec,
      target,
    };
  }
  const deltaSec = Number((finishTimeSec - target.targetSec).toFixed(2));
  if (finishTimeSec <= target.targetSec) {
    return {
      medal: 'gold',
      label: 'Meta Oro cumplida',
      iqBonus: 50,
      deltaSec,
      target,
    };
  }
  if (finishTimeSec <= target.maxLimitSec) {
    return {
      medal: 'silver',
      label: 'Dentro del límite (Plata)',
      iqBonus: 15,
      deltaSec,
      target,
    };
  }
  return {
    medal: 'over_limit',
    label: 'Fuera del tiempo límite',
    iqBonus: -20,
    deltaSec,
    target,
  };
}
