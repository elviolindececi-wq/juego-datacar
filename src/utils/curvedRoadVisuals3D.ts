import * as THREE from 'three';
import type { CurvedRoadPath } from './curvedRoadPath.ts';
import type { TrackHazard } from './interactiveRacePhysics.ts';

/** Una misma curva para asfalto, veredas, edificios, marcas y baches.
 * La malla se crea sólo al cambiar de circuito/obstáculos, nunca por frame.
 */
export function makeCurvedAsphalt(path: CurvedRoadPath, roadWidth: number, length: number,
  holes: readonly TrackHazard[] = []): THREE.BufferGeometry {
  const vertices: number[] = [];
  const uv: number[] = [];
  const indexes: number[] = [];
  const lateralSteps = 32;
  const alongSteps = Math.ceil(length / 1.5);
  const step = length / alongSteps;
  for (let row = 0; row <= alongSteps; row++) {
    const s = -20 + row * step;
    for (let col = 0; col <= lateralSteps; col++) {
      const x = roadWidth * (col / lateralSteps - .5);
      const p = path.world(s, x);
      vertices.push(p.x, 0, p.z);
      uv.push(col / lateralSteps, row / alongSteps);
    }
  }
  const nx = lateralSteps + 1;
  for (let row = 0; row < alongSteps; row++) for (let col = 0; col < lateralSteps; col++) {
    const s = -20 + (row + .5) * step;
    const lateral = roadWidth * ((col + .5) / lateralSteps - .5);
    // Conservar huecos excavados donde el vehículo puede perder altura.
    if (holes.some(h => h.kind === 'pothole' && Math.hypot(h.x - lateral, h.z - s) < h.radius * .86)) continue;
    const a = row * nx + col, b = a + 1, c = a + nx, d = c + 1;
    indexes.push(a, c, b, b, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indexes);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Reproyectar geometría estática generada a lo largo del eje +Z.
 * Se transforman matrices de instancias sin alterar sus materiales ni jerarquía.
 * Los elementos longitudinales largos se teselan para seguir las curvas.
 */
export function bendRoadsideGroup(group: THREE.Group, path: CurvedRoadPath): void {
  if (!path.isCurved) return;
  const tempMatrix = new THREE.Matrix4();
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), scale = new THREE.Vector3();
  const headingQ = new THREE.Quaternion();
  const children = group.children.slice();
  for (const child of children) {
    if (child instanceof THREE.InstancedMesh) {
      for (let i = 0; i < child.count; i++) {
        child.getMatrixAt(i, tempMatrix);
        tempMatrix.decompose(p, q, scale);
        const point = path.world(p.z, p.x);
        headingQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), point.yaw);
        p.x = point.x; p.z = point.z;
        q.premultiply(headingQ);
        tempMatrix.compose(p, q, scale);
        child.setMatrixAt(i, tempMatrix);
      }
      child.instanceMatrix.needsUpdate = true;
      child.frustumCulled = false;
      continue;
    }
    if (child instanceof THREE.LineSegments) {
      const attr = child.geometry.getAttribute('position');
      for (let i = 0; i < attr.count; i++) {
        const point = path.world(attr.getZ(i), attr.getX(i));
        attr.setXYZ(i, point.x, attr.getY(i), point.z);
      }
      attr.needsUpdate = true;
      child.geometry.computeBoundingSphere();
      continue;
    }
    if (child instanceof THREE.Mesh) {
      // Varios carteles comparten primitivas; cada uno necesita sus propios
      // vértices antes de reubicar la geometría, para no doblarla dos veces.
      child.geometry = child.geometry.clone();
      child.geometry.computeBoundingBox();
      const box = child.geometry.boundingBox!;
      const localSpanZ = child.rotation.x < -1.4 ? box.max.y - box.min.y : box.max.z - box.min.z;
      const worldSpanZ = localSpanZ * (child.rotation.x < -1.4 ? child.scale.y : child.scale.z);
      // Veredas, cordones y franjas: crear segmentos longitudinales sin multiplicar draw calls.
      if (worldSpanZ > 13) {
        const segments = Math.ceil(worldSpanZ / 5);
        if (child.geometry instanceof THREE.BoxGeometry) {
          const params = child.geometry.parameters;
          child.geometry = new THREE.BoxGeometry(params.width, params.height, params.depth, 1, 1, segments);
        } else if (child.geometry instanceof THREE.PlaneGeometry) {
          const params = child.geometry.parameters;
          child.geometry = new THREE.PlaneGeometry(params.width, params.height, 1, segments);
        }
      }
      child.updateMatrix();
      const attr = child.geometry.getAttribute('position');
      const transformed = new THREE.Vector3();
      for (let i = 0; i < attr.count; i++) {
        transformed.set(attr.getX(i), attr.getY(i), attr.getZ(i)).applyMatrix4(child.matrix);
        const point = path.world(transformed.z, transformed.x);
        attr.setXYZ(i, point.x, transformed.y, point.z);
      }
      attr.needsUpdate = true;
      child.geometry.computeVertexNormals();
      child.geometry.computeBoundingSphere();
      child.position.set(0, 0, 0);
      child.rotation.set(0, 0, 0);
      child.scale.set(1, 1, 1);
      child.updateMatrix();
      continue;
    }
    if (child instanceof THREE.Group) {
      // Grupos pequeños (carteles): reorientar el conjunto completo, no cada hijo.
      const point = path.world(child.position.z, child.position.x);
      child.position.set(point.x, child.position.y, point.z);
      child.rotation.y += point.yaw;
    }
  }
}
