import type { Vehicle } from '../types/vehicle.ts';
import { getSafetyState } from './vehicleSafetySystems.ts';

/**
 * ABS solo si la ficha técnica cargada lo documenta expresamente.
 * Cuatro discos, EBD, ADAS o un año de fabricación no demuestran ABS por sí solos.
 * Si el campo está sin verificar no afirmamos que el vehículo real carece de ABS.
 */
export function hasDocumentedABS(vehicle: Vehicle): boolean {
  const explicit = getSafetyState(vehicle, 'abs');
  if (explicit !== 'unknown') return explicit === 'present';
  if (typeof vehicle.equipment?.abs === 'boolean') return vehicle.equipment.abs;
  const features = [
    ...(vehicle.equipment?.safetyFeatures ?? []),
    ...(vehicle.equipment?.adasFeatures ?? []),
    vehicle.technicalDetails?.brakeDetails ?? '',
  ];
  return features.some(feature => /\bABS\b/i.test(feature));
}

export interface BrakingResponse {
  /** Desaceleración longitudinal absoluta; aplicar signo de la velocidad externamente. */
  deceleration: number;
  /** ABS está modulando presión por proximidad al límite de agarre. */
  absActive: boolean;
  /** Deslizamiento longitudinal aproximado, 0–1; NO modelo de neumático homologado. */
  brakeSlip: number;
  /** Tendencia al bloqueo si el sistema no está documentado; no es un dato del vehículo real. */
  lockSeverity: number;
  /** Fracción de respuesta de giro conservada durante frenada extrema. */
  steeringRetention: number;
}

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/**
 * Aproximación arcade físicamente consistente con círculo de fricción: la presión de
 * freno solicita desaceleración, la calzada impone el máximo y el ABS reduce presión
 * antes del bloqueo. Se calcula a paso fijo, no usa eventos artificiales por tecla.
 */
export function brakingResponse(args: {
  vehicle: Vehicle;
  speedMps: number;
  pedal: number;
  availableLongitudinalAccel: number;
  requestedMaxDeceleration: number;
  timeSeconds: number;
}): BrakingResponse {
  const { vehicle, speedMps, timeSeconds } = args;
  const pedal = clamp(args.pedal, 0, 1);
  const available = Math.max(0.35, args.availableLongitudinalAccel);
  const requested = pedal * Math.max(0, args.requestedMaxDeceleration);
  if (pedal < .025 || Math.abs(speedMps) < .45) {
    return { deceleration: 0, absActive: false, brakeSlip: 0, lockSeverity: 0, steeringRetention: 1 };
  }
  const documented = hasDocumentedABS(vehicle);
  const intervention = clamp((requested - available * .86) / Math.max(.3, available * .27), 0, 1);
  const absActive = documented && Math.abs(speedMps) > 3 && pedal > .55 && intervention > .16;
  if (absActive) {
    // Modulación pequeña a 12 Hz: conserva adherencia sin sacudir la cámara.
    const modulation = 1 - .028 * (1 + Math.sin(timeSeconds * Math.PI * 24)) * .5;
    return {
      deceleration: Math.min(requested, available * .965) * modulation,
      absActive: true,
      brakeSlip: .09 + .07 * intervention,
      lockSeverity: 0,
      steeringRetention: 1,
    };
  }
  // Si ABS no está confirmado, usamos una aproximación convencional; esto NO
  // equivale a afirmar que la versión comercial del vehículo carezca de ABS.
  // Sin ficha, la física usa freno neutro sin declarar al auto como carente de ABS.
  const equipmentPending = getSafetyState(vehicle,'abs') === 'unknown' && !vehicle.equipment?.abs &&
    !(vehicle.equipment?.safetyFeatures ?? []).some(x => /\bABS\b/i.test(x));
  const lockSeverity = documented || equipmentPending ? 0 :
    clamp((requested - available * .94) / Math.max(.4, available * .42), 0, 1) *
    clamp((pedal - .60) / .40, 0, 1);
  return {
    deceleration: Math.min(requested, available) * (1 - .34 * lockSeverity),
    absActive: false,
    brakeSlip: clamp(.025 * pedal + .65 * lockSeverity, 0, 1),
    lockSeverity,
    steeringRetention: 1 - .68 * lockSeverity,
  };
}
