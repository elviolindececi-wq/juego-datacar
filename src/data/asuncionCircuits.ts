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
}
export const ASUNCION_CIRCUITS: AsuncionCircuit[] = [
  {
    id: 'avelino', name: 'Avenida Avelino Martínez', zone: 'Especial · Extremo',
    subtitle: 'El circuito definitivo', difficulty: 9.5, distanceMeters: 1900,
    profile: 'craters', hazardLabel: 'Pozos tipo cráter y lagunas artificiales',
    surfaceGrip: 0.76, roughness: 1.35, sky: '#f59e0b',
    lore: 'No es una simulación de la Luna, pero con agua estancada. Si rompés tu suspensión acá, el juego no te la repone.',
  },
  {
    id: 'herrera', name: 'Esquina Herrera y Caballero', zone: 'Microcentro caótico',
    subtitle: 'Erupción de baches', difficulty: 8.0, distanceMeters: 1700,
    profile: 'chains', hazardLabel: 'Baches encadenados y charcos',
    surfaceGrip: 0.72, roughness: 1.20, sky: '#38bdf8',
    lore: 'Trampa mortal en pleno centro histórico. Los pozos mutan cada hora por las pérdidas de agua. Esquivás uno y caés en tres más.',
  },
  {
    id: 'jose-felix', name: 'Calle José Félix López', zone: 'Zona Terminal',
    subtitle: 'La zanja interminable', difficulty: 7.5, distanceMeters: 1780,
    profile: 'trenches', hazardLabel: 'Zanjas y asfalto deformado',
    surfaceGrip: 0.87, roughness: 1.20, sky: '#fb923c',
    lore: 'Las zanjas del asfalto tienen el tamaño ideal para tragarse una llanta entera. Ideal para practicar zig-zag a alta velocidad.',
  },
  {
    id: 'artigas', name: 'Avenida Artigas y Mburicaó', zone: 'Circuito acuático',
    subtitle: 'La avenida se vuelve navegable', difficulty: 8.5, distanceMeters: 2050,
    profile: 'flood', hazardLabel: 'Raudales, agua y pérdida de tracción',
    surfaceGrip: 0.59, roughness: 1.0, sky: '#22d3ee',
    lore: 'Cuando caen dos gotas, este tramo se vuelve navegable. El agua cubre los baches profundos, así que vas a tener que adivinar dónde pisás.',
  },
  {
    id: 'oliva', name: 'Calle Oliva y Piribebuy', zone: 'Microcentro histórico',
    subtitle: 'Un clásico rompe-coches', difficulty: 6.5, distanceMeters: 1600,
    profile: 'cobbles', hazardLabel: 'Adoquines sueltos y registros hundidos',
    surfaceGrip: 0.84, roughness: 1.50, sky: '#a78bfa',
    lore: 'Los registros de cemento están 20 centímetros por debajo del suelo. Tu columna vertebral va a sufrir.',
  },
  {
    id: 'aviadores', name: 'Avenida Aviadores del Chaco', zone: 'Pista de piques',
    subtitle: 'La recta de los imprevistos', difficulty: 4.0, distanceMeters: 2300,
    profile: 'traffic', hazardLabel: 'Tránsito pesado y obstáculos sorpresa',
    surfaceGrip: 0.98, roughness: 0.35, sky: '#4ade80',
    lore: 'La pista más rápida y cheta del juego... hasta que te tragás un registro de metal o aparece un obstáculo de sorpresa.',
  },
];

export function toRaceTrack(circuit: AsuncionCircuit): RaceTrackConfig {
  return {
    id: 'circuit', name: circuit.name, subtitle: circuit.zone,
    distanceMeters: circuit.distanceMeters, inclineGradePercent: 0, cargoPayloadKg: 0,
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
