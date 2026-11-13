import type { RaceTrackConfig } from '../types/vehicle';

/** Circuitos ficticios inspirados en nombres de vías reales de Asunción.
 * Los incidentes, condiciones, dificultad y trazados NO son datos viales actuales. */
export type CircuitHazardProfile = 'craters' | 'chains' | 'trenches' | 'flood' | 'cobbles' | 'traffic';
export interface AsuncionCircuit {
  id: string;
  name: string;
  zone: string;
  subtitle: string;
  lore: string;
  difficulty: number;
  distanceMeters: number;
  profile: CircuitHazardProfile;
  hazardLabel: string;
  surfaceGrip: number;
  roughness: number;
  sky: string;
  imageUrl: string;
}
export const ASUNCION_CIRCUITS: AsuncionCircuit[] = [
  {
    id: 'avelino', name: 'Avenida Avelino Martínez', zone: 'Especial · Extremo',
    subtitle: 'El circuito definitivo', difficulty: 9.5, distanceMeters: 1900,
    profile: 'craters', hazardLabel: 'Pozos tipo cráter y lagunas artificiales',
    surfaceGrip: 0.76, roughness: 1.35, sky: '#f59e0b',
    imageUrl: '/assets/aistudio/avenida_en_ruinas_al_atardecer_ba6dfeb9.webp',
    lore: 'No es una simulación de la Luna, pero con agua estancada. Si rompés tu suspensión acá, el juego no te la repone.',
  },
  {
    id: 'herrera', name: 'Esquina Herrera y Caballero', zone: 'Microcentro caótico',
    subtitle: 'Erupción de baches', difficulty: 8.0, distanceMeters: 1700,
    profile: 'chains', hazardLabel: 'Baches encadenados y charcos',
    surfaceGrip: 0.72, roughness: 1.20, sky: '#38bdf8',
    imageUrl: '/assets/aistudio/intersecci_n_lluviosa_en_el_microcentro_asunceno_e11ab2d7.webp',
    lore: 'Trampa mortal en pleno centro histórico. Los pozos mutan cada hora por las pérdidas de agua. Esquivás uno y caés en tres más.',
  },
  {
    id: 'jose-felix', name: 'Calle José Félix López', zone: 'Zona Terminal',
    subtitle: 'La zanja interminable', difficulty: 7.5, distanceMeters: 1780,
    profile: 'trenches', hazardLabel: 'Zanjas y asfalto deformado',
    surfaceGrip: 0.87, roughness: 1.20, sky: '#fb923c',
    imageUrl: '/assets/aistudio/calle_deteriorada_hacia_la_terminal_de_asunci_n_1db0397e.webp',
    lore: 'Las zanjas del asfalto tienen el tamaño ideal para tragarse una llanta entera. Ideal para practicar zig-zag a alta velocidad.',
  },
  {
    id: 'artigas', name: 'Avenida Artigas y Mburicaó', zone: 'Circuito acuático',
    subtitle: 'La avenida se vuelve navegable', difficulty: 8.5, distanceMeters: 2050,
    profile: 'flood', hazardLabel: 'Raudales, agua y pérdida de tracción',
    surfaceGrip: 0.59, roughness: 1.0, sky: '#22d3ee',
    imageUrl: '/assets/aistudio/avenida_inundada_al_atardecer_en_asunci_n_b57c3cda.webp',
    lore: 'Cuando caen dos gotas, este tramo se vuelve navegable. El agua cubre los baches profundos, así que vas a tener que adivinar dónde pisás.',
  },
  {
    id: 'oliva', name: 'Calle Oliva y Piribebuy', zone: 'Microcentro histórico',
    subtitle: 'Un clásico rompe-coches', difficulty: 4.8, distanceMeters: 1600,
    profile: 'cobbles', hazardLabel: 'Adoquines sueltos y registros hundidos',
    surfaceGrip: 0.84, roughness: 1.50, sky: '#a78bfa',
    imageUrl: '/assets/aistudio/calle_hist_rica_de_asunci_n_al_atardecer_e19f74fb.webp',
    lore: 'Los registros de cemento están 20 centímetros por debajo del suelo. Tu columna vertebral va a sufrir.',
  },
  {
    id: 'aviadores', name: 'Avenida Aviadores del Chaco', zone: 'Circuito de Raudales · Paseo La Galería',
    subtitle: 'Raudales frente a las torres gemelas', difficulty: 8.2, distanceMeters: 2300,
    profile: 'flood', hazardLabel: 'Raudales corporativos, agua en calzada y Paseo La Galería',
    surfaceGrip: 0.74, roughness: 0.82, sky: '#38bdf8',
    imageUrl: '/assets/aistudio/image_95e09b58.png',
    lore: 'Las torres curvas vidriadas del Paseo La Galería se reflejan en pleno raudal sobre Aviadores del Chaco. Hidropedal, agua profunda y frenadas críticas.',
  },
];

export function toRaceTrack(circuit: AsuncionCircuit, laps = 1): RaceTrackConfig {
  const safeLaps = Math.max(1, Math.min(3, Math.round(laps)));
  return {
    id: 'circuit',
    name: circuit.name,
    subtitle: safeLaps > 1 ? `${circuit.zone} · ${safeLaps} vueltas` : circuit.zone,
    distanceMeters: circuit.distanceMeters * safeLaps,
    laps: safeLaps,
    inclineGradePercent: 0,
    cargoPayloadKg: 0,
    description: `${circuit.hazardLabel}. Circuito ficticio inspirado en Asunción.`,
    cityCircuitId: circuit.id,
    routeHazardProfile: circuit.profile,
    surfaceGripFactor: circuit.surfaceGrip,
    surfaceRoughnessFactor: circuit.roughness,
  };
}
export type DifficultyFilter = 'todos' | 'facil' | 'medio' | 'dificil' | 'extremo';
export function matchesDifficulty(circuit: AsuncionCircuit, filter: DifficultyFilter): boolean {
  if (filter === 'facil') return circuit.difficulty < 5;
  if (filter === 'medio') return circuit.difficulty >= 5 && circuit.difficulty < 8;
  if (filter === 'dificil') return circuit.difficulty >= 8 && circuit.difficulty < 9;
  if (filter === 'extremo') return circuit.difficulty >= 9;
  return true;
}
