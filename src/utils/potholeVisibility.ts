/** Detección anticipada de baches visibles en la trayectoria del jugador.
 * Es una alerta de conducción, no interviene en la física ni agranda las colisiones.
 */
export interface RoadHazardLocator { id: number; kind: string; x: number; z: number; radius: number }
export interface PotholeLookahead {
  id: number;
  distanceM: number;
  offsetM: number;
  radiusM: number;
  severity: 'moderado' | 'profundo';
}

export function findUpcomingPothole(
  hazards: readonly RoadHazardLocator[],
  position: { x: number; z: number; yaw: number; speed: number },
  vehicleWidthM = 1.8,
): PotholeLookahead | null {
  // No advertir sobre pozos delanteros cuando se circula marcha atrás.
  if (position.speed <= .8) return null;
  const range = Math.min(76, Math.max(34, position.speed * 2.55));
  const cos = Math.cos(position.yaw);
  const sin = Math.sin(position.yaw);
  let nearest: PotholeLookahead | null = null;
  for (const hazard of hazards) {
    if (hazard.kind !== 'pothole') continue;
    const dx = hazard.x - position.x;
    const dz = hazard.z - position.z;
    const ahead = dz * cos + dx * sin;
    if (ahead <= 3 || ahead >= range) continue;
    const sideways = dx * cos - dz * sin;
    // Cerca del carril de circulación; un pozo de otra calzada no molesta al conductor.
    if (Math.abs(sideways) > hazard.radius + vehicleWidthM * .35) continue;
    if (!nearest || ahead < nearest.distanceM) {
      nearest = {
        id: hazard.id,
        distanceM: ahead,
        offsetM: sideways,
        radiusM: hazard.radius,
        severity: hazard.radius >= 1.04 ? 'profundo' : 'moderado',
      };
    }
  }
  return nearest;
}

/** Señal de 0..1 para ajustar levemente el ángulo de cámara (sin cambiar distancia ni hitboxes). */
export function potholeCameraCue(distanceM: number): number {
  const x = Math.max(0, Math.min(1, (58 - distanceM) / 42));
  return x * x * (3 - 2 * x);
}
