import * as THREE from 'three';
import type { CurvedRoadPath } from './curvedRoadPath.ts';
import type { TrafficLightNode } from './urbanTrafficRules.ts';
import {
  CENTRAL_MEDIAN_HALF_WIDTH_M,
  CENTRAL_MEDIAN_MIN_ROAD_WIDTH_M,
  CENTRAL_MEDIAN_MODULE_LEN_M,
  computeCentralMedianSpans,
  shouldBuildCentralMedian,
  type CentralMedianEligibilityInput,
  type MedianSpanSegment,
} from './centralMedianCollision.ts';

export {
  CENTRAL_MEDIAN_HALF_WIDTH_M,
  CENTRAL_MEDIAN_MIN_ROAD_WIDTH_M,
  CENTRAL_MEDIAN_MODULE_LEN_M,
  computeCentralMedianSpans,
  shouldBuildCentralMedian,
  type CentralMedianEligibilityInput,
  type MedianSpanSegment,
};

function createWeatheredConcreteTextures(): {
  albedo: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
} {
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = 256;
  albedoCanvas.height = 256;
  const actx = albedoCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 256;
  bumpCanvas.height = 256;
  const bctx = bumpCanvas.getContext('2d');

  if (actx && bctx) {
    actx.fillStyle = '#8b9198';
    actx.fillRect(0, 0, 256, 256);

    bctx.fillStyle = '#808080';
    bctx.fillRect(0, 0, 256, 256);

    // Granulado mineral y desgaste urbano moderado determinista
    let seed = 4177;
    const nextRand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let i = 0; i < 1100; i++) {
      const px = Math.floor(nextRand() * 256);
      const py = Math.floor(nextRand() * 256);
      const sz = 1 + Math.floor(nextRand() * 3);
      const shade = Math.floor(118 + nextRand() * 44);
      actx.fillStyle = `rgb(${shade},${shade + 2},${shade + 5})`;
      actx.fillRect(px, py, sz, sz);

      const bShade = Math.floor(96 + nextRand() * 64);
      bctx.fillStyle = `rgb(${bShade},${bShade},${bShade})`;
      bctx.fillRect(px, py, sz, sz);
    }

    // Desgaste longitudinal de neumáticos / hollín suave en los costados inferiores del cordón
    const edgeWearLeft = actx.createLinearGradient(0, 0, 48, 0);
    edgeWearLeft.addColorStop(0, 'rgba(38, 43, 50, 0.42)');
    edgeWearLeft.addColorStop(1, 'rgba(38, 43, 50, 0)');
    actx.fillStyle = edgeWearLeft;
    actx.fillRect(0, 0, 48, 256);

    const edgeWearRight = actx.createLinearGradient(256, 0, 208, 0);
    edgeWearRight.addColorStop(0, 'rgba(38, 43, 50, 0.42)');
    edgeWearRight.addColorStop(1, 'rgba(38, 43, 50, 0)');
    actx.fillStyle = edgeWearRight;
    actx.fillRect(208, 0, 48, 256);

    // Junta transversal de dilatación de hormigón oscuro en cada módulo
    actx.fillStyle = 'rgba(30, 34, 40, 0.78)';
    actx.fillRect(0, 0, 256, 7);
    actx.fillStyle = 'rgba(198, 205, 214, 0.35)';
    actx.fillRect(0, 7, 256, 3);

    bctx.fillStyle = '#1f1f1f';
    bctx.fillRect(0, 0, 256, 8);
  }

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;
  albedo.anisotropy = 4;

  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;

  return { albedo, bump };
}

function createCurbProfileGeometry(moduleLengthM: number): THREE.BufferGeometry {
  // Perfil transversal con bordillos biselados reales (ancho total 0.84 m, alto 0.19 m)
  const hw = CENTRAL_MEDIAN_HALF_WIDTH_M; // 0.42 m
  const topHw = 0.33;
  const h = 0.19;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.lineTo(-hw, 0.06);
  shape.lineTo(-topHw, h);
  shape.lineTo(topHw, h);
  shape.lineTo(hw, 0.06);
  shape.lineTo(hw, 0);
  shape.closePath();

  const extrude = new THREE.ExtrudeGeometry(shape, {
    depth: moduleLengthM,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 1,
  });
  // Centrar longitudinalmente en [-L/2 .. +L/2] sobre el eje Z local
  extrude.translate(0, 0, -moduleLengthM * 0.5);
  extrude.computeVertexNormals();
  return extrude;
}

export interface CentralMedianVisualsController {
  group: THREE.Group;
  spans: MedianSpanSegment[];
  moduleCount: number;
  dispose: () => void;
}

export function createCentralMedianVisuals3D(args: {
  roadPath: CurvedRoadPath;
  roadWidthM: number;
  trackDistanceMeters: number;
  cityCircuitId?: string;
  routeHazardProfile?: string;
  isDragStrip?: boolean;
  lights: readonly TrafficLightNode[];
  crossingZs?: readonly number[];
  hazardCenters?: ReadonlyArray<{ x: number; z: number; radiusM?: number }>;
}): CentralMedianVisualsController {
  const group = new THREE.Group();
  group.name = 'central_concrete_median_3d';

  const eligible = shouldBuildCentralMedian({
    roadWidthM: args.roadWidthM,
    trackDistanceMeters: args.trackDistanceMeters,
    cityCircuitId: args.cityCircuitId,
    routeHazardProfile: args.routeHazardProfile,
    isDragStrip: args.isDragStrip,
  });

  if (!eligible) {
    return {
      group,
      spans: [],
      moduleCount: 0,
      dispose: () => {},
    };
  }

  const spans = computeCentralMedianSpans({
    trackDistanceMeters: args.trackDistanceMeters,
    lights: args.lights,
    crossingZs: args.crossingZs,
    hazardCenters: args.hazardCenters,
  });

  if (spans.length === 0) {
    return {
      group,
      spans: [],
      moduleCount: 0,
      dispose: () => {},
    };
  }

  const moduleCentersS: number[] = [];
  const noseCaps: Array<{ s: number; dirSign: 1 | -1 }> = [];

  for (const span of spans) {
    const spanLen = span.toS - span.fromS;
    const count = Math.max(1, Math.floor(spanLen / CENTRAL_MEDIAN_MODULE_LEN_M));
    const actualStride = spanLen / count;
    for (let i = 0; i < count; i++) {
      moduleCentersS.push(span.fromS + (i + 0.5) * actualStride);
    }
    noseCaps.push({ s: span.fromS - 0.35, dirSign: -1 });
    noseCaps.push({ s: span.toS + 0.35, dirSign: 1 });
  }

  const { albedo, bump } = createWeatheredConcreteTextures();
  const curbGeo = createCurbProfileGeometry(CENTRAL_MEDIAN_MODULE_LEN_M * 0.985);
  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: albedo,
    bumpMap: bump,
    bumpScale: 0.018,
    roughness: 0.86,
    metalness: 0.06,
  });

  const curbInstanced = new THREE.InstancedMesh(curbGeo, concreteMat, moduleCentersS.length);
  curbInstanced.name = 'concrete_median_modules';
  curbInstanced.castShadow = false;
  curbInstanced.receiveShadow = true;

  // Sombra suave de contacto bajo cada bloque para asentarlo sobre el asfalto (evita aspecto flotante)
  const shadowStripGeo = new THREE.PlaneGeometry(
    CENTRAL_MEDIAN_HALF_WIDTH_M * 2.38,
    CENTRAL_MEDIAN_MODULE_LEN_M * 1.01,
  );
  shadowStripGeo.rotateX(-Math.PI / 2);
  const shadowStripMat = new THREE.MeshBasicMaterial({
    color: 0x05080f,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const shadowInstanced = new THREE.InstancedMesh(
    shadowStripGeo,
    shadowStripMat,
    moduleCentersS.length,
  );
  shadowInstanced.renderOrder = 1;

  // Tachas reflectantes viales (ojo de gato ámbar) cada 3 módulos
  const reflectorIndices: number[] = [];
  for (let i = 0; i < moduleCentersS.length; i += 3) {
    reflectorIndices.push(i);
  }
  const studGeo = new THREE.BoxGeometry(0.14, 0.036, 0.16);
  const studMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.65,
    roughness: 0.28,
    metalness: 0.22,
  });
  const studInstanced = new THREE.InstancedMesh(
    studGeo,
    studMat,
    Math.max(1, reflectorIndices.length),
  );

  // Cabezales ahusados amarillo/negro reflectantes en cada apertura de intersección
  const noseGeo = new THREE.CylinderGeometry(0.24, CENTRAL_MEDIAN_HALF_WIDTH_M, 0.18, 12);
  const noseMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    emissive: 0xca8a04,
    emissiveIntensity: 0.28,
    roughness: 0.46,
    metalness: 0.14,
  });
  const noseInstanced = new THREE.InstancedMesh(
    noseGeo,
    noseMat,
    Math.max(1, noseCaps.length),
  );

  const dummy = new THREE.Object3D();

  for (let i = 0; i < moduleCentersS.length; i++) {
    const s = moduleCentersS[i];
    const pt = args.roadPath.world(s, 0);
    dummy.position.set(pt.x, 0.012, pt.z);
    dummy.rotation.set(0, pt.yaw, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    curbInstanced.setMatrixAt(i, dummy.matrix);

    dummy.position.set(pt.x, 0.016, pt.z);
    dummy.updateMatrix();
    shadowInstanced.setMatrixAt(i, dummy.matrix);
  }

  for (let r = 0; r < reflectorIndices.length; r++) {
    const s = moduleCentersS[reflectorIndices[r]];
    const pt = args.roadPath.world(s, 0);
    dummy.position.set(pt.x, 0.215, pt.z);
    dummy.rotation.set(0, pt.yaw, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    studInstanced.setMatrixAt(r, dummy.matrix);
  }

  for (let n = 0; n < noseCaps.length; n++) {
    const cap = noseCaps[n];
    const pt = args.roadPath.world(cap.s, 0);
    dummy.position.set(pt.x, 0.10, pt.z);
    dummy.rotation.set(0, pt.yaw, 0);
    dummy.scale.set(1, 1, 1.35);
    dummy.updateMatrix();
    noseInstanced.setMatrixAt(n, dummy.matrix);
  }

  curbInstanced.instanceMatrix.needsUpdate = true;
  curbInstanced.computeBoundingSphere();
  shadowInstanced.instanceMatrix.needsUpdate = true;
  shadowInstanced.computeBoundingSphere();
  studInstanced.instanceMatrix.needsUpdate = true;
  studInstanced.computeBoundingSphere();
  noseInstanced.instanceMatrix.needsUpdate = true;
  noseInstanced.computeBoundingSphere();

  group.add(shadowInstanced, curbInstanced, studInstanced, noseInstanced);

  return {
    group,
    spans,
    moduleCount: moduleCentersS.length,
    dispose: () => {
      curbGeo.dispose();
      concreteMat.dispose();
      albedo.dispose();
      bump.dispose();
      shadowStripGeo.dispose();
      shadowStripMat.dispose();
      studGeo.dispose();
      studMat.dispose();
      noseGeo.dispose();
      noseMat.dispose();
    },
  };
}
