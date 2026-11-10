/** Escalable: validar y registrar vehículos futuros mediante la interfaz Vehicle.
 * Un registro no necesita entradas hardcodeadas en la física, ABS ni en la UI.
 */
import type { Vehicle } from '../types/vehicle.ts';
import { SAFETY_KEYS, getSafetyState } from '../utils/vehicleSafetySystems.ts';

export function validateNewVehicle(vehicle:Vehicle):string[] {
  const errors:string[]=[];
  if (!vehicle.id?.trim()) errors.push('id obligatorio');
  if (!vehicle.brand?.trim() || !vehicle.name?.trim() || !vehicle.trim?.trim()) errors.push('marca, modelo y versión obligatorios');
  for (const key of ['powerHp','torqueNm','weightKg','brakingDistance100','tireGrip','topSpeedKmh'] as const)
    if (!Number.isFinite(vehicle[key]) || vehicle[key] <= 0) errors.push(`${key}: positivo y numérico`);
  for (const k of ['lengthMm','widthMm','heightMm','clearanceMm'] as const)
    if (!Number.isFinite(vehicle.dimensions[k]) || vehicle.dimensions[k] <= 0) errors.push(`dimensions.${k}: inválido`);
  if (!vehicle.equipment?.safetySystems) errors.push('safetySystems requerido (usar unknown para datos sin verificar)');
  if (!vehicle.specEvidence) errors.push('specEvidence requerido; indicar fuente o pendiente');
  if (vehicle.equipment?.safetySystems) for (const k of SAFETY_KEYS)
    if (getSafetyState(vehicle,k) === 'present' && !vehicle.specEvidence?.sourceLabel) errors.push(`${k}: falta fuente`);
  return errors;
}
export function registerVehicleInCatalog(existing:Vehicle[], incoming:Vehicle):Vehicle[] {
  const errors=validateNewVehicle(incoming);
  if (errors.length) throw new Error(`Ficha incompleta ${incoming.id}: ${errors.join('; ')}`);
  if (existing.some(v=>v.id===incoming.id)) throw new Error(`id de vehículo duplicado: ${incoming.id}`);
  return [...existing,incoming];
}
