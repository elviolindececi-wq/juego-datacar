import * as THREE from 'three';

/**
 * Ruedas independientes para GLB segmentados (Meshy `model_part0..N` o Blender `wheel_*` / multi-malla).
 *
 * - Meshy: 1 carrocería (`model_part0`) + 4 o más subpiezas de rueda (`model_part1..N`).
 * - Blender / Exportación estándar: mallas con nombre `wheel*`, `rueda*`, `tire*`, `llanta*`, `rim*`
 *   o bien >= 5 mallas donde la mayor en volumen es la carrocería y las esquinas inferiores son las 4 ruedas.
 *
 * En lugar de asumir cinco mallas exactas, reunimos los subcomponentes por el centro
 * físico de rueda: adelante/atrás (X), izquierda/derecha (Z).
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
}

type Wheel = {
  steering: THREE.Group;
  rolling: THREE.Group;
  radiusMeters: number;
  initialPivotY: number;
  worldX: number;
  worldZ: number;
  front: boolean;
  id: string;
};

type Part = {
  mesh: THREE.Mesh;
  center: THREE.Vector3;
  box: THREE.Box3;
};

function computeBoxInAncestorSpace(mesh: THREE.Mesh, ancestor: THREE.Object3D): THREE.Box3 | null {
  mesh.geometry.computeBoundingBox();
  const localBox = mesh.geometry.boundingBox;
  if (!localBox) return null;

  if (mesh.parent === ancestor && mesh.position.lengthSq() === 0 && mesh.rotation.x === 0 && mesh.rotation.y === 0 && mesh.rotation.z === 0 && mesh.scale.x === 1 && mesh.scale.y === 1 && mesh.scale.z === 1) {
    return localBox.clone();
  }

  ancestor.updateWorldMatrix(true, true);
  const invAncestor = new THREE.Matrix4().copy(ancestor.matrixWorld).invert();
  const relMatrix = new THREE.Matrix4().multiplyMatrices(invAncestor, mesh.matrixWorld);
  return localBox.clone().applyMatrix4(relMatrix);
}

export function createVehicleWheelRig(
  modelContainer: THREE.Group,
  worldScale: number,
): VehicleWheelRig | null {
  const parts: Part[] = [];

  // 1. Camino primario original: nomenclatura Meshy (`model_part1..N`, excluyendo carrocería `model_part0`)
  modelContainer.traverse((object) => {
    if (
      !(object as THREE.Mesh).isMesh ||
      !/^model_part\d+$/.test(object.name) ||
      object.name === 'model_part0'
    ) {
      return;
    }
    const mesh = object as THREE.Mesh;
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox?.clone();
    if (!box) return;
    parts.push({ mesh, box, center: box.getCenter(new THREE.Vector3()) });
  });

  // 2. Respaldo universal para splits hechos en Blender / otros flujos (`wheel_*`, `rueda_*` o >=5 mallas)
  if (parts.length < 4) {
    parts.length = 0;
    const namedWheelPattern = /(wheel|rueda|tire|tyre|neumatico|llanta|rim|front_left|front_right|rear_left|rear_right|_fl\b|_fr\b|_rl\b|_rr\b)/i;
    const bodyExcludePattern = /(body|chassis|carroceria|car_body|glass|vidrio|interior|mirror|light|faro)/i;

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

    const explicitlyNamed = allMeshes.filter(
      (m) => namedWheelPattern.test(m.label) && !bodyExcludePattern.test(m.label),
    );

    if (explicitlyNamed.length >= 4) {
      for (const item of explicitlyNamed) {
        parts.push({
          mesh: item.mesh,
          box: item.box,
          center: item.box.getCenter(new THREE.Vector3()),
        });
      }
    } else if (allMeshes.length >= 5) {
      const sortedByVolume = [...allMeshes].sort((a, b) => b.volume - a.volume);
      const largestBody = sortedByVolume[0];
      for (const item of sortedByVolume.slice(1)) {
        if (item !== largestBody && !bodyExcludePattern.test(item.label)) {
          parts.push({
            mesh: item.mesh,
            box: item.box,
            center: item.box.getCenter(new THREE.Vector3()),
          });
        }
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

  // Si provienen de nodos padres distintos en Blender, recalcular cajas en el espacio común de `root`
  if (!allShareSameParent) {
    for (const part of parts) {
      const recomputed = computeBoxInAncestorSpace(part.mesh, root);
      if (recomputed) {
        part.box = recomputed;
        part.center = recomputed.getCenter(new THREE.Vector3());
      }
    }
  }

  // Las cuatro ruedas se reconocen por su posición física en las 4 esquinas.
  const sortedX = parts.map((part) => part.center.x).sort((a, b) => a - b);
  const sortedZ = parts.map((part) => part.center.z).sort((a, b) => a - b);
  const longitudinalSplit = (sortedX[0] + sortedX[sortedX.length - 1]) * 0.5;
  const lateralSplit = (sortedZ[0] + sortedZ[sortedZ.length - 1]) * 0.5;

  // Detectar si el eje longitudinal del GLB es X (Meshy) o Z (Blender estándar)
  const spanX = sortedX[sortedX.length - 1] - sortedX[0];
  const spanZ = sortedZ[sortedZ.length - 1] - sortedZ[0];
  const isXLongitudinal = spanX >= spanZ;

  const clusters = new Map<string, Part[]>();
  for (const part of parts) {
    const front = isXLongitudinal
      ? part.center.x < longitudinalSplit
      : part.center.z > lateralSplit;
    const side = isXLongitudinal
      ? part.center.z > lateralSplit
        ? 'L'
        : 'R'
      : part.center.x > longitudinalSplit
        ? 'L'
        : 'R';
    const key = `${front ? 'F' : 'R'}${side}`;
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key)!.push(part);
  }

  const keys = ['FL', 'FR', 'RL', 'RR'];
  if (keys.some((key) => !clusters.get(key)?.length)) {
    return null;
  }

  const prepared = keys.map((id) => {
    const members = clusters.get(id)!;
    const bounds = new THREE.Box3().makeEmpty();
    members.forEach((part) => bounds.union(part.box));
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const diameterAxis = isXLongitudinal ? size.x : size.z;
    const widthAxis = isXLongitudinal ? size.z : size.x;
    const valid =
      diameterAxis > 0.005 &&
      size.y > 0.005 &&
      widthAxis > 0 &&
      diameterAxis / size.y > 0.62 &&
      diameterAxis / size.y < 1.5 &&
      widthAxis < diameterAxis * 0.9;
    return { id, members, center, size, valid, diameterAxis };
  });

  if (prepared.some((group) => !group.valid)) {
    return null;
  }

  const wheels: Wheel[] = [];
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

    const radiusMeters = (group.diameterAxis + group.size.y) * 0.25 * worldScale;
    wheels.push({
      steering,
      rolling,
      radiusMeters,
      initialPivotY: group.center.y,
      worldX: (isXLongitudinal ? group.center.z : group.center.x) * worldScale,
      worldZ: (isXLongitudinal ? -group.center.x : group.center.z) * worldScale,
      front: group.id.startsWith('F'),
      id: group.id,
    });
  }

  return {
    wheelCount: wheels.length,
    setDistanceMeters(distanceMeters: number) {
      for (const wheel of wheels) {
        if (isXLongitudinal) {
          wheel.rolling.rotation.z = -distanceMeters / wheel.radiusMeters;
        } else {
          wheel.rolling.rotation.x = distanceMeters / wheel.radiusMeters;
        }
      }
    },
    setSuspensionContact(road, heaveM, pitchRad, rollRad, dt) {
      for (const wheel of wheels) {
        const bodyTiltAtWheel = -pitchRad * wheel.worldZ + rollRad * wheel.worldX;
        const worldShift = THREE.MathUtils.clamp(
          road[wheel.id as keyof typeof road] - heaveM - bodyTiltAtWheel,
          -0.24,
          0.24,
        );
        wheel.steering.position.y = THREE.MathUtils.damp(
          wheel.steering.position.y,
          wheel.initialPivotY + worldShift / worldScale,
          22,
          Math.max(0, dt),
        );
      }
    },
    setSteeringRadians(angle: number, deltaSeconds: number) {
      const target = THREE.MathUtils.clamp(angle, -Math.PI / 6, Math.PI / 6);
      for (const wheel of wheels) {
        wheel.steering.rotation.y = THREE.MathUtils.damp(
          wheel.steering.rotation.y,
          wheel.front ? target : 0,
          12,
          Math.max(0, deltaSeconds),
        );
      }
    },
  };
}
