/**
 * DATACAR ARENA — Auditoría Técnica y Presentación Coherente de ADAS (§8 y §11)
 * Observador de solo lectura sobre el estado del juego:
 * - NO modifica fuerzas de frenado, algoritmos protegidos de `vehicleSafetySystems.ts` ni físicas.
 * - Distingue estrictamente los 4 niveles conceptuales:
 *   (1) Alcance de detección, (2) Precaución / distancia de advertencia,
 *   (3) Alerta de colisión inminente, (4) Frenado automático activo (leído del solver).
 * - Evalúa TTC = distancia longitudinal / velocidad relativa de cierre ÚNICAMENTE cuando
 *   unidades son coherentes (m y m/s), velocidad de cierre > 0 y trayectorias alineadas.
 * - Verifica equipamiento real por versión exacta; NUNCA atribuye ADAS a modelos sin respaldo
 *   y etiqueta expresamente toda ayuda genérica sobre motocicletas como:
 *   "ASISTENCIA SIMULADA DEL JUEGO".
 */
import type { Vehicle } from '../types/vehicle.ts';
import { getSafetyState, type FeatureState } from './vehicleSafetySystems.ts';

export type AdasSeverityLevel =
  | 'unavailable'
  | 'standby'
  | 'detection'
  | 'caution'
  | 'collision_warning'
  | 'aeb_active';

export type AdasOriginKind = 'verified_oem' | 'simulated_game_aid' | 'not_equipped';

export interface AdasForwardTargetSample {
  id: string;
  kind: 'vehicle' | 'motorcycle';
  /** Coordenada lateral Frenet X en metros. */
  x: number;
  /** Coordenada longitudinal Frenet Z en metros. */
  z: number;
  /** Velocidad longitudinal en el sentido +Z (m/s). En mano contraria es negativa. */
  longitudinalSpeedMps: number;
  lengthM?: number;
  widthM?: number;
}

export interface AdasVehicleProfileInfo {
  vehicleId: string;
  fcwState: FeatureState;
  aebState: FeatureState;
  blindSpotState: FeatureState;
  pedestrianFebDocumented: boolean;
  motorcycleDetectionDocumented: boolean;
  lowSpeedOnlyNote: boolean;
  /** Calibración visual referencial por modelo (no universal; las fichas comerciales no publican metros de radar). */
  detectionRangeM: number;
  cautionTtcSec: number;
  imminentTtcSec: number;
  equipmentSummaryLabel: string;
}

export interface AdasHudReadout {
  level: AdasSeverityLevel;
  origin: AdasOriginKind;
  colorTone: 'muted' | 'cyan' | 'amber' | 'red';
  badgeLabel: string;
  detailLabel: string;
  distanceMeters: number | null;
  ttcSeconds: number | null;
  closingSpeedKmh: number | null;
  targetKind: 'vehicle' | 'motorcycle' | null;
}

/**
 * Obtiene el perfil documental auditado por versión exacta del catálogo.
 * Ninguna ficha comercial recibida publica alcance exacto de radar en metros ni homologación
 * específica para motocicletas; por ello los umbrales visuales varían según arquitectura
 * documentada de cada versión y la proximidad a motos se identifica siempre como
 * "ASISTENCIA SIMULADA DEL JUEGO".
 */
export function getAuditedAdasProfile(vehicle: Vehicle): AdasVehicleProfileInfo {
  const fcwState = getSafetyState(vehicle, 'fcw');
  const aebState = getSafetyState(vehicle, 'aeb');
  const blindSpotState = getSafetyState(vehicle, 'blindSpot');
  const adasListText = (vehicle.equipment?.adasFeatures ?? []).join(' ').toLowerCase();
  const pedestrianFebDocumented = adasListText.includes('peatones');
  const lowSpeedOnlyNote = adasListText.includes('baja velocidad');

  // Diferenciación por modelo según equipamiento documentado (prohibido usar un umbral universal único)
  if (vehicle.id === 'chery-t4-pro-luxury-hev') {
    return {
      vehicleId: vehicle.id,
      fcwState,
      aebState,
      blindSpotState,
      pedestrianFebDocumented,
      motorcycleDetectionDocumented: false,
      lowSpeedOnlyNote: false,
      detectionRangeM: 52,
      cautionTtcSec: 2.9,
      imminentTtcSec: 1.65,
      equipmentSummaryLabel: 'ADAS verificado (FCW + AEB + BSD + ACC)',
    };
  }

  if (vehicle.id === 'nissan-kicks-2027') {
    return {
      vehicleId: vehicle.id,
      fcwState,
      aebState,
      blindSpotState,
      pedestrianFebDocumented: true,
      motorcycleDetectionDocumented: false,
      lowSpeedOnlyNote: false,
      detectionRangeM: 46,
      cautionTtcSec: 2.7,
      imminentTtcSec: 1.55,
      equipmentSummaryLabel: 'ADAS verificado (FCW + IEB/FEB + LDW)',
    };
  }

  if (vehicle.id === 'chevrolet-tracker-lite') {
    return {
      vehicleId: vehicle.id,
      fcwState,
      aebState,
      blindSpotState,
      pedestrianFebDocumented: false,
      motorcycleDetectionDocumented: false,
      lowSpeedOnlyNote: true,
      detectionRangeM: 38,
      cautionTtcSec: 2.45,
      imminentTtcSec: 1.45,
      equipmentSummaryLabel: 'ADAS verificado (FCW + AEB baja vel. + BSD)',
    };
  }

  if (fcwState === 'present' || aebState === 'present') {
    return {
      vehicleId: vehicle.id,
      fcwState,
      aebState,
      blindSpotState,
      pedestrianFebDocumented,
      motorcycleDetectionDocumented: false,
      lowSpeedOnlyNote,
      detectionRangeM: 42,
      cautionTtcSec: 2.6,
      imminentTtcSec: 1.5,
      equipmentSummaryLabel: 'ADAS frontal en ficha',
    };
  }

  const isUnknown = fcwState === 'unknown' && aebState === 'unknown';
  return {
    vehicleId: vehicle.id,
    fcwState,
    aebState,
    blindSpotState,
    pedestrianFebDocumented: false,
    motorcycleDetectionDocumented: false,
    lowSpeedOnlyNote: false,
    detectionRangeM: 0,
    cautionTtcSec: 0,
    imminentTtcSec: 0,
    equipmentSummaryLabel: isUnknown
      ? 'ADAS no especificado en ficha'
      : 'Sin ADAS frontal en ficha',
  };
}

/**
 * Calcula TTC coherente en segundos solo cuando:
 * - longitudinalGapM >= 0
 * - closingSpeedMps > 0.25 m/s (aproximación real)
 */
export function computeCoherentTtcSeconds(
  longitudinalGapM: number,
  closingSpeedMps: number,
): number | null {
  if (!Number.isFinite(longitudinalGapM) || !Number.isFinite(closingSpeedMps)) return null;
  if (longitudinalGapM < 0) return null;
  if (closingSpeedMps <= 0.25) return null;
  return longitudinalGapM / closingSpeedMps;
}

export function evaluateAdasHudReadout(args: {
  vehicle: Vehicle;
  playerX: number;
  playerZ: number;
  playerSpeedKmh: number;
  solverAebActive?: boolean;
  solverFcwWarning?: boolean;
  targets: readonly AdasForwardTargetSample[];
}): AdasHudReadout {
  const {
    vehicle,
    playerX,
    playerZ,
    playerSpeedKmh,
    solverAebActive = false,
    targets,
  } = args;

  const profile = getAuditedAdasProfile(vehicle);
  const playerSpeedMps = Math.max(0, playerSpeedKmh / 3.6);
  const hasOemForwardAdas = profile.fcwState === 'present' || profile.aebState === 'present';

  // Buscar el objetivo válido más crítico dentro del corredor de trayectoria del jugador
  let bestVehicleGapM: number | null = null;
  let bestVehicleTtc: number | null = null;
  let bestVehicleClosingMps = 0;

  let bestMotoGapM: number | null = null;
  let bestMotoTtc: number | null = null;
  let bestMotoClosingMps = 0;

  const playerHalfLen = ((vehicle.dimensions?.lengthMm || 4300) / 1000) * 0.5;

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const targetHalfLen = (t.lengthM ?? (t.kind === 'motorcycle' ? 2.1 : 4.3)) * 0.5;
    const rawDz = t.z - playerZ;
    if (rawDz <= 0.4 || rawDz > 62) continue;

    const lateralDelta = Math.abs(t.x - playerX);
    const corridorHalfWidth = t.kind === 'motorcycle' ? 1.45 : 1.65;
    if (lateralDelta > corridorHalfWidth) continue;

    const netGapM = Math.max(0, rawDz - playerHalfLen - targetHalfLen);
    const closingMps = playerSpeedMps - t.longitudinalSpeedMps;
    const ttc = computeCoherentTtcSeconds(netGapM, closingMps);

    if (t.kind === 'vehicle') {
      if (
        bestVehicleGapM === null ||
        (ttc !== null && (bestVehicleTtc === null || ttc < bestVehicleTtc)) ||
        (ttc === null && bestVehicleTtc === null && netGapM < bestVehicleGapM)
      ) {
        bestVehicleGapM = netGapM;
        bestVehicleTtc = ttc;
        bestVehicleClosingMps = closingMps;
      }
    } else {
      if (
        bestMotoGapM === null ||
        (ttc !== null && (bestMotoTtc === null || ttc < bestMotoTtc)) ||
        (ttc === null && bestMotoTtc === null && netGapM < bestMotoGapM)
      ) {
        bestMotoGapM = netGapM;
        bestMotoTtc = ttc;
        bestMotoClosingMps = closingMps;
      }
    }
  }

  // 1. Si el solver físico protegido ya activó el AEB en un vehículo con AEB confirmado
  if (hasOemForwardAdas && solverAebActive && playerSpeedKmh > 3) {
    return {
      level: 'aeb_active',
      origin: 'verified_oem',
      colorTone: 'red',
      badgeLabel: 'AEB ACTIVO',
      detailLabel:
        bestVehicleGapM !== null
          ? `Frenado autónomo · ${Math.round(bestVehicleGapM)} m`
          : 'Frenado autónomo de emergencia',
      distanceMeters: bestVehicleGapM !== null ? Math.round(bestVehicleGapM) : null,
      ttcSeconds: bestVehicleTtc !== null ? Number(bestVehicleTtc.toFixed(1)) : null,
      closingSpeedKmh:
        bestVehicleClosingMps > 0 ? Math.round(bestVehicleClosingMps * 3.6) : null,
      targetKind: 'vehicle',
    };
  }

  // 2. Evaluación ADAS OEM verificado frente a otros vehículos (con umbrales propios del modelo)
  if (hasOemForwardAdas && playerSpeedKmh >= 8 && bestVehicleGapM !== null && bestVehicleGapM <= profile.detectionRangeM) {
    const roundedGap = Math.max(1, Math.round(bestVehicleGapM));
    const roundedTtc = bestVehicleTtc !== null ? Number(bestVehicleTtc.toFixed(1)) : null;
    const closingKmh = bestVehicleClosingMps > 0 ? Math.round(bestVehicleClosingMps * 3.6) : null;

    if (roundedTtc !== null && roundedTtc <= profile.imminentTtcSec && bestVehicleGapM <= 26) {
      return {
        level: 'collision_warning',
        origin: 'verified_oem',
        colorTone: 'red',
        badgeLabel: 'ALERTA COLISIÓN FCW',
        detailLabel: `Objetivo a ${roundedGap} m · TTC ${roundedTtc.toFixed(1)} s`,
        distanceMeters: roundedGap,
        ttcSeconds: roundedTtc,
        closingSpeedKmh: closingKmh,
        targetKind: 'vehicle',
      };
    }

    if (
      (roundedTtc !== null && roundedTtc <= profile.cautionTtcSec) ||
      (bestVehicleClosingMps > 0.8 && bestVehicleGapM <= 18)
    ) {
      return {
        level: 'caution',
        origin: 'verified_oem',
        colorTone: 'amber',
        badgeLabel: 'PRECAUCIÓN FCW',
        detailLabel:
          roundedTtc !== null
            ? `Vehículo a ${roundedGap} m · TTC ${roundedTtc.toFixed(1)} s`
            : `Distancia frontal ${roundedGap} m`,
        distanceMeters: roundedGap,
        ttcSeconds: roundedTtc,
        closingSpeedKmh: closingKmh,
        targetKind: 'vehicle',
      };
    }

    return {
      level: 'detection',
      origin: 'verified_oem',
      colorTone: 'cyan',
      badgeLabel: 'DETECCIÓN ADAS',
      detailLabel: `Seguimiento frontal · ${roundedGap} m`,
      distanceMeters: roundedGap,
      ttcSeconds: roundedTtc,
      closingSpeedKmh: closingKmh,
      targetKind: 'vehicle',
    };
  }

  // 3. Proximidad a motociclistas en carril de ida (§8 y §11):
  // Ninguna ficha recibida certifica homologación de radar para motocicletas,
  // por lo que cualquier aviso se identifica expresamente como ASISTENCIA SIMULADA DEL JUEGO.
  if (
    playerSpeedKmh >= 10 &&
    bestMotoGapM !== null &&
    bestMotoGapM <= 26 &&
    bestMotoClosingMps > 0.6
  ) {
    const roundedGap = Math.max(1, Math.round(bestMotoGapM));
    const roundedTtc = bestMotoTtc !== null ? Number(bestMotoTtc.toFixed(1)) : null;
    const isUrgent = (roundedTtc !== null && roundedTtc <= 1.6) || bestMotoGapM <= 9;
    return {
      level: isUrgent ? 'collision_warning' : 'caution',
      origin: 'simulated_game_aid',
      colorTone: isUrgent ? 'red' : 'amber',
      badgeLabel: 'ASISTENCIA SIMULADA DEL JUEGO',
      detailLabel:
        roundedTtc !== null
          ? `Motociclista a ${roundedGap} m · TTC ${roundedTtc.toFixed(1)} s`
          : `Motociclista adelante · ${roundedGap} m`,
      distanceMeters: roundedGap,
      ttcSeconds: roundedTtc,
      closingSpeedKmh: Math.round(bestMotoClosingMps * 3.6),
      targetKind: 'motorcycle',
    };
  }

  // 4. Estado en reposo: distinguir vehículo con ADAS OEM en espera vs No disponible en ficha
  if (hasOemForwardAdas) {
    return {
      level: 'standby',
      origin: 'verified_oem',
      colorTone: 'cyan',
      badgeLabel: 'ADAS LISTO',
      detailLabel: profile.lowSpeedOnlyNote ? 'FCW · AEB baja vel.' : 'FCW / AEB en vigilancia',
      distanceMeters: null,
      ttcSeconds: null,
      closingSpeedKmh: null,
      targetKind: null,
    };
  }

  return {
    level: 'unavailable',
    origin: 'not_equipped',
    colorTone: 'muted',
    badgeLabel: 'ADAS NO DISPONIBLE',
    detailLabel: profile.equipmentSummaryLabel,
    distanceMeters: null,
    ttcSeconds: null,
    closingSpeedKmh: null,
    targetKind: null,
  };
}
