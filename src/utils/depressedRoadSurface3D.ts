import * as THREE from 'three';
import type { TrackHazard } from './interactiveRacePhysics';

/**
 * Superficie física-visual de calzada con agujeros reales (sin pintar un círculo
 * negro encima del asfalto). Conserva la UV de la pista original y sus materiales.
 * Reconstruir únicamente cuando se agrega un bache, NUNCA por frame.
 */
export function createDepressedRoadGeometry(
  width: number,
  length: number,
  worldZCenter: number,
  hazards: readonly TrackHazard[],
): THREE.BufferGeometry {
  const halfWidth = width / 2;
  const halfLength = length / 2;
  const outline = new THREE.Shape();
  outline.moveTo(-halfWidth, -halfLength);
  outline.lineTo(halfWidth, -halfLength);
  outline.lineTo(halfWidth, halfLength);
  outline.lineTo(-halfWidth, halfLength);
  outline.closePath();
  for (const hole of hazards) {
    if (hole.kind !== 'pothole') continue;
    const radius = hole.radius * 0.965;
    if (Math.abs(hole.x) + radius >= halfWidth - .06) continue;
    const localZ = -(hole.z - worldZCenter);
    if (Math.abs(localZ) + radius >= halfLength - .06) continue;
    const cutout = new THREE.Path();
    cutout.absarc(hole.x, localZ, radius, 0, Math.PI * 2, true);
    outline.holes.push(cutout);
  }
  const geo = new THREE.ShapeGeometry(outline, 28);
  // ShapeGeometry entrega UV en coordenadas del mundo: normalizar para la
  // textura de asfalto repetida de la carretera (la malla aún rotará -90° X).
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + halfWidth) / width, (pos.getY(i) + halfLength) / length);
  }
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}
