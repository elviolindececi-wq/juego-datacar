/**
 * V8.3: respuesta longitudinal aproximada basada en la ficha cargada.
 * NO es un mapa calibrado por banco de potencia; no se inventan presiones de turbo,
 * curvas homologadas ni ventajas fuera de la potencia/torque máximos declarados.
 */
import type { Vehicle } from '../types/vehicle.ts';
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
export interface PowertrainProfile {
  turbo: boolean;
  boostThresholdRpm: number;
  spoolUpSeconds: number;
  spoolDownSeconds: number;
  coastDecelMps2: number;
  rpmLimit: number;
  cvt: boolean;
}
export function powertrainProfile(v: Vehicle): PowertrainProfile {
  const fuelDiesel = v.fuelType === 'diesel';
  // Solo declarar turbo cuando la motorización de LA VERSIÓN cargada lo indique.
  // CRDi significa inyección common-rail, no certifica por sí solo turbocompresor.
  const turbo = /\b(turbo|turbodi[eé]sel|vgt|t-gdi|t gdi)\b/i.test(`${v.engineDescription} ${v.fuelFeeding}`);
  const cvt = /\bcvt\b|xtronic/i.test(v.transmissionDescription);
  return {
    turbo,
    boostThresholdRpm: fuelDiesel ? 1550 : 1750,
    spoolUpSeconds: fuelDiesel ? .58 : .42,
    spoolDownSeconds: fuelDiesel ? .30 : .20,
    coastDecelMps2: cvt ? .50 : fuelDiesel ? .78 : .67,
    rpmLimit: fuelDiesel ? 4400 : 6400,
    cvt,
  };
}
export function estimatedRpm(v: Vehicle, speedMps: number, throttle: number): number {
  const p = powertrainProfile(v);
  const kmh = Math.abs(speedMps) * 3.6;
  // CVT mantiene un rango continuo de revoluciones bajo carga;
  // caja escalonada tiene oscilación leve por relaciones, nunca saltos instantáneos.
  const target = p.cvt
    ? 850 + Math.min(3000, kmh * 24) + 1650 * clamp(throttle, 0, 1)
    : 800 + Math.min(p.rpmLimit - 1200, kmh * (p.turbo ? 37 : 40)) + 800 * clamp(throttle, 0, 1);
  return clamp(target, p.turbo && v.fuelType === 'diesel' ? 780 : 800, p.rpmLimit);
}
export function turboTarget(v: Vehicle, rpm: number, throttle: number): number {
  const p = powertrainProfile(v);
  if (!p.turbo) return 0;
  const rpmAvailability = clamp((rpm - p.boostThresholdRpm + 360) / 1250, 0, 1);
  return clamp(throttle, 0, 1) * rpmAvailability;
}
export function integrateTurbo(v: Vehicle, previous: number, rpm: number, throttle: number, dt: number): number {
  const p = powertrainProfile(v);
  if (!p.turbo) return 0;
  const target = turboTarget(v, rpm, throttle);
  const time = target > previous ? p.spoolUpSeconds : p.spoolDownSeconds;
  return clamp(previous + (target - previous) * (1 - Math.exp(-dt / time)), 0, 1);
}
/** Coeficiente <=1: el turbo no incrementa artificialmente las cifras de ficha. */
export function torqueAvailability(v: Vehicle, rpm: number, boost: number): number {
  const p = powertrainProfile(v);
  if (p.turbo) {
    const highRpmTaper = 1 - .16 * clamp((rpm - (v.fuelType === 'diesel' ? 3300 : 5000)) / 1700, 0, 1);
    return clamp((.68 + .32 * boost) * highRpmTaper, .48, 1);
  }
  // Mantener la curva base de los aspirados hasta disponer de curvas de banco
  // específicas: no penalizar la conducción existente de Corolla/Kicks.
  return 1;
}
/** Retención natural al levantar el acelerador. Debe tender a cero casi detenido. */
export function coastEngineBrake(v: Vehicle, speedMps: number, throttle: number, reverse: number, brake: number): number {
  if (throttle > .025 || reverse > .025 || brake > .025) return 0;
  const mps = Math.abs(speedMps);
  const factor = clamp(mps / 4, 0, 1);
  return powertrainProfile(v).coastDecelMps2 * factor;
}
