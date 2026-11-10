import * as THREE from 'three';

/**
 * Ruedas independientes para GLB de Meshy.
 *
 * Tracker: 1 carrocería + 4 mallas de rueda.
 * Corolla Cross: 1 carrocería + 7 SUBPIEZAS distribuidas en 4 ruedas.
 * En lugar de asumir cinco mallas, reunimos los subcomponentes por el centro
 * físico de rueda: adelante/atrás (X), izquierda/derecha (Z).
 *
 * Ejes originales de ambos modelos Meshy: X longitudinal (frente = -X),
 * Y vertical y Z como eje de rodadura. Todos los pivotes se crean en Three.js
 * sin tocar la geometría, UVs ni materiales del GLB.
 */
export interface VehicleWheelRig {
  setDistanceMeters(distanceMeters: number): void;
  setSteeringRadians(angle: number, deltaSeconds: number): void;
  setSuspensionContact(road: { FL: number; FR: number; RL: number; RR: number }, heaveM: number, pitchRad: number, rollRad: number, dt: number): void;
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

export function createVehicleWheelRig(modelContainer: THREE.Group, worldScale: number): VehicleWheelRig | null {
  const parts: Part[] = [];
  modelContainer.traverse((object) => {
    if (!(object as THREE.Mesh).isMesh || !/^model_part\d+$/.test(object.name) || object.name === 'model_part0') return;
    const mesh = object as THREE.Mesh;
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox?.clone();
    if (!box) return;
    parts.push({ mesh, box, center: box.getCenter(new THREE.Vector3()) });
  });

  if (parts.length < 4) {
    console.warn('[DATACAR] No hay suficientes subpiezas para formar cuatro ruedas.', parts.map(p => p.mesh.name));
    return null;
  }
  const root = parts[0].mesh.parent;
  if (!root || parts.some(p => p.mesh.parent !== root)) {
    console.warn('[DATACAR] Las ruedas deben compartir el mismo nodo padre para una rotación segura.');
    return null;
  }

  // Las cuatro ruedas se reconocen por su posición, NO por los índices de Meshy.
  const sortedX = parts.map(part => part.center.x).sort((a, b) => a - b);
  const sortedZ = parts.map(part => part.center.z).sort((a, b) => a - b);
  const longitudinalSplit = (sortedX[0] + sortedX[sortedX.length - 1]) * 0.5;
  const lateralSplit = (sortedZ[0] + sortedZ[sortedZ.length - 1]) * 0.5;
  const clusters = new Map<string, Part[]>();
  for (const part of parts) {
    const front = part.center.x < longitudinalSplit;
    const side = part.center.z > lateralSplit ? 'L' : 'R';
    const key = `${front ? 'F' : 'R'}${side}`;
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key)!.push(part);
  }

  const keys = ['FL', 'FR', 'RL', 'RR'];
  if (keys.some(key => !clusters.get(key)?.length)) {
    console.warn('[DATACAR] No se pudieron encontrar las cuatro posiciones de rueda.', [...clusters.keys()]);
    return null;
  }

  const prepared = keys.map(id => {
    const members = clusters.get(id)!;
    const bounds = new THREE.Box3().makeEmpty();
    members.forEach(part => bounds.union(part.box));
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const valid = size.x > 0.005 && size.y > 0.005 && size.z > 0 &&
      size.x / size.y > 0.65 && size.x / size.y < 1.45 && size.z < size.x * 0.85;
    return { id, members, center, size, valid };
  });

  if (prepared.some(group => !group.valid)) {
    console.warn('[DATACAR] Segmentación incompleta: al menos una rueda tiene dimensiones inverosímiles.',
      prepared.map(g => ({ id: g.id, parts: g.members.map(m => m.mesh.name), size: g.size.toArray() })));
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
      // Los vértices del GLB ya vienen en coordenadas ensambladas.
      // Pasar las piezas al pivote y compensar el centro preserva su posición.
      rolling.add(mesh);
      mesh.position.sub(group.center);
    }
    const radiusMeters = (group.size.x + group.size.y) * 0.25 * worldScale;
    wheels.push({ steering, rolling, radiusMeters, initialPivotY: group.center.y,
      worldX: group.center.z * worldScale, worldZ: -group.center.x * worldScale,
      front: group.id.startsWith('F'), id: group.id });
  }

  console.info('[DATACAR] Cuatro ruedas animables:', prepared.map(g =>
    `${g.id}: ${g.members.map(m => m.mesh.name).join('+')}`));

  return {
    wheelCount: wheels.length,
    setDistanceMeters(distanceMeters: number) {
      for (const wheel of wheels) {
        // Forward del modelo = -X, por lo que el avance corresponde a giro -Z.
        // El signo inverso durante marcha atrás sale naturalmente de la distancia.
        wheel.rolling.rotation.z = -distanceMeters / wheel.radiusMeters;
      }
    },
    setSuspensionContact(road, heaveM, pitchRad, rollRad, dt) {
      for (const wheel of wheels) {
        // El modelo Meshy se escala y gira +90°; X local = largo, Z local = ancho.
        // Mantener cada neumático apoyado en la altura que detecta la física.
        const bodyTiltAtWheel = -pitchRad * wheel.worldZ + rollRad * wheel.worldX;
        const worldShift = THREE.MathUtils.clamp(road[wheel.id as keyof typeof road] - heaveM - bodyTiltAtWheel, -.24, .24);
        wheel.steering.position.y = THREE.MathUtils.damp(wheel.steering.position.y,
          wheel.initialPivotY + worldShift / worldScale, 22, Math.max(0, dt));
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
