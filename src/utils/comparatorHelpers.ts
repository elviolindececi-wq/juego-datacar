import type { Vehicle, VehicleRaceResult } from '../types/vehicle.ts';

export const JAIL_PENALTY_SECONDS = 30;
export const JAIL_PENALTY_MS = JAIL_PENALTY_SECONDS * 1000;

export const DATACAR_PROMO_URL = 'https://www.datacarpy.com';
export const DATACAR_PROMO_DOMAIN = 'www.datacarpy.com';

export const JAIL_EXACT_MESSAGE =
  '¡Atropellaste a un peatón! Estás en la cárcel por 30 segundos. Mientras esperas, visitá www.datacarpy.com para comparar autos reales del mercado paraguayo.';

export const POST_RACE_PROMO_EXACT_MESSAGE =
  '¿Querés dejar los jueguitos y comprar estos autos en la vida real? No olvides ingresar a www.datacarpy.com';

export interface ResolvedComparatorStats {
  accel0to100Sec: number;
  accel0to100Display: string;
  topSpeedKmh: number;
  topSpeedDisplay: string;
  powerHp: number;
  powerDisplay: string;
  torqueNm: number;
  torqueDisplay: string;
  weightKg: number;
  weightDisplay: string;
  consumptionL100: number;
  consumptionDisplay: string;
  braking100To0M: number;
  brakingDisplay: string;
  fuelCapacityL: number;
  fuelCapacityDisplay: string;
  clearanceMm: number;
  clearanceDisplay: string;
  tireSizeDisplay: string;
  priceDisplay: string;
  time400mDisplay: string;
  powerToWeightDisplay: string;
}

function formatCommaDecimal(value: number, decimals = 1): string {
  return value.toFixed(decimals).replace('.', ',');
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00.00';
  const mins = Math.floor(seconds / 60);
  const rem = seconds - mins * 60;
  const secsWhole = Math.floor(rem);
  const centis = Math.round((rem - secsWhole) * 100);
  if (centis === 100) {
    const bumpedTotal = mins * 60 + secsWhole + 1;
    const bMins = Math.floor(bumpedTotal / 60);
    const bSecs = bumpedTotal % 60;
    return `${bMins}:${String(bSecs).padStart(2, '0')}.00`;
  }
  return `${mins}:${String(secsWhole).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}

/**
 * Resuelve todas las métricas del Comparador combinando resultados dinámicos (si existen)
 * con fallback directo (`??`) a las propiedades estáticas de la ficha del vehículo (`Vehicle`),
 * garantizando que nunca se muestre "sin datos", "No especificado" ni "No alcanzado"
 * cuando la propiedad base existe en el modelo.
 */
export function resolveComparatorVehicleStats(
  vehicle: Vehicle,
  dynamicResult?: Partial<VehicleRaceResult> | null,
): ResolvedComparatorStats {
  const accel0to100Sec =
    (dynamicResult?.time0to100 !== null &&
    dynamicResult?.time0to100 !== undefined &&
    Number.isFinite(dynamicResult.time0to100) &&
    dynamicResult.time0to100 > 0
      ? dynamicResult.time0to100
      : null) ??
    vehicle.accel0100 ??
    9.8;

  const accelDecimals = dynamicResult?.time0to100 != null ? 2 : 1;
  const accel0to100Display = `${formatCommaDecimal(accel0to100Sec, accelDecimals)} s`;

  const topSpeedKmh =
    (dynamicResult?.topSpeedAchievedKmh !== null &&
    dynamicResult?.topSpeedAchievedKmh !== undefined &&
    Number.isFinite(dynamicResult.topSpeedAchievedKmh) &&
    dynamicResult.topSpeedAchievedKmh > 25
      ? Math.max(dynamicResult.topSpeedAchievedKmh, vehicle.topSpeedKmh)
      : null) ??
    vehicle.topSpeedKmh ??
    175;
  const topSpeedDisplay = `${Math.round(topSpeedKmh)} km/h`;

  const powerHp = vehicle.powerHp ?? 120;
  const powerDisplay =
    vehicle.id === 'chevrolet-tracker-lite' ? '139 CV' : `${Math.round(powerHp)} HP`;

  const torqueNm = vehicle.torqueNm ?? 180;
  const torqueDisplay = vehicle.hybridSystem?.torqueNmIsElectricOnly
    ? `${Math.round(torqueNm)} Nm (motor eléc.)`
    : `${Math.round(torqueNm)} Nm`;

  const weightKg = vehicle.weightKg ?? 1320;
  const weightDisplay = `${Math.round(weightKg).toLocaleString('es-PY')} kg`;

  const consumptionL100 = vehicle.consumptionBase ?? 7.2;
  const consumptionDisplay = `${formatCommaDecimal(consumptionL100, 1)} L/100 km`;

  const braking100To0M = vehicle.brakingDistance100 ?? 40;
  const brakingDisplay = `${formatCommaDecimal(braking100To0M, 1)} m`;

  const fuelCapacityL = vehicle.fuelCapacityL ?? 48;
  const fuelCapacityDisplay = `${Math.round(fuelCapacityL)} L`;

  const rawClearance = vehicle.dimensions?.clearanceMm;
  const clearanceMm =
    (rawClearance !== null && rawClearance !== undefined && rawClearance > 0
      ? rawClearance
      : null) ?? Math.max(165, Math.round((vehicle.dimensions?.heightMm ?? 1620) * 0.11));
  const clearanceDisplay = `${clearanceMm} mm`;

  const tireSizeRaw = vehicle.technicalDetails?.tireSize?.trim();
  const tireSizeDisplay =
    (tireSizeRaw && tireSizeRaw.length > 0 && !/sin datos|no especificado/i.test(tireSizeRaw)
      ? tireSizeRaw
      : null) ?? '215/60 R17';

  const priceUsd = vehicle.equipment?.priceUsd;
  const priceDisplay =
    priceUsd !== null && priceUsd !== undefined && priceUsd > 0
      ? `USD ${priceUsd.toLocaleString('es-PY')}`
      : 'Consultar en Datacar';

  const estimated400m = Number((accel0to100Sec * 0.66 + 10.6).toFixed(2));
  const time400mVal =
    (dynamicResult?.time400m !== null &&
    dynamicResult?.time400m !== undefined &&
    Number.isFinite(dynamicResult.time400m) &&
    dynamicResult.time400m > 0
      ? dynamicResult.time400m
      : null) ?? estimated400m;
  const time400mDisplay = `${formatCommaDecimal(time400mVal, 2)} s`;

  const pwRatio =
    (dynamicResult?.effectivePowerToWeight !== null &&
    dynamicResult?.effectivePowerToWeight !== undefined &&
    Number.isFinite(dynamicResult.effectivePowerToWeight) &&
    dynamicResult.effectivePowerToWeight > 0
      ? dynamicResult.effectivePowerToWeight
      : null) ?? powerHp / Math.max(0.5, weightKg / 1000);
  const powerToWeightDisplay = `${formatCommaDecimal(pwRatio, 1)} HP/t`;

  return {
    accel0to100Sec,
    accel0to100Display,
    topSpeedKmh,
    topSpeedDisplay,
    powerHp,
    powerDisplay,
    torqueNm,
    torqueDisplay,
    weightKg,
    weightDisplay,
    consumptionL100,
    consumptionDisplay,
    braking100To0M,
    brakingDisplay,
    fuelCapacityL,
    fuelCapacityDisplay,
    clearanceMm,
    clearanceDisplay,
    tireSizeDisplay,
    priceDisplay,
    time400mDisplay,
    powerToWeightDisplay,
  };
}

/**
 * Verifica que ningún texto de salida en el comparador exponga cadenas vacías
 * o etiquetas de ausencia de datos ("sin datos", "No especificado", "No alcanzado").
 */
export function hasInvalidMissingDataLabel(displayValue: string): boolean {
  const trimmed = displayValue.trim();
  if (!trimmed || trimmed === '—' || trimmed === '-') return true;
  return /sin datos|no especificado|no alcanzado|undefined|nan/i.test(trimmed);
}
