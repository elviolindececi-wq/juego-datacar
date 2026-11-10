/**
 * DATACAR ARENA V8.7 — dinámica parametrizada por ficha y trazabilidad.
 * La ficha aporta límites de potencia, torque, masa, dimensiones, tracción y neumáticos.
 * Las relaciones de caja, curvas de torque, neumáticos y tiempos de asistencia son
 * CALIBRACIONES DE SIMULACIÓN mientras no se disponga de ensayos homologados.
 */
import type { Vehicle } from '../types/vehicle.ts';
const clamp = (x:number,a:number,b:number) => Math.max(a,Math.min(b,x));

export interface VehicleDynamicsProfile {
  massKg: number;
  wheelbaseM: number;
  tireRadiusM: number;
  powerW: number;
  torqueNm: number;
  maxSteerRad: number;
  steeringResponseHz: number;
  drivelineEfficiency: number;
  transmissionKind: 'cvt'|'automatic'|'manual'|'dct'|'electric'|'hybrid-dht';
  lowSpeedTorqueRatio: number;
  tireGrip: number;
  corneringStiffnessScale: number; // calibración estimada por sección y perfil de neumático
  cgHeightM: number; // estimación por altura total, NO altura CG homologada
  isEstimated: true;
}

export function tireRadiusFromSpec(spec?: string): number | null {
  const match = spec?.match(/(\d{3})\s*\/\s*(\d{2})\s*R\s*(\d{2})/i);
  if (!match) return null;
  const widthMm = Number(match[1]), aspect = Number(match[2]), rimInches = Number(match[3]);
  if (widthMm < 115 || widthMm > 365 || aspect < 25 || aspect > 85 || rimInches < 12 || rimInches > 24) return null;
  return (rimInches * 25.4 / 2 + widthMm * aspect / 100) / 1000;
}

export function getVehicleDynamicsProfile(v: Vehicle, cargoKg = 0, speedMps = 0): VehicleDynamicsProfile {
  const transmission = `${v.transmissionDescription || ''}`.toLowerCase();
  const kind: VehicleDynamicsProfile['transmissionKind'] = v.fuelType === 'electric' ? 'electric' :
    /dht/i.test(transmission) ? 'hybrid-dht' :
    /dct|doble embrague/.test(transmission) ? 'dct' :
    /cvt|xtronic/.test(transmission) ? 'cvt' :
    /manual|mecánica/.test(transmission) && !/automática/.test(transmission) ? 'manual' : 'automatic';
  const massKg = Math.max(650, (Number(v.weightKg) || 1250) + Math.max(0, cargoKg));
  const wheelbaseM = v.technicalDetails?.wheelbaseMm ? v.technicalDetails.wheelbaseMm / 1000 :
    clamp(v.dimensions.lengthMm / 1000 * .60, 2.25, 3.5);
  const tireRadiusM = tireRadiusFromSpec(v.technicalDetails?.tireSize) ?? clamp(v.dimensions.heightMm / 4800, .29, .38);
  const tyreMatch = v.technicalDetails?.tireSize?.match(/(\d{3})\s*\/\s*(\d{2})\s*R\s*(\d{2})/i);
  const tyreWidthMm = tyreMatch ? Number(tyreMatch[1]) : 205;
  const tyreAspect = tyreMatch ? Number(tyreMatch[2]) : 55;
  // Respuesta cualitativa: perfil alto se deforma más, sección ancha responde
  // algo más rápido. NO supone que ancho equivale a mejor agarre máximo.
  const corneringStiffnessScale = clamp(1 + (tyreWidthMm - 205) * .0018 - (tyreAspect - 55) * .003, .82, 1.18);
  const cgHeightM = clamp(v.dimensions.heightMm / 1000 * .32, .46, .70);
  const speedKmh = Math.abs(speedMps) * 3.6;
  // Menos ángulo y respuesta más suave a velocidades altas; masa y batalla influyen.
  const lowSpeedAngle = clamp(Math.atan(wheelbaseM / 5.8), .34, .49);
  const maxSteerRad = lowSpeedAngle * (1 - .68 * clamp(speedKmh / 145, 0, 1));
  const steeringResponseHz = clamp(8.0 * Math.sqrt(1300 / massKg) * (2.65 / wheelbaseM), 4.6, 10.0);
  const drivelineEfficiency = v.drivetrain === 'AWD' ? .81 : .86;
  // Equivalente efectivo de transmisión * diferencial: no es ratio oficial de caja.
  const lowSpeedTorqueRatio = kind === 'hybrid-dht' ? 7.8 : kind === 'cvt' ? 9.2 : kind === 'dct' ? 8.5 : kind === 'electric' ? 7.5 : 8.0;
  return {
    massKg, wheelbaseM, tireRadiusM, powerW: Math.max(1, v.powerHp) * 745.7,
    torqueNm: Math.max(1,v.torqueNm), maxSteerRad, steeringResponseHz,
    drivelineEfficiency, transmissionKind: kind, lowSpeedTorqueRatio,
    tireGrip: clamp(v.tireGrip || .95, .56, 1.25), corneringStiffnessScale, cgHeightM, isEstimated: true,
  };
}

export function tractionForceFromSpec(v:Vehicle, profile:VehicleDynamicsProfile, speedMps:number, torqueAvailability:number, longitudinalLimitMps2:number): number {
  const torqueForceN = profile.torqueNm * clamp(torqueAvailability,0,1) * profile.lowSpeedTorqueRatio /
    profile.tireRadiusM * profile.drivelineEfficiency;
  const powerLimitedN = profile.powerW * profile.drivelineEfficiency / Math.max(Math.abs(speedMps), 4);
  return Math.max(0, Math.min(torqueForceN,powerLimitedN,profile.massKg * longitudinalLimitMps2 * .88));
}
