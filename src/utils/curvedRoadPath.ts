/** DATACAR ARENA — Geometría diferencial de ruta para los 6 circuitos de Asunción.
 * Coordenadas Frenet: s = metros sobre la calzada; lateral > 0 = lado +X
 * cuando el vehículo avanza hacia +Z. La geometría es ficticia, no GIS.
 * Cada uno de los 6 circuitos posee una firma geométrica propia (dirección inicial,
 * frecuencia de curvas, chicanas urbanas, barridos costeros o curvas en S) con
 * heading(0) = 0 y continuidad suave para manejo, minimapa y tránsito IA.
 * Este módulo no depende de Three.js y se puede probar con Node.
 */
import type { RaceTrackConfig } from '../types/vehicle.ts';

export type RoadSample = { s: number; x: number; z: number; yaw: number; curvature: number };
export type RoadPoint = RoadSample & { lateral: number };
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const TAU = Math.PI * 2;

export interface CircuitSplineSignature {
  /** Amplitud principal de giro en radianes (signo define si abre a izquierda + o derecha -) */
  primaryYaw: number;
  /** Número de ondas principales por vuelta */
  primaryWaves: number;
  /** Segundo armónico para asimetría (chicanas / horquillas suaves) */
  secondaryYaw: number;
  secondaryWaves: number;
  /** Deriva progresiva de arco costero / avenida larga (0 en rectas simétricas) */
  arcBiasYaw: number;
}

export const CIRCUIT_SPLINE_SIGNATURES: Record<string, CircuitSplineSignature> = {
  // Pista 1: Av. Avelino Martínez (San Lorenzo) — curva inicial pronunciada a la derecha (-X) + doble S industrial
  avelino: {
    primaryYaw: -0.42,
    primaryWaves: 2.0,
    secondaryYaw: 0.16,
    secondaryWaves: 5.0,
    arcBiasYaw: -0.10,
  },
  // Pista 2: Herrera y Caballero (Centro) — chicanas urbanas rápidas alternadas izq-der-izq-der
  herrera: {
    primaryYaw: 0.45,
    primaryWaves: 3.5,
    secondaryYaw: -0.18,
    secondaryWaves: 7.0,
    arcBiasYaw: 0.04,
  },
  // Pista 3: José Félix López (Zona Terminal / Mburicaó) — cañón sinuoso profundo en S invertida
  'jose-felix': {
    primaryYaw: -0.50,
    primaryWaves: 3.0,
    secondaryYaw: -0.15,
    secondaryWaves: 6.0,
    arcBiasYaw: 0.14,
  },
  // Pista 4: Av. Artigas y Mburicaó (Costanera Norte) — gran arco costero continuo bordeando la bahía
  artigas: {
    primaryYaw: 0.34,
    primaryWaves: 1.5,
    secondaryYaw: 0.11,
    secondaryWaves: 4.0,
    arcBiasYaw: 0.28,
  },
  // Pista 5: Calle Oliva y Piribebuy (Microcentro Histórico) — quiebres técnicos cerrados de damero colonial
  oliva: {
    primaryYaw: 0.48,
    primaryWaves: 4.0,
    secondaryYaw: 0.21,
    secondaryWaves: 8.0,
    arcBiasYaw: -0.16,
  },
  // Pista 6: Av. Aviadores del Chaco (Paseo La Galería) — boulevard corporativo veloz de curvatura amplia y fluida
  aviadores: {
    primaryYaw: 0.24,
    primaryWaves: 1.5,
    secondaryYaw: -0.08,
    secondaryWaves: 3.0,
    arcBiasYaw: -0.06,
  },
};

function resolveCircuitKey(track: RaceTrackConfig): string | null {
  if (track.cityCircuitId && CIRCUIT_SPLINE_SIGNATURES[track.cityCircuitId]) {
    return track.cityCircuitId;
  }
  if (typeof track.id === 'string' && track.id.startsWith('circuit-')) {
    const suffix = track.id.slice('circuit-'.length);
    if (CIRCUIT_SPLINE_SIGNATURES[suffix]) return suffix;
  }
  return null;
}

export class CurvedRoadPath {
  readonly isCurved: boolean;
  readonly circuitKey: string | null;
  readonly length: number;
  readonly samples: RoadSample[];
  readonly stride: number;
  private readonly sig: CircuitSplineSignature;
  private readonly lapScale: number;

  constructor(track: RaceTrackConfig, stride = 2) {
    const key = resolveCircuitKey(track);
    this.circuitKey = key;
    this.isCurved = key !== null;
    this.length = Math.max(10, track.distanceMeters);
    this.stride = Math.max(0.5, stride);
    this.lapScale = Math.max(1, Math.round(track.laps ?? 1));
    this.sig = key
      ? CIRCUIT_SPLINE_SIGNATURES[key]
      : {
          primaryYaw: 0.16,
          primaryWaves: 2,
          secondaryYaw: 0.032,
          secondaryWaves: 4,
          arcBiasYaw: 0,
        };

    const count = Math.ceil((this.length + 150) / this.stride);
    const ds = (this.length + 150) / count;
    this.samples = [];
    let x = 0;
    let z = 0;
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
    const u = clamp(s / this.length, 0, 1);
    const w1 = this.sig.primaryWaves * this.lapScale;
    const w2 = this.sig.secondaryWaves * this.lapScale;
    // 0 rad exactos en s = 0 y s = length (sin(0)=0, 1-cos(0)=0) con continuidad C∞.
    const h1 = this.sig.primaryYaw * Math.sin(TAU * w1 * u);
    const h2 = this.sig.secondaryYaw * Math.sin(TAU * w2 * u);
    const arc = this.sig.arcBiasYaw * 0.5 * (1 - Math.cos(TAU * this.lapScale * u));
    return h1 + h2 + arc;
  }

  curvature(s: number): number {
    if (!this.isCurved || s < 0 || s > this.length) return 0;
    const u = s / this.length;
    const w1 = this.sig.primaryWaves * this.lapScale;
    const w2 = this.sig.secondaryWaves * this.lapScale;
    const d1 = this.sig.primaryYaw * w1 * Math.cos(TAU * w1 * u);
    const d2 = this.sig.secondaryYaw * w2 * Math.cos(TAU * w2 * u);
    const dArc = this.sig.arcBiasYaw * 0.5 * this.lapScale * Math.sin(TAU * this.lapScale * u);
    return (TAU / this.length) * (d1 + d2 + dArc);
  }

  at(distance: number): RoadSample {
    if (distance < 0) return { s: distance, x: 0, z: distance, yaw: 0, curvature: 0 };
    const s = clamp(distance, 0, this.samples[this.samples.length - 1].s);
    let lo = 0;
    let hi = this.samples.length - 2;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.samples[mid].s <= s) lo = mid;
      else hi = mid - 1;
    }
    const a = this.samples[lo];
    const b = this.samples[lo + 1];
    const alpha = clamp((s - a.s) / (b.s - a.s), 0, 1);
    return {
      s,
      x: a.x + (b.x - a.x) * alpha,
      z: a.z + (b.z - a.z) * alpha,
      yaw: this.heading(s),
      curvature: this.curvature(s),
    };
  }

  world(distance: number, lateral = 0): RoadPoint {
    const a = this.at(distance);
    return {
      ...a,
      x: a.x + lateral * Math.cos(a.yaw),
      z: a.z - lateral * Math.sin(a.yaw),
      lateral,
    };
  }

  /** Inverse nearest-point projection — only for user mouse placement. */
  project(x: number, z: number): { s: number; lateral: number; distance: number } {
    let best = { s: 0, lateral: 0, distance: Infinity };
    for (let i = 0; i < this.samples.length - 1; i++) {
      const a = this.samples[i];
      const b = this.samples[i + 1];
      const vx = b.x - a.x;
      const vz = b.z - a.z;
      const len2 = vx * vx + vz * vz;
      const t = clamp(((x - a.x) * vx + (z - a.z) * vz) / Math.max(1e-8, len2), 0, 1);
      const px = a.x + vx * t;
      const pz = a.z + vz * t;
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
      const p = this.at(s);
      result.push({ x: p.x, z: p.z });
    }
    const end = this.at(this.length);
    result.push({ x: end.x, z: end.z });
    return result;
  }
}

export function makeRoadPath(track: RaceTrackConfig): CurvedRoadPath {
  return new CurvedRoadPath(track);
}
