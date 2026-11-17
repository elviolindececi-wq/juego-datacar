/**
 * DATACAR ARENA V8.5 — interpolación únicamente VISUAL de la simulación a 100 Hz.
 * Nunca modifica el estado de la física, los choques ni la telemetría oficial.
 * Un fotograma se dibuja entre el penúltimo y el último paso físico, evitando
 * escalones de 1/100 s cuando la tasa de refresco no coincide con los pasos.
 */
import type { DynamicCar } from './interactiveRacePhysics.ts';

export type RenderPose = Pick<DynamicCar, 'x' | 'z' | 'yaw' | 'speed' | 'steer' | 'slip' | 'bump'> & {
  suspension: {
    heaveM: number;
    pitchRad: number;
    rollRad: number;
    impact: number;
    wheelRoadM: { FL: number; FR: number; RL: number; RR: number };
  };
};

export const snapshotRenderPose = (c: DynamicCar): RenderPose => ({
  x: c.x, z: c.z, yaw: c.yaw, speed: c.speed, steer: c.steer, slip: c.slip, bump: c.bump,
  suspension: {
    heaveM: c.suspension.heaveM,
    pitchRad: c.suspension.pitchRad,
    rollRad: c.suspension.rollRad,
    impact: c.suspension.impact,
    wheelRoadM: { ...c.suspension.wheelRoadM },
  },
});

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const angleLerp = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

export function interpolateRenderPose(previous: RenderPose | undefined, car: DynamicCar, alpha: number): RenderPose {
  if (!previous || !Number.isFinite(alpha)) return snapshotRenderPose(car);
  const t = Math.max(0, Math.min(1, alpha));
  const s = car.suspension;
  return {
    x: lerp(previous.x, car.x, t), z: lerp(previous.z, car.z, t),
    yaw: angleLerp(previous.yaw, car.yaw, t),
    speed: lerp(previous.speed, car.speed, t),
    steer: angleLerp(previous.steer, car.steer, t),
    slip: lerp(previous.slip, car.slip, t),
    bump: lerp(previous.bump, car.bump, t),
    suspension: {
      heaveM: lerp(previous.suspension.heaveM, s.heaveM, t),
      pitchRad: lerp(previous.suspension.pitchRad, s.pitchRad, t),
      rollRad: lerp(previous.suspension.rollRad, s.rollRad, t),
      impact: lerp(previous.suspension.impact, s.impact, t),
      wheelRoadM: {
        FL: lerp(previous.suspension.wheelRoadM.FL, s.wheelRoadM.FL, t),
        FR: lerp(previous.suspension.wheelRoadM.FR, s.wheelRoadM.FR, t),
        RL: lerp(previous.suspension.wheelRoadM.RL, s.wheelRoadM.RL, t),
        RR: lerp(previous.suspension.wheelRoadM.RR, s.wheelRoadM.RR, t),
      },
    },
  };
}
