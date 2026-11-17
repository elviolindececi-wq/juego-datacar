/**
 * DATACAR ARENA — Feature Flags & Configuración de Patrocinadores Oficiales (Sponsors)
 * Cuando se cierre un acuerdo comercial con una marca de neumáticos o un emblema de
 * estaciones de servicio, basta con actualizar `ACTIVE_TIRE_SPONSOR` o `ACTIVE_FUEL_SPONSOR`
 * en este archivo para personalizar toda la interfaz, el catálogo y las estaciones 3D en pista.
 */

export const enableTireShowroom: boolean = true;
export const enableFuelStationsInCircuit: boolean = true;

export interface TireSponsorBrand {
  id: string;
  displayName: string;
  tagline: string;
  primaryColorHex: string;
  accentColorHex: string;
  officialWebsiteUrl?: string;
  logoAssetPath?: string;
  /** True mientras se muestra la marca institucional preparada para el futuro sponsor */
  isSponsorSlotAvailable?: boolean;
}

export interface FuelStationSponsorBrand {
  id: string;
  displayName: string;
  stationTitle: string;
  shopName: string;
  tagline: string;
  primaryColorHex: string;
  secondaryColorHex: string;
  canopyFasciaHex: string;
  officialWebsiteUrl?: string;
  logoAssetPath?: string;
  /** Probabilidad (0..1) de que en una carrera se active el evento aleatorio de reserva de combustible */
  randomRefuelChallengeProbability: number;
  isSponsorSlotAvailable?: boolean;
}

/**
 * CONFIGURACIÓN DEL SPONSOR DE CUBIERTAS
 * Para activar un sponsor vendido (ej. Pirelli, Michelin, Bridgestone, Fate, Sunset):
 * cambiar `displayName`, `tagline`, `primaryColorHex`, `officialWebsiteUrl` y poner `isSponsorSlotAvailable: false`.
 */
export const ACTIVE_TIRE_SPONSOR: TireSponsorBrand = {
  id: 'datacar-tires-sponsor-slot',
  displayName: 'DATACAR PRO TIRES',
  tagline: 'ESPACIO PREPARADO PARA SPONSOR OFICIAL DE NEUMÁTICOS',
  primaryColorHex: '#00E5F5',
  accentColorHex: '#FFAA12',
  officialWebsiteUrl: 'https://www.datacarpy.com',
  isSponsorSlotAvailable: true,
};

/**
 * CONFIGURACIÓN DEL SPONSOR DE ESTACIONES DE SERVICIO
 * Para activar un emblema vendido (ej. Petrobras, Shell, Copetrol, Puma Energy, Enex):
 * cambiar `displayName`, `stationTitle`, `primaryColorHex`, `secondaryColorHex` y poner `isSponsorSlotAvailable: false`.
 */
export const ACTIVE_FUEL_SPONSOR: FuelStationSponsorBrand = {
  id: 'datacar-energy-sponsor-slot',
  displayName: 'DATACAR ENERGY',
  stationTitle: 'ESTACIÓN DATACAR ENERGY · 24 HS',
  shopName: 'DATACAR FULL MARKET',
  tagline: 'ESPACIO PREPARADO PARA SPONSOR DE COMBUSTIBLES',
  primaryColorHex: '#00E5F5',
  secondaryColorHex: '#FFAA12',
  canopyFasciaHex: '#071a2b',
  officialWebsiteUrl: 'https://www.datacarpy.com',
  randomRefuelChallengeProbability: 0.55,
  isSponsorSlotAvailable: true,
};

export interface SponsoredTireSpec {
  id: string;
  sponsorBrandId: string;
  modelName: string;
  sizeCode: string;
  loadSpeedIndex?: string;
  categoryLabel?: string;
  productImagePath?: string;
  verifiedSheetSource: string;
}

export interface VehicleTireCompatibilityRule {
  vehicleId: string;
  oemTireSize: string;
  compatibleTireIds: string[];
  verifiedBySponsor: boolean;
}

export interface TireShowroomCatalogConfig {
  enabled: boolean;
  sponsor: TireSponsorBrand | null;
  tires: SponsoredTireSpec[];
  compatibilities: VehicleTireCompatibilityRule[];
}

export const INITIAL_TIRE_SHOWROOM_CONFIG: TireShowroomCatalogConfig = {
  enabled: enableTireShowroom,
  sponsor: ACTIVE_TIRE_SPONSOR,
  tires: [],
  compatibilities: [],
};
