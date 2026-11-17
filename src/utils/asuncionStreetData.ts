/**
 * Datos de arte de DATACAR ARENA: cruce estilizado, NO cartografía/estado vial real.
 * Solo se usan nombres de calles/zonas verificados o se explicita que son genéricos.
 * Las posiciones en metros se generan de forma determinista dentro del circuito.
 */
export type LocalStreetProfile = 'craters' | 'chains' | 'trenches' | 'flood' | 'cobbles' | 'traffic';
export interface StreetCrossing {
  z: number;
  main: string;
  transverse: string;
  qualifier?: string;
}
export interface SpeedBump {
  id: string;
  z: number;
  height: number; // m, relieve aproximado (sin geometría física completa de suspensión)
  length: number; // m, ancho longitudinal del lomo
}
const CITY_STREETS: Record<LocalStreetProfile, { primary: string; secondary: [string, string]; bumps: number[] }> = {
  craters: { primary: 'AV. AVELINO MARTÍNEZ', secondary: ['DESVÍO DE OBRA', 'CRUCE LOCAL'], bumps: [.20, .46, .72] },
  chains: { primary: 'HERRERA', secondary: ['CABALLERO', 'CABALLERO'], bumps: [.18, .44, .73] },
  trenches: { primary: 'TTE. JOSÉ FÉLIX LÓPEZ', secondary: ['AZTECAS', 'EPIFANIO MÉNDEZ FLEITAS'], bumps: [.18, .47, .72] },
  flood: { primary: 'AV. ARTIGAS', secondary: ['LOMBARDO', 'VENEZUELA'], bumps: [.21, .71] },
  cobbles: { primary: 'OLIVA · PIRIBEBUY', secondary: ['MICROCENTRO', 'CASCO HISTÓRICO'], bumps: [.17, .40, .63, .85] },
  traffic: { primary: 'AV. AVIADORES DEL CHACO', secondary: ['CRUCE LOCAL', 'SECTOR COMERCIAL'], bumps: [.32, .68] },
};

export function getAsuncionStreetDetails(profile: string | undefined, distanceMeters: number) {
  if (!profile || !(profile in CITY_STREETS) || distanceMeters <= 80) return { crossings: [] as StreetCrossing[], speedBumps: [] as SpeedBump[] };
  const p = CITY_STREETS[profile as LocalStreetProfile];
  const crossings = [.33, .64].map((portion, i) => ({
    z: Math.round(distanceMeters * portion), main: p.primary,
    transverse: p.secondary[i], qualifier: 'ESCENARIO FICTICIO',
  }));
  const speedBumps = p.bumps.map((portion, i) => {
    let z = Math.round(distanceMeters * portion);
    // Nunca bloquear con un lomo el centro de la intersección/crosswalk.
    for (const crossing of crossings) {
      if (Math.abs(z - crossing.z) < 19) z = crossing.z + (z < crossing.z ? -20 : 20);
    }
    return {
      id: `${profile}-lomo-${i + 1}`, z: Math.max(20, Math.min(distanceMeters - 20, z)),
      height: profile === 'traffic' ? .075 : .095 + i % 2 * .018,
      length: profile === 'cobbles' ? 1.75 : 2.1,
    };
  });
  return { crossings, speedBumps };
}
