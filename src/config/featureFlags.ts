/**
 * DATACAR ARENA — Feature Flags & Contratos Comerciales Futuros
 * Control explícito de funcionalidades sujetas a patrocinio oficial.
 */

/**
 * OBLIGATORIO (§12): La función de mejora/catálogo comercial de neumáticos
 * permanece deshabilitada hasta contar con un sponsor oficial confirmado.
 * NO habilitar automáticamente por presencia de imágenes, logos o assets.
 */
export const enableTireShowroom: boolean = false;

export interface TireSponsorBrand {
  id: string;
  displayName: string;
  officialWebsiteUrl?: string;
  logoAssetPath?: string;
}

export interface SponsoredTireSpec {
  id: string;
  sponsorBrandId: string;
  modelName: string;
  sizeCode: string; // ej. "215/60 R17" homologado por ficha oficial
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
  sponsor: null,
  tires: [],
  compatibilities: [],
};
