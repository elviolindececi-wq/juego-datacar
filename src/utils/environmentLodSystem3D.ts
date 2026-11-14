import * as THREE from 'three';
import type { CurvedRoadPath } from './curvedRoadPath';
import type { PhotorealEnvironmentController } from './nfsmwEnvironmentMaterials';

/**
 * Sistema de Nivel de Detalle basado en distancia a cámara (LOD0 / LOD1 / LOD2)
 * combinado con InstancedMesh de cero asignaciones por cuadro (0 GC) para alcanzar
 * densidad geométrica estilo Need for Speed: Most Wanted (2012) sin caída de FPS:
 * - LOD0 (0 .. 68 m): máxima densidad geométrica frente a cámara (ramas volumétricas,
 *   follaje alpha-clipped con SSS/viento, aisladores cerámicos torneados, torres de alta tensión
 *   reticuladas, guardarrieles perfil W-beam con postes I y muros de contención con contrafuertes).
 * - LOD1 (68 .. 175 m): geometría intermedia equilibrada preservando silueta y materiales PBR.
 * - LOD2 (> 175 m): silueta liviana para mantener horizonte urbano completo con mínimo costo GPU.
 */

export const ENV_LOD0_MAX_DIST_M = 68;
export const ENV_LOD1_MAX_DIST_M = 175;

const LOD0_MAX_DIST_SQ = ENV_LOD0_MAX_DIST_M * ENV_LOD0_MAX_DIST_M;
const LOD1_MAX_DIST_SQ = ENV_LOD1_MAX_DIST_M * ENV_LOD1_MAX_DIST_M;

export interface TreeAnchorSpec {
  s: number;
  lateral: number;
  scale: number;
  colorIndex: number;
}

export interface RoadSpanRange {
  from: number;
  to: number;
}

export interface ParkZoneRange {
  side: number;
  centerX: number;
  centerZ: number;
  spanZ: number;
}

export interface EnvironmentLodBuildOptions {
  halfRoadWidth: number;
  trackEndMeters: number;
  spans: readonly RoadSpanRange[];
  crossingsZ: readonly number[];
  parkZones: readonly ParkZoneRange[];
  paseoSites?: ReadonlyArray<{ z: number; side: -1 | 1 }>;
  treeAnchors: readonly TreeAnchorSpec[];
  envMaterials: PhotorealEnvironmentController;
  hasRiverfront?: boolean;
}

export interface LodTierCounts {
  lod0: number;
  lod1: number;
  lod2: number;
  total: number;
}

export interface EnvironmentLodDiagnostics {
  trees: LodTierCounts;
  utilityPoles: LodTierCounts;
  hvTowers: LodTierCounts;
  guardrails: LodTierCounts;
  retainingWalls: LodTierCounts;
  catenarySegments: number;
  lod0TreeTriangles: number;
  lod2TreeTriangles: number;
}

export interface EnvironmentLodController {
  group: THREE.Group;
  applyRoadPath: (roadPath?: CurvedRoadPath) => void;
  update: (camX: number, camY: number, camZ: number, force?: boolean) => void;
  getDiagnostics: () => EnvironmentLodDiagnostics;
  dispose: () => void;
}

// ---------------------------------------------------------------------------
// Fusión determinista de BufferGeometries estáticas (position + normal + uv)
// ---------------------------------------------------------------------------

function mergeStaticGeometries(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const nonIndexed: THREE.BufferGeometry[] = [];
  let totalVerts = 0;

  for (const raw of parts) {
    const g = raw.index ? raw.toNonIndexed() : raw.clone();
    if (!g.getAttribute('normal')) {
      g.computeVertexNormals();
    }
    const pos = g.getAttribute('position');
    if (!pos || pos.count === 0) {
      g.dispose();
      continue;
    }
    if (!g.getAttribute('uv')) {
      const dummyUv = new Float32Array(pos.count * 2);
      g.setAttribute('uv', new THREE.BufferAttribute(dummyUv, 2));
    }
    totalVerts += pos.count;
    nonIndexed.push(g);
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);

  let vOffset = 0;
  for (const g of nonIndexed) {
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const norm = g.getAttribute('normal') as THREE.BufferAttribute;
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    const count = pos.count;

    for (let i = 0; i < count; i++) {
      const i3 = (vOffset + i) * 3;
      const i2 = (vOffset + i) * 2;
      positions[i3] = pos.getX(i);
      positions[i3 + 1] = pos.getY(i);
      positions[i3 + 2] = pos.getZ(i);

      normals[i3] = norm.getX(i);
      normals[i3 + 1] = norm.getY(i);
      normals[i3 + 2] = norm.getZ(i);

      uvs[i2] = uv.getX(i);
      uvs[i2 + 1] = uv.getY(i);
    }
    vOffset += count;
    g.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  merged.computeBoundingSphere();
  return merged;
}

function makeStrutBetween(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  rBottom: number,
  rTop: number,
  radialSegments: number,
): THREE.BufferGeometry {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const len = Math.hypot(dx, dy, dz) || 0.001;
  const cyl = new THREE.CylinderGeometry(rTop, rBottom, len, radialSegments, 1);
  const dir = new THREE.Vector3(dx / len, dy / len, dz / len);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const mat = new THREE.Matrix4().compose(
    new THREE.Vector3((ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5),
    quat,
    new THREE.Vector3(1, 1, 1),
  );
  cyl.applyMatrix4(mat);
  return cyl;
}

function makeBoxPart(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx !== 0 || ry !== 0 || rz !== 0) {
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'));
    g.applyMatrix4(m);
  }
  g.translate(x, y, z);
  return g;
}

// ---------------------------------------------------------------------------
// 1. VEGETACIÓN DE ALTA DENSIDAD (Ramas volumétricas + Follaje alpha-clipped)
// ---------------------------------------------------------------------------

function buildTreeBarkGeometry(lod: 0 | 1 | 2): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  if (lod === 0) {
    // Raíces acampanadas + tronco en dos tramos + 5 ramas primarias + 8 sub-ramas secundarias
    parts.push(makeStrutBetween(0, -0.05, 0, 0.02, 0.65, 0.01, 0.29, 0.21, 10));
    parts.push(makeStrutBetween(0.02, 0.62, 0.01, -0.03, 2.28, -0.02, 0.21, 0.145, 10));

    const primaryLimbs: Array<[number, number, number, number, number, number, number, number]> = [
      [-0.02, 2.05, -0.01, -0.82, 3.22, 0.52, 0.125, 0.062],
      [-0.02, 2.12, -0.01, 0.78, 3.28, -0.54, 0.12, 0.06],
      [-0.02, 2.18, -0.01, 0.24, 3.45, 0.76, 0.11, 0.055],
      [-0.02, 2.08, -0.01, -0.54, 3.18, -0.68, 0.11, 0.055],
      [-0.03, 2.22, -0.02, 0.08, 3.92, -0.06, 0.115, 0.052],
    ];
    for (const [ax, ay, az, bx, by, bz, rb, rt] of primaryLimbs) {
      parts.push(makeStrutBetween(ax, ay, az, bx, by, bz, rb, rt, 8));
    }

    const secondaryTwigs: Array<[number, number, number, number, number, number]> = [
      [-0.56, 2.86, 0.36, -1.24, 3.56, 0.82],
      [-0.64, 2.96, 0.42, -0.92, 3.88, 0.14],
      [0.54, 2.92, -0.38, 1.18, 3.62, -0.84],
      [0.62, 3.04, -0.44, 0.88, 3.94, 0.18],
      [0.18, 3.08, 0.54, 0.56, 3.74, 1.14],
      [-0.38, 2.88, -0.48, -0.94, 3.58, -1.04],
      [0.05, 3.46, -0.04, -0.38, 4.32, 0.34],
      [0.06, 3.52, -0.04, 0.42, 4.36, -0.32],
    ];
    for (const [ax, ay, az, bx, by, bz] of secondaryTwigs) {
      parts.push(makeStrutBetween(ax, ay, az, bx, by, bz, 0.058, 0.024, 6));
    }
  } else if (lod === 1) {
    parts.push(makeStrutBetween(0, -0.04, 0, 0, 2.28, 0, 0.25, 0.14, 7));
    parts.push(makeStrutBetween(0, 2.08, 0, -0.78, 3.22, 0.48, 0.11, 0.05, 5));
    parts.push(makeStrutBetween(0, 2.12, 0, 0.74, 3.26, -0.50, 0.11, 0.05, 5));
    parts.push(makeStrutBetween(0, 2.16, 0, 0.18, 3.58, 0.64, 0.10, 0.045, 5));
    parts.push(makeStrutBetween(0, 2.10, 0, -0.46, 3.35, -0.60, 0.10, 0.045, 5));
  } else {
    parts.push(makeStrutBetween(0, 0, 0, 0, 2.85, 0, 0.22, 0.12, 4));
  }

  const merged = mergeStaticGeometries(parts);
  parts.forEach((p) => p.dispose());
  return merged;
}

function makeOrganicCanopySubCrown(
  radius: number,
  detail: number,
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number,
  seedPhase: number,
): THREE.BufferGeometry {
  const ico = new THREE.IcosahedronGeometry(radius, detail);
  const pos = ico.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const wave =
      1.0 +
      0.13 * Math.sin(px * 3.1 + seedPhase) * Math.cos(pz * 2.9 - seedPhase * 0.7) +
      0.08 * Math.sin(py * 4.3 + seedPhase * 1.3);
    pos.setXYZ(i, px * sx * wave + cx, py * sy * wave + cy, pz * sz * wave + cz);
  }
  ico.computeVertexNormals();
  return ico;
}

function buildTreeCoreCanopyGeometry(lod: 0 | 1 | 2): THREE.BufferGeometry {
  const detail = lod === 0 ? 1 : lod === 1 ? 1 : 0;
  const lobes: Array<[number, number, number, number, number, number, number]> =
    lod === 0
      ? [
          [1.08, 0.0, 3.92, 0.0, 1.15, 0.86, 1.12],
          [0.94, -0.82, 3.26, 0.52, 1.12, 0.82, 1.06],
          [0.96, 0.78, 3.32, -0.54, 1.10, 0.84, 1.08],
          [0.88, 0.24, 3.18, 0.78, 1.06, 0.78, 1.04],
          [0.86, -0.54, 3.22, -0.68, 1.04, 0.80, 1.02],
          [0.78, 0.06, 4.46, -0.08, 1.02, 0.76, 1.00],
        ]
      : lod === 1
        ? [
            [1.14, 0.0, 3.82, 0.0, 1.16, 0.86, 1.12],
            [0.98, -0.74, 3.22, 0.48, 1.08, 0.82, 1.04],
            [1.00, 0.72, 3.28, -0.50, 1.08, 0.82, 1.04],
            [0.92, 0.16, 3.12, 0.68, 1.02, 0.78, 1.00],
          ]
        : [
            [1.48, 0.0, 3.55, 0.0, 1.28, 0.96, 1.24],
          ];

  const parts = lobes.map(([r, cx, cy, cz, sx, sy, sz], idx) =>
    makeOrganicCanopySubCrown(r, detail, cx, cy, cz, sx, sy, sz, idx * 1.7 + 0.5),
  );
  const merged = mergeStaticGeometries(parts);
  parts.forEach((p) => p.dispose());
  return merged;
}

function makeArchedLeafBoughCard(
  size: number,
  cx: number,
  cy: number,
  cz: number,
  rx: number,
  ry: number,
  rz: number,
): THREE.BufferGeometry {
  const plane = new THREE.PlaneGeometry(size, size, 2, 2);
  const pos = plane.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    // Comba orgánica de rama foliar para volumen tridimensional desde cualquier ángulo
    const archZ = -0.18 * (px * px + py * py);
    pos.setZ(i, archZ);
  }
  plane.computeVertexNormals();
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(cx, cy, cz),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')),
    new THREE.Vector3(1, 1, 1),
  );
  plane.applyMatrix4(m);
  return plane;
}

function buildTreeAlphaCutoutBoughsGeometry(lod: 0 | 1): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const ringCount = lod === 0 ? 10 : 5;
  for (let i = 0; i < ringCount; i++) {
    const ang = (i / ringCount) * Math.PI * 2 + 0.28;
    const rad = i % 2 === 0 ? 1.28 : 1.06;
    const y = i % 2 === 0 ? 3.12 : 3.68;
    parts.push(
      makeArchedLeafBoughCard(
        1.52,
        Math.cos(ang) * rad,
        y,
        Math.sin(ang) * rad,
        0.48 + (i % 3) * 0.14,
        -ang + Math.PI * 0.5,
        (i % 2 === 0 ? 1 : -1) * 0.24,
      ),
    );
  }

  const upperCount = lod === 0 ? 6 : 3;
  for (let j = 0; j < upperCount; j++) {
    const ang = (j / upperCount) * Math.PI * 2 + 0.72;
    parts.push(
      makeArchedLeafBoughCard(
        1.38,
        Math.cos(ang) * 0.66,
        4.36 + (j % 2) * 0.24,
        Math.sin(ang) * 0.66,
        0.82,
        -ang,
        0.18,
      ),
    );
  }

  const merged = mergeStaticGeometries(parts);
  parts.forEach((p) => p.dispose());
  return merged;
}

// ---------------------------------------------------------------------------
// 2. INFRAESTRUCTURA URBANA: Postes de madera/óxido, Aisladores cerámicos,
//    Torres de Alta Tensión, Guardarrieles W-Beam y Muros de Contención
// ---------------------------------------------------------------------------

function buildUtilityPoleTimberGeometry(lod: 0 | 1 | 2): THREE.BufferGeometry {
  const segs = lod === 0 ? 12 : lod === 1 ? 8 : 5;
  const parts: THREE.BufferGeometry[] = [];
  const shaft = new THREE.CylinderGeometry(0.095, 0.148, 8.1, segs, 1);
  shaft.translate(0, 4.02, 0);
  parts.push(shaft);

  if (lod <= 1) {
    const baseSleeve = new THREE.CylinderGeometry(0.158, 0.168, 0.65, segs, 1);
    baseSleeve.translate(0, 0.30, 0);
    parts.push(baseSleeve);
  }
  if (lod === 0) {
    const topCone = new THREE.ConeGeometry(0.102, 0.18, segs);
    topCone.translate(0, 8.16, 0);
    parts.push(topCone);
  }

  const merged = mergeStaticGeometries(parts);
  parts.forEach((p) => p.dispose());
  return merged;
}

function buildUtilityPoleHardwareGeometry(lod: 0 | 1 | 2): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // Cruceta superior (3 fases MT) + cruceta inferior (distribución BT)
  parts.push(makeBoxPart(2.12, 0.11, 0.11, 0, 7.46, 0.12));
  if (lod <= 1) {
    parts.push(makeBoxPart(1.68, 0.10, 0.10, 0, 6.76, -0.12));
    // Riostras diagonales en V de acero oxidado
    parts.push(makeStrutBetween(-0.62, 7.42, 0.08, -0.06, 6.96, 0.04, 0.018, 0.018, 4));
    parts.push(makeStrutBetween(0.62, 7.42, 0.08, 0.06, 6.96, 0.04, 0.018, 0.018, 4));
    parts.push(makeStrutBetween(-0.48, 6.72, -0.08, -0.06, 6.32, -0.04, 0.016, 0.016, 4));
    parts.push(makeStrutBetween(0.48, 6.72, -0.08, 0.06, 6.32, -0.04, 0.016, 0.016, 4));
  }

  // Brazo pescante de alumbrado público orientado hacia la calzada (-X local cuando yaw mira a pista)
  parts.push(makeStrutBetween(0, 5.75, 0, -0.92, 6.18, 0, 0.032, 0.026, lod === 0 ? 8 : 5));
  parts.push(makeBoxPart(0.58, 0.13, 0.28, -1.08, 6.18, 0));

  if (lod === 0) {
    // Abrazaderas metálicas + tambor transformador de distribución con aletas disipadoras
    for (const cy of [5.05, 5.65, 6.76, 7.46]) {
      const collar = new THREE.CylinderGeometry(0.125, 0.128, 0.08, 10);
      collar.translate(0, cy, 0);
      parts.push(collar);
    }
    const tank = new THREE.CylinderGeometry(0.24, 0.24, 0.82, 12);
    tank.translate(0.32, 5.26, 0);
    parts.push(tank);
    for (let fin = -2; fin <= 2; fin++) {
      parts.push(makeBoxPart(0.06, 0.62, 0.02, 0.56, 5.26, fin * 0.065));
    }
  } else if (lod === 1) {
    const tank = new THREE.CylinderGeometry(0.23, 0.23, 0.80, 7);
    tank.translate(0.32, 5.26, 0);
    parts.push(tank);
  }

  const merged = mergeStaticGeometries(parts);
  parts.forEach((p) => p.dispose());
  return merged;
}

function makeRibbedCeramicInsulator(
  height: number,
  radius: number,
  radialSegments: number,
  ribs: number,
): THREE.BufferGeometry {
  const profile: THREE.Vector2[] = [new THREE.Vector2(0.001, 0), new THREE.Vector2(radius * 0.45, 0)];
  for (let r = 0; r < ribs; r++) {
    const y0 = ((r + 0.15) / ribs) * height;
    const yMid = ((r + 0.52) / ribs) * height;
    const y1 = ((r + 0.88) / ribs) * height;
    const skirtR = radius * (1.0 - r * 0.08);
    profile.push(new THREE.Vector2(radius * 0.42, y0));
    profile.push(new THREE.Vector2(skirtR, yMid));
    profile.push(new THREE.Vector2(radius * 0.36, y1));
  }
  profile.push(new THREE.Vector2(radius * 0.32, height));
  profile.push(new THREE.Vector2(0.001, height));
  return new THREE.LatheGeometry(profile, radialSegments);
}

function buildUtilityCeramicInsulatorsGeometry(lod: 0 | 1): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const segs = lod === 0 ? 10 : 6;
  const ribs = lod === 0 ? 3 : 2;
  const baseBell = makeRibbedCeramicInsulator(0.24, 0.085, segs, ribs);

  // 4 aisladores en cruceta superior + 3 aisladores en cruceta inferior
  const upperXs = [-0.94, -0.34, 0.34, 0.94];
  for (const ux of upperXs) {
    const inst = baseBell.clone();
    inst.translate(ux, 7.51, 0.12);
    parts.push(inst);
  }
  const lowerXs = [-0.74, 0, 0.74];
  for (const lx of lowerXs) {
    const inst = baseBell.clone();
    inst.scale(0.88, 0.88, 0.88);
    inst.translate(lx, 6.81, -0.12);
    parts.push(inst);
  }
  if (lod === 0) {
    // 2 pasatapas cerámicos de media tensión sobre la tapa del transformador
    for (const bz of [-0.09, 0.09]) {
      const bush = baseBell.clone();
      bush.scale(0.72, 1.05, 0.72);
      bush.translate(0.32, 5.67, bz);
      parts.push(bush);
    }
  }
  baseBell.dispose();

  const merged = mergeStaticGeometries(parts);
  parts.forEach((p) => p.dispose());
  return merged;
}

function buildHighVoltageTowerGeometry(lod: 0 | 1 | 2): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const tiers: Array<{ y: number; half: number }> = [
    { y: 0.0, half: 1.65 },
    { y: 4.2, half: 1.32 },
    { y: 8.4, half: 1.02 },
    { y: 12.6, half: 0.76 },
    { y: 16.2, half: 0.58 },
    { y: 18.6, half: 0.46 },
  ];

  const corners: Array<[number, number]> = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];

  // 4 montantes principales inclinados + anillos horizontales + celosía diagonal en X
  for (let t = 0; t < tiers.length - 1; t++) {
    const a = tiers[t];
    const b = tiers[t + 1];
    for (let c = 0; c < 4; c++) {
      const [sx, sz] = corners[c];
      const [nx, nz] = corners[(c + 1) % 4];
      parts.push(
        makeStrutBetween(
          sx * a.half,
          a.y,
          sz * a.half,
          sx * b.half,
          b.y,
          sz * b.half,
          0.075,
          0.065,
          lod === 0 ? 6 : 4,
        ),
      );
      // Travesaño horizontal de nivel superior
      if (lod <= 1 || t % 2 === 1) {
        parts.push(
          makeStrutBetween(
            sx * b.half,
            b.y,
            sz * b.half,
            nx * b.half,
            b.y,
            nz * b.half,
            0.045,
            0.045,
            4,
          ),
        );
      }
      // Diagonales cruzadas de reticulado metálico
      if (lod === 0) {
        parts.push(
          makeStrutBetween(
            sx * a.half,
            a.y,
            sz * a.half,
            nx * b.half,
            b.y,
            nz * b.half,
            0.034,
            0.034,
            4,
          ),
        );
        parts.push(
          makeStrutBetween(
            nx * a.half,
            a.y,
            nz * a.half,
            sx * b.half,
            b.y,
            sz * b.half,
            0.034,
            0.034,
            4,
          ),
        );
      } else if (lod === 1 && (t + c) % 2 === 0) {
        parts.push(
          makeStrutBetween(
            sx * a.half,
            a.y,
            sz * a.half,
            nx * b.half,
            b.y,
            nz * b.half,
            0.036,
            0.036,
            4,
          ),
        );
      }
    }
  }

  // Cúpula piramidal de hilo de guardia (y = 18.6 -> 20.9 m)
  const topRing = tiers[tiers.length - 1];
  for (const [sx, sz] of corners) {
    parts.push(
      makeStrutBetween(sx * topRing.half, topRing.y, sz * topRing.half, 0, 20.9, 0, 0.05, 0.035, 4),
    );
  }

  // Dos ménsulas dobles de alta tensión (y = 13.8 m ancho 6.6 m; y = 17.2 m ancho 5.2 m)
  const crossArms: Array<{ y: number; halfSpan: number; waist: number }> = [
    { y: 13.8, halfSpan: 3.3, waist: 0.70 },
    { y: 17.2, halfSpan: 2.6, waist: 0.52 },
  ];
  for (const arm of crossArms) {
    parts.push(makeBoxPart(arm.halfSpan * 2, 0.16, 0.42, 0, arm.y, 0));
    for (const side of [-1, 1]) {
      parts.push(
        makeStrutBetween(
          side * arm.waist,
          arm.y + 1.05,
          0,
          side * arm.halfSpan,
          arm.y + 0.05,
          0,
          0.042,
          0.034,
          4,
        ),
      );
      if (lod === 0) {
        parts.push(
          makeStrutBetween(
            side * arm.waist,
            arm.y + 0.52,
            -0.22,
            side * arm.halfSpan * 0.62,
            arm.y + 0.04,
            0,
            0.03,
            0.03,
            4,
          ),
        );
        parts.push(
          makeStrutBetween(
            side * arm.waist,
            arm.y + 0.52,
            0.22,
            side * arm.halfSpan * 0.62,
            arm.y + 0.04,
            0,
            0.03,
            0.03,
            4,
          ),
        );
      }
    }
  }

  const merged = mergeStaticGeometries(parts);
  parts.forEach((p) => p.dispose());
  return merged;
}

function buildHighVoltageInsulatorStringsGeometry(lod: 0 | 1): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const segs = lod === 0 ? 10 : 6;
  const stringChain = makeRibbedCeramicInsulator(1.05, 0.135, segs, lod === 0 ? 6 : 3);

  const attachPoints: Array<[number, number]> = [
    [-3.18, 12.72],
    [3.18, 12.72],
    [-1.72, 12.72],
    [1.72, 12.72],
    [-2.48, 16.12],
    [2.48, 16.12],
  ];
  for (const [ax, ay] of attachPoints) {
    const c = stringChain.clone();
    c.translate(ax, ay, 0);
    parts.push(c);
  }
  stringChain.dispose();

  const merged = mergeStaticGeometries(parts);
  parts.forEach((p) => p.dispose());
  return merged;
}

function buildWBeamCorrugatedRailGeometry(lengthZ: number, profileDetail: 'high' | 'mid'): THREE.BufferGeometry {
  // Perfil W-beam orientado hacia -X local (de cara a la calzada cuando se rota según lado)
  const profile: Array<[number, number]> =
    profileDetail === 'high'
      ? [
          [0.055, 0.43],
          [-0.015, 0.47],
          [-0.085, 0.53],
          [-0.085, 0.58],
          [-0.018, 0.62],
          [-0.085, 0.66],
          [-0.085, 0.71],
          [-0.015, 0.77],
          [0.055, 0.81],
        ]
      : [
          [0.03, 0.44],
          [-0.08, 0.54],
          [-0.02, 0.62],
          [-0.08, 0.70],
          [0.03, 0.80],
        ];

  const segCount = profile.length - 1;
  const halfL = lengthZ * 0.5;
  const positions = new Float32Array(segCount * 6 * 3);
  const normals = new Float32Array(segCount * 6 * 3);
  const uvs = new Float32Array(segCount * 6 * 2);

  let vi = 0;
  const pushVert = (x: number, y: number, z: number, nx: number, ny: number, u: number, v: number) => {
    positions[vi * 3] = x;
    positions[vi * 3 + 1] = y;
    positions[vi * 3 + 2] = z;
    normals[vi * 3] = nx;
    normals[vi * 3 + 1] = ny;
    normals[vi * 3 + 2] = 0;
    uvs[vi * 2] = u;
    uvs[vi * 2 + 1] = v;
    vi++;
  };

  for (let s = 0; s < segCount; s++) {
    const [x0, y0] = profile[s];
    const [x1, y1] = profile[s + 1];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    // Normal apuntando hacia -X (hacia la pista)
    const nx = -dy / len;
    const ny = dx / len;
    const v0 = s / segCount;
    const v1 = (s + 1) / segCount;

    pushVert(x0, y0, -halfL, nx, ny, 0, v0);
    pushVert(x0, y0, halfL, nx, ny, 1, v0);
    pushVert(x1, y1, halfL, nx, ny, 1, v1);

    pushVert(x0, y0, -halfL, nx, ny, 0, v0);
    pushVert(x1, y1, halfL, nx, ny, 1, v1);
    pushVert(x1, y1, -halfL, nx, ny, 0, v1);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return g;
}

function buildGuardrailBayGeometry(lod: 0 | 1 | 2): THREE.BufferGeometry {
  const bayLen = 4.04;
  const parts: THREE.BufferGeometry[] = [];

  if (lod === 0) {
    parts.push(buildWBeamCorrugatedRailGeometry(bayLen, 'high'));
    // Contrapeso posterior de rigidez para vista en escorzo
    parts.push(makeBoxPart(0.025, 0.34, bayLen, 0.02, 0.62, 0));
    // 2 postes de acero perfil I/H hincados cada 2 m + separadores y cabezas de bulones
    for (const pz of [-1.0, 1.0]) {
      // Alma y alas del poste I
      parts.push(makeBoxPart(0.14, 0.86, 0.03, 0.14, 0.39, pz));
      parts.push(makeBoxPart(0.03, 0.86, 0.12, 0.075, 0.39, pz));
      parts.push(makeBoxPart(0.03, 0.86, 0.12, 0.205, 0.39, pz));
      // Taco separador (blockout) + bulón frontal
      parts.push(makeBoxPart(0.09, 0.26, 0.11, 0.025, 0.62, pz));
      parts.push(makeBoxPart(0.035, 0.05, 0.05, -0.032, 0.62, pz));
    }
  } else if (lod === 1) {
    parts.push(buildWBeamCorrugatedRailGeometry(bayLen, 'mid'));
    for (const pz of [-1.0, 1.0]) {
      parts.push(makeBoxPart(0.12, 0.84, 0.10, 0.12, 0.39, pz));
    }
  } else {
    parts.push(makeBoxPart(0.08, 0.34, bayLen, -0.02, 0.62, 0));
    parts.push(makeBoxPart(0.10, 0.82, 0.10, 0.10, 0.39, 0));
  }

  const merged = mergeStaticGeometries(parts);
  parts.forEach((p) => p.dispose());
  return merged;
}

function buildRetainingWallBayGeometry(lod: 0 | 1 | 2): THREE.BufferGeometry {
  const bayLen = 6.02;
  const parts: THREE.BufferGeometry[] = [];

  if (lod === 0) {
    // Muro de hormigón en talud (battered face mirando hacia -X) + zócalo + albardilla biselada + 2 contrafuertes
    parts.push(makeBoxPart(0.56, 0.34, bayLen, 0.12, 0.14, 0));
    parts.push(makeBoxPart(0.46, 2.18, bayLen, 0.18, 1.36, 0, 0, 0, -0.045));
    // Albardilla superior sobresaliente (coping cap)
    parts.push(makeBoxPart(0.58, 0.18, bayLen + 0.04, 0.16, 2.52, 0));
    // 2 pilastras / contrafuertes estructurales con remate inclinado
    for (const pz of [-1.5, 1.5]) {
      parts.push(makeBoxPart(0.22, 2.38, 0.44, -0.08, 1.19, pz));
      parts.push(makeBoxPart(0.24, 0.16, 0.48, -0.07, 2.44, pz, 0, 0, 0.18));
    }
    // Mechinales de drenaje inferiores
    for (const wz of [-2.2, 0.0, 2.2]) {
      parts.push(makeBoxPart(0.08, 0.11, 0.08, -0.07, 0.42, wz));
    }
  } else if (lod === 1) {
    parts.push(makeBoxPart(0.46, 2.42, bayLen, 0.16, 1.20, 0));
    parts.push(makeBoxPart(0.56, 0.18, bayLen, 0.15, 2.50, 0));
    for (const pz of [-1.5, 1.5]) {
      parts.push(makeBoxPart(0.18, 2.36, 0.40, -0.06, 1.18, pz));
    }
  } else {
    parts.push(makeBoxPart(0.46, 2.56, bayLen, 0.16, 1.26, 0));
  }

  const merged = mergeStaticGeometries(parts);
  parts.forEach((p) => p.dispose());
  return merged;
}

// ---------------------------------------------------------------------------
// 3. CANAL GENÉRICO DE INSTANCEDMESH CON PARTICIÓN DE DISTANCIA 0-GC
// ---------------------------------------------------------------------------

interface AnchorTransform {
  s: number;
  lateral: number;
  y: number;
  yaw: number;
  sx: number;
  sy: number;
  sz: number;
  color?: THREE.Color;
}

class InstancedLodFamily {
  readonly name: string;
  readonly anchors: AnchorTransform[];
  readonly total: number;
  readonly worldMatrices: Float32Array;
  readonly worldPos: Float32Array;
  readonly colors: Float32Array | null;

  readonly meshesLod0: THREE.InstancedMesh[] = [];
  readonly meshesLod1: THREE.InstancedMesh[] = [];
  readonly meshesLod2: THREE.InstancedMesh[] = [];

  lod0Count = 0;
  lod1Count = 0;
  lod2Count = 0;

  constructor(name: string, anchors: AnchorTransform[], withColors: boolean) {
    this.name = name;
    this.anchors = anchors;
    this.total = anchors.length;
    this.worldMatrices = new Float32Array(Math.max(1, this.total) * 16);
    this.worldPos = new Float32Array(Math.max(1, this.total) * 3);
    this.colors = withColors ? new Float32Array(Math.max(1, this.total) * 3) : null;

    if (this.colors) {
      for (let i = 0; i < this.total; i++) {
        const c = anchors[i].color;
        this.colors[i * 3] = c ? c.r : 1;
        this.colors[i * 3 + 1] = c ? c.g : 1;
        this.colors[i * 3 + 2] = c ? c.b : 1;
      }
    }
  }

  addTierMesh(
    tier: 0 | 1 | 2,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    parent: THREE.Group,
    castShadow = true,
  ): THREE.InstancedMesh {
    const cap = Math.max(1, this.total);
    const mesh = new THREE.InstancedMesh(geometry, material, cap);
    mesh.name = `${this.name}_lod${tier}`;
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (this.colors) {
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
    parent.add(mesh);
    if (tier === 0) this.meshesLod0.push(mesh);
    else if (tier === 1) this.meshesLod1.push(mesh);
    else this.meshesLod2.push(mesh);
    return mesh;
  }

  computeWorldTransforms(
    roadPath: CurvedRoadPath | undefined,
    posTmp: THREE.Vector3,
    quatTmp: THREE.Quaternion,
    eulerTmp: THREE.Euler,
    scaleTmp: THREE.Vector3,
    matTmp: THREE.Matrix4,
  ): void {
    for (let i = 0; i < this.total; i++) {
      const a = this.anchors[i];
      const wp = roadPath
        ? roadPath.world(a.s, a.lateral)
        : { x: a.lateral, z: a.s, yaw: 0 };
      const yaw = wp.yaw + a.yaw;

      this.worldPos[i * 3] = wp.x;
      this.worldPos[i * 3 + 1] = a.y;
      this.worldPos[i * 3 + 2] = wp.z;

      posTmp.set(wp.x, a.y, wp.z);
      eulerTmp.set(0, yaw, 0, 'YXZ');
      quatTmp.setFromEuler(eulerTmp);
      scaleTmp.set(a.sx, a.sy, a.sz);
      matTmp.compose(posTmp, quatTmp, scaleTmp);
      matTmp.toArray(this.worldMatrices, i * 16);
    }
  }

  partitionByCamera(camX: number, camY: number, camZ: number): void {
    if (this.total === 0) {
      this.lod0Count = 0;
      this.lod1Count = 0;
      this.lod2Count = 0;
      return;
    }

    let c0 = 0;
    let c1 = 0;
    let c2 = 0;

    const m0List = this.meshesLod0;
    const m1List = this.meshesLod1;
    const m2List = this.meshesLod2;
    const srcMats = this.worldMatrices;
    const srcColors = this.colors;

    for (let i = 0; i < this.total; i++) {
      const p3 = i * 3;
      const dx = this.worldPos[p3] - camX;
      const dy = (this.worldPos[p3 + 1] - camY) * 0.45;
      const dz = this.worldPos[p3 + 2] - camZ;
      const distSq = dx * dx + dy * dy + dz * dz;

      const srcBase = i * 16;
      if (distSq <= LOD0_MAX_DIST_SQ) {
        const dstBase = c0 * 16;
        for (let m = 0; m < m0List.length; m++) {
          const arr = m0List[m].instanceMatrix.array as Float32Array;
          for (let k = 0; k < 16; k++) arr[dstBase + k] = srcMats[srcBase + k];
          if (srcColors && m0List[m].instanceColor) {
            const cArr = m0List[m].instanceColor!.array as Float32Array;
            cArr[c0 * 3] = srcColors[p3];
            cArr[c0 * 3 + 1] = srcColors[p3 + 1];
            cArr[c0 * 3 + 2] = srcColors[p3 + 2];
          }
        }
        c0++;
      } else if (distSq <= LOD1_MAX_DIST_SQ) {
        const dstBase = c1 * 16;
        for (let m = 0; m < m1List.length; m++) {
          const arr = m1List[m].instanceMatrix.array as Float32Array;
          for (let k = 0; k < 16; k++) arr[dstBase + k] = srcMats[srcBase + k];
          if (srcColors && m1List[m].instanceColor) {
            const cArr = m1List[m].instanceColor!.array as Float32Array;
            cArr[c1 * 3] = srcColors[p3];
            cArr[c1 * 3 + 1] = srcColors[p3 + 1];
            cArr[c1 * 3 + 2] = srcColors[p3 + 2];
          }
        }
        c1++;
      } else {
        const dstBase = c2 * 16;
        for (let m = 0; m < m2List.length; m++) {
          const arr = m2List[m].instanceMatrix.array as Float32Array;
          for (let k = 0; k < 16; k++) arr[dstBase + k] = srcMats[srcBase + k];
          if (srcColors && m2List[m].instanceColor) {
            const cArr = m2List[m].instanceColor!.array as Float32Array;
            cArr[c2 * 3] = srcColors[p3];
            cArr[c2 * 3 + 1] = srcColors[p3 + 1];
            cArr[c2 * 3 + 2] = srcColors[p3 + 2];
          }
        }
        c2++;
      }
    }

    this.lod0Count = c0;
    this.lod1Count = c1;
    this.lod2Count = c2;

    for (const m of m0List) {
      m.count = c0;
      m.visible = c0 > 0;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    for (const m of m1List) {
      m.count = c1;
      m.visible = c1 > 0;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    for (const m of m2List) {
      m.count = c2;
      m.visible = c2 > 0;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  getCounts(): LodTierCounts {
    return {
      lod0: this.lod0Count,
      lod1: this.lod1Count,
      lod2: this.lod2Count,
      total: this.total,
    };
  }
}

// ---------------------------------------------------------------------------
// 4. FÁBRICA PRINCIPAL DEL SISTEMA LOD + CATENARIAS AÉREAS
// ---------------------------------------------------------------------------

export function createEnvironmentLodSystem3D(
  options: EnvironmentLodBuildOptions,
): EnvironmentLodController {
  const {
    halfRoadWidth,
    trackEndMeters,
    spans,
    crossingsZ,
    parkZones,
    paseoSites = [],
    treeAnchors,
    envMaterials,
    hasRiverfront = false,
  } = options;

  const group = new THREE.Group();
  group.name = 'nfsmw2012_instanced_lod_props';
  // Se transforma analíticamente mediante roadPath.world(s, lateral) para soportar partición LOD mundial en 0 GC
  group.userData.skipBend = true;

  const disposableGeometries: THREE.BufferGeometry[] = [];
  const disposableMaterials: THREE.Material[] = [];

  const foliagePalette = [
    new THREE.Color('#536938'), // Verde oliva otoñal apagado
    new THREE.Color('#c88b26'), // Amarillo ocre / dorado de otoño
    new THREE.Color('#42562f'), // Verde bosque profundo
    new THREE.Color('#cc671f'), // Naranja otoñal luminoso
    new THREE.Color('#a84624'), // Cobrizo rojizo cálido
    new THREE.Color('#ddb034'), // Amarillo ámbar traslúcido al sol
  ];

  // A. ÁRBOLES VOLUMÉTRICOS DE ALTA DENSIDAD (LOD0 / LOD1 / LOD2)
  const treeTransforms: AnchorTransform[] = treeAnchors.map((t, idx) => ({
    s: t.s,
    lateral: t.lateral,
    y: 0,
    yaw: (idx * 1.37) % (Math.PI * 2),
    sx: t.scale,
    sy: t.scale,
    sz: t.scale,
    color: foliagePalette[t.colorIndex % foliagePalette.length],
  }));

  const treeFamily = new InstancedLodFamily('volumetric_trees', treeTransforms, true);
  const barkGeo0 = buildTreeBarkGeometry(0);
  const barkGeo1 = buildTreeBarkGeometry(1);
  const barkGeo2 = buildTreeBarkGeometry(2);
  const coreLeafGeo0 = buildTreeCoreCanopyGeometry(0);
  const coreLeafGeo1 = buildTreeCoreCanopyGeometry(1);
  const coreLeafGeo2 = buildTreeCoreCanopyGeometry(2);
  const cutoutBoughGeo0 = buildTreeAlphaCutoutBoughsGeometry(0);
  const cutoutBoughGeo1 = buildTreeAlphaCutoutBoughsGeometry(1);
  disposableGeometries.push(
    barkGeo0,
    barkGeo1,
    barkGeo2,
    coreLeafGeo0,
    coreLeafGeo1,
    coreLeafGeo2,
    cutoutBoughGeo0,
    cutoutBoughGeo1,
  );

  treeFamily.addTierMesh(0, barkGeo0, envMaterials.trunkMaterial, group, true);
  treeFamily.addTierMesh(1, barkGeo1, envMaterials.trunkMaterial, group, false);
  treeFamily.addTierMesh(2, barkGeo2, envMaterials.trunkMaterial, group, false);

  treeFamily.addTierMesh(0, coreLeafGeo0, envMaterials.foliageMaterial, group, true);
  treeFamily.addTierMesh(1, coreLeafGeo1, envMaterials.foliageMaterial, group, false);
  treeFamily.addTierMesh(2, coreLeafGeo2, envMaterials.foliageMaterial, group, false);

  treeFamily.addTierMesh(0, cutoutBoughGeo0, envMaterials.foliageCutoutMaterial, group, false);
  treeFamily.addTierMesh(1, cutoutBoughGeo1, envMaterials.foliageCutoutMaterial, group, false);

  const lod0TreeTriangles =
    (barkGeo0.getAttribute('position').count +
      coreLeafGeo0.getAttribute('position').count +
      cutoutBoughGeo0.getAttribute('position').count) /
    3;
  const lod2TreeTriangles =
    (barkGeo2.getAttribute('position').count + coreLeafGeo2.getAttribute('position').count) / 3;

  // B. POSTES ELÉCTRICOS DE MADERA/ÓXIDO + AISLADORES CERÁMICOS
  const poleAnchorsLeft: AnchorTransform[] = [];
  const poleAnchorsRight: AnchorTransform[] = [];
  const poleSpacing = 48;
  const poleSteps = Math.ceil(trackEndMeters / poleSpacing);
  for (let p = 0; p < poleSteps; p++) {
    const s = p * poleSpacing + 6;
    if (s > trackEndMeters - 8) break;
    if (crossingsZ.some((cz) => Math.abs(cz - s) < 9.0)) continue;
    // En -X rotamos Math.PI para que el brazo de alumbrado (-X local) apunte hacia la calzada (+X)
    poleAnchorsLeft.push({
      s,
      lateral: -(halfRoadWidth + 2.38),
      y: 0,
      yaw: Math.PI,
      sx: 1,
      sy: 1,
      sz: 1,
    });
    // En +X yaw = 0 para que el brazo (-X local) apunte hacia la calzada (-X)
    poleAnchorsRight.push({
      s,
      lateral: halfRoadWidth + 2.38,
      y: 0,
      yaw: 0,
      sx: 1,
      sy: 1,
      sz: 1,
    });
  }
  const allPoleAnchors = [...poleAnchorsLeft, ...poleAnchorsRight];
  const poleFamily = new InstancedLodFamily('utility_poles', allPoleAnchors, false);

  const poleTimber0 = buildUtilityPoleTimberGeometry(0);
  const poleTimber1 = buildUtilityPoleTimberGeometry(1);
  const poleTimber2 = buildUtilityPoleTimberGeometry(2);
  const poleHardware0 = buildUtilityPoleHardwareGeometry(0);
  const poleHardware1 = buildUtilityPoleHardwareGeometry(1);
  const poleHardware2 = buildUtilityPoleHardwareGeometry(2);
  const poleInsulators0 = buildUtilityCeramicInsulatorsGeometry(0);
  const poleInsulators1 = buildUtilityCeramicInsulatorsGeometry(1);
  disposableGeometries.push(
    poleTimber0,
    poleTimber1,
    poleTimber2,
    poleHardware0,
    poleHardware1,
    poleHardware2,
    poleInsulators0,
    poleInsulators1,
  );

  poleFamily.addTierMesh(0, poleTimber0, envMaterials.utilityWoodPoleMaterial, group, true);
  poleFamily.addTierMesh(1, poleTimber1, envMaterials.utilityWoodPoleMaterial, group, true);
  poleFamily.addTierMesh(2, poleTimber2, envMaterials.utilityWoodPoleMaterial, group, false);

  poleFamily.addTierMesh(0, poleHardware0, envMaterials.rustedUtilityMetalMaterial, group, true);
  poleFamily.addTierMesh(1, poleHardware1, envMaterials.rustedUtilityMetalMaterial, group, false);
  poleFamily.addTierMesh(2, poleHardware2, envMaterials.rustedUtilityMetalMaterial, group, false);

  poleFamily.addTierMesh(0, poleInsulators0, envMaterials.ceramicInsulatorMaterial, group, false);
  poleFamily.addTierMesh(1, poleInsulators1, envMaterials.ceramicInsulatorMaterial, group, false);

  // C. TORRES RETICULADAS DE ALTA TENSIÓN + CADENAS DE AISLADORES
  const hvTowerAnchors: AnchorTransform[] = [];
  const hvSide = hasRiverfront ? 1 : -1;
  const hvLateral = hvSide * (halfRoadWidth + (hasRiverfront ? 28.5 : 23.5));
  const hvSpacing = 148;
  for (let s = 66; s < trackEndMeters - 30; s += hvSpacing) {
    if (crossingsZ.some((cz) => Math.abs(cz - s) < 15)) continue;
    if (paseoSites.some((ps) => ps.side === hvSide && Math.abs(ps.z - s) < 58)) continue;
    hvTowerAnchors.push({
      s,
      lateral: hvLateral,
      y: -0.12,
      yaw: 0,
      sx: 1.12,
      sy: 1.16,
      sz: 1.12,
    });
  }
  const hvTowerFamily = new InstancedLodFamily('high_voltage_towers', hvTowerAnchors, false);
  const hvGeo0 = buildHighVoltageTowerGeometry(0);
  const hvGeo1 = buildHighVoltageTowerGeometry(1);
  const hvGeo2 = buildHighVoltageTowerGeometry(2);
  const hvInsGeo0 = buildHighVoltageInsulatorStringsGeometry(0);
  const hvInsGeo1 = buildHighVoltageInsulatorStringsGeometry(1);
  disposableGeometries.push(hvGeo0, hvGeo1, hvGeo2, hvInsGeo0, hvInsGeo1);

  hvTowerFamily.addTierMesh(0, hvGeo0, envMaterials.rustedUtilityMetalMaterial, group, true);
  hvTowerFamily.addTierMesh(1, hvGeo1, envMaterials.rustedUtilityMetalMaterial, group, true);
  hvTowerFamily.addTierMesh(2, hvGeo2, envMaterials.rustedUtilityMetalMaterial, group, false);
  hvTowerFamily.addTierMesh(0, hvInsGeo0, envMaterials.ceramicInsulatorMaterial, group, false);
  hvTowerFamily.addTierMesh(1, hvInsGeo1, envMaterials.ceramicInsulatorMaterial, group, false);

  // D. GUARDARRIELES METÁLICOS 3D (W-BEAM) EN LOS BORDES DEL TRAZADO
  const guardrailAnchors: AnchorTransform[] = [];
  const railBayLength = 4.0;
  for (const span of spans) {
    const startS = span.from + 3.5;
    const endS = span.to - 3.5;
    if (endS - startS < railBayLength) continue;
    for (let s = startS + railBayLength * 0.5; s <= endS - railBayLength * 0.5; s += railBayLength) {
      for (const side of [-1, 1] as const) {
        guardrailAnchors.push({
          s,
          lateral: side * (halfRoadWidth + 0.94),
          y: 0,
          yaw: side === 1 ? 0 : Math.PI,
          sx: 1,
          sy: 1,
          sz: 1,
        });
      }
    }
  }
  const guardrailFamily = new InstancedLodFamily('metallic_guardrails', guardrailAnchors, false);
  const railGeo0 = buildGuardrailBayGeometry(0);
  const railGeo1 = buildGuardrailBayGeometry(1);
  const railGeo2 = buildGuardrailBayGeometry(2);
  disposableGeometries.push(railGeo0, railGeo1, railGeo2);

  guardrailFamily.addTierMesh(0, railGeo0, envMaterials.guardrailMetalMaterial, group, true);
  guardrailFamily.addTierMesh(1, railGeo1, envMaterials.guardrailMetalMaterial, group, false);
  guardrailFamily.addTierMesh(2, railGeo2, envMaterials.guardrailMetalMaterial, group, false);

  // E. MUROS DE CONTENCIÓN DE HORMIGÓN INTEMPERIZADO EN BORDES EXTERIORES
  const wallAnchors: AnchorTransform[] = [];
  const wallBayLength = 6.0;
  for (const span of spans) {
    const startS = span.from + 5.0;
    const endS = span.to - 5.0;
    if (endS - startS < wallBayLength) continue;
    for (let s = startS + wallBayLength * 0.5; s <= endS - wallBayLength * 0.5; s += wallBayLength) {
      for (const side of [-1, 1] as const) {
        const nearPark = parkZones.some(
          (pz) => pz.side === side && Math.abs(pz.centerZ - s) < pz.spanZ * 0.62,
        );
        if (nearPark) continue;
        const nearPaseo = paseoSites.some(
          (ps) => ps.side === side && Math.abs(ps.z - s) < 46,
        );
        if (nearPaseo) continue;

        wallAnchors.push({
          s,
          lateral: side * (halfRoadWidth + 6.45),
          y: -0.05,
          yaw: side === 1 ? 0 : Math.PI,
          sx: 1,
          sy: 1,
          sz: 1,
        });
      }
    }
  }
  const retainingWallFamily = new InstancedLodFamily('concrete_retaining_walls', wallAnchors, false);
  const wallGeo0 = buildRetainingWallBayGeometry(0);
  const wallGeo1 = buildRetainingWallBayGeometry(1);
  const wallGeo2 = buildRetainingWallBayGeometry(2);
  disposableGeometries.push(wallGeo0, wallGeo1, wallGeo2);

  retainingWallFamily.addTierMesh(0, wallGeo0, envMaterials.retainingWallMaterial, group, true);
  retainingWallFamily.addTierMesh(1, wallGeo1, envMaterials.retainingWallMaterial, group, true);
  retainingWallFamily.addTierMesh(2, wallGeo2, envMaterials.retainingWallMaterial, group, false);

  // F. TENDIDO ELÉCTRICO AÉREO CATENARIO (MT/BT sobre postes + Alta Tensión sobre torres)
  const catenaryGeometry = new THREE.BufferGeometry();
  const catenaryMaterial = new THREE.LineBasicMaterial({
    color: '#22282d',
    transparent: true,
    opacity: 0.84,
  });
  disposableGeometries.push(catenaryGeometry);
  disposableMaterials.push(catenaryMaterial);

  const catenaryLines = new THREE.LineSegments(catenaryGeometry, catenaryMaterial);
  catenaryLines.name = 'catenaria_electrica_alta_baja_tension';
  catenaryLines.frustumCulled = false;
  group.add(catenaryLines);

  let catenarySegmentCount = 0;

  const rebuildCatenaryVertices = (roadPath?: CurvedRoadPath) => {
    const verts: number[] = [];
    const evalWorld = (s: number, lateral: number) =>
      roadPath ? roadPath.world(s, lateral) : { x: lateral, z: s, yaw: 0 };

    // 1) Conductores catenarios de distribución entre postes consecutivos (-X y +X)
    const poleWireOffsets: Array<{ dLat: number; y: number; sag: number }> = [
      { dLat: -0.92, y: 7.72, sag: 0.34 },
      { dLat: -0.32, y: 7.72, sag: 0.34 },
      { dLat: 0.32, y: 7.72, sag: 0.34 },
      { dLat: 0.92, y: 7.72, sag: 0.34 },
      { dLat: -0.72, y: 7.02, sag: 0.28 },
      { dLat: 0.72, y: 7.02, sag: 0.28 },
    ];

    for (const poleChain of [poleAnchorsLeft, poleAnchorsRight]) {
      const signFlip = poleChain === poleAnchorsLeft ? -1 : 1;
      for (let i = 0; i < poleChain.length - 1; i++) {
        const pA = poleChain[i];
        const pB = poleChain[i + 1];
        const spanS = pB.s - pA.s;
        if (spanS <= 2 || spanS > poleSpacing * 1.65) continue;

        const subSteps = 6;
        for (const wire of poleWireOffsets) {
          const latA = pA.lateral + signFlip * wire.dLat;
          const latB = pB.lateral + signFlip * wire.dLat;
          for (let k = 0; k < subSteps; k++) {
            const t0 = k / subSteps;
            const t1 = (k + 1) / subSteps;
            const s0 = pA.s + spanS * t0;
            const s1 = pA.s + spanS * t1;
            const w0 = evalWorld(s0, latA + (latB - latA) * t0);
            const w1 = evalWorld(s1, latA + (latB - latA) * t1);
            // Curva catenaria parabólica física 4*t*(1-t)
            const sag0 = wire.sag * 4 * t0 * (1 - t0);
            const sag1 = wire.sag * 4 * t1 * (1 - t1);
            verts.push(w0.x, wire.y - sag0, w0.z, w1.x, wire.y - sag1, w1.z);
          }
        }
      }
    }

    // 2) Líneas aéreas catenarias de Alta Tensión entre torres reticuladas consecutivas
    const hvConductors: Array<{ dLat: number; y: number; sag: number }> = [
      { dLat: -3.18, y: 12.64, sag: 1.48 },
      { dLat: 3.18, y: 12.64, sag: 1.48 },
      { dLat: -1.72, y: 12.64, sag: 1.42 },
      { dLat: 1.72, y: 12.64, sag: 1.42 },
      { dLat: -2.48, y: 16.04, sag: 1.38 },
      { dLat: 2.48, y: 16.04, sag: 1.38 },
      { dLat: 0.0, y: 20.78, sag: 0.95 }, // Hilo de guardia superior
    ];

    for (let i = 0; i < hvTowerAnchors.length - 1; i++) {
      const tA = hvTowerAnchors[i];
      const tB = hvTowerAnchors[i + 1];
      const spanS = tB.s - tA.s;
      if (spanS <= 10 || spanS > hvSpacing * 2.15) continue;

      const subSteps = 9;
      for (const cond of hvConductors) {
        for (let k = 0; k < subSteps; k++) {
          const u0 = k / subSteps;
          const u1 = (k + 1) / subSteps;
          const w0 = evalWorld(tA.s + spanS * u0, tA.lateral + cond.dLat);
          const w1 = evalWorld(tA.s + spanS * u1, tA.lateral + cond.dLat);
          const sag0 = cond.sag * 4 * u0 * (1 - u0);
          const sag1 = cond.sag * 4 * u1 * (1 - u1);
          verts.push(w0.x, cond.y - sag0, w0.z, w1.x, cond.y - sag1, w1.z);
        }
      }
    }

    catenarySegmentCount = verts.length / 6;
    catenaryGeometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    catenaryGeometry.computeBoundingSphere();
  };

  // Objetos temporales reutilizables (0 GC)
  const _pos = new THREE.Vector3();
  const _quat = new THREE.Quaternion();
  const _euler = new THREE.Euler();
  const _scale = new THREE.Vector3();
  const _mat = new THREE.Matrix4();

  const allFamilies: InstancedLodFamily[] = [
    treeFamily,
    poleFamily,
    hvTowerFamily,
    guardrailFamily,
    retainingWallFamily,
  ];

  let lastCamX = Number.NaN;
  let lastCamY = Number.NaN;
  let lastCamZ = Number.NaN;

  const update = (camX: number, camY: number, camZ: number, force = false) => {
    if (!force && Number.isFinite(lastCamX)) {
      const dx = camX - lastCamX;
      const dy = camY - lastCamY;
      const dz = camZ - lastCamZ;
      if (dx * dx + dy * dy + dz * dz < 9.0) return;
    }
    lastCamX = camX;
    lastCamY = camY;
    lastCamZ = camZ;

    for (let f = 0; f < allFamilies.length; f++) {
      allFamilies[f].partitionByCamera(camX, camY, camZ);
    }
  };

  const applyRoadPath = (roadPath?: CurvedRoadPath) => {
    for (let f = 0; f < allFamilies.length; f++) {
      allFamilies[f].computeWorldTransforms(roadPath, _pos, _quat, _euler, _scale, _mat);
    }
    rebuildCatenaryVertices(roadPath);
    update(
      Number.isFinite(lastCamX) ? lastCamX : 0,
      Number.isFinite(lastCamY) ? lastCamY : 2.0,
      Number.isFinite(lastCamZ) ? lastCamZ : 0,
      true,
    );
  };

  // Inicializar en coordenadas base para que la escena sea inmediatamente consultable antes del primer frame
  applyRoadPath(undefined);

  return {
    group,
    applyRoadPath,
    update,
    getDiagnostics: () => ({
      trees: treeFamily.getCounts(),
      utilityPoles: poleFamily.getCounts(),
      hvTowers: hvTowerFamily.getCounts(),
      guardrails: guardrailFamily.getCounts(),
      retainingWalls: retainingWallFamily.getCounts(),
      catenarySegments: catenarySegmentCount,
      lod0TreeTriangles,
      lod2TreeTriangles,
    }),
    dispose: () => {
      disposableGeometries.forEach((g) => g.dispose());
      disposableMaterials.forEach((m) => m.dispose());
    },
  };
}
