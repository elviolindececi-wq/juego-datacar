import type { Vehicle } from '../types/vehicle.ts';

export type LuggageLoadTier = 'none' | 'light' | 'full';

export interface VehiclePayloadSelection {
  occupants: number;
  luggageTier: LuggageLoadTier;
}

export const AVERAGE_PASSENGER_WEIGHT_KG = 75;

export const DEFAULT_PAYLOAD_SELECTION: VehiclePayloadSelection = {
  occupants: 1,
  luggageTier: 'none',
};

export const LUGGAGE_TIERS: Array<{ id: LuggageLoadTier; label: string; kg: number; detail: string }> = [
  { id: 'none', label: 'Sin valijas', kg: 0, detail: 'Baúl vacío (+0 kg)' },
  { id: 'light', label: 'Equipaje liviano', kg: 40, detail: '2 bolsos / compras (+40 kg)' },
  { id: 'full', label: 'Baúl cargado', kg: 90, detail: 'Viaje familiar completo (+90 kg)' },
];

export function getMaxOccupantsForVehicle(vehicle?: Vehicle | null): number {
  const cap = vehicle?.equipment?.seatingCapacity ?? 5;
  return Math.max(1, Math.min(8, Math.round(cap)));
}

export function getLuggageKg(tier: LuggageLoadTier): number {
  return LUGGAGE_TIERS.find((t) => t.id === tier)?.kg ?? 0;
}

export function clampPayloadSelection(
  selection: VehiclePayloadSelection,
  vehicle?: Vehicle | null
): VehiclePayloadSelection {
  const maxSeats = getMaxOccupantsForVehicle(vehicle);
  return {
    occupants: Math.max(1, Math.min(maxSeats, Math.round(selection.occupants || 1))),
    luggageTier: selection.luggageTier,
  };
}

/**
 * Peso adicional sobre la masa en orden de marcha:
 * El conductor (1 persona) se considera parte de la orden de marcha base del simulador;
 * cada acompañante adicional suma 75 kg + carga declarada de equipaje.
 */
export function computePayloadKg(
  selection: VehiclePayloadSelection,
  vehicle?: Vehicle | null
): number {
  const clamped = clampPayloadSelection(selection, vehicle);
  const extraPassengers = Math.max(0, clamped.occupants - 1);
  const rawKg = extraPassengers * AVERAGE_PASSENGER_WEIGHT_KG + getLuggageKg(clamped.luggageTier);
  const vehicleLimit = vehicle?.maxPayloadKg && vehicle.maxPayloadKg > 0 ? vehicle.maxPayloadKg + 120 : 650;
  return Math.min(vehicleLimit, Math.max(0, Math.round(rawKg)));
}

export function formatPayloadBadge(selection: VehiclePayloadSelection, vehicle?: Vehicle | null): string {
  const clamped = clampPayloadSelection(selection, vehicle);
  const extraKg = computePayloadKg(clamped, vehicle);
  const paxText = clamped.occupants === 1 ? '1 persona (solo piloto)' : `${clamped.occupants} personas`;
  return extraKg > 0 ? `${paxText} · +${extraKg} kg` : paxText;
}

export function computePayloadHandlingInsight(
  selection: VehiclePayloadSelection,
  vehicle?: Vehicle | null
): {
  extraKg: number;
  baseWeightKg: number;
  totalMassKg: number;
  brakingExtensionPct: number;
  accelPenaltyPct: number;
  iqCleanLoadBonus: number;
} {
  const clamped = clampPayloadSelection(selection, vehicle);
  const extraKg = computePayloadKg(clamped, vehicle);
  const baseWeightKg = Math.max(950, vehicle?.weightKg ?? 1380);
  const totalMassKg = baseWeightKg + extraKg;
  const massRatio = extraKg / baseWeightKg;

  return {
    extraKg,
    baseWeightKg,
    totalMassKg,
    brakingExtensionPct: Math.round(massRatio * 100 * 0.92),
    accelPenaltyPct: Math.round(massRatio * 100),
    iqCleanLoadBonus: clamped.occupants >= 3 ? Math.min(18, (clamped.occupants - 1) * 4) : 0,
  };
}
