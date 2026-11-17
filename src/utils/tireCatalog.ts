import { useEffect, useState } from 'react';
import { ACTIVE_TIRE_SPONSOR, type TireSponsorBrand } from '../config/featureFlags.ts';
import type { Vehicle } from '../types/vehicle.ts';

export type TireCompoundId =
  | 'oem_urban'
  | 'sport_uhp'
  | 'wet_raudal'
  | 'reinforced_all_terrain';

export interface TireCompoundSpec {
  id: TireCompoundId;
  code: string;
  modelName: string;
  categoryBadge: string;
  recommendedCircuitProfile: string;
  shortDescription: string;
  technicalHighlight: string;
  /** Multiplicador sobre `vehicle.tireGrip` */
  gripMultiplier: number;
  /** Mejora de distancia de frenado 100–0 km/h en metros */
  brakingReductionMeters: number;
  /** Mejora de aceleración 0–100 km/h en segundos */
  accel0100BonusSec: number;
  /** Incremento de velocidad punta en km/h */
  topSpeedBonusKmh: number;
  /** Puntuación visual (0..100) para barras comparativas del Showroom */
  ratings: {
    dryGrip: number;
    wetDrainage: number;
    potholeDurability: number;
    brakingResponse: number;
  };
  accentColorHex: string;
}

export const TIRE_COMPOUNDS_CATALOG: readonly TireCompoundSpec[] = [
  {
    id: 'oem_urban',
    code: 'OEM-STD',
    modelName: 'SERIE ORIGINAL · TOURING CONFORT',
    categoryBadge: 'EQUIPAMIENTO DE SERIE',
    recommendedCircuitProfile: 'Uso mixto urbano y ruta',
    shortDescription:
      'Compuesto original equilibrado entre confort de marcha, bajo ruido y consumo contenido.',
    technicalHighlight: 'Banda simétrica multi-surco · Calibración estándar de fábrica',
    gripMultiplier: 1.0,
    brakingReductionMeters: 0,
    accel0100BonusSec: 0,
    topSpeedBonusKmh: 0,
    ratings: {
      dryGrip: 74,
      wetDrainage: 75,
      potholeDurability: 76,
      brakingResponse: 74,
    },
    accentColorHex: '#38bdf8',
  },
  {
    id: 'sport_uhp',
    code: 'UHP-RS',
    modelName: 'ULTRA HIGH PERFORMANCE · ASFALTO SECO',
    categoryBadge: '+7% AGARRE · FRENADA CORTA',
    recommendedCircuitProfile: 'Contrarreloj Fase 2, Oliva y tramos rápidos',
    shortDescription:
      'Compuesto de sílice de alta adherencia con hombros rígidos para máxima tracción en curva y frenada extrema.',
    technicalHighlight: '-2,2 m en frenada 100–0 km/h · -0,25 s en 0–100 km/h',
    gripMultiplier: 1.07,
    brakingReductionMeters: 2.2,
    accel0100BonusSec: 0.25,
    topSpeedBonusKmh: 3,
    ratings: {
      dryGrip: 96,
      wetDrainage: 78,
      potholeDurability: 72,
      brakingResponse: 95,
    },
    accentColorHex: '#f59e0b',
  },
  {
    id: 'wet_raudal',
    code: 'AQUA-PRO',
    modelName: 'HYDRO-CHANNEL PRO · LLUVIA & RAUDALES',
    categoryBadge: '+14% TRACCIÓN EN AGUA',
    recommendedCircuitProfile: 'Aviadores del Chaco y Artigas (Raudales)',
    shortDescription:
      'Canales direccionales en V de evacuación rápida que reducen el hidroplaneo en calzadas inundadas.',
    technicalHighlight: '-1,6 m en frenada húmeda · +5% adherencia general',
    gripMultiplier: 1.05,
    brakingReductionMeters: 1.6,
    accel0100BonusSec: 0.16,
    topSpeedBonusKmh: 1,
    ratings: {
      dryGrip: 84,
      wetDrainage: 98,
      potholeDurability: 82,
      brakingResponse: 90,
    },
    accentColorHex: '#00e5f5',
  },
  {
    id: 'reinforced_all_terrain',
    code: 'AT-KARKASA',
    modelName: 'KARKASA REFORZADA XL · BACHES & ADOQUINES',
    categoryBadge: 'ALTA ABSORCIÓN DE IMPACTO',
    recommendedCircuitProfile: 'Avelino Martínez, Herrera y José Félix López',
    shortDescription:
      'Laterales con doble malla de poliéster y tacos de hombro reforzados para resistir pozos, zanjas y adoquines sueltos.',
    technicalHighlight: '+4% tracción en asfalto roto · -1,3 m en frenada',
    gripMultiplier: 1.04,
    brakingReductionMeters: 1.3,
    accel0100BonusSec: 0.14,
    topSpeedBonusKmh: 1,
    ratings: {
      dryGrip: 82,
      wetDrainage: 86,
      potholeDurability: 98,
      brakingResponse: 85,
    },
    accentColorHex: '#10b981',
  },
] as const;

const STORAGE_KEY = 'datacar_arena_selected_tires_v1';
const TIRE_CHANGE_EVENT = 'datacar-tires-updated';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadSelectedTireMap(): Record<string, TireCompoundId> {
  if (!canUseStorage()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    const out: Record<string, TireCompoundId> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (TIRE_COMPOUNDS_CATALOG.some((c) => c.id === v)) {
        out[k] = v as TireCompoundId;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function getSelectedTireForVehicle(vehicleId?: string | null): TireCompoundId {
  if (!vehicleId) return 'oem_urban';
  const map = loadSelectedTireMap();
  return map[vehicleId] ?? 'oem_urban';
}

export function setSelectedTireForVehicle(
  vehicleId: string,
  compoundId: TireCompoundId,
): TireCompoundId {
  if (!canUseStorage() || !vehicleId) return compoundId;
  try {
    const current = loadSelectedTireMap();
    current[vehicleId] = compoundId;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    window.dispatchEvent(new CustomEvent(TIRE_CHANGE_EVENT));
  } catch {
    // Ignore storage errors
  }
  return compoundId;
}

export function getTireCompoundSpec(compoundId?: TireCompoundId | null): TireCompoundSpec {
  return (
    TIRE_COMPOUNDS_CATALOG.find((c) => c.id === compoundId) ??
    TIRE_COMPOUNDS_CATALOG[0]
  );
}

export function getActiveTireSponsor(): TireSponsorBrand {
  return ACTIVE_TIRE_SPONSOR;
}

/**
 * Aplica las mejoras físicas del compuesto de neumáticos elegido al vehículo para el Modo Carrera,
 * conservando intactas las fichas comerciales cuando se usa `oem_urban`.
 */
export function applySelectedTireCompoundToVehicle(
  vehicle: Vehicle,
  compoundId: TireCompoundId = getSelectedTireForVehicle(vehicle.id),
): Vehicle {
  const spec = getTireCompoundSpec(compoundId);
  if (spec.id === 'oem_urban') return vehicle;

  const upgradedGrip = Number((vehicle.tireGrip * spec.gripMultiplier).toFixed(3));
  const upgradedBraking = Number(
    Math.max(26.5, vehicle.brakingDistance100 - spec.brakingReductionMeters).toFixed(1),
  );
  const upgradedAccel = Number(
    Math.max(2.5, vehicle.accel0100 - spec.accel0100BonusSec).toFixed(2),
  );
  const upgradedTopSpeed = Math.round(vehicle.topSpeedKmh + spec.topSpeedBonusKmh);

  return {
    ...vehicle,
    tireGrip: upgradedGrip,
    brakingDistance100: upgradedBraking,
    accel0100: upgradedAccel,
    topSpeedKmh: upgradedTopSpeed,
  };
}

export function useTireCatalogSelection(vehicleId?: string | null) {
  const [selectedCompoundId, setSelectedCompoundId] = useState<TireCompoundId>(() =>
    getSelectedTireForVehicle(vehicleId),
  );

  useEffect(() => {
    setSelectedCompoundId(getSelectedTireForVehicle(vehicleId));
  }, [vehicleId]);

  useEffect(() => {
    const sync = () => {
      setSelectedCompoundId(getSelectedTireForVehicle(vehicleId));
    };
    window.addEventListener(TIRE_CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(TIRE_CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [vehicleId]);

  const selectCompound = (nextId: TireCompoundId) => {
    if (!vehicleId) return;
    setSelectedTireForVehicle(vehicleId, nextId);
    setSelectedCompoundId(nextId);
  };

  return {
    selectedCompoundId,
    selectedSpec: getTireCompoundSpec(selectedCompoundId),
    sponsor: getActiveTireSponsor(),
    catalog: TIRE_COMPOUNDS_CATALOG,
    selectCompound,
  };
}
