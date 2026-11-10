/** DATACAR ARENA V8.0 — clima y agua, modelo arcade-físico explícito.
 * Son circuitos ficticios: estas zonas de agua no representan peligros viales actuales.
 */
export type WeatherMode = 'sunny' | 'cloudy' | 'rain' | 'storm' | 'flood';
export const WEATHER_OPTIONS: { id: WeatherMode; label: string }[] = [
  { id: 'sunny', label: 'Soleado' },
  { id: 'cloudy', label: 'Nublado' },
  { id: 'rain', label: 'Lluvia' },
  { id: 'storm', label: 'Tormenta' },
  { id: 'flood', label: 'Raudales' },
];
export const WEATHER_CONFIG: Record<WeatherMode, { grip: number; rainIntensity: number; roadWetness: number; sky: string }> = {
  sunny: { grip: 1, rainIntensity: 0, roadWetness: 0, sky: '#8498a8' },
  cloudy: { grip: 0.99, rainIntensity: 0, roadWetness: 0.05, sky: '#687988' },
  rain: { grip: 0.83, rainIntensity: 0.52, roadWetness: 0.67, sky: '#566574' },
  storm: { grip: 0.70, rainIntensity: 1, roadWetness: 0.93, sky: '#343f4d' },
  flood: { grip: 0.62, rainIntensity: 0.88, roadWetness: 1, sky: '#354959' },
};
export interface WaterZone { x: number; z: number; radiusX: number; radiusZ: number; flowDirection: -1 | 1; depth: number }
export function getWaterZones(mode: WeatherMode, trackDistance: number, profile?: string): WaterZone[] {
  if (mode === 'sunny' || mode === 'cloudy') return [];
  const heavy = mode === 'flood' || (profile === 'flood' && mode !== 'rain');
  const count = Math.min(12, Math.max(2, Math.floor((trackDistance - 90) / (heavy ? 92 : 155))));
  const zones: WaterZone[] = [];
  for (let i = 0; i < count; i++) {
    const z = 68 + i * ((trackDistance - 135) / Math.max(1, count - 1));
    if (z >= trackDistance - 18) continue;
    zones.push({
      x: heavy ? (i % 3 === 0 ? 0 : i % 2 ? -2.2 : 2.2) : (i % 2 ? -3.6 : 3.6),
      z, radiusX: heavy ? 5.2 : 2.5, radiusZ: heavy ? 8.2 : 4.7,
      flowDirection: i % 2 ? -1 : 1,
      depth: heavy ? .22 : mode === 'storm' ? .13 : .055,
    });
  }
  return zones;
}
export function waterContact(zones: WaterZone[], x: number, z: number): { immersion: number; flow: number } {
  let immersion = 0;
  let flow = 0;
  for (const zone of zones) {
    const dx = (x - zone.x) / zone.radiusX;
    const dz = (z - zone.z) / zone.radiusZ;
    const normalized = dx * dx + dz * dz;
    if (normalized >= 1) continue;
    const strength = Math.min(1, (1 - normalized) * Math.min(1, zone.depth / .22));
    if (strength > immersion) { immersion = strength; flow = zone.flowDirection * strength; }
  }
  return { immersion, flow };
}
