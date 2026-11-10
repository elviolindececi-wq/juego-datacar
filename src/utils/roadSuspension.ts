/**
 * DATACAR ARENA: cuatro apoyos rueda-suelo y respuesta de suspensión simplificada.
 * Las alturas son metros y el tiempo, segundos. No es un rigid body 3D ni
 * pretende reproducir amortiguadores homologados de cada fabricante.
 * El estado es determinista: no hay aleatoriedad ni vibración senoidal basada
 * en la distancia. Se actualiza con el mismo paso fijo que la física horizontal.
 */
import type { SpeedBump } from './asuncionStreetData.ts';

export type WheelCorner = 'FL' | 'FR' | 'RL' | 'RR';
export const WHEEL_CORNERS: readonly WheelCorner[] = ['FL', 'FR', 'RL', 'RR'];
export type FourWheelHeights = Record<WheelCorner, number>;
export interface RoadDepression { id: number; kind: string; x: number; z: number; radius: number }
export interface SuspensionPose {
  heaveM: number;
  pitchRad: number;
  rollRad: number;
  wheelRoadM: FourWheelHeights;
  impact: number;
}
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const smoothstep = (x: number) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const emptyCorners = (): FourWheelHeights => ({ FL: 0, FR: 0, RL: 0, RR: 0 });

/** Coincide con el perfil sinidal de la malla visible de realisticSpeedBumps3D. */
export function bumpRoadHeight(z: number, bumps: readonly SpeedBump[]): number {
  let h = 0;
  for (const bump of bumps) {
    const t = (z - (bump.z - bump.length / 2)) / bump.length;
    if (t >= 0 && t <= 1) h = Math.max(h, bump.height * Math.sin(Math.PI * t));
  }
  return h;
}

/** Bache profundo en el centro, borde redondeado. Descenso máximo ~17 cm, representado en cuatro apoyos. */
export function potholeRoadDepth(x: number, z: number, holes: readonly RoadDepression[]): number {
  let depth = 0;
  for (const hole of holes) {
    if (hole.kind !== 'pothole') continue;
    const d = Math.hypot(x - hole.x, z - hole.z) / Math.max(.25, hole.radius);
    if (d >= 1) continue;
    const interior = 1 - smoothstep((d - .43) / .57);
    // La altura real usada por la suspensión no excede los límites de un bache urbano.
    depth = Math.max(depth, .17 * interior);
  }
  return -depth;
}

export function roadHeightAt(x: number, z: number, holes: readonly RoadDepression[], bumps: readonly SpeedBump[]): number {
  return bumpRoadHeight(z, bumps) + potholeRoadDepth(x, z, holes);
}

/** Respuesta de cuatro masas suspendidas con resorte lineal y amortiguación crítica parcial. */
export class FourCornerSuspension {
  private height = emptyCorners();
  private velocity = emptyCorners();
  private previousRoad = emptyCorners();
  private bodyPitch = 0;
  private bodyRoll = 0;
  public pose: SuspensionPose = { heaveM: 0, pitchRad: 0, rollRad: 0, wheelRoadM: emptyCorners(), impact: 0 };

  reset() {
    this.height = emptyCorners(); this.velocity = emptyCorners(); this.previousRoad = emptyCorners();
    this.bodyPitch = 0; this.bodyRoll = 0;
    this.pose = { heaveM: 0, pitchRad: 0, rollRad: 0, wheelRoadM: emptyCorners(), impact: 0 };
  }

  step(args: {
    x: number; z: number; yaw: number; speed: number; dt: number;
    wheelbaseM: number; trackWidthM: number; massKg: number;
    longitudinalAccelMps2?: number; lateralAccelMps2?: number;
    hazards: readonly RoadDepression[]; bumps: readonly SpeedBump[];
  }): SuspensionPose {
    const { x, z, yaw, dt, hazards, bumps } = args;
    if (dt <= 0) return this.pose;
    const wheelbase = clamp(args.wheelbaseM, 2.15, 3.4);
    const width = clamp(args.trackWidthM, 1.25, 1.9);
    // Frecuencia natural nominal ~1.6 Hz; vehículos más pesados ligeramente más suaves.
    const hz = clamp(2.15 - (args.massKg - 1200) * .00012, 1.80, 2.22);
    const w = 2 * Math.PI * hz;
    const damping = .48; // rebote visible pero amortiguado, sin oscilación perpetua
    let impact = Math.max(0, this.pose.impact - dt * 3.0);
    for (const corner of WHEEL_CORNERS) {
      const front = corner[0] === 'F';
      const left = corner[1] === 'L';
      const localX = (left ? 1 : -1) * width / 2;
      const localZ = (front ? 1 : -1) * wheelbase / 2;
      const wheelX = x + Math.cos(yaw) * localX + Math.sin(yaw) * localZ;
      const wheelZ = z - Math.sin(yaw) * localX + Math.cos(yaw) * localZ;
      const target = roadHeightAt(wheelX, wheelZ, hazards, bumps);
      const delta = target - this.previousRoad[corner];
      // Intensidad de golpe controlada; un lomo despacio no suena/pega como a 80 km/h.
      if (Math.abs(args.speed) > 1) {
        const excitation = Math.abs(delta) / dt;
        impact = Math.max(impact, clamp((excitation - .12) / 1.7, 0, 1) * clamp(Math.abs(args.speed) / 13, .06, 1));
      }
      this.previousRoad[corner] = target;
      // Masa-resorte-amortiguador F= -k(y-road) - c*y'; dt fijo de la simulación.
      const accel = w * w * (target - this.height[corner]) - 2 * damping * w * this.velocity[corner];
      this.velocity[corner] = clamp(this.velocity[corner] + accel * dt, -3.8, 3.8);
      this.height[corner] = clamp(this.height[corner] + this.velocity[corner] * dt, -.23, .19);
    }
    const h = this.height;
    const frontH = (h.FL + h.FR) / 2;
    const rearH = (h.RL + h.RR) / 2;
    const leftH = (h.FL + h.RL) / 2;
    const rightH = (h.FR + h.RR) / 2;
    // Aproximación de cabeceo/balanceo del chasis bajo carga, acoplada a las
    // aceleraciones efectivas.  No es la rigidez real de las barras de torsión.
    const pitchTarget = clamp(-(args.longitudinalAccelMps2 ?? 0) * .0065, -.065, .065);
    const rollTarget = clamp(-(args.lateralAccelMps2 ?? 0) * .011, -.09, .09);
    const response = 1 - Math.exp(-4.0 * dt);
    this.bodyPitch += (pitchTarget - this.bodyPitch) * response;
    this.bodyRoll += (rollTarget - this.bodyRoll) * response;
    this.pose = {
      heaveM: clamp((frontH + rearH) / 2, -.18, .17),
      pitchRad: clamp(-Math.atan2(frontH - rearH, wheelbase) + this.bodyPitch, -.13, .13),
      rollRad: clamp(Math.atan2(leftH - rightH, width) + this.bodyRoll, -.14, .14),
      wheelRoadM: { ...this.previousRoad },
      impact,
    };
    return this.pose;
  }
}
