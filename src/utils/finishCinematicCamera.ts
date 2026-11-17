/**
 * Cámara de llegada V9.3. Toma la posición y orientación real del VEHÍCULO,
 * no la coordenada longitudinal s de una carretera que puede curvarse.
 * Se puede probar sin Three.js ni WebGL.
 */
export interface FinishCameraPose {
  camera: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  fov: number;
}

export function finishCameraPose(x: number, z: number, yaw: number, progress: number, compact = false): FinishCameraPose {
  const p = Math.max(0, Math.min(1, progress));
  const ease = p * p * (3 - 2 * p);
  // Delante del auto, leve ángulo de tres cuartos para mostrar parrilla y costado.
  const distance = (compact ? 7.3 : 6.7) - ease * .9;
  const side = (compact ? 1.45 : 1.95) + ease * .20;
  const frontX = Math.sin(yaw);
  const frontZ = Math.cos(yaw);
  const sideX = Math.cos(yaw);
  const sideZ = -Math.sin(yaw);
  return {
    camera: {
      x: x + frontX * distance + sideX * side,
      y: 1.63 - ease * .10,
      z: z + frontZ * distance + sideZ * side,
    },
    target: { x, y: 1.16, z },
    fov: (compact ? 53 : 49) - ease * 2.5,
  };
}
