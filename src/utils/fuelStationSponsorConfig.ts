import {
  ACTIVE_FUEL_SPONSOR,
  type FuelStationSponsorBrand,
} from '../config/featureFlags.ts';
import type { Vehicle } from '../types/vehicle.ts';

export type FuelProductId =
  | 'nafta_97_premium'
  | 'nafta_95_super'
  | 'bio_flex_octane'
  | 'ultra_diesel_s10'
  | 'racing_100_ron';

export interface FuelProductSpec {
  id: FuelProductId;
  code: string;
  displayName: string;
  octaneOrCetaneLabel: string;
  badgeColorHex: string;
  shortTechnicalNote: string;
  powerResponseBonusPct: number;
  iqBonusPoints: number;
}

export const FUEL_PRODUCTS_CATALOG: readonly FuelProductSpec[] = [
  {
    id: 'nafta_97_premium',
    code: '97 RON',
    displayName: 'SUPRA 97 OCTANOS · ADITIVADA GDI/HEV',
    octaneOrCetaneLabel: '97 RON · Ultra Baja Fricción',
    badgeColorHex: '#f59e0b',
    shortTechnicalNote:
      'Máxima resistencia a la detonación para motores Turbo de inyección directa, D-4S e Híbridos HEV.',
    powerResponseBonusPct: 4.5,
    iqBonusPoints: 30,
  },
  {
    id: 'ultra_diesel_s10',
    code: 'DIÉSEL S10',
    displayName: 'ULTRA DIÉSEL S10 · COMMON-RAIL PRO',
    octaneOrCetaneLabel: 'Cetano 53 · <10 ppm Azufre',
    badgeColorHex: '#10b981',
    shortTechnicalNote:
      'Protege inyectores piezoelectrónicos CRDi y maximiza el par motor en subida con carga.',
    powerResponseBonusPct: 4.5,
    iqBonusPoints: 30,
  },
  {
    id: 'bio_flex_octane',
    code: 'FLEX E85/97',
    displayName: 'ECO-FLEX OCTANE · BIOETANOL + 97 RON',
    octaneOrCetaneLabel: 'Alto Octanaje Flex / 6DCT',
    badgeColorHex: '#00e5f5',
    shortTechnicalNote:
      'Mezcla oxigenada de combustión fría ideal para motores Flex y cajas de doble embrague.',
    powerResponseBonusPct: 4.0,
    iqBonusPoints: 25,
  },
  {
    id: 'nafta_95_super',
    code: '95 SUPER',
    displayName: 'SUPER 95 OCTANOS · MULTIPUNTO LIMPIA',
    octaneOrCetaneLabel: '95 RON · Detergencia Activa',
    badgeColorHex: '#38bdf8',
    shortTechnicalNote:
      'Calibración óptima para motores atmosféricos multipunto y sistemas Mild-Hybrid 12V.',
    powerResponseBonusPct: 3.5,
    iqBonusPoints: 25,
  },
  {
    id: 'racing_100_ron',
    code: '100 RON',
    displayName: 'RACING 100 OCTANOS · PROTOTIPO V10',
    octaneOrCetaneLabel: '100 RON · Grado Competición',
    badgeColorHex: '#ef4444',
    shortTechnicalNote:
      'Combustible sintético de alto régimen para superdeportivos de alta compresión.',
    powerResponseBonusPct: 5.5,
    iqBonusPoints: 35,
  },
] as const;

export interface VehicleFuelRecommendation {
  vehicleId: string;
  vehicleLabel: string;
  recommendedFuel: FuelProductSpec;
  alternativeFuel: FuelProductSpec;
  reasonHeadline: string;
  technicalExplanation: string;
}

/**
 * Recomienda de forma inteligente el combustible exacto según la motorización,
 * alimentación (`fuelFeeding`), tipo de combustible (`fuelType`) e hibridación del vehículo.
 */
export function recommendFuelForVehicle(vehicle: Vehicle): VehicleFuelRecommendation {
  const byId = (id: FuelProductId): FuelProductSpec =>
    FUEL_PRODUCTS_CATALOG.find((p) => p.id === id) ?? FUEL_PRODUCTS_CATALOG[0];

  const vehicleLabel = `${vehicle.brand} ${vehicle.name}`;

  // 1. Diésel (ej. Kia Carens 1.5L CRDi Turbo Diésel)
  if (vehicle.fuelType === 'diesel' || /di[eé]sel|crdi/i.test(vehicle.engineDescription)) {
    return {
      vehicleId: vehicle.id,
      vehicleLabel,
      recommendedFuel: byId('ultra_diesel_s10'),
      alternativeFuel: byId('ultra_diesel_s10'),
      reasonHeadline: 'MOTOR TURBO DIÉSEL CRDi DETECTADO',
      technicalExplanation:
        'Tu motor 1.5L CRDi Turbo Diésel (250 Nm) exige Ultra Diésel S10 de bajo azufre para cuidar el sistema common-rail y sostener el empuje.',
    };
  }

  // 2. Superdeportivo V10 (Lamborghini Proyecto Fantasma)
  if (vehicle.category === 'supercar' || vehicle.powerHp >= 450) {
    return {
      vehicleId: vehicle.id,
      vehicleLabel,
      recommendedFuel: byId('racing_100_ron'),
      alternativeFuel: byId('nafta_97_premium'),
      reasonHeadline: 'UNIDAD V10 DE ALTA COMPRESIÓN',
      technicalExplanation:
        'El motor V10 5.2L de 640 HP requiere Racing 100 Octanos o Supra 97 RON para entregar máxima potencia sin retraso de encendido.',
    };
  }

  // 3. Híbrido autorrecargable HEV (Chery T4 Pro Luxury HEV)
  if (vehicle.hybridSystem?.kind === 'self-charging-hev') {
    return {
      vehicleId: vehicle.id,
      vehicleLabel,
      recommendedFuel: byId('nafta_97_premium'),
      alternativeFuel: byId('nafta_95_super'),
      reasonHeadline: 'PROPULSIÓN HÍBRIDA HEV (195 HP COMBINADOS)',
      technicalExplanation:
        'En arranques frecuentes del motor térmico asistido por batería, Supra 97 Octanos mantiene limpios los inyectores y optimiza el rendimiento DHT.',
    };
  }

  // 4. Mild-Hybrid 12V Dualjet (Suzuki Fronx)
  if (vehicle.hybridSystem?.kind === 'mild-12v') {
    return {
      vehicleId: vehicle.id,
      vehicleLabel,
      recommendedFuel: byId('nafta_95_super'),
      alternativeFuel: byId('nafta_97_premium'),
      reasonHeadline: 'MOTOR 1.5L DUALJET + MILD HYBRID 12V',
      technicalExplanation:
        'La doble inyección multipunto Dualjet con asistencia ISG 12V logra su mejor relación eficiencia/respuesta con Super 95 o Supra 97 Octanos.',
    };
  }

  // 5. Flex / 6DCT (Nissan Kicks)
  if (vehicle.fuelType === 'flex' || /flex/i.test(vehicle.fuelFeeding)) {
    return {
      vehicleId: vehicle.id,
      vehicleLabel,
      recommendedFuel: byId('bio_flex_octane'),
      alternativeFuel: byId('nafta_97_premium'),
      reasonHeadline: 'MOTORIZACIÓN FLEX · CAJA 6DCT DOBLE EMBRAGUE',
      technicalExplanation:
        'Tu motor 1.2L con admisión Flex aprovecha el octanaje de Eco-Flex E85/97 o Supra 97 RON para cambios más ágiles en la caja 6DCT.',
    };
  }

  // 6. Turbo Inyección Directa o D-4S (Chevrolet Tracker 1.2T / Toyota Corolla Cross 2.0 D-4S)
  if (/turbo|directa|d-4s/i.test(`${vehicle.engineDescription} ${vehicle.fuelFeeding}`)) {
    return {
      vehicleId: vehicle.id,
      vehicleLabel,
      recommendedFuel: byId('nafta_97_premium'),
      alternativeFuel: byId('nafta_95_super'),
      reasonHeadline: 'INYECCIÓN DIRECTA / TURBO DE ALTA EFICIENCIA',
      technicalExplanation:
        'Por su relación de compresión e inyección directa, Supra 97 Octanos evita el pistoneo y garantiza el 100% del torque disponible.',
    };
  }

  // 7. Atmosférico multipunto (Chery T2 Pro Max 1.5 CVT)
  return {
    vehicleId: vehicle.id,
    vehicleLabel,
    recommendedFuel: byId('nafta_95_super'),
    alternativeFuel: byId('nafta_97_premium'),
    reasonHeadline: 'MOTOR 1.5L ATMOSFÉRICO CVT EURO 6B',
    technicalExplanation:
      'Para tu motor 1.5L atmosférico con caja CVT, Super 95 Octanos con aditivos detergentes entrega marcha suave y consumo óptimo.',
  };
}

export function getActiveFuelSponsor(): FuelStationSponsorBrand {
  return ACTIVE_FUEL_SPONSOR;
}

/**
 * Calcula la ubicación longitudinal `stationS` (en metros desde la largada de una vuelta)
 * donde se emplaza la Estación de Servicio 3D en cualquier circuito.
 */
export function getCircuitFuelStationDistanceM(singleLapDistanceM: number): number {
  const safeLap = Math.max(600, singleLapDistanceM);
  return Math.round(safeLap * 0.42);
}

export interface FuelStationRaceAlertState {
  /** Si en esta partida se activó el desafío aleatorio de pasar a cargar combustible */
  challengeActive: boolean;
  /** Si el jugador ya pasó por la bahía de surtidores y cargó combustible */
  refueled: boolean;
  /** Combustible cargado en la parada */
  loadedFuel: FuelProductSpec | null;
  /** Distancia restante en metros hasta la estación en la vuelta actual (negativo si ya la pasó) */
  distanceToStationM: number;
  /** True cuando el vehículo está dentro del radio de aproximación (260 m antes hasta 28 m después) */
  isApproachingStation: boolean;
  /** True cuando el vehículo está exactamente sobre el carril de carga de la estación */
  isInPitBay: boolean;
  sponsor: FuelStationSponsorBrand;
  recommendation: VehicleFuelRecommendation;
}

export function evaluateFuelStationPitInteraction(args: {
  playerSInLapM: number;
  playerLateralX: number;
  singleLapDistanceM: number;
  challengeActive: boolean;
  alreadyRefueled: boolean;
  loadedFuel: FuelProductSpec | null;
  vehicle: Vehicle;
}): FuelStationRaceAlertState {
  const stationS = getCircuitFuelStationDistanceM(args.singleLapDistanceM);
  const deltaM = stationS - args.playerSInLapM;
  const isApproachingStation = deltaM >= -24 && deltaM <= 260;

  // El carril derecho de entrada a la estación en la avenida (X <= -5.0 m) dentro de +/- 26 m de los surtidores
  const isInPitBay =
    Math.abs(args.playerSInLapM - stationS) <= 26 && args.playerLateralX <= -4.8;

  const recommendation = recommendFuelForVehicle(args.vehicle);

  return {
    challengeActive: args.challengeActive,
    refueled: args.alreadyRefueled,
    loadedFuel: args.loadedFuel,
    distanceToStationM: Math.round(deltaM),
    isApproachingStation,
    isInPitBay,
    sponsor: getActiveFuelSponsor(),
    recommendation,
  };
}
