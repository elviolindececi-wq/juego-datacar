import type { Vehicle } from '../types/vehicle.ts';

export type FaithfulBodyType = 'suv_compact' | 'suv_coupe' | 'mpv_3row' | 'crossover';
export type FaithfulGrilleStyle =
  | 'chery_diamond'
  | 'nissan_slat_bars'
  | 'suzuki_chrome_bar'
  | 'kia_tiger_chrome'
  | 'generic_mesh';
export type FaithfulDrlStyle =
  | 'chery_t2_slit_pod'
  | 'chery_t4_twinbar'
  | 'nissan_triple_bar'
  | 'kia_starmap_y'
  | 'suzuki_tricube'
  | 'signature_led';
export type FaithfulAlloyStyle = 'machined_twinspoke' | 'diamond_cut_5' | 'sport_dark_silver';

export interface FaithfulVehicleSpec {
  modelId: string;
  brandLabel: string;
  modelBadgeText: string;
  bodyType: FaithfulBodyType;
  lengthM: number;
  widthM: number;
  heightM: number;
  clearanceM: number;
  wheelRadiusM: number;
  wheelWidthM: number;
  wheelbaseRatio: number;
  frontOverhangRatio: number;
  bodyColorHex: string;
  secondaryAccentHex: string;
  roofColorHex: string;
  mirrorColorHex: string;
  claddingColorHex: string;
  skidPlateColorHex: string;
  roofRailColorHex: string;
  pillarBlackout: 'b_c' | 'a_b' | 'all_floating';
  doorHandleChrome: boolean;
  hasPanoramicRoof: boolean;
  hoodLineRatio: number;
  beltlineRatio: number;
  roofStartRatio: number;
  roofEndRatio: number;
  rearSlope: number; // 0.38 = raked fastback, 0.78 = upright 3-row hatch
  grilleStyle: FaithfulGrilleStyle;
  drlStyle: FaithfulDrlStyle;
  alloyStyle: FaithfulAlloyStyle;
  alloySpokeCount: number;
  clearcoat: number;
  metallicFactor: number;
  paintRoughness: number;
}

const CATALOG_SPECS: Record<string, FaithfulVehicleSpec> = {
  'chery-t2-pro-max': {
    modelId: 'chery-t2-pro-max',
    brandLabel: 'CHERY',
    modelBadgeText: 'TIGGO 2',
    bodyType: 'suv_compact',
    lengthM: 4.20,
    widthM: 1.76,
    heightM: 1.57,
    clearanceM: 0.18,
    wheelRadiusM: 0.34,
    wheelWidthM: 0.215,
    wheelbaseRatio: 0.608,
    frontOverhangRatio: 0.205,
    bodyColorHex: '#a31621',
    secondaryAccentHex: '#c8d1da',
    roofColorHex: '#a31621',
    mirrorColorHex: '#a31621',
    claddingColorHex: '#181d25',
    skidPlateColorHex: '#c5ced6',
    roofRailColorHex: '#d5dce3',
    pillarBlackout: 'b_c',
    doorHandleChrome: false,
    hasPanoramicRoof: true,
    hoodLineRatio: 0.59,
    beltlineRatio: 0.65,
    roofStartRatio: 0.54,
    roofEndRatio: 0.14,
    rearSlope: 0.56,
    grilleStyle: 'chery_diamond',
    drlStyle: 'chery_t2_slit_pod',
    alloyStyle: 'diamond_cut_5',
    alloySpokeCount: 5,
    clearcoat: 0.94,
    metallicFactor: 0.68,
    paintRoughness: 0.16,
  },
  'chery-t4-pro-luxury-hev': {
    modelId: 'chery-t4-pro-luxury-hev',
    brandLabel: 'CHERY',
    modelBadgeText: 'TIGGO 4 PRO',
    bodyType: 'suv_compact',
    lengthM: 4.32,
    widthM: 1.831,
    heightM: 1.653,
    clearanceM: 0.16,
    wheelRadiusM: 0.35,
    wheelWidthM: 0.225,
    wheelbaseRatio: 0.604,
    frontOverhangRatio: 0.202,
    bodyColorHex: '#153da3',
    secondaryAccentHex: '#e11d48', // Franjas rojas en splitter y moldura lateral
    roofColorHex: '#153da3',
    mirrorColorHex: '#153da3',
    claddingColorHex: '#181e27',
    skidPlateColorHex: '#cbd5e1',
    roofRailColorHex: '#d6dee6',
    pillarBlackout: 'b_c',
    doorHandleChrome: false,
    hasPanoramicRoof: true,
    hoodLineRatio: 0.58,
    beltlineRatio: 0.64,
    roofStartRatio: 0.53,
    roofEndRatio: 0.12,
    rearSlope: 0.62,
    grilleStyle: 'chery_diamond',
    drlStyle: 'chery_t4_twinbar',
    alloyStyle: 'machined_twinspoke',
    alloySpokeCount: 5,
    clearcoat: 0.95,
    metallicFactor: 0.72,
    paintRoughness: 0.15,
  },
  'kia-carens-ex': {
    modelId: 'kia-carens-ex',
    brandLabel: 'KIA',
    modelBadgeText: 'CARENS',
    bodyType: 'mpv_3row',
    lengthM: 4.54,
    widthM: 1.80,
    heightM: 1.70,
    clearanceM: 0.195,
    wheelRadiusM: 0.355,
    wheelWidthM: 0.215,
    wheelbaseRatio: 0.612,
    frontOverhangRatio: 0.194,
    bodyColorHex: '#102654',
    secondaryAccentHex: '#d8e1ea',
    roofColorHex: '#102654',
    mirrorColorHex: '#102654',
    claddingColorHex: '#171d26',
    skidPlateColorHex: '#d1d9e2',
    roofRailColorHex: '#dbe2ea',
    pillarBlackout: 'b_c',
    doorHandleChrome: true,
    hasPanoramicRoof: false,
    hoodLineRatio: 0.57,
    beltlineRatio: 0.62,
    roofStartRatio: 0.56,
    roofEndRatio: 0.08,
    rearSlope: 0.76,
    grilleStyle: 'kia_tiger_chrome',
    drlStyle: 'kia_starmap_y',
    alloyStyle: 'diamond_cut_5',
    alloySpokeCount: 5,
    clearcoat: 0.92,
    metallicFactor: 0.70,
    paintRoughness: 0.17,
  },
  'nissan-kicks-2027': {
    modelId: 'nissan-kicks-2027',
    brandLabel: 'NISSAN',
    modelBadgeText: 'KICKS',
    bodyType: 'crossover',
    lengthM: 4.365,
    widthM: 1.81,
    heightM: 1.62,
    clearanceM: 0.18,
    wheelRadiusM: 0.36,
    wheelWidthM: 0.225,
    wheelbaseRatio: 0.608,
    frontOverhangRatio: 0.198,
    bodyColorHex: '#b49872', // Champagne / bronce arenisco metálico
    secondaryAccentHex: '#cbd5e1',
    roofColorHex: '#0b0e14', // Techo flotante negro brillante
    mirrorColorHex: '#0b0e14',
    claddingColorHex: '#161b22',
    skidPlateColorHex: '#cbd5e1',
    roofRailColorHex: '#d6dde4',
    pillarBlackout: 'all_floating',
    doorHandleChrome: false,
    hasPanoramicRoof: true,
    hoodLineRatio: 0.61,
    beltlineRatio: 0.66,
    roofStartRatio: 0.53,
    roofEndRatio: 0.12,
    rearSlope: 0.60,
    grilleStyle: 'nissan_slat_bars',
    drlStyle: 'nissan_triple_bar',
    alloyStyle: 'machined_twinspoke',
    alloySpokeCount: 5,
    clearcoat: 0.94,
    metallicFactor: 0.74,
    paintRoughness: 0.16,
  },
  'suzuki-fronx': {
    modelId: 'suzuki-fronx',
    brandLabel: 'SUZUKI',
    modelBadgeText: 'FRONX',
    bodyType: 'suv_coupe',
    lengthM: 3.995,
    widthM: 1.765,
    heightM: 1.55,
    clearanceM: 0.17,
    wheelRadiusM: 0.335,
    wheelWidthM: 0.205,
    wheelbaseRatio: 0.630,
    frontOverhangRatio: 0.195,
    bodyColorHex: '#cc5210', // Naranja cobrizo metálico
    secondaryAccentHex: '#d1d8e0',
    roofColorHex: '#cc5210',
    mirrorColorHex: '#0e131b',
    claddingColorHex: '#181e26',
    skidPlateColorHex: '#cfd6de',
    roofRailColorHex: '#d7dfe7',
    pillarBlackout: 'a_b',
    doorHandleChrome: false,
    hasPanoramicRoof: false,
    hoodLineRatio: 0.60,
    beltlineRatio: 0.65,
    roofStartRatio: 0.52,
    roofEndRatio: 0.18,
    rearSlope: 0.41, // Caída coupé fastback pronunciada
    grilleStyle: 'suzuki_chrome_bar',
    drlStyle: 'suzuki_tricube',
    alloyStyle: 'sport_dark_silver',
    alloySpokeCount: 5,
    clearcoat: 0.96,
    metallicFactor: 0.76,
    paintRoughness: 0.15,
  },
  'toyota-corolla-cross-seg-2027': {
    modelId: 'toyota-corolla-cross-seg-2027',
    brandLabel: 'TOYOTA',
    modelBadgeText: 'COROLLA CROSS',
    bodyType: 'suv_compact',
    lengthM: 4.46,
    widthM: 1.825,
    heightM: 1.62,
    clearanceM: 0.161,
    wheelRadiusM: 0.345,
    wheelWidthM: 0.215,
    wheelbaseRatio: 0.592,
    frontOverhangRatio: 0.21,
    bodyColorHex: '#eef2f6',
    secondaryAccentHex: '#94a3b8',
    roofColorHex: '#eef2f6',
    mirrorColorHex: '#eef2f6',
    claddingColorHex: '#19202a',
    skidPlateColorHex: '#cbd5e1',
    roofRailColorHex: '#d1d5db',
    pillarBlackout: 'b_c',
    doorHandleChrome: false,
    hasPanoramicRoof: true,
    hoodLineRatio: 0.59,
    beltlineRatio: 0.64,
    roofStartRatio: 0.53,
    roofEndRatio: 0.13,
    rearSlope: 0.60,
    grilleStyle: 'generic_mesh',
    drlStyle: 'signature_led',
    alloyStyle: 'machined_twinspoke',
    alloySpokeCount: 5,
    clearcoat: 0.92,
    metallicFactor: 0.52,
    paintRoughness: 0.16,
  },
  'chevrolet-tracker-lite': {
    modelId: 'chevrolet-tracker-lite',
    brandLabel: 'CHEVROLET',
    modelBadgeText: 'TRACKER',
    bodyType: 'suv_compact',
    lengthM: 4.304,
    widthM: 1.791,
    heightM: 1.626,
    clearanceM: 0.157,
    wheelRadiusM: 0.34,
    wheelWidthM: 0.215,
    wheelbaseRatio: 0.597,
    frontOverhangRatio: 0.206,
    bodyColorHex: '#2563eb',
    secondaryAccentHex: '#cbd5e1',
    roofColorHex: '#2563eb',
    mirrorColorHex: '#2563eb',
    claddingColorHex: '#19202a',
    skidPlateColorHex: '#cbd5e1',
    roofRailColorHex: '#d1d5db',
    pillarBlackout: 'b_c',
    doorHandleChrome: false,
    hasPanoramicRoof: true,
    hoodLineRatio: 0.59,
    beltlineRatio: 0.64,
    roofStartRatio: 0.53,
    roofEndRatio: 0.13,
    rearSlope: 0.60,
    grilleStyle: 'generic_mesh',
    drlStyle: 'signature_led',
    alloyStyle: 'sport_dark_silver',
    alloySpokeCount: 5,
    clearcoat: 0.92,
    metallicFactor: 0.68,
    paintRoughness: 0.16,
  },
};

export function getFaithfulVehicleSpecById(
  modelId: string,
  overrides?: Partial<Pick<Vehicle, 'brand' | 'name' | 'color' | 'dimensions'>>,
): FaithfulVehicleSpec {
  const base = CATALOG_SPECS[modelId];
  if (base) {
    return base;
  }

  const lengthM = Math.min(5.2, Math.max(3.6, (overrides?.dimensions?.lengthMm || 4350) / 1000));
  const rawWidthM = (overrides?.dimensions?.widthMm || 1800) / 1000;
  const widthM = Math.min(2.05, Math.max(1.68, rawWidthM > 1.98 ? 1.84 : rawWidthM));
  const heightM = Math.min(1.92, Math.max(1.38, (overrides?.dimensions?.heightMm || 1620) / 1000));
  const clearanceM = Math.min(0.26, Math.max(0.12, (overrides?.dimensions?.clearanceMm || 175) / 1000));
  const colorHex = overrides?.color && /^#[0-9a-f]{6}$/i.test(overrides.color) ? overrides.color : '#0ea5e9';

  return {
    modelId,
    brandLabel: (overrides?.brand || 'CUSTOM').toUpperCase(),
    modelBadgeText: (overrides?.name || 'PRO').toUpperCase(),
    bodyType: heightM < 1.50 ? 'suv_coupe' : 'suv_compact',
    lengthM,
    widthM,
    heightM,
    clearanceM,
    wheelRadiusM: Math.min(0.37, Math.max(0.32, heightM * 0.215)),
    wheelWidthM: 0.22,
    wheelbaseRatio: 0.605,
    frontOverhangRatio: 0.20,
    bodyColorHex: colorHex,
    secondaryAccentHex: '#38bdf8',
    roofColorHex: colorHex,
    mirrorColorHex: '#0f172a',
    claddingColorHex: '#161c24',
    skidPlateColorHex: '#cbd5e1',
    roofRailColorHex: '#d5dde5',
    pillarBlackout: 'b_c',
    doorHandleChrome: false,
    hasPanoramicRoof: true,
    hoodLineRatio: 0.58,
    beltlineRatio: 0.64,
    roofStartRatio: 0.53,
    roofEndRatio: 0.13,
    rearSlope: heightM < 1.50 ? 0.45 : 0.60,
    grilleStyle: 'generic_mesh',
    drlStyle: 'signature_led',
    alloyStyle: 'machined_twinspoke',
    alloySpokeCount: 5,
    clearcoat: 0.94,
    metallicFactor: 0.72,
    paintRoughness: 0.16,
  };
}

export function getFaithfulVehicleSpec(vehicle: Vehicle): FaithfulVehicleSpec {
  return getFaithfulVehicleSpecById(vehicle.id, {
    brand: vehicle.brand,
    name: vehicle.name,
    color: vehicle.color,
    dimensions: vehicle.dimensions,
  });
}

export function listAllFaithfulCatalogIds(): string[] {
  return Object.keys(CATALOG_SPECS);
}
