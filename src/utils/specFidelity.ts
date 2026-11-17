/**
 * DATACAR ARENA — Fidelidad Técnica de Catálogo (§3 y §14)
 * Garantiza que ningún componente presente calibraciones internas del solver
 * como si fueran especificaciones oficiales del fabricante cuando el dato no
 * figura en la ficha técnica verificada.
 */
import type { Vehicle } from '../types/vehicle.ts';

export const NOT_SPECIFIED_LABEL = 'No especificado';

const IMPLICIT_SIMULATION_ONLY_FIELDS = new Set<string>([
  'weightKg',
  'topSpeedKmh',
  'accel0100',
  'dragCoeff',
  'frontalArea',
  'fuelCapacityL',
  'consumptionBase',
  'consumptionRacing',
  'brakingDistance100',
]);

/**
 * Determina si un campo técnico es una estimación de simulación y NO un dato
 * confirmado en la ficha oficial de la versión.
 */
export function isVehicleFieldUnconfirmed(vehicle: Vehicle, fieldName: string): boolean {
  if (vehicle.estimatedFieldNames && vehicle.estimatedFieldNames.length > 0) {
    return vehicle.estimatedFieldNames.includes(fieldName);
  }
  if (vehicle.estimatedSimulationParameters && IMPLICIT_SIMULATION_ONLY_FIELDS.has(fieldName)) {
    return true;
  }
  return false;
}

/** Potencia oficial para mostrar en UI; devuelve "No especificado" si no consta en ficha. */
export function formatOfficialPower(vehicle: Vehicle, unit: 'HP' | 'CV' = 'HP'): string {
  if (isVehicleFieldUnconfirmed(vehicle, 'powerHp')) {
    return NOT_SPECIFIED_LABEL;
  }
  if (vehicle.id === 'chevrolet-tracker-lite') {
    return unit === 'CV' ? '139 CV (≈137 HP)' : '137 HP (139 CV)';
  }
  const rounded = Number.isInteger(vehicle.powerHp)
    ? String(vehicle.powerHp)
    : vehicle.powerHp.toFixed(1);
  return `${rounded} ${unit}`;
}

/** Torque oficial para mostrar en UI; distingue torque eléctrico puro en HEV y datos faltantes. */
export function formatOfficialTorque(vehicle: Vehicle): string {
  if (vehicle.hybridSystem?.torqueNmIsElectricOnly && vehicle.hybridSystem.electricTorqueNm) {
    return `${vehicle.hybridSystem.electricTorqueNm} Nm (motor eléc.)`;
  }
  if (isVehicleFieldUnconfirmed(vehicle, 'torqueNm')) {
    return NOT_SPECIFIED_LABEL;
  }
  return `${Math.round(vehicle.torqueNm)} Nm`;
}

/** Despeje al suelo oficial; devuelve "No especificado" si la ficha listaba 0 mm o no consta. */
export function formatOfficialClearance(vehicle: Vehicle): string {
  if (isVehicleFieldUnconfirmed(vehicle, 'dimensions.clearanceMm')) {
    return NOT_SPECIFIED_LABEL;
  }
  const mm = vehicle.dimensions?.clearanceMm ?? vehicle.equipment?.groundClearanceMm;
  if (!mm || mm <= 0) return NOT_SPECIFIED_LABEL;
  return `${mm} mm`;
}

/** Consumo mixto oficial; devuelve "No especificado" cuando es supuesto de simulación. */
export function formatOfficialConsumption(vehicle: Vehicle): string {
  if (isVehicleFieldUnconfirmed(vehicle, 'consumptionBase')) {
    return NOT_SPECIFIED_LABEL;
  }
  return `${vehicle.consumptionBase.toFixed(1)} L/100km`;
}

/** Aceleración 0-100 km/h oficial o etiquetada explícitamente como simulación si no está en ficha. */
export function formatOfficialOrSimAccel(vehicle: Vehicle, allowSimTag = false): string {
  if (isVehicleFieldUnconfirmed(vehicle, 'accel0100')) {
    return allowSimTag ? `≈ ${vehicle.accel0100.toFixed(1)} s (sim.)` : NOT_SPECIFIED_LABEL;
  }
  return `${vehicle.accel0100.toFixed(1)} s`;
}

/** Velocidad máxima oficial o "No especificado" cuando no figura en ficha. */
export function formatOfficialTopSpeed(vehicle: Vehicle, allowSimTag = false): string {
  if (isVehicleFieldUnconfirmed(vehicle, 'topSpeedKmh')) {
    return allowSimTag ? `≈ ${Math.round(vehicle.topSpeedKmh)} km/h (sim.)` : NOT_SPECIFIED_LABEL;
  }
  return `${Math.round(vehicle.topSpeedKmh)} km/h`;
}

/** Peso en orden de marcha oficial o "No especificado" cuando es parámetro de simulación. */
export function formatOfficialWeight(vehicle: Vehicle, allowSimTag = false): string {
  if (isVehicleFieldUnconfirmed(vehicle, 'weightKg')) {
    return allowSimTag ? `≈ ${Math.round(vehicle.weightKg)} kg (sim.)` : NOT_SPECIFIED_LABEL;
  }
  return `${Math.round(vehicle.weightKg)} kg`;
}

/** Frenado 100-0 km/h oficial o "No especificado" cuando es parámetro de simulación. */
export function formatOfficialBraking(vehicle: Vehicle, allowSimTag = false): string {
  if (isVehicleFieldUnconfirmed(vehicle, 'brakingDistance100')) {
    return allowSimTag ? `≈ ${vehicle.brakingDistance100.toFixed(1)} m (sim.)` : NOT_SPECIFIED_LABEL;
  }
  return `${vehicle.brakingDistance100.toFixed(1)} m`;
}

/** Capacidad de tanque oficial o "No especificado" cuando no figura en ficha. */
export function formatOfficialFuelCapacity(vehicle: Vehicle): string {
  if (isVehicleFieldUnconfirmed(vehicle, 'fuelCapacityL')) {
    return NOT_SPECIFIED_LABEL;
  }
  return `${vehicle.fuelCapacityL} L`;
}

/** Precio referencial exacto del registro del catálogo sin inventar cifras alternativas. */
export function formatOfficialPriceUsd(vehicle: Vehicle): string {
  const usd = vehicle.equipment?.priceUsd;
  if (!usd || !Number.isFinite(usd) || usd <= 0) return NOT_SPECIFIED_LABEL;
  return `USD ${usd.toLocaleString('es-PY')}`;
}

/** Abreviatura fiel de la transmisión declarada en la ficha de cada versión. */
export function formatShortTransmission(vehicle: Vehicle): string {
  const desc = (vehicle.transmissionDescription || '').toUpperCase();
  if (desc.includes('6DCT') || desc.includes('DCT')) return '6DCT';
  if (desc.includes('DHT')) return 'DHT HEV';
  if (desc.includes('CVT') && desc.includes('10')) return 'CVT 10v';
  if (desc.includes('CVT')) return 'CVT';
  if (desc.includes('6 VELOCIDADES')) return 'AT 6 vel.';
  return vehicle.transmissionDescription || NOT_SPECIFIED_LABEL;
}

/** Descripción editorial breve 100% respaldada por la ficha cargada de cada versión. */
export function getVerifiedVehicleSummary(vehicle: Vehicle): string {
  switch (vehicle.id) {
    case 'toyota-corolla-cross-seg-2027':
      return '2.0L Dynamic Force (171 HP / 203 Nm), caja CVT de 10 marchas preprogramadas y 7 airbags según ficha SEG 2027.';
    case 'chevrolet-tracker-lite':
      return '1.2L Turbo 3 cilindros (139 CV / 220 Nm), caja automática de 6 marchas, pantalla 11" y asistencias de ficha DATACAR.';
    case 'nissan-kicks-2027':
      return '1.2L 120 HP / 220 Nm con transmisión automática 6DCT de doble embrague, pantalla 12,3" y paquete ADAS según ficha.';
    case 'kia-carens-ex':
      return 'SUV familiar de 3 filas (7 plazas), motor 1.5L CRDi Turbo Diésel de 250 Nm y 195 mm de despeje.';
    case 'chery-t4-pro-luxury-hev':
      return 'Híbrido autorrecargable (HEV) de 195 HP combinados, caja DHT, 7 airbags y paquete ADAS completo en ficha.';
    case 'suzuki-fronx':
      return '1.5L Dualjet 102 HP / 137 Nm con asistencia Mild Hybrid ISG 12V, caja automática de 6 marchas y cámara 360°.';
    case 'chery-t2-pro-max':
      return 'SUV compacto 1.5L Euro 6B con caja automática CVT18, pantalla 10,25", ESP/TCS y control de descenso HDC.';
    default:
      return vehicle.description || NOT_SPECIFIED_LABEL;
  }
}
