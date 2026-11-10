/** Selección de planos para la retransmisión cinematográfica. El eje de avance es +Z. */
export type DirectorShot = 'grilla_frontal' | 'persecucion_baja' | 'lateral_izquierda' | 'cenital_dinamica' | 'lateral_derecha' | 'frontal_seguimiento' | 'frontal_meta';

export function chooseDirectorShot(leaderDistance: number, trackLength: number): DirectorShot {
  const progress = Math.min(1, Math.max(0, leaderDistance / Math.max(1, trackLength)));
  if (trackLength - leaderDistance <= Math.min(38, trackLength * 0.16)) return 'frontal_meta';
  if (progress < 0.075) return 'grilla_frontal';
  if (progress < 0.255) return 'persecucion_baja';
  if (progress < 0.405) return 'lateral_izquierda';
  if (progress < 0.555) return 'cenital_dinamica';
  if (progress < 0.705) return 'lateral_derecha';
  return 'frontal_seguimiento';
}

/** El auto apunta a +Z, y en vista trasera derecha de pantalla es -X global. */
export function screenRightSteeringToWorldYaw(angleRadians: number): number {
  return -angleRadians;
}
