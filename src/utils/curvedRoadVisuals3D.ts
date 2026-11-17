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

export interface NearestRoadCenterlineHit {
  distance: number;
  nearestX: number;
  nearestZ: number;
  nearestS: number;
}

export interface RoadCorridorSpatialIndex {
  readonly roadWidth: number;
  readonly halfRoad: number;
  minDistanceToCenterline: (wx: number, wz: number) => NearestRoadCenterlineHit;
}

/**
 * Índice espacial 2D O(1) sobre toda la traza vial [-25 .. path.length + 45]
 * para garantizar que ningún edificio, podio, torre espejada ni hito invada
 * otro tramo curvo o recto de la ruta en ningún circuito.
 */
export function buildRoadCorridorSpatialIndex(
  path: CurvedRoadPath,
  roadWidth: number,
  sampleStepM = 2.5,
): RoadCorridorSpatialIndex {
  const cellSize = 28;
  const minS = -25;
  const maxS = path.length + 45;
  const sampleX: number[] = [];
  const sampleZ: number[] = [];
  const sampleS: number[] = [];
  const buckets = new Map<string, number[]>();

  const keyOf = (cx: number, cz: number) => `${cx},${cz}`;

  for (let s = minS; s <= maxS; s += sampleStepM) {
    const pt = path.at(s);
    const idx = sampleX.length;
    sampleX.push(pt.x);
    sampleZ.push(pt.z);
    sampleS.push(s);
    const cx = Math.floor(pt.x / cellSize);
    const cz = Math.floor(pt.z / cellSize);
    const k = keyOf(cx, cz);
    let bucket = buckets.get(k);
    if (!bucket) {
      bucket = [];
      buckets.set(k, bucket);
    }
    bucket.push(idx);
  }

  return {
    roadWidth,
    halfRoad: roadWidth * 0.5,
    minDistanceToCenterline(wx: number, wz: number): NearestRoadCenterlineHit {
      const baseCx = Math.floor(wx / cellSize);
      const baseCz = Math.floor(wz / cellSize);
      let bestDistSq = Infinity;
      let bestIdx = 0;

      // Buscar primero en vecindad 5x5 (~140m x 140m) para O(1) inmediato
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          const bucket = buckets.get(keyOf(baseCx + dx, baseCz + dz));
          if (!bucket) continue;
          for (let k = 0; k < bucket.length; k++) {
            const idx = bucket[k];
            const ddx = wx - sampleX[idx];
            const ddz = wz - sampleZ[idx];
            const dSq = ddx * ddx + ddz * ddz;
            if (dSq < bestDistSq) {
              bestDistSq = dSq;
              bestIdx = idx;
            }
          }
        }
      }

      // Respaldo exhaustivo si el punto está a > 84m de toda la ruta
      if (!Number.isFinite(bestDistSq)) {
        for (let idx = 0; idx < sampleX.length; idx++) {
          const ddx = wx - sampleX[idx];
          const ddz = wz - sampleZ[idx];
          const dSq = ddx * ddx + ddz * ddz;
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            bestIdx = idx;
          }
        }
      }

      return {
        distance: Math.sqrt(bestDistSq),
        nearestX: sampleX[bestIdx] ?? 0,
        nearestZ: sampleZ[bestIdx] ?? 0,
        nearestS: sampleS[bestIdx] ?? 0,
      };
    },
  };
}

/**
 * Calcula una pose lateral segura para edificios monumentales (ej. Weno Bank)
 * verificando despeje contra TODOS los segmentos de la ruta.
 */
export function resolveSafeRoadsideBuildingPose(
  path: CurvedRoadPath,
  roadWidth: number,
  targetS: number,
  preferredLateral: number,
  footprintRadius: number,
  minEdgeClearanceM = 3.5,
): { x: number; z: number; yaw: number; lateral: number } {
  const corridor = buildRoadCorridorSpatialIndex(path, roadWidth);
  const requiredDist = roadWidth * 0.5 + footprintRadius + minEdgeClearanceM;
  const preferredSign: 1 | -1 = preferredLateral >= 0 ? 1 : -1;
  const baseAbsLat = Math.max(Math.abs(preferredLateral), requiredDist);

  const candidateLaterals = [
    preferredSign * baseAbsLat,
    preferredSign * (baseAbsLat + 8),
    preferredSign * (baseAbsLat + 16),
    -preferredSign * baseAbsLat,
    -preferredSign * (baseAbsLat + 8),
    preferredSign * (baseAbsLat + 28),
    -preferredSign * (baseAbsLat + 28),
  ];

  let bestPose = path.world(targetS, preferredLateral);
  let bestClearance = -Infinity;

  for (const lat of candidateLaterals) {
    const candidate = path.world(targetS, lat);
    const hit = corridor.minDistanceToCenterline(candidate.x, candidate.z);
    if (hit.distance >= requiredDist) {
      return { x: candidate.x, z: candidate.z, yaw: candidate.yaw, lateral: lat };
    }
    if (hit.distance > bestClearance) {
      bestClearance = hit.distance;
      bestPose = candidate;
    }
  }

  return {
    x: bestPose.x,
    z: bestPose.z,
    yaw: bestPose.yaw,
    lateral: bestPose.lateral,
  };
}

/**
 * Evalúa los 9 puntos clave de la huella 2D orientada (centro, 4 vértices y 4 puntos medios de fachada)
 * contra todo el corredor vial y devuelve la distancia mínima real al eje de calzada.
 */
function minObbDistanceToRoadCenterline(
  corridor: RoadCorridorSpatialIndex,
  cx: number,
  cz: number,
  halfX: number,
  halfZ: number,
  yawRad: number,
): NearestRoadCenterlineHit {
  const cosY = Math.cos(yawRad);
  const sinY = Math.sin(yawRad);
  // Eje local X = (cosY, -sinY), eje local Z = (sinY, cosY) en convención Three.js Y-up
  const uxX = cosY * halfX;
  const uxZ = -sinY * halfX;
  const uzX = sinY * halfZ;
  const uzZ = cosY * halfZ;

  let best = corridor.minDistanceToCenterline(cx, cz);
  const offsets: ReadonlyArray<readonly [number, number]> = [
    [uxX + uzX, uxZ + uzZ],
    [uxX - uzX, uxZ - uzZ],
    [-uxX + uzX, -uxZ + uzZ],
    [-uxX - uzX, -uxZ - uzZ],
    [uxX, uxZ],
    [-uxX, -uxZ],
    [uzX, uzZ],
    [-uzX, -uzZ],
  ];
  for (let i = 0; i < offsets.length; i++) {
    const hit = corridor.minDistanceToCenterline(cx + offsets[i][0], cz + offsets[i][1]);
    if (hit.distance < best.distance) {
      best = hit;
    }
  }
  return best;
}

/** Reproyectar geometría estática generada a lo largo del eje +Z.
 * Se transforman matrices de instancias sin alterar sus materiales ni jerarquía.
 * Los elementos longitudinales largos se teselan para seguir las curvas, y todo
 * edificio o estructura vertical pasa por el filtro global OBB de gálibo vial.
 */
export function bendRoadsideGroup(
  group: THREE.Group,
  path: CurvedRoadPath,
  roadWidth = 21,
): void {
  const corridor = buildRoadCorridorSpatialIndex(path, roadWidth);
  const halfRoad = roadWidth * 0.5;
  const tempMatrix = new THREE.Matrix4();
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), scale = new THREE.Vector3();
  const euler = new THREE.Euler();
  const headingQ = new THREE.Quaternion();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const children = group.children.slice();

  for (const child of children) {
    if (child.userData?.skipBend) continue;
    const isBuilding = Boolean(child.userData?.isRoadsideBuilding);

    if (child instanceof THREE.InstancedMesh) {
      if (!path.isCurved && !isBuilding) continue;
      const edgeClearance =
        typeof child.userData?.minEdgeClearanceM === 'number'
          ? child.userData.minEdgeClearanceM
          : 3.2;

      for (let i = 0; i < child.count; i++) {
        child.getMatrixAt(i, tempMatrix);
        tempMatrix.decompose(p, q, scale);
        if (scale.x === 0 && scale.y === 0 && scale.z === 0) continue;

        if (path.isCurved) {
          const point = path.world(p.z, p.x);
          headingQ.setFromAxisAngle(yAxis, point.yaw);
          p.x = point.x;
          p.z = point.z;
          q.premultiply(headingQ);
        }

        if (isBuilding) {
          euler.setFromQuaternion(q, 'YXZ');
          const halfX = Math.abs(scale.x) * 0.5;
          const halfZ = Math.abs(scale.z) * 0.5;
          const hit = minObbDistanceToRoadCenterline(corridor, p.x, p.z, halfX, halfZ, euler.y);
          if (hit.distance < halfRoad + edgeClearance) {
            p.set(0, -500, 0);
            scale.set(0, 0, 0);
          }
        }

        tempMatrix.compose(p, q, scale);
        child.setMatrixAt(i, tempMatrix);
      }
      child.instanceMatrix.needsUpdate = true;
      child.frustumCulled = false;
      continue;
    }

    if (child instanceof THREE.LineSegments) {
      if (!path.isCurved) continue;
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
      if (isBuilding) {
        const worldCheck = path.isCurved
          ? path.world(child.position.z, child.position.x)
          : { x: child.position.x, z: child.position.z, yaw: 0 };
        const halfX =
          typeof child.userData?.footprintHalfX === 'number'
            ? child.userData.footprintHalfX
            : 3.6;
        const halfZ =
          typeof child.userData?.footprintHalfZ === 'number'
            ? child.userData.footprintHalfZ
            : 0.5;
        const hit = minObbDistanceToRoadCenterline(
          corridor,
          worldCheck.x,
          worldCheck.z,
          halfX,
          halfZ,
          child.rotation.y + worldCheck.yaw,
        );
        if (hit.distance < halfRoad + 3.2) {
          child.visible = false;
          child.scale.set(0, 0, 0);
          child.updateMatrix();
          continue;
        }
      }
      if (!path.isCurved) continue;
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
      if (path.isCurved) {
        // Grupos anclados en su propio centro local (carteles, torres espejadas, Paseo La Galería)
        const point = path.world(child.position.z, child.position.x);
        child.position.set(point.x, child.position.y, point.z);
        child.rotation.y += point.yaw;
      }
      if (isBuilding) {
        const halfX =
          typeof child.userData?.footprintHalfX === 'number'
            ? child.userData.footprintHalfX
            : typeof child.userData?.footprintRadius === 'number'
              ? child.userData.footprintRadius
              : 9.5;
        const halfZ =
          typeof child.userData?.footprintHalfZ === 'number'
            ? child.userData.footprintHalfZ
            : typeof child.userData?.footprintRadius === 'number'
              ? child.userData.footprintRadius
              : 11.5;
        const requiredEdgeDist = halfRoad + 3.4;
        const hit = minObbDistanceToRoadCenterline(
          corridor,
          child.position.x,
          child.position.z,
          halfX,
          halfZ,
          child.rotation.y,
        );
        if (hit.distance < requiredEdgeDist) {
          const centerHit = corridor.minDistanceToCenterline(child.position.x, child.position.z);
          const dx = child.position.x - centerHit.nearestX;
          const dz = child.position.z - centerHit.nearestZ;
          const len = Math.hypot(dx, dz);
          if (len > 0.05) {
            const pushDist = requiredEdgeDist - hit.distance + 4.5;
            const pushedX = child.position.x + (dx / len) * pushDist;
            const pushedZ = child.position.z + (dz / len) * pushDist;
            const recheck = minObbDistanceToRoadCenterline(
              corridor,
              pushedX,
              pushedZ,
              halfX,
              halfZ,
              child.rotation.y,
            );
            if (recheck.distance >= requiredEdgeDist) {
              child.position.set(pushedX, child.position.y, pushedZ);
            } else {
              child.visible = false;
              child.scale.set(0, 0, 0);
            }
          } else {
            child.visible = false;
            child.scale.set(0, 0, 0);
          }
        }
      }
    }
  }
}

export interface RoadClearanceAuditReport {
  checkedInstances: number;
  checkedGroups: number;
  encroachingItems: Array<{ name: string; x: number; z: number; distanceToCenterline: number; minAllowed: number }>;
}

/**
 * Audita determinísticamente que ningún edificio, podio, torre espejada o complejo urbano
 * invada la calzada transitable ni los cordones tras proyectar sobre `path`.
 */
export function auditSceneryRoadClearance(
  group: THREE.Group,
  path: CurvedRoadPath,
  roadWidth: number,
): RoadClearanceAuditReport {
  const corridor = buildRoadCorridorSpatialIndex(path, roadWidth);
  const halfRoad = roadWidth * 0.5;
  const minAllowed = halfRoad + 1.5; // Calzada completa + cordón cuneta despejados al 100%
  const tempMatrix = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const euler = new THREE.Euler();
  let checkedInstances = 0;
  let checkedGroups = 0;
  const encroachingItems: RoadClearanceAuditReport['encroachingItems'] = [];

  for (const child of group.children) {
    if (!child.visible || !child.userData?.isRoadsideBuilding) continue;

    if (child instanceof THREE.InstancedMesh) {
      for (let i = 0; i < child.count; i++) {
        child.getMatrixAt(i, tempMatrix);
        tempMatrix.decompose(p, q, scale);
        if (scale.x === 0 && scale.y === 0 && scale.z === 0) continue;
        checkedInstances++;
        euler.setFromQuaternion(q, 'YXZ');
        const hit = minObbDistanceToRoadCenterline(
          corridor,
          p.x,
          p.z,
          Math.abs(scale.x) * 0.5,
          Math.abs(scale.z) * 0.5,
          euler.y,
        );
        if (hit.distance < minAllowed) {
          encroachingItems.push({
            name: `${child.name}[${i}]`,
            x: p.x,
            z: p.z,
            distanceToCenterline: hit.distance,
            minAllowed,
          });
        }
      }
    } else if (child instanceof THREE.Group) {
      if (child.scale.x === 0 && child.scale.y === 0 && child.scale.z === 0) continue;
      checkedGroups++;
      const halfX =
        typeof child.userData?.footprintHalfX === 'number'
          ? child.userData.footprintHalfX
          : 9.5;
      const halfZ =
        typeof child.userData?.footprintHalfZ === 'number'
          ? child.userData.footprintHalfZ
          : 11.5;
      const hit = minObbDistanceToRoadCenterline(
        corridor,
        child.position.x,
        child.position.z,
        halfX,
        halfZ,
        child.rotation.y,
      );
      if (hit.distance < minAllowed) {
        encroachingItems.push({
          name: child.name,
          x: child.position.x,
          z: child.position.z,
          distanceToCenterline: hit.distance,
          minAllowed,
        });
      }
    }
  }

  return { checkedInstances, checkedGroups, encroachingItems };
}

