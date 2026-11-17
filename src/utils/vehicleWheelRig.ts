import * as THREE from 'three';

export type WheelCornerId = 'FL' | 'FR' | 'RL' | 'RR';

export type WheelRigMode =
  | 'native_nodes'
  | 'separated_submesh'
  | 'procedural_oem';

export interface WheelCornerRuntimeState {
  id: WheelCornerId;
  front: boolean;
  rollAngleRad: number;
  steerAngleRad: number;
  radiusMeters: number;
  pivotY: number;
  steeringPivot: THREE.Group;
  rollingPivot: THREE.Group;
}

/**
 * Rig cinemático de 4 ruedas reales para vehículos 3D de DATACAR ARENA.
 *
 * Jerarquía por esquina (`FL`, `FR`, `RL`, `RR`):
 *   `root` -> `SteeringPivot_<id>` (guiñada `localUp` solo en `FL`/`FR`)
 *          -> `RollingPivot_<id>` (rodadura pura `ω = d / r` sobre `localRollAxis`)
 *
 * Soporta:
 * 1. Nodos/grupos nombrados en Blender (`Wheel_FL`, `rueda_*`, `tire_*`, multi-primitiva llanta+neumático).
 * 2. Segmentación multi-pieza Meshy (`model_part1..N`, agrupando múltiples sub-mallas por esquina).
 * 3. Agrupación geométrica multi-malla (`>= 5` mallas con detección de esquinas inferiores).
 * 4. Separación cilíndrica no destructiva de sub-mallas por índices cuando un `.glb` viene soldado
 *    en una única malla (`meshCount === 1`, p. ej. `tracker-rs.glb`), preservando UV y texturas originales
 *    sin duplicar neumáticos ni deformar la carrocería.
 */
export interface VehicleWheelRig {
  setDistanceMeters(distanceMeters: number): void;
  setSteeringRadians(angle: number, deltaSeconds: number): void;
  setSuspensionContact(
    road: { FL: number; FR: number; RL: number; RR: number },
    heaveM: number,
    pitchRad: number,
    rollRad: number,
    dt: number,
  ): void;
  readonly wheelCount: number;
  readonly mode?: WheelRigMode;
  readonly wheelRadiusMeters?: number;
  readonly hasFrontSteering?: boolean;
  getWheelStates?: () => WheelCornerRuntimeState[];
  dispose?: () => void;
}

interface WheelRuntimeNode {
  id: WheelCornerId;
  front: boolean;
  steering: THREE.Group;
  rolling: THREE.Group;
  radiusMeters: number;
  initialPivotY: number;
  worldX: number;
  worldZ: number;
  rollAngleRad: number;
  steerAngleRad: number;
}

interface PartCandidate {
  mesh: THREE.Mesh;
  box: THREE.Box3;
  center: THREE.Vector3;
}

const WHEEL_CORNER_IDS: readonly WheelCornerId[] = ['FL', 'FR', 'RL', 'RR'];

const NAMED_WHEEL_NODE_PATTERN =
  /(wheel|rueda|tire|tyre|neumatico|neumático|llanta|(?:^|[^a-z])rim(?:s)?(?:[^a-z]|$)|front[_-]?left|front[_-]?right|rear[_-]?left|rear[_-]?right|(?:^|[_-\s])(?:fl|fr|rl|rr)(?:$|[_-\s\d]))/i;

const BODY_OR_INTERIOR_EXCLUDE_PATTERN =
  /(steering[_-]?wheel|volante|body|chassis|carroceria|carrocería|car[_-]?body|glass|window|windshield|vidrio|cristal|interior|seat|asiento|mirror|espejo|headlight|taillight|lamp|faro|farol|bumper|paragolpe|hood|bonnet|trunk|door|puerta|roof|techo|grille|parrilla)/i;

function computeBoxInAncestorSpace(mesh: THREE.Mesh, ancestor: THREE.Object3D): THREE.Box3 | null {
  if (!mesh.geometry) return null;
  mesh.geometry.computeBoundingBox();
  const localBox = mesh.geometry.boundingBox;
  if (!localBox || localBox.isEmpty()) return null;

  if (
    mesh.parent === ancestor &&
    mesh.position.lengthSq() === 0 &&
    mesh.rotation.x === 0 &&
    mesh.rotation.y === 0 &&
    mesh.rotation.z === 0 &&
    mesh.scale.x === 1 &&
    mesh.scale.y === 1 &&
    mesh.scale.z === 1
  ) {
    return localBox.clone();
  }

  ancestor.updateWorldMatrix(true, true);
  const invAncestor = new THREE.Matrix4().copy(ancestor.matrixWorld).invert();
  const relMatrix = new THREE.Matrix4().multiplyMatrices(invAncestor, mesh.matrixWorld);
  return localBox.clone().applyMatrix4(relMatrix);
}

/**
 * Calcula los ejes unitarios en el espacio local de `root` equivalentes a las direcciones
 * canónicas del vehículo en DATACAR (`+Z` avance, `+Y` arriba, `+X` izquierda) y el eje de
 * rodadura `localRollAxis = normalize(localUp × localForward)` tal que `+Δθ = +Δd / r`
 * desplaza siempre la cima del neumático hacia `+Z` (avance) y `-Δθ` hacia `-Z` (reversa).
 */
function resolveLocalVehicleBasis(
  root: THREE.Object3D,
  modelContainer: THREE.Object3D,
): {
  localForward: THREE.Vector3;
  localUp: THREE.Vector3;
  localLeft: THREE.Vector3;
  localRollAxis: THREE.Vector3;
} {
  const qRootToVehicle = new THREE.Quaternion();
  const chain: THREE.Object3D[] = [];
  let cursor: THREE.Object3D | null = root;
  while (cursor) {
    chain.push(cursor);
    if (cursor === modelContainer) break;
    cursor = cursor.parent;
  }
  for (let i = chain.length - 1; i >= 0; i--) {
    qRootToVehicle.multiply(chain[i].quaternion);
  }

  const qVehicleToRoot = qRootToVehicle.clone().invert();
  const localForward = new THREE.Vector3(0, 0, 1).applyQuaternion(qVehicleToRoot).normalize();
  const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(qVehicleToRoot).normalize();
  const localLeft = new THREE.Vector3(1, 0, 0).applyQuaternion(qVehicleToRoot).normalize();
  const localRollAxis = new THREE.Vector3().crossVectors(localUp, localForward);
  if (localRollAxis.lengthSq() < 1e-6) {
    localRollAxis.set(1, 0, 0);
  } else {
    localRollAxis.normalize();
  }

  return { localForward, localUp, localLeft, localRollAxis };
}

function parseExplicitCornerHint(label: string): WheelCornerId | null {
  const t = label.toLowerCase();
  if (/(front[_-\s]*left|del[_-\s]*izq|(?:^|[_-\s])fl(?:$|[_-\s\d])|wheel[_-\s]*fl)/i.test(t)) {
    return 'FL';
  }
  if (/(front[_-\s]*right|del[_-\s]*der|(?:^|[_-\s])fr(?:$|[_-\s\d])|wheel[_-\s]*fr)/i.test(t)) {
    return 'FR';
  }
  if (/(rear[_-\s]*left|back[_-\s]*left|tras[_-\s]*izq|(?:^|[_-\s])rl(?:$|[_-\s\d])|wheel[_-\s]*rl)/i.test(t)) {
    return 'RL';
  }
  if (/(rear[_-\s]*right|back[_-\s]*right|tras[_-\s]*der|(?:^|[_-\s])rr(?:$|[_-\s\d])|wheel[_-\s]*rr)/i.test(t)) {
    return 'RR';
  }
  return null;
}

function extractCompactSubGeometry(
  srcGeo: THREE.BufferGeometry,
  triIndices: number[],
): THREE.BufferGeometry {
  const dstGeo = new THREE.BufferGeometry();
  const oldToNew = new Map<number, number>();
  const remappedIndices = new Uint32Array(triIndices.length);
  const uniqueOldIndices: number[] = [];

  for (let i = 0; i < triIndices.length; i++) {
    const oldIdx = triIndices[i];
    let newIdx = oldToNew.get(oldIdx);
    if (newIdx === undefined) {
      newIdx = uniqueOldIndices.length;
      oldToNew.set(oldIdx, newIdx);
      uniqueOldIndices.push(oldIdx);
    }
    remappedIndices[i] = newIdx;
  }

  const newVertexCount = uniqueOldIndices.length;
  for (const [attrName, rawAttr] of Object.entries(srcGeo.attributes)) {
    if (!(rawAttr instanceof THREE.BufferAttribute)) continue;
    const itemSize = rawAttr.itemSize;
    const ArrayCtor = rawAttr.array.constructor as {
      new (length: number): Float32Array | Uint16Array | Uint8Array | Int16Array | Int8Array | Uint32Array;
    };
    const nextArray = new ArrayCtor(newVertexCount * itemSize);
    for (let newIdx = 0; newIdx < newVertexCount; newIdx++) {
      const oldIdx = uniqueOldIndices[newIdx];
      const srcBase = oldIdx * itemSize;
      const dstBase = newIdx * itemSize;
      for (let c = 0; c < itemSize; c++) {
        nextArray[dstBase + c] = rawAttr.array[srcBase + c];
      }
    }
    const nextAttr = new THREE.BufferAttribute(nextArray, itemSize, rawAttr.normalized);
    dstGeo.setAttribute(attrName, nextAttr);
  }

  dstGeo.setIndex(
    newVertexCount <= 65535
      ? new THREE.BufferAttribute(new Uint16Array(remappedIndices), 1)
      : new THREE.BufferAttribute(remappedIndices, 1),
  );
  dstGeo.computeBoundingBox();
  dstGeo.computeBoundingSphere();
  return dstGeo;
}

/**
 * Intenta separar de forma limpia y segura las 4 ruedas de un `.glb` de malla única (`meshCount === 1`)
 * particionando su `BufferGeometry` por regiones cilíndricas en los 4 apoyos inferiores sobre el asfalto.
 * Solo aplica la separación si las 4 esquinas contienen suficientes triángulos simétricos reales de rueda.
 */
function trySeparateSingleMeshWheels(
  singleMesh: THREE.Mesh,
  modelContainer: THREE.Group,
  disposables: { geometries: THREE.BufferGeometry[]; materials: THREE.Material[] },
): PartCandidate[] | null {
  const srcGeo = singleMesh.geometry;
  if (!srcGeo || !srcGeo.attributes.position) return null;

  const posAttr = srcGeo.attributes.position as THREE.BufferAttribute;
  const vertexCount = posAttr.count;
  const indexAttr = srcGeo.getIndex();
  const totalTriangles = indexAttr ? Math.floor(indexAttr.count / 3) : Math.floor(vertexCount / 3);

  // Evitar tocar primitivas simples de prueba (cubos, planos, cajas pequeñas)
  if (totalTriangles < 800 || vertexCount < 400) return null;

  const meshBox = computeBoxInAncestorSpace(singleMesh, modelContainer);
  if (!meshBox) return null;

  const basis = resolveLocalVehicleBasis(singleMesh, modelContainer);
  srcGeo.computeBoundingBox();
  const localBox = srcGeo.boundingBox;
  if (!localBox) return null;

  const v = new THREE.Vector3();
  let minF = Infinity;
  let maxF = -Infinity;
  let minL = Infinity;
  let maxL = -Infinity;
  let minU = Infinity;
  let maxU = -Infinity;

  const sampleStep = Math.max(1, Math.floor(vertexCount / 6000));
  for (let i = 0; i < vertexCount; i += sampleStep) {
    v.fromBufferAttribute(posAttr, i);
    const f = v.dot(basis.localForward);
    const l = v.dot(basis.localLeft);
    const u = v.dot(basis.localUp);
    if (f < minF) minF = f;
    if (f > maxF) maxF = f;
    if (l < minL) minL = l;
    if (l > maxL) maxL = l;
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
  }

  const rawLength = maxF - minF;
  const rawWidth = maxL - minL;
  const rawHeight = maxU - minU;
  if (rawLength <= 0.02 || rawWidth <= 0.01 || rawHeight <= 0.01) return null;

  const midF = (minF + maxF) * 0.5;
  const midL = (minL + maxL) * 0.5;
  const contactMaxU = minU + rawHeight * 0.11;

  const contactPatch: Record<WheelCornerId, { fs: number[]; ls: number[] }> = {
    FL: { fs: [], ls: [] },
    FR: { fs: [], ls: [] },
    RL: { fs: [], ls: [] },
    RR: { fs: [], ls: [] },
  };

  for (let i = 0; i < vertexCount; i++) {
    v.fromBufferAttribute(posAttr, i);
    const u = v.dot(basis.localUp);
    if (u > contactMaxU) continue;
    const f = v.dot(basis.localForward);
    const l = v.dot(basis.localLeft);
    if (Math.abs(l - midL) < rawWidth * 0.22 || Math.abs(f - midF) < rawLength * 0.14) continue;
    const key: WheelCornerId = f >= midF ? (l >= midL ? 'FL' : 'FR') : l >= midL ? 'RL' : 'RR';
    contactPatch[key].fs.push(f);
    contactPatch[key].ls.push(l);
  }

  if (WHEEL_CORNER_IDS.some((k) => contactPatch[k].fs.length < 12)) {
    return null;
  }

  const mean = (arr: number[]) => arr.reduce((acc, n) => acc + n, 0) / arr.length;
  const rRaw = THREE.MathUtils.clamp(rawHeight * 0.182, rawLength * 0.062, rawLength * 0.105);
  const wheelCenterU = minU + rRaw;
  const minOuterAbsL = rawWidth * 0.285;

  const centers: Record<WheelCornerId, { f: number; l: number; u: number }> = {
    FL: { f: mean(contactPatch.FL.fs), l: mean(contactPatch.FL.ls), u: wheelCenterU },
    FR: { f: mean(contactPatch.FR.fs), l: mean(contactPatch.FR.ls), u: wheelCenterU },
    RL: { f: mean(contactPatch.RL.fs), l: mean(contactPatch.RL.ls), u: wheelCenterU },
    RR: { f: mean(contactPatch.RR.fs), l: mean(contactPatch.RR.ls), u: wheelCenterU },
  };

  const bodyTriIndices: number[] = [];
  const wheelTriIndices: Record<WheelCornerId, number[]> = {
    FL: [],
    FR: [],
    RL: [],
    RR: [],
  };

  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const vc = new THREE.Vector3();
  const centroid = new THREE.Vector3();
  const captureRadius = rRaw * 1.015;

  for (let t = 0; t < totalTriangles; t++) {
    const ia = indexAttr ? indexAttr.getX(t * 3) : t * 3;
    const ib = indexAttr ? indexAttr.getX(t * 3 + 1) : t * 3 + 1;
    const ic = indexAttr ? indexAttr.getX(t * 3 + 2) : t * 3 + 2;

    va.fromBufferAttribute(posAttr, ia);
    vb.fromBufferAttribute(posAttr, ib);
    vc.fromBufferAttribute(posAttr, ic);
    centroid.copy(va).add(vb).add(vc).multiplyScalar(1 / 3);

    const cf = centroid.dot(basis.localForward);
    const cl = centroid.dot(basis.localLeft);
    const cu = centroid.dot(basis.localUp);

    let assigned: WheelCornerId | null = null;
    if (Math.abs(cl - midL) >= minOuterAbsL && cu <= minU + rRaw * 2.04) {
      const candidateKey: WheelCornerId =
        cf >= midF ? (cl >= midL ? 'FL' : 'FR') : cl >= midL ? 'RL' : 'RR';
      const ctr = centers[candidateKey];
      if (Math.hypot(cf - ctr.f, cu - ctr.u) <= captureRadius) {
        assigned = candidateKey;
      }
    }

    if (assigned) {
      wheelTriIndices[assigned].push(ia, ib, ic);
    } else {
      bodyTriIndices.push(ia, ib, ic);
    }
  }

  const minWheelTriangles = 80;
  if (
    WHEEL_CORNER_IDS.some((k) => wheelTriIndices[k].length / 3 < minWheelTriangles) ||
    bodyTriIndices.length / 3 < totalTriangles * 0.25
  ) {
    return null;
  }

  const parentObj = singleMesh.parent || modelContainer;

  // Actualizar la malla principal con vértices compactados exclusivamente para la carrocería
  const bodyGeo = extractCompactSubGeometry(srcGeo, bodyTriIndices);
  disposables.geometries.push(bodyGeo);
  singleMesh.geometry = bodyGeo;
  singleMesh.name = singleMesh.name || 'separated_vehicle_body';

  // Agregar guardaplast interior mate oscuro en los 4 pasarruedas para cubrir el hueco al girar dirección
  const linerMat = new THREE.MeshStandardMaterial({
    color: '#090c12',
    roughness: 0.94,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
  disposables.materials.push(linerMat);

  const linerWidth = rawWidth * 0.16;
  const linerRadius = rRaw * 0.96;
  const linerGeo = new THREE.CylinderGeometry(
    linerRadius,
    linerRadius,
    linerWidth,
    20,
    1,
    false,
    0,
    Math.PI * 2,
  );
  const qCyl = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), basis.localLeft);
  linerGeo.applyQuaternion(qCyl);
  disposables.geometries.push(linerGeo);

  for (const k of WHEEL_CORNER_IDS) {
    const ctr = centers[k];
    const sideSign = k.endsWith('L') ? 1 : -1;
    const inwardL = ctr.l - sideSign * (rawWidth * 0.055);
    const linerPos = new THREE.Vector3()
      .addScaledVector(basis.localForward, ctr.f)
      .addScaledVector(basis.localLeft, inwardL)
      .addScaledVector(basis.localUp, ctr.u);
    const linerMesh = new THREE.Mesh(linerGeo, linerMat);
    linerMesh.name = `WheelWellLiner_${k}`;
    linerMesh.position.copy(linerPos);
    linerMesh.castShadow = false;
    linerMesh.receiveShadow = true;
    singleMesh.add(linerMesh);
  }

  // Crear las 4 sub-mallas reales de rueda con geometría compacta propia, preservando UV y material del GLB
  const extractedParts: PartCandidate[] = [];
  for (const k of WHEEL_CORNER_IDS) {
    const wGeo = extractCompactSubGeometry(srcGeo, wheelTriIndices[k]);
    disposables.geometries.push(wGeo);

    const wMesh = new THREE.Mesh(wGeo, singleMesh.material);
    wMesh.name = `SeparatedWheel_${k}`;
    wMesh.position.copy(singleMesh.position);
    wMesh.quaternion.copy(singleMesh.quaternion);
    wMesh.scale.copy(singleMesh.scale);
    wMesh.castShadow = true;
    wMesh.receiveShadow = true;
    parentObj.add(wMesh);

    const boxInContainer = computeBoxInAncestorSpace(wMesh, modelContainer);
    if (boxInContainer) {
      extractedParts.push({
        mesh: wMesh,
        box: boxInContainer,
        center: boxInContainer.getCenter(new THREE.Vector3()),
      });
    }
  }

  return extractedParts.length === 4 ? extractedParts : null;
}

export function createVehicleWheelRig(
  modelContainer: THREE.Group,
  worldScale: number,
): VehicleWheelRig | null {
  const safeWorldScale = Math.max(1e-4, worldScale);
  const disposables = {
    geometries: [] as THREE.BufferGeometry[],
    materials: [] as THREE.Material[],
  };
  let detectedMode: WheelRigMode = 'native_nodes';
  const parts: PartCandidate[] = [];

  // Etapa 1A: Nodos o grupos jerárquicos explícitamente nombrados (`Wheel_FL`, `wheel_*`, `rueda_*`, multi-primitiva)
  const visitedMeshes = new Set<THREE.Mesh>();
  modelContainer.traverse((object) => {
    if (object === modelContainer) return;
    const label = `${object.name || ''}`;
    if (!NAMED_WHEEL_NODE_PATTERN.test(label) || BODY_OR_INTERIOR_EXCLUDE_PATTERN.test(label)) {
      return;
    }
    object.traverse((sub) => {
      const mesh = sub as THREE.Mesh;
      if (!mesh.isMesh || visitedMeshes.has(mesh)) return;
      if (BODY_OR_INTERIOR_EXCLUDE_PATTERN.test(mesh.name || '')) return;
      const box = computeBoxInAncestorSpace(mesh, modelContainer);
      if (!box) return;
      visitedMeshes.add(mesh);
      parts.push({
        mesh,
        box,
        center: box.getCenter(new THREE.Vector3()),
      });
    });
  });

  // Etapa 1B / Etapa 2: Segmentación multi-pieza Meshy (`model_part0..N`) o multi-malla geométrica (`>= 5` mallas),
  // o Etapa 3: separación segura en malla única (`=== 1`).
  // Nota: En algunos GLB (p. ej. `lamborghini-bonus.glb`), `model_part0` es una rueda y `model_part1` es la carrocería,
  // además de existir alerones (`model_part5`). Por eso descartamos siempre la malla de mayor volumen (carrocería)
  // y cualquier pieza central/superior (alerón, techo, paragolpes) que cruce el eje longitudinal o esté elevada.
  if (parts.length < 4) {
    parts.length = 0;
    const allMeshes: { mesh: THREE.Mesh; box: THREE.Box3; volume: number; label: string }[] = [];
    modelContainer.traverse((object) => {
      if (!(object as THREE.Mesh).isMesh) return;
      const mesh = object as THREE.Mesh;
      const box = computeBoxInAncestorSpace(mesh, modelContainer);
      if (!box) return;
      const sz = box.getSize(new THREE.Vector3());
      const volume = Math.max(0, sz.x * sz.y * sz.z);
      const label = `${mesh.name} ${mesh.parent?.name || ''}`;
      allMeshes.push({ mesh, box, volume, label });
    });

    if (allMeshes.length >= 5) {
      const fullBounds = new THREE.Box3().makeEmpty();
      allMeshes.forEach((m) => fullBounds.union(m.box));
      const fullSize = fullBounds.getSize(new THREE.Vector3());
      const fullHeight = Math.max(1e-4, fullSize.y);
      const containerBasis = resolveLocalVehicleBasis(modelContainer, modelContainer);
      const fullWidthAxis = Math.max(
        1e-4,
        Math.abs(containerBasis.localLeft.x) * fullSize.x +
          Math.abs(containerBasis.localLeft.y) * fullSize.y +
          Math.abs(containerBasis.localLeft.z) * fullSize.z,
      );
      const maxWheelCenterY = fullBounds.min.y + fullHeight * 0.58;
      const maxWheelBottomY = fullBounds.min.y + fullHeight * 0.26;

      const sortedByVolume = [...allMeshes].sort((a, b) => b.volume - a.volume);
      const largestBody = sortedByVolume[0];
      for (const item of sortedByVolume.slice(1)) {
        const c = item.box.getCenter(new THREE.Vector3());
        const itemSize = item.box.getSize(new THREE.Vector3());
        const itemLateralSpan =
          Math.abs(containerBasis.localLeft.x) * itemSize.x +
          Math.abs(containerBasis.localLeft.y) * itemSize.y +
          Math.abs(containerBasis.localLeft.z) * itemSize.z;
        const isCentrallySpanningPart = itemLateralSpan > fullWidthAxis * 0.48;
        if (
          item !== largestBody &&
          !BODY_OR_INTERIOR_EXCLUDE_PATTERN.test(item.label) &&
          c.y <= maxWheelCenterY &&
          item.box.min.y <= maxWheelBottomY &&
          !isCentrallySpanningPart
        ) {
          parts.push({
            mesh: item.mesh,
            box: item.box,
            center: c,
          });
        }
      }
    } else if (allMeshes.length === 1) {
      const separated = trySeparateSingleMeshWheels(
        allMeshes[0].mesh,
        modelContainer,
        disposables,
      );
      if (separated && separated.length >= 4) {
        detectedMode = 'separated_submesh';
        parts.push(...separated);
      }
    }
  }

  if (parts.length < 4) {
    return null;
  }

  const sharedParent = parts[0].mesh.parent;
  const allShareSameParent = Boolean(
    sharedParent && parts.every((p) => p.mesh.parent === sharedParent),
  );
  const root: THREE.Object3D = allShareSameParent && sharedParent ? sharedParent : modelContainer;

  if (!allShareSameParent) {
    for (const part of parts) {
      const recomputed = computeBoxInAncestorSpace(part.mesh, root);
      if (recomputed) {
        part.box = recomputed;
        part.center = recomputed.getCenter(new THREE.Vector3());
      }
    }
  }

  const basis = resolveLocalVehicleBasis(root, modelContainer);

  const forwardCoords = parts.map((p) => p.center.dot(basis.localForward)).sort((a, b) => a - b);
  const leftCoords = parts.map((p) => p.center.dot(basis.localLeft)).sort((a, b) => a - b);
  const midForward = (forwardCoords[0] + forwardCoords[forwardCoords.length - 1]) * 0.5;
  const midLeft = (leftCoords[0] + leftCoords[leftCoords.length - 1]) * 0.5;

  const clusters = new Map<WheelCornerId, PartCandidate[]>();
  for (const part of parts) {
    const hint = parseExplicitCornerHint(
      `${part.mesh.name || ''} ${part.mesh.parent?.name || ''}`,
    );
    const fCoord = part.center.dot(basis.localForward);
    const lCoord = part.center.dot(basis.localLeft);
    // Usar siempre la posición geométrica real en espacio vehículo para garantizar coherencia izq/der y frente/zaga,
    // empleando el nombre explícito únicamente cuando el centro coincide con la mediana.
    const isFront =
      Math.abs(fCoord - midForward) > 1e-5
        ? fCoord > midForward
        : hint
          ? hint.startsWith('F')
          : fCoord >= midForward;
    const isLeft =
      Math.abs(lCoord - midLeft) > 1e-5
        ? lCoord > midLeft
        : hint
          ? hint.endsWith('L')
          : lCoord >= midLeft;
    const key: WheelCornerId = `${isFront ? 'F' : 'R'}${isLeft ? 'L' : 'R'}`;
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key)!.push(part);
  }

  if (WHEEL_CORNER_IDS.some((key) => !clusters.get(key)?.length)) {
    return null;
  }

  const cornerMinVec = new THREE.Vector3();
  const cornerMaxVec = new THREE.Vector3();

  const prepared = WHEEL_CORNER_IDS.map((id) => {
    const members = clusters.get(id)!;
    const bounds = new THREE.Box3().makeEmpty();
    members.forEach((part) => bounds.union(part.box));
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());

    // Proyectar dimensiones de la caja sobre los ejes vehículo (largo, alto, ancho de neumático)
    cornerMinVec.copy(bounds.min);
    cornerMaxVec.copy(bounds.max);
    const diameterAxis = Math.abs(
      Math.abs(basis.localForward.x) * size.x +
        Math.abs(basis.localForward.y) * size.y +
        Math.abs(basis.localForward.z) * size.z,
    );
    const heightAxis = Math.abs(
      Math.abs(basis.localUp.x) * size.x +
        Math.abs(basis.localUp.y) * size.y +
        Math.abs(basis.localUp.z) * size.z,
    );
    const widthAxis = Math.abs(
      Math.abs(basis.localLeft.x) * size.x +
        Math.abs(basis.localLeft.y) * size.y +
        Math.abs(basis.localLeft.z) * size.z,
    );

    const aspectRatio = heightAxis > 1e-5 ? diameterAxis / heightAxis : 0;
    const valid =
      diameterAxis > 0.004 &&
      heightAxis > 0.004 &&
      widthAxis > 0.001 &&
      aspectRatio > 0.52 &&
      aspectRatio < 1.75 &&
      widthAxis < Math.max(diameterAxis, heightAxis) * 1.15;

    return { id, members, center, diameterAxis, heightAxis, valid };
  });

  if (prepared.some((group) => !group.valid)) {
    return null;
  }

  const wheels: WheelRuntimeNode[] = [];
  for (const group of prepared) {
    const steering = new THREE.Group();
    steering.name = `SteeringPivot_${group.id}`;
    steering.position.copy(group.center);

    const rolling = new THREE.Group();
    rolling.name = `RollingPivot_${group.id}`;
    root.add(steering);
    steering.add(rolling);

    for (const { mesh } of group.members) {
      if (allShareSameParent) {
        rolling.add(mesh);
        mesh.position.sub(group.center);
      } else {
        root.updateWorldMatrix(true, true);
        rolling.attach(mesh);
      }
    }

    const radiusMeters = Math.max(
      0.16,
      (group.diameterAxis + group.heightAxis) * 0.25 * safeWorldScale,
    );
    const worldX = group.center.dot(basis.localLeft) * safeWorldScale;
    const worldZ = group.center.dot(basis.localForward) * safeWorldScale;

    wheels.push({
      id: group.id,
      front: group.id.startsWith('F'),
      steering,
      rolling,
      radiusMeters,
      initialPivotY: group.center.y,
      worldX,
      worldZ,
      rollAngleRad: 0,
      steerAngleRad: 0,
    });
  }

  const avgWheelRadiusMeters =
    wheels.reduce((acc, w) => acc + w.radiusMeters, 0) / Math.max(1, wheels.length);

  return {
    wheelCount: wheels.length,
    mode: detectedMode,
    wheelRadiusMeters: avgWheelRadiusMeters,
    hasFrontSteering: wheels.some((w) => w.front),
    setDistanceMeters(distanceMeters: number) {
      const safeDist = Number.isFinite(distanceMeters) ? distanceMeters : 0;
      for (const wheel of wheels) {
        const angleRad = safeDist / wheel.radiusMeters;
        wheel.rollAngleRad = angleRad;
        wheel.rolling.quaternion.setFromAxisAngle(basis.localRollAxis, angleRad);
      }
    },
    setSteeringRadians(angle: number, deltaSeconds: number) {
      const safeAngle = Number.isFinite(angle) ? angle : 0;
      const target = THREE.MathUtils.clamp(safeAngle, -Math.PI / 6, Math.PI / 6);
      const dt = Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds : 0);
      for (const wheel of wheels) {
        const goal = wheel.front ? target : 0;
        const nextSteer =
          dt >= 0.99
            ? goal
            : THREE.MathUtils.damp(wheel.steerAngleRad, goal, 14, dt);
        wheel.steerAngleRad = Math.abs(nextSteer) < 1e-5 ? 0 : nextSteer;
        wheel.steering.quaternion.setFromAxisAngle(basis.localUp, wheel.steerAngleRad);
      }
    },
    setSuspensionContact(road, heaveM, pitchRad, rollRad, dt) {
      const dtSafe = Math.max(0, Number.isFinite(dt) ? dt : 0);
      for (const wheel of wheels) {
        const bodyTiltAtWheel = -pitchRad * wheel.worldZ + rollRad * wheel.worldX;
        const worldShift = THREE.MathUtils.clamp(
          road[wheel.id] - heaveM - bodyTiltAtWheel,
          -0.24,
          0.24,
        );
        wheel.steering.position.y = THREE.MathUtils.damp(
          wheel.steering.position.y,
          wheel.initialPivotY + worldShift / safeWorldScale,
          22,
          dtSafe,
        );
      }
    },
    getWheelStates() {
      return wheels.map((w) => ({
        id: w.id,
        front: w.front,
        rollAngleRad: w.rollAngleRad,
        steerAngleRad: w.steerAngleRad,
        radiusMeters: w.radiusMeters,
        pivotY: w.steering.position.y,
        steeringPivot: w.steering,
        rollingPivot: w.rolling,
      }));
    },
    dispose() {
      disposables.geometries.forEach((g) => g.dispose());
      disposables.materials.forEach((m) => m.dispose());
    },
  };
}
