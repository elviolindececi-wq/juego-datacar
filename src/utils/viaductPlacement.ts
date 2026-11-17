import { getAsuncionStreetDetails } from './asuncionStreetData.ts';

/** Viaductos ficticios sin invadir cruces, largada ni zona final de la carrera. */
export function getViaductStations(length: number, profile?: string): number[] {
  if (!Number.isFinite(length) || length < 650) return [];
  const crossings = getAsuncionStreetDetails(profile, length).crossings;
  return [.24, .51, .77]
    .map(p => Math.round(length * p))
    .filter(s => s > 125 && s < length - 125)
    .filter(s => !crossings.some(c => Math.abs(c.z - s) < 32));
}
