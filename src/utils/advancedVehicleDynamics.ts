/**
 * DATACAR ARENA V8.9 — dynamic single-track (bicycle) vehicle model.
 *
 * Game-oriented dynamics, NOT a certified OEM, full 14-DOF or Pacejka model.
 * Source for mass, dimensions and tyres: exact Vehicle record; unlisted centre-of-
 * gravity, yaw inertia and cornering stiffness are clearly estimated calibrations.
 * Uses independent axle forces, changing normal loads, combined-slip limits and
 * semi-implicit integration at the existing fixed 100 Hz physics step.
 * Coordinate conventions: +Z forward, +X to vehicle's left, +yaw toward +X.
 */
import type { DrivetrainType } from '../types/vehicle.ts';

const G = 9.80665;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const follow = (v: number, target: number, gain: number, dt: number) => v + (target - v) * (1 - Math.exp(-gain * dt));

export interface BicycleInput {
  massKg: number;
  wheelbaseM: number;
  drivetrain: DrivetrainType;
  speedMps: number; // signed (reverse supported)
  lateralSpeedMps: number;
  yawRateRadS: number;
  steeringRad: number;
  longitudinalAccelMps2: number;
  tyreFriction: number; // coefficient includes surface/weather/water
  corneringStiffnessScale?: number; // estimación por tamaño y perfil de neumáticos
  cgHeightM?: number; // altura CG aproximada desde altura total del vehículo
  dt: number;
}
export interface BicycleOutput {
  lateralSpeedMps: number;
  yawRateRadS: number;
  lateralAccelMps2: number;
  frontNormalN: number;
  rearNormalN: number;
  frontLateralForceN: number;
  rearLateralForceN: number;
  frontSlipAngleRad: number;
  rearSlipAngleRad: number;
  combinedGripUsed: number;
  sideSlipRad: number;
}

export function integrateBicycle(input: BicycleInput): BicycleOutput {
  const mass = Math.max(650, input.massKg);
  const L = clamp(input.wheelbaseM, 2.1, 3.6);
  const dt = clamp(input.dt, 0, .02);
  const mu = clamp(input.tyreFriction, .1, 1.7);
  const vx = input.speedMps;
  const vy = input.lateralSpeedMps;
  const r = input.yawRateRadS;
  const steer = clamp(input.steeringRad, -.56, .56);
  // Approximate CG at 47% of wheelbase from front axle. Not OEM homologation.
  const a = L * .47;
  const b = L - a;
  const staticFront = mass * G * b / L;
  const cgHeight = clamp(input.cgHeightM ?? .54, .42, .75);
  const frontTransfer = -mass * clamp(input.longitudinalAccelMps2, -14, 14) * cgHeight / L;
  const Fzf = clamp(staticFront + frontTransfer, mass * G * .16, mass * G * .84);
  const Fzr = mass * G - Fzf;
  // Straight-line load allocation: estimated FWD/RWD torque split or front-biased braking.
  const brake = input.longitudinalAccelMps2 < -.08;
  const frontShare = brake ? .67 : input.drivetrain === 'FWD' ? .90 : input.drivetrain === 'RWD' ? .10 : .50;
  const Fx = mass * Math.abs(input.longitudinalAccelMps2);
  const fxFront = Fx * frontShare;
  const fxRear = Fx * (1 - frontShare);
  const loadSensitiveMu = (normalN: number, staticN: number) => mu * clamp(Math.pow(normalN / staticN, -.07), .90, 1.13);
  const frictionFront = loadSensitiveMu(Fzf, staticFront) * Fzf;
  const frictionRear = loadSensitiveMu(Fzr, mass * G - staticFront) * Fzr;
  // Friction ellipse: braking/drive consumes traction otherwise available for steering.
  const capF = Math.sqrt(Math.max(0, frictionFront * frictionFront - fxFront * fxFront));
  const capR = Math.sqrt(Math.max(0, frictionRear * frictionRear - fxRear * fxRear));
  const u = Math.max(2.5, Math.abs(vx));
  const alphaF = Math.atan2(vy + a * r, u) - steer;
  const alphaR = Math.atan2(vy - b * r, u);
  // Saturating tyre force (tanh brush approximation), not invented Pacejka coefficients.
  const stiffness = clamp(input.corneringStiffnessScale ?? 1, .75, 1.25);
  const cornerF = 6.5 * Fzf * stiffness;
  const cornerR = 6.2 * Fzr * stiffness;
  const FyF = capF > .01 ? -capF * Math.tanh(cornerF * alphaF / capF) : 0;
  const FyR = capR > .01 ? -capR * Math.tanh(cornerR * alphaR / capR) : 0;
  // Yaw inertia estimate Izz = m*k² with k ~= 0.49 * wheelbase.
  const inertiaYaw = mass * Math.pow(.49 * L, 2);
  const Fy = FyF * Math.cos(steer) + FyR;
  const lateralAccel = Fy / mass;
  const vyDot = lateralAccel - vx * r;
  const yawAccel = (a * FyF * Math.cos(steer) - b * FyR) / inertiaYaw;
  let nextVy = clamp(vy + vyDot * dt, -12, 12);
  let nextYawRate = clamp(r + yawAccel * dt, -1.8, 1.8);
  // At very low speeds use kinematic steering: dynamic tyre model is ill-conditioned.
  // Reverse naturally reverses yaw direction.
  const kinematicYaw = vx * Math.tan(steer) / L;
  const blend = clamp((Math.abs(vx) - 2.3) / 3.7, 0, 1);
  nextYawRate = (1 - blend) * follow(r, kinematicYaw, 8, dt) + blend * nextYawRate;
  nextVy = (1 - blend) * (vy * Math.exp(-8 * dt)) + blend * nextVy;
  const usageF = frictionFront > 1 ? Math.hypot(fxFront, FyF) / frictionFront : 0;
  const usageR = frictionRear > 1 ? Math.hypot(fxRear, FyR) / frictionRear : 0;
  return {
    lateralSpeedMps: Number.isFinite(nextVy) ? nextVy : 0,
    yawRateRadS: Number.isFinite(nextYawRate) ? nextYawRate : 0,
    lateralAccelMps2: Number.isFinite(lateralAccel) ? lateralAccel : 0,
    frontNormalN: Fzf, rearNormalN: Fzr,
    frontLateralForceN: FyF, rearLateralForceN: FyR,
    frontSlipAngleRad: alphaF, rearSlipAngleRad: alphaR,
    combinedGripUsed: clamp(Math.max(usageF, usageR), 0, 1),
    sideSlipRad: Math.atan2(nextVy, Math.max(2.5, Math.abs(vx))),
  };
}
