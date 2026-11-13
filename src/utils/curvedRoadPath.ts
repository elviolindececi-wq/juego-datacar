/** DATACAR ARENA V9.2 — una única referencia geométrica para la ruta.
 * Coordenadas Frenet: s = metros sobre la calzada; lateral > 0 = lado +X
 * cuando el vehículo avanza hacia +Z. La geometría es ficticia, no GIS.
 * Las amplitudes son deliberadamente suaves (radio de curva urbano amplio).
 * Este módulo no depende de Three.js y se puede probar con Node.
 */
import type { RaceTrackConfig } from '../types/vehicle.ts';

export type RoadSample = { s: number; x: number; z: number; yaw: number; curvature: number };
export type RoadPoint = RoadSample & { lateral: number };
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const TAU = Math.PI * 2;

const variants: Record<string, [number, number, number]> = {
  avelino: [.17, .035, 2],
  herrera: [.19, .045, 2],
  'jose-felix': [.22, .040, 2],
  artigas: [.20, .038, 2],
  oliva: [.16, .055, 2],
  aviadores: [.12, .025, 2],
};

export class CurvedRoadPath {
  readonly isCurved: boolean;
  readonly length: number;
  readonly samples: RoadSample[];
  readonly stride: number;
  private readonly coeff: [number, number, number];

  constructor(track: RaceTrackConfig, stride = 2) {
    this.isCurved = !!track.cityCircuitId && !!variants[track.cityCircuitId];
    this.length = Math.max(10, track.distanceMeters);
    this.stride = Math.max(.5, stride);
    const baseCoeff = variants[track.cityCircuitId || ''] ?? [.16, .032, 2];
    const lapScale = Math.max(1, Math.round(track.laps ?? 1));
    this.coeff = [baseCoeff[0], baseCoeff[1], baseCoeff[2] * lapScale];
    const count = Math.ceil((this.length + 150) / this.stride);
    const ds = (this.length + 150) / count;
    this.samples = [];
    let x = 0, z = 0;
    for (let i = 0; i <= count; i++) {
      const s = ds * i;
      const yaw = this.heading(s);
      this.samples.push({ s, x, z, yaw, curvature: this.curvature(s) });
      if (i < count) {
        const mid = this.heading(s + ds / 2);
        x += Math.sin(mid) * ds;
        z += Math.cos(mid) * ds;
      }
    }
  }

  heading(s: number): number {
    if (!this.isCurved) return 0;
    const [primary, secondary, waves] = this.coeff;
    const u = clamp(s / this.length, 0, 1);
    // 0 rad en salida y llegada. Continuidad C∞ en toda la ruta.
    return primary * Math.sin(TAU * waves * u) + secondary * Math.sin(TAU * (waves + 2) * u);
  }

  curvature(s: number): number {
    if (!this.isCurved || s < 0 || s > this.length) return 0;
    const [primary, secondary, waves] = this.coeff;
    const u = s / this.length;
    return (TAU / this.length) * (primary * waves * Math.cos(TAU * waves * u) +
      secondary * (waves + 2) * Math.cos(TAU * (waves + 2) * u));
  }

  at(distance: number): RoadSample {
    if (distance < 0) return { s: distance, x: 0, z: distance, yaw: 0, curvature: 0 };
    const s = clamp(distance, 0, this.samples[this.samples.length - 1].s);
    let lo = 0, hi = this.samples.length - 2;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.samples[mid].s <= s) lo = mid;
      else hi = mid - 1;
    }
    const a = this.samples[lo];
    const b = this.samples[lo + 1];
    const alpha = clamp((s - a.s) / (b.s - a.s), 0, 1);
    return { s, x: a.x + (b.x - a.x) * alpha, z: a.z + (b.z - a.z) * alpha,
      yaw: this.heading(s), curvature: this.curvature(s) };
  }

  world(distance: number, lateral = 0): RoadPoint {
    const a = this.at(distance);
    return { ...a, x: a.x + lateral * Math.cos(a.yaw), z: a.z - lateral * Math.sin(a.yaw), lateral };
  }

  /** Inverse nearest-point projection — only for user mouse placement.
   * Runtime physics stores its own (s, lateral) state, so it does not need this O(N) search. */
  project(x: number, z: number): { s: number; lateral: number; distance: number } {
    let best = { s: 0, lateral: 0, distance: Infinity };
    for (let i = 0; i < this.samples.length - 1; i++) {
      const a = this.samples[i], b = this.samples[i + 1];
      const vx = b.x - a.x, vz = b.z - a.z;
      const len2 = vx * vx + vz * vz;
      const t = clamp(((x - a.x) * vx + (z - a.z) * vz) / Math.max(1e-8, len2), 0, 1);
      const px = a.x + vx * t, pz = a.z + vz * t;
      const dist2 = (x - px) ** 2 + (z - pz) ** 2;
      if (dist2 < best.distance) {
        const s = a.s + t * (b.s - a.s);
        const yaw = this.heading(s);
        best = { s, lateral: (x - px) * Math.cos(yaw) - (z - pz) * Math.sin(yaw), distance: dist2 };
      }
    }
    return { ...best, distance: Math.sqrt(best.distance) };
  }

  centerlinePoints(interval = 12): { x: number; z: number }[] {
    const result = [];
    for (let s = 0; s < this.length; s += interval) {
      const p = this.at(s); result.push({ x: p.x, z: p.z });
    }
    const end = this.at(this.length); result.push({ x: end.x, z: end.z });
    return result;
  }
}

export function makeRoadPath(track: RaceTrackConfig): CurvedRoadPath {
  return new CurvedRoadPath(track);
}
