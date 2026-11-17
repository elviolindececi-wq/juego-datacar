import * as THREE from 'three';
import type { WeatherMode } from './weatherDynamics';

export type WenoBankLodTier = 'lod0' | 'lod1' | 'lod2';

export interface WenoBankDiagnostics {
  lodTier: WenoBankLodTier;
  distanceToCamera: number;
  signText: 'weno bank';
  disposed: boolean;
  canopyVertexCount: number;
  foliageInstanceCount: number;
}

export interface WenoBankBuilding3DController {
  group: THREE.Group;
  /** Coordenadas locales del carril de llegada VIP (frente a la escalinata) para posicionar el vehículo rival */
  vipDropoffLocalOffset: THREE.Vector3;
  updateLod: (cameraWorldPos: THREE.Vector3) => WenoBankLodTier;
  setWeather: (weather: WeatherMode) => void;
  setEnvMap: (envMap: THREE.Texture | null) => void;
  setLodDistanceScale: (scale: number) => void;
  getDiagnostics: () => WenoBankDiagnostics;
  dispose: () => void;
}

export interface CreateWenoBankBuildingOptions {
  maxAnisotropy?: number;
  isMobilePerf?: boolean;
  initialWeather?: WeatherMode;
  envMap?: THREE.Texture | null;
  lodDistanceScale?: number;
}

const _worldAnchorScratch = new THREE.Vector3();

/**
 * Evalúa la altura escultórica `y` y desplazamiento frontal `z` de la cubierta
 * cerámica de terracota del Weno Bank (inspirada en arquitectura orgánica contemporánea):
 * - Gran arco monumental elevado en el lado izquierdo (`u ≈ 0.25`, `y ≈ 14.3m`) con espacio abierto debajo.
 * - Descenso hacia el apoyo cónico izquierdo (`u = 0`, `y ≈ 2.5m`).
 * - Transición central profunda y retorcida (`u ≈ 0.57`, `y ≈ 3.1m`) sobre apoyo cónico central.
 * - Ala derecha que se extiende horizontalmente y vuelve a levantarse (`u = 1.0`, `y ≈ 8.8m`).
 */
export function evaluateTerracottaCanopySurface(
  u: number,
  v: number,
  target: { x: number; y: number; z: number },
): void {
  const cu = THREE.MathUtils.clamp(u, 0, 1);
  const cv = THREE.MathUtils.clamp(v, 0, 1);

  // Ancho total ~31.6m (-15.8m a +15.8m)
  const x = (cu - 0.5) * 31.6;

  // Perfil transversal longitudinal: gran arco izquierdo -> valle central -> ala derecha ascendente
  const leftArch = 12.15 * Math.exp(-Math.pow((cu - 0.245) / 0.185, 2));
  const farLeftFlare = 2.35 * Math.pow(Math.max(0, 1 - cu / 0.16), 1.4);
  const centralValleyBase = 2.55 + 0.55 * Math.sin(cu * Math.PI);
  const rightWingLift =
    cu > 0.52 ? 6.25 * Math.pow((cu - 0.52) / 0.48, 1.52) : 0;

  // Torsión orgánica entre el frente (v = 1) y la parte posterior (v = 0)
  const twistFrontLift =
    (cv - 0.45) *
    (2.35 * Math.exp(-Math.pow((cu - 0.24) / 0.2, 2)) -
      1.25 * Math.exp(-Math.pow((cu - 0.58) / 0.18, 2)) +
      1.65 * Math.pow(Math.max(0, (cu - 0.62) / 0.38), 1.25));

  // Abovedado transversal suave de la cáscara cerámica
  const transverseVault = Math.sin(cv * Math.PI) * (0.85 + 0.65 * Math.exp(-Math.pow((cu - 0.25) / 0.22, 2)));

  const y = Math.max(2.15, centralValleyBase + leftArch - farLeftFlare * 0.25 + rightWingLift + twistFrontLift + transverseVault * 0.45);

  // Proyección en planta (Z): el arco izquierdo avanza hacia la explanada y el valle central se curva con elegancia
  const depthSpan = 15.2 - 2.6 * Math.exp(-Math.pow((cu - 0.56) / 0.22, 2)) + 1.8 * Math.pow(cu, 2);
  const frontEdgeZ =
    6.4 +
    2.45 * Math.exp(-Math.pow((cu - 0.23) / 0.19, 2)) -
    1.55 * Math.exp(-Math.pow((cu - 0.57) / 0.18, 2)) +
    1.95 * Math.pow(Math.max(0, (cu - 0.68) / 0.32), 1.35);
  const backEdgeZ = frontEdgeZ - depthSpan;
  const z = THREE.MathUtils.lerp(backEdgeZ, frontEdgeZ, cv);

  target.x = x;
  target.y = y;
  target.z = z;
}

/**
 * Construye una `BufferGeometry` cerrada con espesor visible (`thickness = 0.56m`)
 * para la cubierta escultórica de terracota, con coordenadas UV adaptadas a la curvatura `(u, v)`.
 */
function buildTerracottaRibbonCanopyGeometry(
  uSegs: number,
  vSegs: number,
  thickness = 0.56,
): THREE.BufferGeometry {
  const cols = uSegs + 1;
  const rows = vSegs + 1;
  const gridCount = cols * rows;

  const topPos = new Float32Array(gridCount * 3);
  const botPos = new Float32Array(gridCount * 3);
  const gridUvs = new Float32Array(gridCount * 2);

  const p0 = { x: 0, y: 0, z: 0 };
  const pU = { x: 0, y: 0, z: 0 };
  const pV = { x: 0, y: 0, z: 0 };
  const tu = new THREE.Vector3();
  const tv = new THREE.Vector3();
  const nrm = new THREE.Vector3();

  const eps = 0.004;
  for (let iv = 0; iv < rows; iv++) {
    const v = iv / vSegs;
    for (let iu = 0; iu < cols; iu++) {
      const u = iu / uSegs;
      const idx = iv * cols + iu;

      evaluateTerracottaCanopySurface(u, v, p0);
      evaluateTerracottaCanopySurface(Math.min(1, u + eps), v, pU);
      evaluateTerracottaCanopySurface(u, Math.min(1, v + eps), pV);

      tu.set(pU.x - p0.x, pU.y - p0.y, pU.z - p0.z);
      tv.set(pV.x - p0.x, pV.y - p0.y, pV.z - p0.z);
      // tv apunta de atrás (-Z) a adelante (+Z), tu de izq (-X) a der (+X) -> tv × tu apunta hacia +Y
      nrm.crossVectors(tv, tu);
      if (nrm.lengthSq() < 1e-8) {
        nrm.set(0, 1, 0);
      } else {
        nrm.normalize();
        if (nrm.y < 0) nrm.negate();
      }

      const halfT = thickness * 0.5;
      topPos[idx * 3] = p0.x + nrm.x * halfT;
      topPos[idx * 3 + 1] = p0.y + nrm.y * halfT;
      topPos[idx * 3 + 2] = p0.z + nrm.z * halfT;

      botPos[idx * 3] = p0.x - nrm.x * halfT;
      botPos[idx * 3 + 1] = p0.y - nrm.y * halfT;
      botPos[idx * 3 + 2] = p0.z - nrm.z * halfT;

      // Patrón de pequeñas piezas rectangulares adaptado a la curvatura (u, v)
      gridUvs[idx * 2] = u * 15.0;
      gridUvs[idx * 2 + 1] = v * 8.0;
    }
  }

  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  // Cara superior (iluminada naturalmente)
  for (let i = 0; i < gridCount; i++) {
    positions.push(topPos[i * 3], topPos[i * 3 + 1], topPos[i * 3 + 2]);
    uvs.push(gridUvs[i * 2], gridUvs[i * 2 + 1]);
    // Sutil variación cálida entre cumbrera soleada y valle central
    const yVal = topPos[i * 3 + 1];
    const shade = THREE.MathUtils.clamp(0.88 + (yVal / 15.0) * 0.16, 0.86, 1.04);
    colors.push(shade, shade * 0.98, shade * 0.96);
  }
  for (let iv = 0; iv < vSegs; iv++) {
    for (let iu = 0; iu < uSegs; iu++) {
      const a = iv * cols + iu;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  // Cara inferior (bóveda cerámica con oclusión natural bajo el gran arco)
  const botOffset = positions.length / 3;
  for (let iv = 0; iv < rows; iv++) {
    const v = iv / vSegs;
    for (let iu = 0; iu < cols; iu++) {
      const i = iv * cols + iu;
      positions.push(botPos[i * 3], botPos[i * 3 + 1], botPos[i * 3 + 2]);
      uvs.push(gridUvs[i * 2], gridUvs[i * 2 + 1]);
      // Sombras naturales bajo la cubierta (más profundas hacia el interior y más cálidas en el borde)
      const edgeLight = 0.58 + 0.34 * Math.pow(Math.max(0, v), 1.3);
      colors.push(edgeLight * 1.02, edgeLight * 0.94, edgeLight * 0.89);
    }
  }
  for (let iv = 0; iv < vSegs; iv++) {
    for (let iu = 0; iu < uSegs; iu++) {
      const a = botOffset + iv * cols + iu;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  // Bordes perimetrales de espesor visible (frente, dorso, ala izquierda y ala derecha)
  const appendRimStrip = (ringIndices: number[], uvScale: number) => {
    const startVert = positions.length / 3;
    for (let k = 0; k < ringIndices.length; k++) {
      const gi = ringIndices[k];
      const sUv = (k / Math.max(1, ringIndices.length - 1)) * uvScale;
      positions.push(topPos[gi * 3], topPos[gi * 3 + 1], topPos[gi * 3 + 2]);
      uvs.push(sUv, 0.38);
      colors.push(1.02, 0.96, 0.92);

      positions.push(botPos[gi * 3], botPos[gi * 3 + 1], botPos[gi * 3 + 2]);
      uvs.push(sUv, 0.04);
      colors.push(0.84, 0.78, 0.74);
    }
    for (let k = 0; k < ringIndices.length - 1; k++) {
      const t0 = startVert + k * 2;
      const b0 = t0 + 1;
      const t1 = t0 + 2;
      const b1 = t0 + 3;
      indices.push(t0, b0, t1, t1, b0, b1);
    }
  };

  // Borde frontal (v = 1)
  const frontRing: number[] = [];
  for (let iu = 0; iu < cols; iu++) frontRing.push(vSegs * cols + iu);
  appendRimStrip(frontRing, 15.0);

  // Borde posterior (v = 0)
  const backRing: number[] = [];
  for (let iu = cols - 1; iu >= 0; iu--) backRing.push(iu);
  appendRimStrip(backRing, 15.0);

  // Borde izquierdo (u = 0)
  const leftRing: number[] = [];
  for (let iv = vSegs; iv >= 0; iv--) leftRing.push(iv * cols);
  appendRimStrip(leftRing, 8.0);

  // Borde derecho (u = 1)
  const rightRing: number[] = [];
  for (let iv = 0; iv < rows; iv++) rightRing.push(iv * cols + uSegs);
  appendRimStrip(rightRing, 8.0);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}

/**
 * Textura repetible procedural de pequeñas piezas rectangulares de ladrillo/cerámica terracota
 * con variaciones cálidas de cocción y juntas finas (sin dependencias externas ni 404).
 */
function createTerracottaBrickTextures(maxAnisotropy = 4): {
  albedoMap: THREE.Texture;
  bumpRoughnessMap: THREE.Texture;
} {
  const width = 256;
  const height = 256;

  if (typeof document !== 'undefined') {
    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = width;
    colorCanvas.height = height;
    const ctx = colorCanvas.getContext('2d');

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = width;
    bumpCanvas.height = height;
    const bCtx = bumpCanvas.getContext('2d');

    if (ctx && bCtx) {
      // Base de junta de mortero cálido oscuro
      ctx.fillStyle = '#6d3522';
      ctx.fillRect(0, 0, width, height);

      bCtx.fillStyle = '#484848';
      bCtx.fillRect(0, 0, width, height);

      const rows = 16;
      const cols = 8;
      const brickH = height / rows;
      const brickW = width / cols;

      let seed = 918273;
      const nextRand = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };

      for (let r = 0; r < rows; r++) {
        const stagger = (r % 2) * (brickW * 0.5);
        for (let c = -1; c <= cols; c++) {
          const bx = c * brickW + stagger;
          const by = r * brickH;
          const tone = nextRand();
          // Paleta terracota mate con pequeñas variaciones de horneado
          const red = Math.round(166 + tone * 46);
          const green = Math.round(74 + tone * 34);
          const blue = Math.round(46 + tone * 24);
          ctx.fillStyle = `rgb(${red},${green},${blue})`;
          ctx.fillRect(bx + 1.2, by + 1.2, brickW - 2.2, brickH - 2.2);

          // Sutil bisel interno
          ctx.fillStyle = `rgba(255, 198, 158, ${0.06 + nextRand() * 0.08})`;
          ctx.fillRect(bx + 1.6, by + 1.4, brickW - 3.0, 2.0);

          const relief = Math.round(175 + nextRand() * 68);
          bCtx.fillStyle = `rgb(${relief},${relief},${relief})`;
          bCtx.fillRect(bx + 1.3, by + 1.3, brickW - 2.4, brickH - 2.4);
        }
      }

      const albedoMap = new THREE.CanvasTexture(colorCanvas);
      albedoMap.colorSpace = THREE.SRGBColorSpace;
      albedoMap.wrapS = THREE.RepeatWrapping;
      albedoMap.wrapT = THREE.RepeatWrapping;
      albedoMap.anisotropy = maxAnisotropy;
      albedoMap.needsUpdate = true;

      const bumpRoughnessMap = new THREE.CanvasTexture(bumpCanvas);
      bumpRoughnessMap.wrapS = THREE.RepeatWrapping;
      bumpRoughnessMap.wrapT = THREE.RepeatWrapping;
      bumpRoughnessMap.anisotropy = maxAnisotropy;
      bumpRoughnessMap.needsUpdate = true;

      return { albedoMap, bumpRoughnessMap };
    }
  }

  // Fallback DataTexture para entornos sin DOM (ej. node:test)
  const colorBytes = new Uint8Array(64 * 64 * 4);
  const bumpBytes = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) {
    const row = Math.floor(y / 8);
    const isHorizontalMortar = y % 8 === 0;
    for (let x = 0; x < 64; x++) {
      const shiftedX = (x + (row % 2) * 8) % 16;
      const isMortar = isHorizontalMortar || shiftedX === 0;
      const i = (y * 64 + x) * 4;
      const jitter = ((x * 13 + y * 29) % 19) - 9;
      colorBytes[i] = isMortar ? 108 : Math.min(255, 186 + jitter);
      colorBytes[i + 1] = isMortar ? 52 : Math.min(255, 88 + Math.round(jitter * 0.5));
      colorBytes[i + 2] = isMortar ? 35 : Math.min(255, 56 + Math.round(jitter * 0.3));
      colorBytes[i + 3] = 255;

      const bVal = isMortar ? 70 : 210 + (jitter % 20);
      bumpBytes[i] = bVal;
      bumpBytes[i + 1] = bVal;
      bumpBytes[i + 2] = bVal;
      bumpBytes[i + 3] = 255;
    }
  }
  const albedoMap = new THREE.DataTexture(colorBytes, 64, 64, THREE.RGBAFormat);
  albedoMap.colorSpace = THREE.SRGBColorSpace;
  albedoMap.wrapS = THREE.RepeatWrapping;
  albedoMap.wrapT = THREE.RepeatWrapping;
  albedoMap.needsUpdate = true;

  const bumpRoughnessMap = new THREE.DataTexture(bumpBytes, 64, 64, THREE.RGBAFormat);
  bumpRoughnessMap.wrapS = THREE.RepeatWrapping;
  bumpRoughnessMap.wrapT = THREE.RepeatWrapping;
  bumpRoughnessMap.needsUpdate = true;

  return { albedoMap, bumpRoughnessMap };
}

/**
 * Construye una fachada curva acristalada cuya coronación superior acompaña exactamente
 * el intradós del arco izquierdo de terracota, evitando que sobresalga sobre la cubierta.
 */
function buildCurvedCurtainWallGeometry(
  arcSegs: number,
  getRoofClearanceY: (x: number, z: number) => number,
): {
  glassGeometry: THREE.BufferGeometry;
  mullionPositions: Float32Array;
} {
  const centerX = -5.6;
  const centerZ = 0.25;
  const radius = 5.65;
  const startAngle = -Math.PI * 0.34;
  const endAngle = Math.PI * 0.38;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const mullionLines: number[] = [];

  const ringPoints: Array<{ x: number; z: number; topY: number }> = [];

  for (let i = 0; i <= arcSegs; i++) {
    const t = i / arcSegs;
    const ang = THREE.MathUtils.lerp(startAngle, endAngle, t);
    const x = centerX + Math.sin(ang) * radius;
    const z = centerZ + Math.cos(ang) * radius;
    const topY = Math.max(3.6, getRoofClearanceY(x, z) - 0.34);
    ringPoints.push({ x, z, topY });

    // Vértice inferior (sobre plataforma de acceso y = 0.45) y superior (bajo arco)
    positions.push(x, 0.45, z);
    uvs.push(t, 0);
    positions.push(x, topY, z);
    uvs.push(t, topY / 13.5);

    if (i < arcSegs) {
      const b0 = i * 2;
      const t0 = b0 + 1;
      const b1 = b0 + 2;
      const t1 = b0 + 3;
      indices.push(b0, b1, t0, t0, b1, t1);
    }

    // Montantes verticales metálicos delgados cada 3 segmentos
    if (i % 3 === 0) {
      mullionLines.push(x, 0.45, z, x, topY, z);
    }
  }

  // Travesaños horizontales y perfil curvo superior
  const transomHeights = [3.15, 6.1, 9.0];
  for (let i = 0; i < ringPoints.length - 1; i++) {
    const a = ringPoints[i];
    const b = ringPoints[i + 1];
    // Perfil de coronación curvo bajo la bóveda
    mullionLines.push(a.x, a.topY, a.z, b.x, b.topY, b.z);
    for (const th of transomHeights) {
      if (a.topY > th + 0.35 && b.topY > th + 0.35) {
        mullionLines.push(a.x, th, a.z, b.x, th, b.z);
      }
    }
  }

  const glassGeometry = new THREE.BufferGeometry();
  glassGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  glassGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  glassGeometry.setIndex(indices);
  glassGeometry.computeVertexNormals();
  glassGeometry.computeBoundingSphere();

  return {
    glassGeometry,
    mullionPositions: new Float32Array(mullionLines),
  };
}

/**
 * Construye el letrero tridimensional "weno bank" en letras blancas minúsculas,
 * limpias y modernas, usando geometría 3D extruida propia del universo ficticio.
 */
function buildWenoBank3DSignGroup(
  letterMaterial: THREE.Material,
  plinthMaterial: THREE.Material,
  ownedGeometries: THREE.BufferGeometry[],
): THREE.Group {
  const signGroup = new THREE.Group();
  signGroup.name = 'weno_bank_3d_sign';

  // Basamento oscuro elegante sobre el jardín delantero
  const plinthGeo = new THREE.BoxGeometry(10.8, 0.28, 0.92);
  ownedGeometries.push(plinthGeo);
  const plinth = new THREE.Mesh(plinthGeo, plinthMaterial);
  plinth.position.set(0, 0.14, 0);
  signGroup.add(plinth);

  const extrudeOpts: THREE.ExtrudeGeometryOptions = {
    depth: 0.28,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.028,
    bevelSegments: 2,
    curveSegments: 10,
  };

  const makeRingGlyph = (
    outerR: number,
    innerR: number,
    cy: number,
    stemSide?: 'left-tall' | 'right-short' | 'none',
  ): THREE.BufferGeometry => {
    const shape = new THREE.Shape();
    shape.absarc(0, cy, outerR, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, cy, innerR, 0, Math.PI * 2, true);
    shape.holes.push(hole);

    const parts: THREE.BufferGeometry[] = [new THREE.ExtrudeGeometry(shape, extrudeOpts)];
    if (stemSide === 'left-tall') {
      const stem = new THREE.BoxGeometry(0.24, 1.56, 0.32);
      stem.translate(-outerR + 0.11, 0.78, 0.14);
      parts.push(stem);
    } else if (stemSide === 'right-short') {
      const stem = new THREE.BoxGeometry(0.24, 1.06, 0.32);
      stem.translate(outerR - 0.11, 0.53, 0.14);
      parts.push(stem);
    }
    parts.forEach((g) => ownedGeometries.push(g));
    const wrapper = new THREE.BufferGeometry();
    // Devolvemos la primera y agregamos tallos en el grupo por simplicidad sin merge complejo
    void wrapper;
    return parts[0];
  };

  const addBoxBar = (
    parent: THREE.Group,
    w: number,
    h: number,
    cx: number,
    cy: number,
    rotZ = 0,
  ) => {
    const g = new THREE.BoxGeometry(w, h, 0.33);
    ownedGeometries.push(g);
    const m = new THREE.Mesh(g, letterMaterial);
    m.position.set(cx, cy, 0.14);
    m.rotation.z = rotZ;
    parent.add(m);
  };

  const lettersRoot = new THREE.Group();
  lettersRoot.position.set(0, 0.28, -0.14);

  // 1. 'w' (x = -4.45)
  const wGroup = new THREE.Group();
  wGroup.position.x = -4.45;
  addBoxBar(wGroup, 0.23, 1.06, -0.44, 0.54, 0.18);
  addBoxBar(wGroup, 0.22, 0.82, -0.16, 0.43, -0.22);
  addBoxBar(wGroup, 0.22, 0.82, 0.16, 0.43, 0.22);
  addBoxBar(wGroup, 0.23, 1.06, 0.44, 0.54, -0.18);
  lettersRoot.add(wGroup);

  // 2. 'e' (x = -3.18)
  const eGroup = new THREE.Group();
  eGroup.position.x = -3.18;
  const eShape = new THREE.Shape();
  eShape.absarc(0, 0.54, 0.52, 0.32, Math.PI * 1.84, false);
  eShape.lineTo(0.32, 0.26);
  eShape.absarc(0, 0.54, 0.29, Math.PI * 1.8, 0.25, true);
  eShape.closePath();
  const eGeo = new THREE.ExtrudeGeometry(eShape, extrudeOpts);
  ownedGeometries.push(eGeo);
  eGroup.add(new THREE.Mesh(eGeo, letterMaterial));
  addBoxBar(eGroup, 0.96, 0.21, 0.02, 0.56, 0);
  lettersRoot.add(eGroup);

  // 3. 'n' (x = -1.98)
  const makeLetterN = (posX: number) => {
    const nGroup = new THREE.Group();
    nGroup.position.x = posX;
    addBoxBar(nGroup, 0.24, 1.04, -0.37, 0.52, 0);
    addBoxBar(nGroup, 0.24, 0.78, 0.37, 0.39, 0);
    const archShape = new THREE.Shape();
    archShape.absarc(0, 0.68, 0.49, 0, Math.PI, false);
    archShape.lineTo(-0.25, 0.68);
    archShape.absarc(0, 0.68, 0.25, Math.PI, 0, true);
    archShape.closePath();
    const archGeo = new THREE.ExtrudeGeometry(archShape, extrudeOpts);
    ownedGeometries.push(archGeo);
    nGroup.add(new THREE.Mesh(archGeo, letterMaterial));
    return nGroup;
  };
  lettersRoot.add(makeLetterN(-1.98));

  // 4. 'o' (x = -0.78)
  const oGroup = new THREE.Group();
  oGroup.position.x = -0.78;
  oGroup.add(new THREE.Mesh(makeRingGlyph(0.53, 0.29, 0.54, 'none'), letterMaterial));
  lettersRoot.add(oGroup);

  // Espacio entre "weno" y "bank"

  // 5. 'b' (x = 0.85)
  const bGroup = new THREE.Group();
  bGroup.position.x = 0.85;
  bGroup.add(new THREE.Mesh(makeRingGlyph(0.52, 0.28, 0.54, 'none'), letterMaterial));
  addBoxBar(bGroup, 0.24, 1.58, -0.4, 0.79, 0);
  lettersRoot.add(bGroup);

  // 6. 'a' (x = 2.06)
  const aGroup = new THREE.Group();
  aGroup.position.x = 2.06;
  aGroup.add(new THREE.Mesh(makeRingGlyph(0.52, 0.28, 0.54, 'none'), letterMaterial));
  addBoxBar(aGroup, 0.24, 1.04, 0.4, 0.52, 0);
  lettersRoot.add(aGroup);

  // 7. 'n' (x = 3.28)
  lettersRoot.add(makeLetterN(3.28));

  // 8. 'k' (x = 4.46)
  const kGroup = new THREE.Group();
  kGroup.position.x = 4.46;
  addBoxBar(kGroup, 0.24, 1.58, -0.34, 0.79, 0);
  addBoxBar(kGroup, 0.22, 0.78, 0.08, 0.76, -0.68);
  addBoxBar(kGroup, 0.22, 0.82, 0.12, 0.36, 0.66);
  lettersRoot.add(kGroup);

  lettersRoot.userData.exactSignText = 'weno bank';
  signGroup.add(lettersRoot);
  return signGroup;
}

/**
 * Crea el edificio tridimensional `WenoBankBuilding3D` con:
 * - Cubierta escultórica asimétrica de cerámica terracota (`BufferGeometry`)
 * - Fachada curva acristalada, puertas principales, vestíbulo interior y escalinata semicircular
 * - Jardines tropicales instanciados, palmeras ornamentales, zona VIP de limusinas y letrero 3D "weno bank"
 * - 3 niveles de LOD estables (`lod0`, `lod1`, `lod2`) y adaptación climática sin duplicar modelos.
 */
export function createWenoBankBuilding3D(
  options: CreateWenoBankBuildingOptions = {},
): WenoBankBuilding3DController {
  const maxAnisotropy = Math.max(1, options.maxAnisotropy ?? 4);
  const isMobilePerf = Boolean(options.isMobilePerf);

  const group = new THREE.Group();
  group.name = 'WenoBankBuilding3D';

  const ownedGeometries: THREE.BufferGeometry[] = [];
  const ownedMaterials: THREE.Material[] = [];
  const ownedTextures: THREE.Texture[] = [];

  const { albedoMap, bumpRoughnessMap } = createTerracottaBrickTextures(maxAnisotropy);
  ownedTextures.push(albedoMap, bumpRoughnessMap);

  const envMap = options.envMap ?? null;
  let lodDistanceScale = THREE.MathUtils.clamp(options.lodDistanceScale ?? 1.0, 0.5, 1.5);

  // Material mate de cerámica terracota con sutiles variaciones por vértice y relieve
  const terracottaMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: albedoMap,
    bumpMap: bumpRoughnessMap,
    bumpScale: 0.048,
    roughnessMap: bumpRoughnessMap,
    roughness: 0.85,
    metalness: 0.04,
    vertexColors: true,
    envMap,
    envMapIntensity: 0.32,
    emissive: new THREE.Color('#3b160b'),
    emissiveIntensity: 0.08,
  });
  ownedMaterials.push(terracottaMaterial);

  const concretePierMaterial = new THREE.MeshStandardMaterial({
    color: '#9ca39b',
    roughness: 0.86,
    metalness: 0.06,
    envMap,
    envMapIntensity: 0.35,
  });
  const darkMetalMaterial = new THREE.MeshStandardMaterial({
    color: '#111822',
    roughness: 0.34,
    metalness: 0.80,
    envMap,
    envMapIntensity: 0.92,
  });
  const mullionLineMaterial = new THREE.LineBasicMaterial({
    color: '#0b121c',
  });
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: '#b8e4f7',
    roughness: 0.07,
    metalness: 0.16,
    reflectivity: 0.94,
    ior: 1.52,
    clearcoat: 0.92,
    clearcoatRoughness: 0.05,
    transparent: true,
    opacity: 0.56,
    depthWrite: false,
    envMap,
    envMapIntensity: 1.45,
    emissive: new THREE.Color('#133a52'),
    emissiveIntensity: 0.14,
  });
  const lobbyInteriorMaterial = new THREE.MeshStandardMaterial({
    color: '#e5d0b3',
    roughness: 0.72,
    metalness: 0.05,
    emissive: new THREE.Color('#ffbe73'),
    emissiveIntensity: 0.28,
  });
  const stoneStepMaterial = new THREE.MeshStandardMaterial({
    color: '#b9bebc',
    roughness: 0.78,
    metalness: 0.05,
  });
  const plazaPavingMaterial = new THREE.MeshStandardMaterial({
    color: '#8f7d6e',
    roughness: 0.82,
    metalness: 0.04,
    envMap,
    envMapIntensity: 0.40,
  });
  const vipAsphaltMaterial = new THREE.MeshStandardMaterial({
    color: '#252b34',
    roughness: 0.78,
    metalness: 0.06,
    envMap,
    envMapIntensity: 0.42,
  });
  const planterCurbMaterial = new THREE.MeshStandardMaterial({
    color: '#a36e53',
    roughness: 0.85,
    metalness: 0.03,
  });
  const foliageMaterial = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.66,
    metalness: 0.04,
    emissive: new THREE.Color('#0a3b1f'),
    emissiveIntensity: 0.08,
  });
  const palmTrunkMaterial = new THREE.MeshStandardMaterial({
    color: '#6b533e',
    roughness: 0.88,
    metalness: 0.02,
  });
  const signLetterMaterial = new THREE.MeshStandardMaterial({
    color: '#f8fafc',
    roughness: 0.24,
    metalness: 0.12,
    envMap,
    envMapIntensity: 0.65,
    emissive: new THREE.Color('#e2f1ff'),
    emissiveIntensity: 0.22,
  });
  const signPlinthMaterial = new THREE.MeshStandardMaterial({
    color: '#0c131d',
    roughness: 0.38,
    metalness: 0.62,
    envMap,
    envMapIntensity: 0.75,
  });
  const uplightGlowMaterial = new THREE.MeshBasicMaterial({
    color: '#10b981',
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });
  ownedMaterials.push(
    concretePierMaterial,
    darkMetalMaterial,
    mullionLineMaterial,
    glassMaterial,
    lobbyInteriorMaterial,
    stoneStepMaterial,
    plazaPavingMaterial,
    vipAsphaltMaterial,
    planterCurbMaterial,
    foliageMaterial,
    palmTrunkMaterial,
    signLetterMaterial,
    signPlinthMaterial,
    uplightGlowMaterial,
  );

  // =========================================================================
  // SUBGRUPOS POR NIVEL DE DETALLE (LOD0 cercano, LOD1 medio, LOD2 lejano)
  // =========================================================================
  const baseStructureGroup = new THREE.Group(); // Siempre visible (veredas, explanada, acceso VIP)
  const canopyNearMidGroup = new THREE.Group(); // Cubierta de alta definición (LOD0 y LOD1)
  const canopyFarGroup = new THREE.Group(); // Silueta simplificada (LOD2)
  const midDetailGroup = new THREE.Group(); // Fachada curva cristal, apoyos cónicos, escalinata, cartel "weno bank" (LOD0 y LOD1)
  const nearDetailGroup = new THREE.Group(); // Jardín tropical instanciado, palmeras, costillas metálicas, vestíbulo interior, luminarias (LOD0)

  group.add(baseStructureGroup, canopyNearMidGroup, canopyFarGroup, midDetailGroup, nearDetailGroup);

  // 1. EXPLANADA DE ENTRADA, VEREDAS Y ZONA DE LLEGADA DE LIMUSINAS (VIP)
  const plazaGeo = new THREE.BoxGeometry(36.0, 0.18, 22.0);
  ownedGeometries.push(plazaGeo);
  const plazaMesh = new THREE.Mesh(plazaGeo, plazaPavingMaterial);
  plazaMesh.position.set(0, 0.05, 1.5);
  plazaMesh.receiveShadow = true;
  baseStructureGroup.add(plazaMesh);

  // Bahía vehicular VIP ("Zona de llegada de limusinas") frente al edificio, fuera de la calzada principal
  const vipDriveGeo = new THREE.BoxGeometry(28.0, 0.14, 5.2);
  ownedGeometries.push(vipDriveGeo);
  const vipDriveMesh = new THREE.Mesh(vipDriveGeo, vipAsphaltMaterial);
  vipDriveMesh.position.set(-1.5, 0.09, 13.1);
  vipDriveMesh.receiveShadow = true;
  baseStructureGroup.add(vipDriveMesh);

  const vipCurbGeo = new THREE.BoxGeometry(28.4, 0.22, 0.36);
  ownedGeometries.push(vipCurbGeo);
  const vipCurbMesh = new THREE.Mesh(vipCurbGeo, planterCurbMaterial);
  vipCurbMesh.position.set(-1.5, 0.15, 10.35);
  baseStructureGroup.add(vipCurbMesh);

  // 2. CUBIERTA ESCULTÓRICA DE TERRACOTA (Alta resolución LOD0/LOD1 + Silueta optimizada LOD2)
  const canopyHiGeo = buildTerracottaRibbonCanopyGeometry(
    isMobilePerf ? 40 : 54,
    isMobilePerf ? 14 : 20,
    0.58,
  );
  const canopyFarGeo = buildTerracottaRibbonCanopyGeometry(20, 7, 0.58);
  ownedGeometries.push(canopyHiGeo, canopyFarGeo);

  const canopyHiMesh = new THREE.Mesh(canopyHiGeo, terracottaMaterial);
  canopyHiMesh.name = 'weno_bank_terracotta_canopy_hi';
  canopyHiMesh.castShadow = !isMobilePerf;
  canopyHiMesh.receiveShadow = true;
  canopyNearMidGroup.add(canopyHiMesh);

  const canopyFarMesh = new THREE.Mesh(canopyFarGeo, terracottaMaterial);
  canopyFarMesh.name = 'weno_bank_terracotta_canopy_far';
  canopyFarGroup.add(canopyFarMesh);

  // Volumen interior simplificado para LOD2 lejano
  const farCoreGeo = new THREE.CylinderGeometry(5.3, 5.5, 9.2, 12);
  ownedGeometries.push(farCoreGeo);
  const farCoreMesh = new THREE.Mesh(farCoreGeo, glassMaterial);
  farCoreMesh.position.set(-5.6, 4.8, 0.25);
  canopyFarGroup.add(farCoreMesh);

  // Función auxiliar para consultar la altura interior del techo sobre cualquier punto (x, z)
  const roofSampleScratch = { x: 0, y: 0, z: 0 };
  const getRoofClearanceY = (wx: number, wz: number): number => {
    const uApprox = THREE.MathUtils.clamp(wx / 31.6 + 0.5, 0, 1);
    const vApprox = THREE.MathUtils.clamp((wz + 7.5) / 15.2, 0, 1);
    evaluateTerracottaCanopySurface(uApprox, vApprox, roofSampleScratch);
    return roofSampleScratch.y - 0.3;
  };

  // 3. COLUMNAS TRONCOCÓNICAS DE HORMIGÓN Y BRAZOS METÁLICOS PORTANTES (como en la referencia)
  const pierGeo = new THREE.CylinderGeometry(0.68, 1.18, 2.75, 16);
  const spreaderArmGeo = new THREE.BoxGeometry(3.8, 0.32, 0.55);
  ownedGeometries.push(pierGeo, spreaderArmGeo);

  const pierPositions: ReadonlyArray<{ x: number; z: number; armTiltZ: number }> = [
    { x: -11.6, z: 3.2, armTiltZ: 0.28 },
    { x: 2.35, z: 4.15, armTiltZ: -0.18 },
    { x: 11.4, z: -1.8, armTiltZ: 0.22 },
  ];
  for (const p of pierPositions) {
    const pier = new THREE.Mesh(pierGeo, concretePierMaterial);
    pier.position.set(p.x, 1.38, p.z);
    midDetailGroup.add(pier);

    const arm = new THREE.Mesh(spreaderArmGeo, darkMetalMaterial);
    arm.position.set(p.x + (p.armTiltZ > 0 ? 0.8 : -0.6), 2.85, p.z);
    arm.rotation.z = p.armTiltZ;
    midDetailGroup.add(arm);
  }

  // 4. FACHADA CURVA ACRISTALADA, PUERTAS PRINCIPALES Y ESCALINATA SEMICIRCULAR
  const { glassGeometry, mullionPositions } = buildCurvedCurtainWallGeometry(
    isMobilePerf ? 18 : 26,
    getRoofClearanceY,
  );
  ownedGeometries.push(glassGeometry);
  const glassFacadeMesh = new THREE.Mesh(glassGeometry, glassMaterial);
  glassFacadeMesh.name = 'weno_bank_curved_glass_facade';
  glassFacadeMesh.renderOrder = 2;
  midDetailGroup.add(glassFacadeMesh);

  const mullionGeo = new THREE.BufferGeometry();
  mullionGeo.setAttribute('position', new THREE.BufferAttribute(mullionPositions, 3));
  ownedGeometries.push(mullionGeo);
  const mullionLines = new THREE.LineSegments(mullionGeo, mullionLineMaterial);
  midDetailGroup.add(mullionLines);

  // Marco y puertas dobles de acceso principal reconocibles
  const doorPortalGroup = new THREE.Group();
  doorPortalGroup.position.set(-5.6, 0.45, 5.88);
  const jambGeo = new THREE.BoxGeometry(0.16, 3.1, 0.24);
  const lintelGeo = new THREE.BoxGeometry(3.1, 0.18, 0.28);
  const handleGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.15, 8);
  ownedGeometries.push(jambGeo, lintelGeo, handleGeo);

  for (const sx of [-1.46, 0, 1.46]) {
    const jamb = new THREE.Mesh(jambGeo, darkMetalMaterial);
    jamb.position.set(sx, 1.55, 0);
    doorPortalGroup.add(jamb);
  }
  const lintel = new THREE.Mesh(lintelGeo, darkMetalMaterial);
  lintel.position.set(0, 3.1, 0);
  doorPortalGroup.add(lintel);

  for (const hx of [-0.22, 0.22]) {
    const handle = new THREE.Mesh(handleGeo, signLetterMaterial);
    handle.position.set(hx, 1.42, 0.14);
    doorPortalGroup.add(handle);
  }
  midDetailGroup.add(doorPortalGroup);

  // Plataforma de acceso semicircular de 3 escalones suaves ("escalinata suave")
  for (let s = 0; s < 3; s++) {
    const stepR = 5.4 - s * 0.62;
    const stepGeo = new THREE.CylinderGeometry(stepR, stepR + 0.12, 0.16, 22, 1, false, -Math.PI * 0.48, Math.PI * 0.96);
    ownedGeometries.push(stepGeo);
    const stepMesh = new THREE.Mesh(stepGeo, stoneStepMaterial);
    stepMesh.position.set(-5.6, 0.14 + s * 0.15, 4.55);
    stepMesh.receiveShadow = true;
    midDetailGroup.add(stepMesh);
  }

  // Vestíbulo interior simplificado visible a través del cristal
  const lobbyWallGeo = new THREE.CylinderGeometry(3.8, 3.8, 7.6, 16, 1, false, -Math.PI * 0.65, Math.PI * 1.3);
  const lobbyDeskGeo = new THREE.BoxGeometry(3.4, 1.05, 0.95);
  const innerColGeo = new THREE.CylinderGeometry(0.22, 0.22, 8.2, 10);
  ownedGeometries.push(lobbyWallGeo, lobbyDeskGeo, innerColGeo);

  const lobbyWall = new THREE.Mesh(lobbyWallGeo, lobbyInteriorMaterial);
  lobbyWall.position.set(-5.6, 4.2, -0.8);
  midDetailGroup.add(lobbyWall);

  const lobbyDesk = new THREE.Mesh(lobbyDeskGeo, darkMetalMaterial);
  lobbyDesk.position.set(-5.6, 0.98, 2.2);
  nearDetailGroup.add(lobbyDesk);

  for (const cx of [-8.2, -3.0]) {
    const col = new THREE.Mesh(innerColGeo, darkMetalMaterial);
    col.position.set(cx, 4.5, 1.3);
    nearDetailGroup.add(col);
  }

  // Costillas estructurales oscuras bajo la transición central del techo
  const ribGeo = new THREE.BoxGeometry(0.22, 0.34, 8.8);
  ownedGeometries.push(ribGeo);
  for (let r = 0; r < 4; r++) {
    const uRib = 0.46 + r * 0.11;
    evaluateTerracottaCanopySurface(uRib, 0.5, roofSampleScratch);
    const rib = new THREE.Mesh(ribGeo, darkMetalMaterial);
    rib.position.set(roofSampleScratch.x, roofSampleScratch.y - 0.42, roofSampleScratch.z);
    rib.rotation.z = -0.18 + r * 0.12;
    nearDetailGroup.add(rib);
  }

  // 5. CARTEL INSTITUCIONAL TRIDIMENSIONAL "weno bank" EN EL JARDÍN DELANTERO
  const sign3DGroup = buildWenoBank3DSignGroup(
    signLetterMaterial,
    signPlinthMaterial,
    ownedGeometries,
  );
  // Ubicado en el jardín delantero derecho como en la fotografía de referencia
  sign3DGroup.position.set(4.5, 0.34, 8.65);
  sign3DGroup.rotation.y = -0.08;
  midDetailGroup.add(sign3DGroup);

  // Canteros tropicales delanteros (derecho e izquierdo de la escalinata)
  const rightPlanterGeo = new THREE.BoxGeometry(14.6, 0.42, 4.6);
  const leftPlanterGeo = new THREE.BoxGeometry(5.6, 0.42, 3.8);
  ownedGeometries.push(rightPlanterGeo, leftPlanterGeo);

  const rightPlanter = new THREE.Mesh(rightPlanterGeo, planterCurbMaterial);
  rightPlanter.position.set(5.4, 0.24, 7.1);
  midDetailGroup.add(rightPlanter);

  const leftPlanter = new THREE.Mesh(leftPlanterGeo, planterCurbMaterial);
  leftPlanter.position.set(-12.6, 0.24, 6.4);
  midDetailGroup.add(leftPlanter);

  // 6. PAISAJISMO TROPICAL INSTANCIADO (plantas ornamentales verdes + palmeras pequeñas)
  const shrubClusterCount = isMobilePerf ? 28 : 44;
  const shrubGeo = new THREE.DodecahedronGeometry(0.72, 1);
  ownedGeometries.push(shrubGeo);
  const shrubInstanced = new THREE.InstancedMesh(shrubGeo, foliageMaterial, shrubClusterCount);
  shrubInstanced.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(shrubClusterCount * 3),
    3,
  );

  const dummy = new THREE.Object3D();
  const colorTmp = new THREE.Color();
  const greenPalette = ['#15803d', '#166534', '#1e8e3e', '#0f766e', '#229954'];

  for (let i = 0; i < shrubClusterCount; i++) {
    const inRightGarden = i < Math.floor(shrubClusterCount * 0.74);
    const t = i / shrubClusterCount;
    const gx = inRightGarden
      ? -1.2 + ((i * 37) % 100) * 0.132
      : -15.0 + ((i * 53) % 100) * 0.048;
    const gz = inRightGarden
      ? 5.2 + ((i * 29) % 100) * 0.036
      : 4.9 + ((i * 41) % 100) * 0.028;
    const scaleX = 0.85 + (i % 5) * 0.14;
    const scaleY = 0.55 + (i % 4) * 0.12;
    dummy.position.set(gx, 0.58 + scaleY * 0.22, gz);
    dummy.rotation.set(0, t * Math.PI * 4, 0);
    dummy.scale.set(scaleX, scaleY, scaleX * 0.92);
    dummy.updateMatrix();
    shrubInstanced.setMatrixAt(i, dummy.matrix);
    colorTmp.set(greenPalette[i % greenPalette.length]);
    shrubInstanced.setColorAt(i, colorTmp);
  }
  shrubInstanced.instanceMatrix.needsUpdate = true;
  if (shrubInstanced.instanceColor) shrubInstanced.instanceColor.needsUpdate = true;
  shrubInstanced.computeBoundingSphere();
  nearDetailGroup.add(shrubInstanced);

  // Palmeras pequeñas ornamentales paraguayas (tronco estilizado + penacho de hojas)
  const palmTrunkGeo = new THREE.CylinderGeometry(0.1, 0.17, 2.65, 7);
  const palmFrondGeo = new THREE.ConeGeometry(0.28, 1.85, 4);
  palmFrondGeo.rotateX(Math.PI * 0.42);
  ownedGeometries.push(palmTrunkGeo, palmFrondGeo);

  const palmLocations: ReadonlyArray<{ x: number; z: number; hScale: number }> = [
    { x: -13.4, z: 6.2, hScale: 1.05 },
    { x: -0.4, z: 6.1, hScale: 0.92 },
    { x: 4.8, z: 5.7, hScale: 1.15 },
    { x: 10.6, z: 6.3, hScale: 1.08 },
    { x: 12.8, z: 4.6, hScale: 0.96 },
  ];
  for (const pl of palmLocations) {
    const palm = new THREE.Group();
    palm.position.set(pl.x, 0.42, pl.z);
    palm.scale.setScalar(pl.hScale);
    const trunk = new THREE.Mesh(palmTrunkGeo, palmTrunkMaterial);
    trunk.position.y = 1.3;
    palm.add(trunk);
    for (let f = 0; f < 6; f++) {
      const frond = new THREE.Mesh(palmFrondGeo, foliageMaterial);
      frond.position.y = 2.55;
      frond.rotation.y = (f / 6) * Math.PI * 2;
      palm.add(frond);
    }
    nearDetailGroup.add(palm);
  }

  // Iluminación exterior discreta (bañadores esmeralda/cálidos sobre los apoyos y jardín, sin PointLights costosos)
  const uplightDiscGeo = new THREE.CircleGeometry(1.45, 16);
  uplightDiscGeo.rotateX(-Math.PI / 2);
  ownedGeometries.push(uplightDiscGeo);
  for (const ux of [-11.4, 2.2, 6.5]) {
    const disc = new THREE.Mesh(uplightDiscGeo, uplightGlowMaterial);
    disc.position.set(ux, 0.48, 6.2);
    nearDetailGroup.add(disc);
  }

  // Estado dinámico de LOD con histéresis de 8m para evitar saltos visuales
  let currentLodTier: WenoBankLodTier = 'lod0';
  let lastCameraDistance = 0;
  let isDisposed = false;

  const applyLodVisibility = (tier: WenoBankLodTier) => {
    currentLodTier = tier;
    canopyNearMidGroup.visible = tier === 'lod0' || tier === 'lod1';
    canopyFarGroup.visible = tier === 'lod2';
    midDetailGroup.visible = tier === 'lod0' || tier === 'lod1';
    nearDetailGroup.visible = tier === 'lod0';
  };
  applyLodVisibility('lod0');

  const setWeather = (weather: WeatherMode) => {
    if (isDisposed) return;
    if (weather === 'storm') {
      // Noche / Tormenta: fachada acristalada y letrero iluminados con calidez arquitectónica
      terracottaMaterial.emissive.set('#4c1d0d');
      terracottaMaterial.emissiveIntensity = 0.24;
      terracottaMaterial.roughness = 0.64;
      lobbyInteriorMaterial.emissiveIntensity = 0.78;
      signLetterMaterial.emissiveIntensity = 0.62;
      glassMaterial.opacity = 0.62;
      vipAsphaltMaterial.roughness = 0.22;
      plazaPavingMaterial.roughness = 0.34;
      uplightGlowMaterial.opacity = 0.52;
    } else if (weather === 'rain' || weather === 'flood') {
      // Lluvia / Raudal: reflejos en cristales y pavimento mojado
      terracottaMaterial.emissive.set('#38150a');
      terracottaMaterial.emissiveIntensity = 0.14;
      terracottaMaterial.roughness = 0.68;
      lobbyInteriorMaterial.emissiveIntensity = 0.52;
      signLetterMaterial.emissiveIntensity = 0.42;
      glassMaterial.opacity = 0.64;
      vipAsphaltMaterial.roughness = 0.18;
      plazaPavingMaterial.roughness = 0.28;
      uplightGlowMaterial.opacity = 0.38;
    } else if (weather === 'dawn') {
      // Amanecer dorado: reflejos tibios sobre la bóveda cerámica terracota y calzada seca
      terracottaMaterial.emissive.set('#5c230f');
      terracottaMaterial.emissiveIntensity = 0.16;
      terracottaMaterial.roughness = 0.82;
      lobbyInteriorMaterial.emissiveIntensity = 0.40;
      signLetterMaterial.emissiveIntensity = 0.32;
      glassMaterial.opacity = 0.56;
      vipAsphaltMaterial.roughness = 0.68;
      plazaPavingMaterial.roughness = 0.80;
      uplightGlowMaterial.opacity = 0.36;
    } else if (weather === 'cloudy') {
      // Tarde nublada cálida sobre la cerámica terracota
      terracottaMaterial.emissive.set('#4c1d0d');
      terracottaMaterial.emissiveIntensity = 0.14;
      terracottaMaterial.roughness = 0.82;
      lobbyInteriorMaterial.emissiveIntensity = 0.42;
      signLetterMaterial.emissiveIntensity = 0.32;
      glassMaterial.opacity = 0.56;
      vipAsphaltMaterial.roughness = 0.64;
      plazaPavingMaterial.roughness = 0.78;
      uplightGlowMaterial.opacity = 0.34;
    } else {
      // Día soleado: iluminación natural y cerámica mate
      terracottaMaterial.emissive.set('#2e1108');
      terracottaMaterial.emissiveIntensity = 0.06;
      terracottaMaterial.roughness = 0.86;
      lobbyInteriorMaterial.emissiveIntensity = 0.24;
      signLetterMaterial.emissiveIntensity = 0.16;
      glassMaterial.opacity = 0.52;
      vipAsphaltMaterial.roughness = 0.72;
      plazaPavingMaterial.roughness = 0.84;
      uplightGlowMaterial.opacity = 0.22;
    }
  };

  setWeather(options.initialWeather ?? 'sunny');

  const setEnvMap = (nextEnvMap: THREE.Texture | null) => {
    if (isDisposed) return;
    const targetMats = [
      terracottaMaterial,
      concretePierMaterial,
      darkMetalMaterial,
      glassMaterial,
      plazaPavingMaterial,
      vipAsphaltMaterial,
      signLetterMaterial,
      signPlinthMaterial,
    ];
    for (const m of targetMats) {
      m.envMap = nextEnvMap;
      m.needsUpdate = true;
    }
  };

  const setLodDistanceScale = (scale: number) => {
    lodDistanceScale = THREE.MathUtils.clamp(scale, 0.5, 1.5);
  };

  const updateLod = (cameraWorldPos: THREE.Vector3): WenoBankLodTier => {
    if (isDisposed) return currentLodTier;
    group.getWorldPosition(_worldAnchorScratch);
    const dist = _worldAnchorScratch.distanceTo(cameraWorldPos);
    lastCameraDistance = dist;

    const lod0Max = (isMobilePerf ? 115 : 145) * lodDistanceScale;
    const lod1Max = (isMobilePerf ? 245 : 300) * lodDistanceScale;
    const hysteresis = 8;

    let nextTier = currentLodTier;
    if (currentLodTier === 'lod0') {
      if (dist > lod1Max + hysteresis) nextTier = 'lod2';
      else if (dist > lod0Max + hysteresis) nextTier = 'lod1';
    } else if (currentLodTier === 'lod1') {
      if (dist < lod0Max - hysteresis) nextTier = 'lod0';
      else if (dist > lod1Max + hysteresis) nextTier = 'lod2';
    } else {
      if (dist < lod0Max - hysteresis) nextTier = 'lod0';
      else if (dist < lod1Max - hysteresis) nextTier = 'lod1';
    }

    if (nextTier !== currentLodTier) {
      applyLodVisibility(nextTier);
    }
    return currentLodTier;
  };

  const getDiagnostics = (): WenoBankDiagnostics => ({
    lodTier: currentLodTier,
    distanceToCamera: lastCameraDistance,
    signText: 'weno bank',
    disposed: isDisposed,
    canopyVertexCount: canopyHiGeo.getAttribute('position').count,
    foliageInstanceCount: shrubClusterCount,
  });

  const dispose = () => {
    if (isDisposed) return;
    isDisposed = true;
    for (const g of ownedGeometries) g.dispose();
    for (const m of ownedMaterials) m.dispose();
    for (const t of ownedTextures) t.dispose();
    ownedGeometries.length = 0;
    ownedMaterials.length = 0;
    ownedTextures.length = 0;
  };

  return {
    group,
    vipDropoffLocalOffset: new THREE.Vector3(-4.2, 0.16, 13.1),
    updateLod,
    setWeather,
    setEnvMap,
    setLodDistanceScale,
    getDiagnostics,
    dispose,
  };
}
