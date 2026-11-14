import * as THREE from 'three';

/**
 * Materiales PBR fotorrealistas y shaders de superficie estilo Need for Speed: Most Wanted (2005)
 * (estética otoñal-industrial cruda modernizada) aplicados exclusivamente sobre las mallas,
 * posiciones, escalas y siluetas existentes del escenario sin alterar la geometría.
 */

export type BuildingArchetype = 'concrete' | 'brick' | 'stucco' | 'industrial_metal';

export interface PhotorealEnvironmentController {
  textures: THREE.Texture[];
  trunkMaterial: THREE.MeshStandardMaterial;
  foliageMaterial: THREE.MeshStandardMaterial;
  foliageCutoutMaterial: THREE.MeshStandardMaterial;
  palmTrunkMaterial: THREE.MeshStandardMaterial;
  palmLeafMaterial: THREE.MeshStandardMaterial;
  hedgeMaterial: THREE.MeshStandardMaterial;
  utilityWoodPoleMaterial: THREE.MeshStandardMaterial;
  rustedUtilityMetalMaterial: THREE.MeshStandardMaterial;
  ceramicInsulatorMaterial: THREE.MeshPhysicalMaterial;
  guardrailMetalMaterial: THREE.MeshStandardMaterial;
  retainingWallMaterial: THREE.MeshStandardMaterial;
  groundGrassMaterial: THREE.MeshStandardMaterial;
  lushGrassMaterial: THREE.MeshStandardMaterial;
  distantBankGrassMaterial: THREE.MeshStandardMaterial;
  sidewalkMaterial: THREE.MeshStandardMaterial;
  curbMaterial: THREE.MeshStandardMaterial;
  roofCapMaterial: THREE.MeshStandardMaterial;
  facadeMaterials: THREE.MeshStandardMaterial[];
  towerMaterials: THREE.MeshPhysicalMaterial[];
  windowPaneMaterial: THREE.MeshPhysicalMaterial;
  reflectiveMaterials: Array<THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial>;
  applyMaxAnisotropy: (anisotropy: number) => void;
  update: (timeSec: number, sunDir?: readonly [number, number, number]) => void;
  dispose: () => void;
}

export interface PhotorealEnvironmentOptions {
  historical?: boolean;
  wet?: boolean;
  halfRoadWidth?: number;
  maxAnisotropy?: number;
}

// ---------------------------------------------------------------------------
// Utilidades deterministas de ruido procedural 2D tileable (sin dependencias externas)
// ---------------------------------------------------------------------------

function hash2D(ix: number, iy: number, seed: number): number {
  let n = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function tileableValueNoise(u: number, v: number, periodX: number, periodY: number, seed: number): number {
  const x = ((u % 1) + 1) % 1 * periodX;
  const y = ((v % 1) + 1) % 1 * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  const ix0 = ((x0 % periodX) + periodX) % periodX;
  const ix1 = (ix0 + 1) % periodX;
  const iy0 = ((y0 % periodY) + periodY) % periodY;
  const iy1 = (iy0 + 1) % periodY;

  const a = hash2D(ix0, iy0, seed);
  const b = hash2D(ix1, iy0, seed);
  const c = hash2D(ix0, iy1, seed);
  const d = hash2D(ix1, iy1, seed);

  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function tileableFbm(u: number, v: number, basePeriodX: number, basePeriodY: number, seed: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let px = basePeriodX;
  let py = basePeriodY;
  for (let o = 0; o < octaves; o++) {
    sum += tileableValueNoise(u, v, px, py, seed + o * 97) * amp;
    norm += amp;
    amp *= 0.5;
    px *= 2;
    py *= 2;
  }
  return sum / (norm || 1);
}

/**
 * Convierte un campo de alturas tileable (Float32Array 0..1) en un mapa de normales
 * en espacio tangente (THREE.DataTexture RGBA en linear NoColorSpace).
 */
function buildNormalTextureFromHeightField(
  heightField: Float32Array,
  size: number,
  strength: number,
): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const mask = size - 1;
  for (let y = 0; y < size; y++) {
    const ym = ((y - 1) & mask) * size;
    const yc = y * size;
    const yp = ((y + 1) & mask) * size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1) & mask;
      const xp = (x + 1) & mask;

      const tl = heightField[ym + xm];
      const tc = heightField[ym + x];
      const tr = heightField[ym + xp];
      const ml = heightField[yc + xm];
      const mr = heightField[yc + xp];
      const bl = heightField[yp + xm];
      const bc = heightField[yp + x];
      const br = heightField[yp + xp];

      // Operador Sobel para gradientes nítidos libres de aliasing
      const dX = (tr + 2 * mr + br - (tl + 2 * ml + bl)) * strength;
      const dY = (bl + 2 * bc + br - (tl + 2 * tc + tr)) * strength;

      let nx = -dX;
      let ny = -dY;
      let nz = 1.0;
      const invLen = 1.0 / Math.hypot(nx, ny, nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      const idx = (yc + x) * 4;
      data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function buildGrayscaleDataTexture(
  field: Float32Array,
  size: number,
): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const v = Math.max(0, Math.min(255, Math.round(field[i] * 255)));
    const idx = i * 4;
    data[idx] = v;
    data[idx + 1] = v;
    data[idx + 2] = v;
    data[idx + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function buildRgbaAlbedoTexture(
  rgbaData: Uint8Array,
  size: number,
  anisotropy = 4,
): THREE.DataTexture {
  const tex = new THREE.DataTexture(rgbaData, size, size, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// 1. ÁRBOLES FOTORREALISTAS: CORTEZA PBR + FOLLAJE SSS Y VIENTO DE VÉRTICES
// ---------------------------------------------------------------------------

export function generateBarkPbrMaps(size = 256): {
  albedo: THREE.DataTexture;
  normal: THREE.DataTexture;
  roughness: THREE.DataTexture;
} {
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const rgba = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      // Surcos verticales profundos de corteza + placas escamosas y nudos
      const warp = tileableFbm(u, v, 4, 3, 701, 3) * 0.14;
      const ridges = Math.abs(Math.sin(((u + warp) * 14.0) * Math.PI));
      const plateDetail = tileableFbm(u, v, 16, 6, 733, 4);
      const microGrain = tileableValueNoise(u, v, 48, 24, 769);
      const lichenMask = Math.max(0, tileableFbm(u, v, 7, 7, 811, 3) - 0.63) * 2.4;

      const h = Math.min(1, Math.max(0, Math.pow(ridges, 0.65) * 0.62 + plateDetail * 0.28 + microGrain * 0.10));
      const idx = y * size + x;
      height[idx] = h;

      // Grietas muy mates (0.97) con oclusión profunda; crestas exteriores meteorizadas (0.74)
      rough[idx] = Math.min(0.98, Math.max(0.68, 0.97 - h * 0.23 + (microGrain - 0.5) * 0.06));

      const tAo = Math.max(0, Math.min(1, (h - 0.18) / 0.62));
      const ao = 0.36 + 0.64 * (tAo * tAo * (3 - 2 * tAo));

      // Corteza nogal/ceniza con sutil musgo/liquen oliva
      let r = (76 + h * 46 + (plateDetail - 0.5) * 18) * ao;
      let g = (58 + h * 37 + (plateDetail - 0.5) * 14) * ao;
      let b = (45 + h * 28 + (plateDetail - 0.5) * 10) * ao;

      if (lichenMask > 0.01) {
        const lm = Math.min(0.55, lichenMask);
        r = r * (1 - lm) + 88 * lm;
        g = g * (1 - lm) + 104 * lm;
        b = b * (1 - lm) + 66 * lm;
      }

      const p = idx * 4;
      rgba[p] = Math.max(0, Math.min(255, Math.round(r)));
      rgba[p + 1] = Math.max(0, Math.min(255, Math.round(g)));
      rgba[p + 2] = Math.max(0, Math.min(255, Math.round(b)));
      rgba[p + 3] = 255;
    }
  }

  return {
    albedo: buildRgbaAlbedoTexture(rgba, size, 4),
    normal: buildNormalTextureFromHeightField(height, size, 2.35),
    roughness: buildGrayscaleDataTexture(rough, size),
  };
}

export function generateFoliageCanopyPbrMaps(size = 256): {
  albedo: THREE.DataTexture;
  normal: THREE.DataTexture;
  roughness: THREE.DataTexture;
} {
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const rgba = new Uint8Array(size * size * 4);

  // Racimos densos de hojas superpuestas con nervaduras y oclusión entre follaje
  // Albedo neutro-cálido brillante para preservar y enriquecer instanceColor (naranja, ocre, amarillo, verde oliva)
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const clusterA = tileableFbm(u, v, 12, 12, 907, 4);
      const clusterB = tileableFbm(u + 0.37, v + 0.19, 24, 24, 941, 3);
      const microLeaves = tileableValueNoise(u * 1.3, v * 1.3, 48, 48, 977);
      const leafRibs = Math.abs(Math.sin((u * 30 + clusterA * 2.6) * Math.PI) * Math.cos((v * 30 - clusterB * 2.4) * Math.PI));
      const pocketMask = Math.max(0, Math.min(1, (clusterA * 0.52 + clusterB * 0.33 + microLeaves * 0.15 - 0.22) / 0.56));
      const pocketAo = 0.42 + 0.58 * (pocketMask * pocketMask * (3 - 2 * pocketMask));

      const h = Math.max(0, Math.min(1, pocketMask * 0.62 + leafRibs * 0.24 + microLeaves * 0.14));
      const idx = y * size + x;
      height[idx] = h;
      // Cutícula cerosa sutil en hojas expuestas (0.52) vs interior mate (0.90)
      rough[idx] = Math.max(0.50, Math.min(0.92, 0.89 - h * 0.35));

      const warmShift = (clusterB - 0.5) * 30;
      const baseVal = (202 + h * 52) * pocketAo;
      const r = Math.max(0, Math.min(255, Math.round(baseVal + warmShift * 0.75)));
      const g = Math.max(0, Math.min(255, Math.round(baseVal + warmShift * 0.28)));
      const b = Math.max(0, Math.min(255, Math.round(baseVal * 0.86 - warmShift * 0.38)));

      const p = idx * 4;
      rgba[p] = r;
      rgba[p + 1] = g;
      rgba[p + 2] = b;
      rgba[p + 3] = 255;
    }
  }

  return {
    albedo: buildRgbaAlbedoTexture(rgba, size, 4),
    normal: buildNormalTextureFromHeightField(height, size, 2.75),
    roughness: buildGrayscaleDataTexture(rough, size),
  };
}

/**
 * Genera mapas PBR (albedo RGBA con máscara alfa botánica precisa, normal y rugosidad)
 * para ramas foliares con alpha-clipping (alphaTest) que preservan SSS y viento de vértices.
 */
export function generateFoliageCutoutPbrMaps(size = 256): {
  albedo: THREE.DataTexture;
  normal: THREE.DataTexture;
  roughness: THREE.DataTexture;
} {
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const rgba = new Uint8Array(size * size * 4);

  // Racimo botánico de 15 hojas lanceoladas/aserradas irradiando desde el pecíolo/rama central
  const leaves: Array<{
    cx: number;
    cy: number;
    angle: number;
    rx: number;
    ry: number;
    tint: number;
  }> = [
    { cx: 0.50, cy: 0.50, angle: 0.0, rx: 0.17, ry: 0.28, tint: 1.04 },
    { cx: 0.34, cy: 0.38, angle: -0.62, rx: 0.14, ry: 0.25, tint: 0.96 },
    { cx: 0.66, cy: 0.38, angle: 0.62, rx: 0.14, ry: 0.25, tint: 1.02 },
    { cx: 0.27, cy: 0.57, angle: -1.08, rx: 0.13, ry: 0.24, tint: 0.91 },
    { cx: 0.73, cy: 0.57, angle: 1.08, rx: 0.13, ry: 0.24, tint: 0.94 },
    { cx: 0.38, cy: 0.70, angle: -0.45, rx: 0.14, ry: 0.23, tint: 1.06 },
    { cx: 0.62, cy: 0.70, angle: 0.45, rx: 0.14, ry: 0.23, tint: 1.01 },
    { cx: 0.50, cy: 0.76, angle: 0.05, rx: 0.13, ry: 0.21, tint: 1.08 },
    { cx: 0.50, cy: 0.26, angle: -0.06, rx: 0.14, ry: 0.21, tint: 0.89 },
    { cx: 0.23, cy: 0.36, angle: -0.88, rx: 0.11, ry: 0.19, tint: 0.95 },
    { cx: 0.77, cy: 0.36, angle: 0.88, rx: 0.11, ry: 0.19, tint: 0.98 },
    { cx: 0.22, cy: 0.71, angle: -0.78, rx: 0.11, ry: 0.18, tint: 1.03 },
    { cx: 0.78, cy: 0.71, angle: 0.78, rx: 0.11, ry: 0.18, tint: 1.00 },
    { cx: 0.42, cy: 0.48, angle: -0.28, rx: 0.15, ry: 0.24, tint: 0.93 },
    { cx: 0.58, cy: 0.48, angle: 0.28, rx: 0.15, ry: 0.24, tint: 0.97 },
  ];

  const precomputedLeaves = leaves.map((lf) => ({
    ...lf,
    ca: Math.cos(lf.angle),
    sa: Math.sin(lf.angle),
  }));

  for (let y = 0; y < size; y++) {
    const v = (y + 0.5) / size;
    const twigCenter = 0.5 + Math.sin(v * 5.2) * 0.018;
    const twigHalfWidth = 0.014 * (1.0 - v * 0.55);
    const inTwigV = v > 0.08 && v < 0.76;

    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      const idx = y * size + x;
      const onTwig = inTwigV && Math.abs(u - twigCenter) < twigHalfWidth;

      let bestCoverage = 0;
      let bestRib = 0;
      let bestTint = 1.0;

      for (let i = 0; i < precomputedLeaves.length; i++) {
        const lf = precomputedLeaves[i];
        const dx = u - lf.cx;
        const dy = v - lf.cy;
        if (Math.abs(dx) > 0.34 || Math.abs(dy) > 0.34) continue;
        const lx = (dx * lf.ca + dy * lf.sa) / lf.rx;
        const ly = (-dx * lf.sa + dy * lf.ca) / lf.ry;
        if (Math.abs(lx) > 1.25 || Math.abs(ly) > 1.25) continue;

        // Silueta lanceolada puntiaguda con borde finamente aserrado
        const taper = Math.max(0.12, 1.0 - Math.abs(ly) * 0.68 - Math.max(0, ly) * 0.22);
        const serration = Math.sin((ly + 1.0) * 26.0) * 0.065;
        const normDist = Math.hypot(lx / (taper + serration), ly);
        const cov = Math.max(0, Math.min(1, (1.02 - normDist) * 4.6));
        if (cov > bestCoverage) {
          bestCoverage = cov;
          const midrib = Math.max(0, 1.0 - Math.abs(lx) * 5.5);
          const sideVeins = Math.abs(Math.sin((Math.abs(lx) * 5.5 - ly * 4.2) * Math.PI)) * 0.32;
          bestRib = Math.min(1, midrib * 0.65 + sideVeins + (1 - normDist) * 0.28);
          bestTint = lf.tint;
        }
      }

      const alphaFloat = onTwig ? 1.0 : bestCoverage;
      const p = idx * 4;
      if (alphaFloat <= 0.02) {
        height[idx] = 0;
        rough[idx] = 0.84;
        rgba[p] = 165;
        rgba[p + 1] = 158;
        rgba[p + 2] = 132;
        rgba[p + 3] = 0;
        continue;
      }

      const microNoise = tileableValueNoise(u * 1.5, v * 1.5, 48, 48, 1301);
      const h = onTwig ? 0.85 : Math.max(0, Math.min(1, bestRib * 0.75 + microNoise * 0.25));
      height[idx] = h;
      rough[idx] = onTwig ? 0.88 : Math.max(0.48, Math.min(0.90, 0.84 - h * 0.30));

      if (onTwig && bestCoverage < 0.55) {
        rgba[p] = 112;
        rgba[p + 1] = 88;
        rgba[p + 2] = 62;
        rgba[p + 3] = 255;
      } else {
        // Color base cálido-neutro sin halo oscuro (bleed-free) para multiplicar con instanceColor
        const lum = (196 + h * 54) * bestTint;
        const warm = (microNoise - 0.5) * 22;
        rgba[p] = Math.max(0, Math.min(255, Math.round(lum + warm * 0.7)));
        rgba[p + 1] = Math.max(0, Math.min(255, Math.round(lum + warm * 0.25)));
        rgba[p + 2] = Math.max(0, Math.min(255, Math.round(lum * 0.85 - warm * 0.35)));
        rgba[p + 3] = Math.max(0, Math.min(255, Math.round(alphaFloat * 255)));
      }
    }
  }

  const albedo = buildRgbaAlbedoTexture(rgba, size, 8);
  albedo.wrapS = THREE.ClampToEdgeWrapping;
  albedo.wrapT = THREE.ClampToEdgeWrapping;
  const normal = buildNormalTextureFromHeightField(height, size, 2.35);
  normal.wrapS = THREE.ClampToEdgeWrapping;
  normal.wrapT = THREE.ClampToEdgeWrapping;
  const roughness = buildGrayscaleDataTexture(rough, size);
  roughness.wrapS = THREE.ClampToEdgeWrapping;
  roughness.wrapT = THREE.ClampToEdgeWrapping;

  return { albedo, normal, roughness };
}

/**
 * Mapas PBR para postes eléctricos de madera creosotada envejecida con vetas verticales,
 * grietas de secado y manchas de óxido de herrajes.
 */
export function generateUtilityWoodPolePbrMaps(size = 256): {
  albedo: THREE.DataTexture;
  normal: THREE.DataTexture;
  roughness: THREE.DataTexture;
} {
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const rgba = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const grain = tileableFbm(u, v, 28, 4, 1511, 4);
      const splitCrack = Math.pow(Math.max(0, 1.0 - Math.abs(Math.sin((u * 9.0 + grain * 0.35) * Math.PI)) * 7.5), 2.0);
      const weatherBand = tileableFbm(u, v, 6, 10, 1553, 3);
      const rustBleed = Math.max(0, (weatherBand - 0.58) * 2.2);

      const h = Math.max(0, Math.min(1, grain * 0.72 - splitCrack * 0.55 + 0.22));
      const idx = y * size + x;
      height[idx] = h;
      rough[idx] = Math.max(0.68, Math.min(0.98, 0.86 + splitCrack * 0.10 - rustBleed * 0.08));

      const base = 78 + h * 54;
      const r = base * 1.12 + rustBleed * 46;
      const g = base * 0.90 + rustBleed * 16;
      const b = base * 0.72;

      const p = idx * 4;
      rgba[p] = Math.max(0, Math.min(255, Math.round(r)));
      rgba[p + 1] = Math.max(0, Math.min(255, Math.round(g)));
      rgba[p + 2] = Math.max(0, Math.min(255, Math.round(b)));
      rgba[p + 3] = 255;
    }
  }

  return {
    albedo: buildRgbaAlbedoTexture(rgba, size, 8),
    normal: buildNormalTextureFromHeightField(height, size, 2.4),
    roughness: buildGrayscaleDataTexture(rough, size),
  };
}

/**
 * Mapas PBR de acero galvanizado perfilado con pátina vial y vetas de óxido en bordes
 * para guardarrieles metálicos W-beam.
 */
export function generateGuardrailSteelPbrMaps(size = 256): {
  albedo: THREE.DataTexture;
  normal: THREE.DataTexture;
  roughness: THREE.DataTexture;
} {
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const rgba = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const spangle = tileableValueNoise(u, v, 36, 36, 1609);
      const longitudinalBrush = tileableFbm(u, v, 6, 32, 1627, 3);
      const scrape = Math.pow(Math.max(0, tileableValueNoise(u, v, 10, 48, 1663) - 0.72) * 3.5, 1.5);
      const rustEdge = Math.max(0, (tileableFbm(u, v, 8, 8, 1699, 3) - 0.64) * 2.6);

      const h = Math.max(0, Math.min(1, 0.5 + (longitudinalBrush - 0.5) * 0.35 + scrape * 0.30 - rustEdge * 0.22));
      const idx = y * size + x;
      height[idx] = h;
      rough[idx] = Math.max(0.24, Math.min(0.88, 0.34 + spangle * 0.16 + rustEdge * 0.38 - scrape * 0.08));

      const zinc = 176 + spangle * 32 + scrape * 26;
      const r = zinc * (1 - rustEdge * 0.42) + rustEdge * 138;
      const g = zinc * (1 - rustEdge * 0.55) + rustEdge * 78;
      const b = (zinc + 6) * (1 - rustEdge * 0.68) + rustEdge * 48;

      const p = idx * 4;
      rgba[p] = Math.max(0, Math.min(255, Math.round(r)));
      rgba[p + 1] = Math.max(0, Math.min(255, Math.round(g)));
      rgba[p + 2] = Math.max(0, Math.min(255, Math.round(b)));
      rgba[p + 3] = 255;
    }
  }

  return {
    albedo: buildRgbaAlbedoTexture(rgba, size, 8),
    normal: buildNormalTextureFromHeightField(height, size, 1.85),
    roughness: buildGrayscaleDataTexture(rough, size),
  };
}

/**
 * Mapas PBR de hormigón encofrado intemperizado con juntas de tablones, perforaciones de tirantes
 * y escurrimientos de humedad para muros de contención laterales.
 */
export function generateRetainingWallPbrMaps(size = 256): {
  albedo: THREE.DataTexture;
  normal: THREE.DataTexture;
  roughness: THREE.DataTexture;
} {
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const rgba = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const aggregate = tileableFbm(u, v, 24, 24, 1741, 4);
      const streak = tileableFbm(u, v, 18, 4, 1777, 3);
      // Juntas horizontales de tablones de encofrado (6 hiladas) + junta vertical cada medio módulo
      const boardSeam = Math.exp(-Math.pow(Math.sin(v * 6.0 * Math.PI), 2) * 58.0);
      const panelJoint = Math.exp(-Math.pow(Math.sin(u * 2.0 * Math.PI), 2) * 90.0);
      // Hoyuelos circulares de tensores de encofrado
      const tieU = ((u * 4.0) % 1) - 0.5;
      const tieV = ((v * 3.0) % 1) - 0.5;
      const tieHole = Math.max(0, 1.0 - Math.hypot(tieU, tieV) * 11.0);

      const h = Math.max(0, Math.min(1, 0.62 + (aggregate - 0.5) * 0.28 - boardSeam * 0.26 - panelJoint * 0.34 - tieHole * 0.45));
      const idx = y * size + x;
      height[idx] = h;

      const dampStreak = Math.max(0, (streak - 0.54) * 1.9) * (1.0 - v * 0.35);
      rough[idx] = Math.max(0.58, Math.min(0.97, 0.88 - dampStreak * 0.18 + boardSeam * 0.06));

      const conc = (146 + aggregate * 36) * (1.0 - dampStreak * 0.24 - tieHole * 0.38 - panelJoint * 0.18);
      const mossHint = Math.max(0, (1.0 - v * 2.6)) * aggregate * 22;
      const r = conc - mossHint * 0.35;
      const g = conc + mossHint * 0.32;
      const b = conc * 0.94 - mossHint * 0.45;

      const p = idx * 4;
      rgba[p] = Math.max(0, Math.min(255, Math.round(r)));
      rgba[p + 1] = Math.max(0, Math.min(255, Math.round(g)));
      rgba[p + 2] = Math.max(0, Math.min(255, Math.round(b)));
      rgba[p + 3] = 255;
    }
  }

  return {
    albedo: buildRgbaAlbedoTexture(rgba, size, 8),
    normal: buildNormalTextureFromHeightField(height, size, 2.45),
    roughness: buildGrayscaleDataTexture(rough, size),
  };
}

// ---------------------------------------------------------------------------
// 2. CÉSPED Y CUBIERTA TERRESTRE REALISTA: NORMAL + AO DE RAÍZ + PARCHES OTOÑALES
// ---------------------------------------------------------------------------

export function generateGrassGroundPbrMaps(size = 256): {
  albedo: THREE.DataTexture;
  normal: THREE.DataTexture;
  roughness: THREE.DataTexture;
} {
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const rgba = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      // Briznas entrelazadas de alta frecuencia + terrones de tierra húmeda y paja seca en la raíz
      const tuft = tileableFbm(u, v, 14, 14, 1103, 4);
      const blades1 = tileableValueNoise(u * 1.4 + tuft * 0.08, v * 0.65, 56, 28, 1151);
      const blades2 = tileableValueNoise(u * 0.7 - tuft * 0.06, v * 1.35, 32, 56, 1187);
      const bladeTips = Math.max(blades1, blades2);
      const rootSoil = tileableFbm(u, v, 8, 8, 1223, 3);

      const h = Math.max(0, Math.min(1, bladeTips * 0.66 + tuft * 0.24 + rootSoil * 0.10));
      const idx = y * size + x;
      height[idx] = h;

      // Ambient occlusion profundo en la raíz entre matas de pasto
      const rootAo = 0.38 + 0.62 * Math.pow(h, 0.78);
      const dryStrawMask = Math.max(0, Math.min(1, (rootSoil - 0.54) * 2.6));

      rough[idx] = Math.max(0.64, Math.min(0.97, 0.72 + (1 - h) * 0.18 + dryStrawMask * 0.09));

      // Verde oliva apagado mezclado con hebras secas ocre y tierra oscura en las raíces
      const greenR = 86 + bladeTips * 42;
      const greenG = 112 + bladeTips * 52;
      const greenB = 56 + bladeTips * 24;

      const strawR = 148 + bladeTips * 36;
      const strawG = 122 + bladeTips * 30;
      const strawB = 64 + bladeTips * 18;

      const r = (greenR * (1 - dryStrawMask) + strawR * dryStrawMask) * rootAo;
      const g = (greenG * (1 - dryStrawMask) + strawG * dryStrawMask) * rootAo;
      const b = (greenB * (1 - dryStrawMask) + strawB * dryStrawMask) * rootAo;

      const p = idx * 4;
      rgba[p] = Math.max(0, Math.min(255, Math.round(r)));
      rgba[p + 1] = Math.max(0, Math.min(255, Math.round(g)));
      rgba[p + 2] = Math.max(0, Math.min(255, Math.round(b)));
      rgba[p + 3] = 255;
    }
  }

  return {
    albedo: buildRgbaAlbedoTexture(rgba, size, 8),
    normal: buildNormalTextureFromHeightField(height, size, 2.25),
    roughness: buildGrayscaleDataTexture(rough, size),
  };
}

// ---------------------------------------------------------------------------
// 3. FACHADAS ARQUITECTÓNICAS PBR + ALTURA POM + HORMIGÓN/LADRILLO/METAL OXIDADO/VIDRIO
// ---------------------------------------------------------------------------

export function generateBuildingArchetypePbrMaps(
  archetype: BuildingArchetype,
  size = 512,
): {
  albedo: THREE.DataTexture;
  normal: THREE.DataTexture;
  roughness: THREE.DataTexture;
  height: THREE.DataTexture;
} {
  const heightField = new Float32Array(size * size);
  const roughField = new Float32Array(size * size);
  const rgba = new Uint8Array(size * size * 4);

  // Cada baldosa 512x512 representa un módulo repetible limpio de 3 pisos x 3 vanos arquitectónicos
  const floors = 3;
  const bays = 3;

  for (let y = 0; y < size; y++) {
    const v = y / size; // 0 abajo -> 1 arriba en UV de Three.js DataTexture
    const floorPos = (v * floors) % 1;
    const floorIdx = Math.floor(v * floors);

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const bayPos = (u * bays) % 1;
      const bayIdx = Math.floor(u * bays);
      const idx = y * size + x;

      const grime = tileableFbm(u, v, 6, 6, 1409 + floorIdx * 13, 4);
      const fineGrain = tileableValueNoise(u, v, 64, 64, 1453);

      // Geometría paramétrica de ventana / antepecho / dintel en cada vano
      const inWinX = bayPos > 0.17 && bayPos < 0.83;
      const inWinY = floorPos > 0.22 && floorPos < 0.78;
      const isSill = bayPos > 0.13 && bayPos < 0.87 && floorPos >= 0.17 && floorPos <= 0.22;
      const isLintel = bayPos > 0.14 && bayPos < 0.86 && floorPos >= 0.78 && floorPos <= 0.84;
      const isFloorCornice = floorPos > 0.93 || floorPos < 0.03;

      let r = 140;
      let g = 136;
      let b = 128;
      let h = 0.64;
      let rough = 0.88;

      if (inWinX && inWinY) {
        // Marco perimetral y parteluces metálicos oxidados / aluminio oscuro
        const frameOuter =
          bayPos < 0.205 || bayPos > 0.795 || floorPos < 0.255 || floorPos > 0.745;
        const mullionV = Math.abs(bayPos - 0.5) < 0.018;
        const mullionH = Math.abs(floorPos - 0.52) < 0.018;

        if (frameOuter || mullionV || mullionH) {
          const rustTouch = archetype === 'industrial_metal' || archetype === 'brick' ? 0.35 : 0.12;
          r = 56 + rustTouch * 48 + (fineGrain - 0.5) * 14;
          g = 54 + rustTouch * 18 + (fineGrain - 0.5) * 12;
          b = 52 + (fineGrain - 0.5) * 10;
          h = frameOuter ? 0.44 : 0.30;
          rough = 0.42 + grime * 0.18;
        } else {
          // Paño de cristal profundo con persianas/interior cálido tenue (la reflexión celeste/dorada la aporta el shader PBR+CubeMap)
          const roomSeed = hash2D(bayIdx + 3, floorIdx + 7, archetype.length * 91);
          const warmInterior = roomSeed > 0.68 ? 1.0 : 0.0;
          const blindStripe = Math.sin(floorPos * 140.0) * 0.5 + 0.5;
          r = 24 + warmInterior * 42 * (0.65 + 0.35 * blindStripe) + (1 - floorPos) * 12;
          g = 34 + warmInterior * 30 * (0.65 + 0.35 * blindStripe) + (1 - floorPos) * 16;
          b = 44 + warmInterior * 12 + (1 - floorPos) * 20;
          h = 0.08; // Hundimiento real de 8-14 cm para Parallax Occlusion Mapping
          rough = 0.055 + (grime - 0.5) * 0.03;
        }
      } else if (isSill || isLintel || isFloorCornice) {
        // Antepechos, dinteles de piedra/hormigón y cornisas sobresalientes con manchas de escorrentía debajo
        const stoneTone = 132 + (fineGrain - 0.5) * 20 - grime * 26;
        r = stoneTone + 4;
        g = stoneTone;
        b = stoneTone - 8;
        h = isSill ? 0.94 : isLintel ? 0.88 : 0.84;
        rough = 0.82 + grime * 0.12;
      } else {
        // Muro principal según arquetipo industrial-otoñal de NFSMW
        if (archetype === 'brick') {
          // Ladrillo visto envejecido con aparejo trabado, juntas de mortero hundidas y hollín industrial
          const brickRows = 36;
          const brickRow = Math.floor(v * brickRows);
          const rowFrac = (v * brickRows) % 1;
          const brickCols = 14;
          const stagger = (brickRow % 2) * 0.5;
          const colFrac = (u * brickCols + stagger) % 1;
          const brickCol = Math.floor(u * brickCols + stagger);
          const isMortar = rowFrac < 0.13 || colFrac < 0.065;

          if (isMortar) {
            const mVal = 112 - grime * 28 + (fineGrain - 0.5) * 14;
            r = mVal + 4;
            g = mVal + 1;
            b = mVal - 5;
            h = 0.42;
            rough = 0.95;
          } else {
            const bVar = hash2D(brickCol, brickRow, 2027);
            const soot = Math.max(0, grime - 0.52) * 55;
            r = 138 + (bVar - 0.5) * 42 - soot + (fineGrain - 0.5) * 14;
            g = 74 + (bVar - 0.5) * 24 - soot * 0.85 + (fineGrain - 0.5) * 10;
            b = 54 + (bVar - 0.5) * 18 - soot * 0.7 + (fineGrain - 0.5) * 8;
            h = 0.68 + (bVar - 0.5) * 0.08 + (fineGrain - 0.5) * 0.05;
            rough = 0.86 + (bVar - 0.5) * 0.08;
          }
        } else if (archetype === 'industrial_metal') {
          // Chapa acanalada industrial + vigas de acero remachadas y óxido anaranjado/marrón
          const ribWave = Math.sin(u * 48.0 * Math.PI * 2);
          const isGirder = Math.abs(floorPos - 0.08) < 0.035 || Math.abs(bayPos - 0.02) < 0.02;
          const rustNoise = tileableFbm(u * 1.2, v * 0.7, 8, 6, 3301, 4);
          const underSillRust =
            bayPos > 0.14 && bayPos < 0.86 && floorPos < 0.17
              ? (1 - floorPos / 0.17) * 0.55
              : 0;
          const rustMask = Math.max(0, Math.min(1, (rustNoise - 0.46) * 2.4 + underSillRust));

          const baseSteel = isGirder ? 82 : 104 + ribWave * 14;
          const steelR = baseSteel + (fineGrain - 0.5) * 10;
          const steelG = baseSteel + 4 + (fineGrain - 0.5) * 10;
          const steelB = baseSteel + 9 + (fineGrain - 0.5) * 10;

          const rustR = 134 + (fineGrain - 0.5) * 22;
          const rustG = 68 + (fineGrain - 0.5) * 14;
          const rustB = 36 + (fineGrain - 0.5) * 10;

          r = steelR * (1 - rustMask) + rustR * rustMask;
          g = steelG * (1 - rustMask) + rustG * rustMask;
          b = steelB * (1 - rustMask) + rustB * rustMask;
          h = isGirder ? 0.82 : 0.62 + ribWave * 0.11 - rustMask * 0.05;
          // Metal satinado (0.44) donde está sano, muy áspero (0.91) donde hay herrumbre
          rough = 0.44 * (1 - rustMask) + 0.91 * rustMask;
        } else if (archetype === 'stucco') {
          // Mampostería / revoque ocre-arenisca envejecido con juntas de sillería, microfisuras y escorrentía bajo alféizar
          const crackField = Math.abs(tileableFbm(u, v, 10, 10, 4111, 4) - 0.5);
          const isCrack = crackField < 0.011 && grime > 0.48;
          const ashlarJointY = Math.abs((v * 12) % 1) < 0.022;
          const dripBelowSill =
            bayPos > 0.16 && bayPos < 0.84 && floorPos < 0.17
              ? (1 - floorPos / 0.17) * (0.38 + 0.62 * tileableValueNoise(u * 4, v, 24, 6, 4219))
              : 0;

          if (isCrack) {
            r = 86;
            g = 76;
            b = 64;
            h = 0.44;
            rough = 0.96;
          } else if (ashlarJointY) {
            const jTone = 132 - grime * 24;
            r = jTone + 8;
            g = jTone + 1;
            b = jTone - 12;
            h = 0.52;
            rough = 0.94;
          } else {
            const plasterWave = tileableFbm(u, v, 16, 16, 4253, 3);
            const warmStucco = 164 - grime * 28 - dripBelowSill * 34 + (plasterWave - 0.5) * 14 + (fineGrain - 0.5) * 12;
            r = warmStucco + 11;
            g = warmStucco + 2;
            b = warmStucco - 16;
            h = 0.66 + (plasterWave - 0.5) * 0.05 + (fineGrain - 0.5) * 0.04;
            rough = 0.86 + grime * 0.10 - dripBelowSill * 0.06;
          }
        } else {
          // 'concrete': Hormigón visto industrial meteorizado con juntas de encofrado, coqueras y chorreaduras bajo alféizar
          const panelJointX = Math.abs((u * 6) % 1) < 0.022;
          const panelJointY = Math.abs((v * 9) % 1) < 0.028;
          const dripBelowSill =
            bayPos > 0.16 && bayPos < 0.84 && floorPos < 0.17
              ? (1 - floorPos / 0.17) * (0.35 + 0.65 * tileableValueNoise(u * 4, v, 24, 6, 5107))
              : 0;

          if (panelJointX || panelJointY) {
            r = 84;
            g = 82;
            b = 78;
            h = 0.44;
            rough = 0.95;
          } else {
            const conc = 148 - grime * 36 - dripBelowSill * 38 + (fineGrain - 0.5) * 20;
            r = conc + 3;
            g = conc + 1;
            b = conc - 4;
            h = 0.66 + (fineGrain - 0.5) * 0.07 - (grime > 0.64 ? 0.05 : 0);
            rough = 0.84 + grime * 0.12 - dripBelowSill * 0.08;
          }
        }
      }

      heightField[idx] = Math.max(0, Math.min(1, h));
      roughField[idx] = Math.max(0.04, Math.min(0.98, rough));

      const p = idx * 4;
      rgba[p] = Math.max(0, Math.min(255, Math.round(r)));
      rgba[p + 1] = Math.max(0, Math.min(255, Math.round(g)));
      rgba[p + 2] = Math.max(0, Math.min(255, Math.round(b)));
      rgba[p + 3] = 255;
    }
  }

  return {
    albedo: buildRgbaAlbedoTexture(rgba, size, 8),
    normal: buildNormalTextureFromHeightField(heightField, size, 2.6),
    roughness: buildGrayscaleDataTexture(roughField, size),
    height: buildGrayscaleDataTexture(heightField, size),
  };
}

export function generateCurtainWallPbrMaps(size = 512): {
  albedo: THREE.DataTexture;
  normal: THREE.DataTexture;
  roughness: THREE.DataTexture;
  height: THREE.DataTexture;
} {
  const heightField = new Float32Array(size * size);
  const roughField = new Float32Array(size * size);
  const rgba = new Uint8Array(size * size * 4);

  const rows = 8;
  const cols = 6;
  for (let y = 0; y < size; y++) {
    const v = y / size;
    const rf = (v * rows) % 1;
    const rIdx = Math.floor(v * rows);
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const cf = (u * cols) % 1;
      const cIdx = Math.floor(u * cols);
      const idx = y * size + x;

      const isSpandrel = rf < 0.18;
      const isMullion = cf < 0.055 || cf > 0.945 || Math.abs(rf - 0.18) < 0.025;
      const grain = tileableValueNoise(u, v, 64, 64, 6101);

      if (isMullion) {
        const m = 66 + (grain - 0.5) * 14;
        rgba[idx * 4] = Math.round(m);
        rgba[idx * 4 + 1] = Math.round(m + 3);
        rgba[idx * 4 + 2] = Math.round(m + 6);
        rgba[idx * 4 + 3] = 255;
        heightField[idx] = 0.84;
        roughField[idx] = 0.34;
      } else if (isSpandrel) {
        rgba[idx * 4] = 38;
        rgba[idx * 4 + 1] = 48;
        rgba[idx * 4 + 2] = 58;
        rgba[idx * 4 + 3] = 255;
        heightField[idx] = 0.52;
        roughField[idx] = 0.24;
      } else {
        const seed = hash2D(cIdx, rIdx, 6229);
        const litWarm = seed > 0.74 ? 1 : 0;
        const grad = 0.65 + 0.35 * rf;
        rgba[idx * 4] = Math.round((34 + litWarm * 54) * grad);
        rgba[idx * 4 + 1] = Math.round((54 + litWarm * 38) * grad);
        rgba[idx * 4 + 2] = Math.round((72 + litWarm * 14) * grad);
        rgba[idx * 4 + 3] = 255;
        heightField[idx] = 0.18;
        roughField[idx] = 0.045;
      }
    }
  }

  return {
    albedo: buildRgbaAlbedoTexture(rgba, size, 8),
    normal: buildNormalTextureFromHeightField(heightField, size, 2.1),
    roughness: buildGrayscaleDataTexture(roughField, size),
    height: buildGrayscaleDataTexture(heightField, size),
  };
}

export function generateWeatheredSidewalkPbrMaps(size = 256): {
  albedo: THREE.DataTexture;
  normal: THREE.DataTexture;
  roughness: THREE.DataTexture;
} {
  const heightField = new Float32Array(size * size);
  const roughField = new Float32Array(size * size);
  const rgba = new Uint8Array(size * size * 4);

  const tiles = 4;
  for (let y = 0; y < size; y++) {
    const v = y / size;
    const vf = (v * tiles) % 1;
    const ty = Math.floor(v * tiles);
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const uf = (u * tiles) % 1;
      const tx = Math.floor(u * tiles);
      const idx = y * size + x;

      const isGroove = uf < 0.045 || vf < 0.045;
      const wear = tileableFbm(u, v, 8, 8, 7103, 4);
      const grain = tileableValueNoise(u, v, 48, 48, 7159);
      const tileTint = (hash2D(tx, ty, 7211) - 0.5) * 14;

      if (isGroove) {
        const mossInJoint = wear > 0.56 ? 0.45 : 0;
        rgba[idx * 4] = Math.round(74 * (1 - mossInJoint) + 64 * mossInJoint);
        rgba[idx * 4 + 1] = Math.round(72 * (1 - mossInJoint) + 84 * mossInJoint);
        rgba[idx * 4 + 2] = Math.round(66 * (1 - mossInJoint) + 46 * mossInJoint);
        rgba[idx * 4 + 3] = 255;
        heightField[idx] = 0.25;
        roughField[idx] = 0.96;
      } else {
        const c = 154 + tileTint - wear * 32 + (grain - 0.5) * 16;
        rgba[idx * 4] = Math.max(0, Math.min(255, Math.round(c + 3)));
        rgba[idx * 4 + 1] = Math.max(0, Math.min(255, Math.round(c + 1)));
        rgba[idx * 4 + 2] = Math.max(0, Math.min(255, Math.round(c - 5)));
        rgba[idx * 4 + 3] = 255;
        heightField[idx] = 0.72 + (grain - 0.5) * 0.08 - wear * 0.12;
        roughField[idx] = Math.max(0.58, Math.min(0.95, 0.78 + (wear - 0.5) * 0.22));
      }
    }
  }

  return {
    albedo: buildRgbaAlbedoTexture(rgba, size, 8),
    normal: buildNormalTextureFromHeightField(heightField, size, 1.9),
    roughness: buildGrayscaleDataTexture(roughField, size),
  };
}

// ---------------------------------------------------------------------------
// INYECTORES GLSL PBR (onBeforeCompile) — SSS, VIENTO, CÉSPED MACRO, POM E IMPERFECCIONES
// ---------------------------------------------------------------------------

const GLSL_WORLD_NOISE_HELPERS = /* glsl */ `
  float envHash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float envNoise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = envHash21(i);
    float b = envHash21(i + vec2(1.0, 0.0));
    float c = envHash21(i + vec2(0.0, 1.0));
    float d = envHash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float envFbm3(vec2 p) {
    float v = 0.0;
    v += 0.533 * envNoise2(p);
    v += 0.267 * envNoise2(p * 2.07 + vec2(13.7, 7.3));
    v += 0.200 * envNoise2(p * 4.21 + vec2(5.1, 29.4));
    return v;
  }
`;

export function enhanceBarkMaterialWithBaseMoss(
  material: THREE.MeshStandardMaterial,
  cacheKey: string,
): void {
  material.customProgramCacheKey = () => cacheKey;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      `varying vec3 vBarkWorldPos;\n` +
      shader.vertexShader.replace(
        '#include <project_vertex>',
        `
        #include <project_vertex>
        vec4 barkInstPos = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          barkInstPos = instanceMatrix * barkInstPos;
        #endif
        vBarkWorldPos = (modelMatrix * barkInstPos).xyz;
        `,
      );

    shader.fragmentShader =
      `varying vec3 vBarkWorldPos;\n${GLSL_WORLD_NOISE_HELPERS}\n` +
      shader.fragmentShader
        .replace(
          '#include <color_fragment>',
          `
          #include <color_fragment>
          float barkNoise = envFbm3(vBarkWorldPos.xz * 1.4 + vec2(vBarkWorldPos.y * 0.8));
          float rootDirt = smoothstep(0.95, 0.0, vBarkWorldPos.y) * (0.55 + 0.45 * barkNoise);
          float barkMoss = smoothstep(1.35, 0.05, vBarkWorldPos.y) * smoothstep(0.46, 0.78, barkNoise);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.11, 0.085, 0.06), rootDirt * 0.62);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.23, 0.10), barkMoss * 0.54);
          `,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `
          #include <roughnessmap_fragment>
          roughnessFactor = clamp(roughnessFactor + (envNoise2(vBarkWorldPos.xy * 2.5) - 0.5) * 0.14, 0.58, 0.99);
          `,
        );
  };
  material.needsUpdate = true;
}

export function enhanceFoliageMaterialWithSSSAndWind(
  material: THREE.MeshStandardMaterial,
  sharedUniforms: {
    uEnvTime: { value: number };
    uSunDirWorld: { value: THREE.Vector3 };
  },
  options: { sssIntensity?: number; windAmplitude?: number; cacheKey: string },
): void {
  const sssStrength = options.sssIntensity ?? 0.68;
  const windAmp = options.windAmplitude ?? 0.065;

  material.customProgramCacheKey = () => options.cacheKey;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uEnvTime = sharedUniforms.uEnvTime;
    shader.uniforms.uSunDirWorld = sharedUniforms.uSunDirWorld;
    shader.uniforms.uSssStrength = { value: sssStrength };
    shader.uniforms.uWindAmp = { value: windAmp };

    shader.vertexShader =
      `
      uniform float uEnvTime;
      uniform vec3 uSunDirWorld;
      uniform float uWindAmp;
      varying vec3 vLeafWorldPos;
      varying vec3 vSunDirView;
      varying vec3 vRadialCrownNormal;
      varying float vCanopyTipMask;
      ` +
      shader.vertexShader
        .replace(
          '#include <begin_vertex>',
          `
          #include <begin_vertex>
          vec3 instAnchor = vec3(0.0);
          mat3 instRotMat = mat3(1.0);
          #ifdef USE_INSTANCING
            instAnchor = instanceMatrix[3].xyz;
            instRotMat = mat3(instanceMatrix);
          #endif
          vec3 worldAnchor = (modelMatrix * vec4(instAnchor, 1.0)).xyz;
          float heightMask = smoothstep(1.2, 4.8, worldAnchor.y + position.y);
          float gustPhase = uEnvTime * 1.75 + worldAnchor.z * 0.11 + worldAnchor.x * 0.16;
          float swayX = sin(gustPhase) * uWindAmp + sin(uEnvTime * 4.3 + position.y * 3.7 + worldAnchor.x) * (uWindAmp * 0.28);
          float swayZ = cos(gustPhase * 0.86 + 1.1) * (uWindAmp * 0.78);
          transformed.x += swayX * heightMask;
          transformed.z += swayZ * heightMask;
          transformed.y += sin(uEnvTime * 3.1 + position.x * 2.9 + worldAnchor.z) * (uWindAmp * 0.18) * heightMask;
          vCanopyTipMask = clamp(length(position) * 0.82, 0.24, 1.0);
          vec3 localCrownDir = length(position) > 0.001 ? normalize(position) : normal;
          vRadialCrownNormal = normalize(normalMatrix * (instRotMat * localCrownDir));
          `,
        )
        .replace(
          '#include <project_vertex>',
          `
          #include <project_vertex>
          vec4 leafInstPos = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            leafInstPos = instanceMatrix * leafInstPos;
          #endif
          vLeafWorldPos = (modelMatrix * leafInstPos).xyz;
          vSunDirView = normalize((viewMatrix * vec4(normalize(uSunDirWorld), 0.0)).xyz);
          `,
        );

    shader.fragmentShader =
      `
      uniform float uSssStrength;
      varying vec3 vLeafWorldPos;
      varying vec3 vSunDirView;
      varying vec3 vRadialCrownNormal;
      varying float vCanopyTipMask;
      ${GLSL_WORLD_NOISE_HELPERS}
      ` +
      shader.fragmentShader
        .replace(
          '#include <color_fragment>',
          `
          #include <color_fragment>
          // Variación cromática orgánica entre racimos (bordes cálidos cobrizos/dorados + oclusión interna de copa)
          float leafPatch = envFbm3(vLeafWorldPos.xz * 0.55 + vec2(vLeafWorldPos.y * 0.42));
          float leafMicro = envNoise2(vLeafWorldPos.xy * 3.4 + vLeafWorldPos.z * 2.1);
          vec3 autumnEdgeTint = mix(vec3(0.90, 0.96, 0.80), vec3(1.24, 0.96, 0.62), leafPatch);
          diffuseColor.rgb *= autumnEdgeTint * mix(0.66, 1.10, vCanopyTipMask) * mix(0.86, 1.12, leafMicro);
          `,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `
          // Suaviza las aristas poligonales del icosaedro hacia una copa orgánica redondeada antes de aplicar el normal map foliar
          normal = normalize(mix(normal, normalize(vRadialCrownNormal), 0.72));
          #include <normal_fragment_maps>
          `,
        )
        .replace(
          '#include <opaque_fragment>',
          `
          // Subsurface Scattering (SSS) foliar: el sol de tarde atraviesa cálidamente hojas naranjas, amarillas y verde oliva
          vec3 leafViewDir = normalize(vViewPosition);
          float backScatter = pow(clamp(dot(leafViewDir, -vSunDirView), 0.0, 1.0), 2.15);
          float wrapSun = smoothstep(-0.55, 0.82, dot(normal, vSunDirView));
          float thinRim = pow(1.0 - abs(dot(normal, leafViewDir)), 1.25);
          float sssTranslucency = (backScatter * 0.90 + wrapSun * thinRim * 0.68 + wrapSun * 0.30) * vCanopyTipMask;
          vec3 warmTransmitted = diffuseColor.rgb * vec3(1.68, 1.10, 0.40) * sssTranslucency * uSssStrength;
          vec3 canopyAmbientBounce = diffuseColor.rgb * vec3(0.18, 0.16, 0.08) * vCanopyTipMask;
          outgoingLight += warmTransmitted + canopyAmbientBounce;
          #include <opaque_fragment>
          `,
        );
  };
  material.needsUpdate = true;
}

export function enhanceGrassMaterialWithMacroVariation(
  material: THREE.MeshStandardMaterial,
  options: { halfRoadWidth: number; wet: boolean; cacheKey: string },
): void {
  const halfRoad = options.halfRoadWidth;
  const wetness = options.wet ? 1.0 : 0.0;

  material.customProgramCacheKey = () => options.cacheKey;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGrassHalfRoad = { value: halfRoad };
    shader.uniforms.uGrassWet = { value: wetness };

    shader.vertexShader =
      `varying vec3 vGrassWorldPos;\n` +
      shader.vertexShader.replace(
        '#include <project_vertex>',
        `
        #include <project_vertex>
        vec4 grassInstPos = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          grassInstPos = instanceMatrix * grassInstPos;
        #endif
        vGrassWorldPos = (modelMatrix * grassInstPos).xyz;
        `,
      );

    shader.fragmentShader =
      `
      uniform float uGrassHalfRoad;
      uniform float uGrassWet;
      varying vec3 vGrassWorldPos;
      ${GLSL_WORLD_NOISE_HELPERS}
      ` +
      shader.fragmentShader
        .replace(
          '#include <map_fragment>',
          `
          // Muestreo dual estocástico en coordenadas mundiales rotadas para eliminar cualquier patrón lineal o Moiré de tiling
          float grassCamDist = length(cameraPosition - vGrassWorldPos);
          float aerialSmooth = smoothstep(26.0, 95.0, grassCamDist);
          vec2 grassWorldUvA = vGrassWorldPos.xz * 0.34;
          vec2 grassRotXz = vec2(
            vGrassWorldPos.x * 0.3907 - vGrassWorldPos.z * 0.9205,
            vGrassWorldPos.x * 0.9205 + vGrassWorldPos.z * 0.3907
          );
          vec2 grassWorldUvB = grassRotXz * 0.23 + vec2(7.13, 13.71);
          float grassBlendNoise = smoothstep(0.32, 0.68, envFbm3(vGrassWorldPos.xz * 0.14));
          #ifdef USE_MAP
            vec4 texGrassA = texture2D(map, grassWorldUvA);
            vec4 texGrassB = texture2D(map, grassWorldUvB);
            vec4 blendedGrassTex = mix(texGrassA, texGrassB, grassBlendNoise);
            // Atenúa contraste de micro-brizna a gran distancia aérea manteniendo tono medio natural
            blendedGrassTex.rgb = mix(blendedGrassTex.rgb, vec3(0.46, 0.50, 0.30), aerialSmooth * 0.55);
            diffuseColor *= blendedGrassTex;
          #endif
          `,
        )
        .replace(
          '#include <color_fragment>',
          `
          #include <color_fragment>
          // Ruido multiescala en espacio mundial para crear parches otoñales secos + verdes oliva + musgo húmedo + AO en raíces
          float macroDry = envFbm3(vGrassWorldPos.xz * 0.052);
          float clumpPatch = envFbm3(vGrassWorldPos.xz * 0.22 + vec2(17.2, 9.4));
          float microTuft = envNoise2(vGrassWorldPos.xz * 1.55);

          vec3 mutedOlive = vec3(0.72, 0.80, 0.56);
          vec3 dryAutumnOchre = vec3(1.12, 0.87, 0.50);
          vec3 deepMossGreen = vec3(0.45, 0.60, 0.38);
          vec3 soilThatch = vec3(0.55, 0.42, 0.30);

          float dryMask = smoothstep(0.45, 0.75, macroDry * 0.68 + clumpPatch * 0.32);
          float lushMask = smoothstep(0.54, 0.22, macroDry) * smoothstep(0.38, 0.72, clumpPatch);
          float soilWear = smoothstep(0.72, 0.92, clumpPatch * 0.6 + (1.0 - microTuft) * 0.4);

          // Desgaste de tierra y polvo junto al cordón vial
          float roadsideEdge = exp(-abs(abs(vGrassWorldPos.x) - (uGrassHalfRoad + 0.95)) * 1.15);
          soilWear = clamp(soilWear + roadsideEdge * 0.48, 0.0, 1.0);

          vec3 macroTint = mix(mutedOlive, dryAutumnOchre, dryMask);
          macroTint = mix(macroTint, deepMossGreen, lushMask * 0.65);
          macroTint = mix(macroTint, soilThatch, soilWear * 0.58);

          // Ambient occlusion densa en las raíces y depresiones de matas
          float rootClumpAo = mix(0.56, 1.10, smoothstep(0.18, 0.84, microTuft * 0.55 + clumpPatch * 0.45));
          diffuseColor.rgb *= macroTint * mix(rootClumpAo, 0.92, aerialSmooth * 0.5) * mix(1.0, 0.78, uGrassWet);
          `,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `
          float roughnessFactor = roughness;
          #ifdef USE_ROUGHNESSMAP
            float rA = texture2D(roughnessMap, grassWorldUvA).g;
            float rB = texture2D(roughnessMap, grassWorldUvB).g;
            roughnessFactor *= mix(rA, rB, grassBlendNoise);
          #endif
          float grassRoughVar = envNoise2(vGrassWorldPos.xz * 0.65);
          roughnessFactor = clamp(mix(roughnessFactor, 0.95, grassRoughVar * 0.35) * mix(1.0, 0.65, uGrassWet), 0.42, 0.99);
          `,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `
          #ifdef USE_NORMALMAP_TANGENTSPACE
            vec3 nGrassA = texture2D(normalMap, grassWorldUvA).xyz * 2.0 - 1.0;
            vec3 nGrassB = texture2D(normalMap, grassWorldUvB).xyz * 2.0 - 1.0;
            vec3 nGrassMix = normalize(mix(nGrassA, nGrassB, grassBlendNoise));
            vec2 grassSlope = (nGrassMix.xy / max(0.25, nGrassMix.z)) * normalScale * (1.0 - aerialSmooth * 0.65);
            vec3 worldBaseGrassN = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
            vec3 worldGrassN = normalize(worldBaseGrassN + vec3(grassSlope.x, 0.0, grassSlope.y));
            normal = normalize((viewMatrix * vec4(worldGrassN, 0.0)).xyz);
          #endif
          `,
        );
  };
  material.needsUpdate = true;
}

export function enhanceBuildingFacadeMaterial(
  material: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial,
  options: {
    heightMap: THREE.Texture;
    pomScale?: number;
    tileWidthMeters?: number;
    tileHeightMeters?: number;
    isCurtainTower?: boolean;
    sharedSunDir: { value: THREE.Vector3 };
    cacheKey: string;
  },
): void {
  const pomScale = options.pomScale ?? 0.028;
  const tileW = options.tileWidthMeters ?? 10.6;
  const tileH = options.tileHeightMeters ?? 10.2;
  const isTower = options.isCurtainTower ? 1.0 : 0.0;

  material.customProgramCacheKey = () => options.cacheKey;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uArchHeightMap = { value: options.heightMap };
    shader.uniforms.uPomScale = { value: pomScale };
    shader.uniforms.uTileScale = { value: new THREE.Vector2(tileW, tileH) };
    shader.uniforms.uIsCurtainTower = { value: isTower };
    shader.uniforms.uSunDirWorld = options.sharedSunDir;

    shader.vertexShader =
      `
      uniform vec2 uTileScale;
      varying vec3 vFacadeWorldPos;
      varying vec3 vFacadeLocalNormal;
      varying vec2 vArchTiledUv;
      varying vec3 vWorldTangent;
      varying vec3 vWorldBitangent;
      varying vec3 vWorldNormalVec;
      ` +
      shader.vertexShader.replace(
        '#include <project_vertex>',
        `
        #include <project_vertex>
        mat4 instMat = mat4(1.0);
        float spanX = 12.0;
        float spanY = 18.0;
        float spanZ = 12.0;
        #ifdef USE_INSTANCING
          instMat = instanceMatrix;
          spanX = max(1.0, length(instanceMatrix[0].xyz));
          spanY = max(1.0, length(instanceMatrix[1].xyz));
          spanZ = max(1.0, length(instanceMatrix[2].xyz));
        #endif

        mat4 fullWorldMat = modelMatrix * instMat;
        vFacadeWorldPos = (fullWorldMat * vec4(transformed, 1.0)).xyz;
        vFacadeLocalNormal = normal;

        // Tiling arquitectónico entero en metros reales para evitar ventanas estiradas o cortadas
        float horizMeters = abs(normal.x) > 0.5 ? spanZ : spanX;
        float baysX = max(1.0, floor(horizMeters / uTileScale.x + 0.5));
        float floorsY = max(1.0, floor(spanY / uTileScale.y + 0.5));
        #ifdef USE_MAP
          vec2 rawUv = vMapUv;
        #else
          vec2 rawUv = uv;
        #endif
        vArchTiledUv = abs(normal.y) > 0.5
          ? rawUv * vec2(max(1.0, spanX / 6.0), max(1.0, spanZ / 6.0))
          : vec2(rawUv.x * baysX, rawUv.y * floorsY);

        // Base TBN analítica ortonormal para caras del edificio (libre de artefactos dFdx/dFdy)
        vec3 localT = abs(normal.x) > 0.5
          ? vec3(0.0, 0.0, normal.x > 0.0 ? -1.0 : 1.0)
          : (abs(normal.z) > 0.5 ? vec3(normal.z > 0.0 ? 1.0 : -1.0, 0.0, 0.0) : vec3(1.0, 0.0, 0.0));
        vec3 localB = abs(normal.y) > 0.5 ? vec3(0.0, 0.0, -1.0) : vec3(0.0, 1.0, 0.0);

        vWorldTangent = normalize((fullWorldMat * vec4(localT, 0.0)).xyz);
        vWorldBitangent = normalize((fullWorldMat * vec4(localB, 0.0)).xyz);
        vWorldNormalVec = normalize(cross(vWorldTangent, vWorldBitangent));
        if (dot(vWorldNormalVec, (fullWorldMat * vec4(normal, 0.0)).xyz) < 0.0) {
          vWorldNormalVec = -vWorldNormalVec;
        }
        `,
      );

    shader.fragmentShader =
      `
      uniform sampler2D uArchHeightMap;
      uniform float uPomScale;
      uniform float uIsCurtainTower;
      uniform vec3 uSunDirWorld;
      varying vec3 vFacadeWorldPos;
      varying vec3 vFacadeLocalNormal;
      varying vec2 vArchTiledUv;
      varying vec3 vWorldTangent;
      varying vec3 vWorldBitangent;
      varying vec3 vWorldNormalVec;
      ${GLSL_WORLD_NOISE_HELPERS}

      vec2 computePomUv(vec2 baseUv, vec3 viewDirTS, float strength) {
        const float numLayers = 5.0;
        float layerDepth = 1.0 / numLayers;
        float currentLayerDepth = 0.0;
        vec2 P = (viewDirTS.xy / max(0.28, viewDirTS.z)) * strength;
        vec2 deltaUv = P / numLayers;
        vec2 currentUv = baseUv;
        float currentDepth = 1.0 - texture2D(uArchHeightMap, currentUv).r;

        for (int i = 0; i < 5; i++) {
          if (currentLayerDepth < currentDepth) {
            currentUv -= deltaUv;
            currentDepth = 1.0 - texture2D(uArchHeightMap, currentUv).r;
            currentLayerDepth += layerDepth;
          }
        }
        vec2 prevUv = currentUv + deltaUv;
        float afterDepth = currentDepth - currentLayerDepth;
        float beforeDepth = (1.0 - texture2D(uArchHeightMap, prevUv).r) - currentLayerDepth + layerDepth;
        float weight = clamp(afterDepth / max(0.0001, afterDepth - beforeDepth), 0.0, 1.0);
        return mix(currentUv, prevUv, weight);
      }
      ` +
      shader.fragmentShader
        .replace(
          '#include <map_fragment>',
          `
          bool isRoofSurface = abs(vFacadeLocalNormal.y) > 0.5;
          vec3 worldViewVec = cameraPosition - vFacadeWorldPos;
          float camDist = length(worldViewVec);
          vec3 worldViewDir = worldViewVec / max(0.001, camDist);

          vec2 pomUv = vArchTiledUv;
          if (!isRoofSurface && camDist < 145.0) {
            vec3 viewDirTS = normalize(vec3(
              dot(worldViewDir, vWorldTangent),
              dot(worldViewDir, vWorldBitangent),
              dot(worldViewDir, vWorldNormalVec)
            ));
            float distFade = smoothstep(145.0, 50.0, camDist);
            pomUv = computePomUv(vArchTiledUv, viewDirTS, uPomScale * distFade);
          }

          #ifdef USE_MAP
            if (isRoofSurface) {
              // Azotea industrial de grava/membrana asfáltica meteorizada (sin estirar ventanas en el techo)
              float roofGravel = envFbm3(vFacadeWorldPos.xz * 0.65);
              float roofStain = envFbm3(vFacadeWorldPos.xz * 0.14 + vec2(4.2, 8.7));
              vec3 tarCol = mix(vec3(0.14, 0.14, 0.13), vec3(0.27, 0.25, 0.22), roofGravel);
              tarCol *= mix(0.72, 1.08, roofStain);
              diffuseColor.rgb *= tarCol;
            } else {
              vec4 sampledDiffuseColor = texture2D(map, pomUv);
              diffuseColor *= sampledDiffuseColor;
            }
          #endif
          `,
        )
        .replace(
          '#include <color_fragment>',
          `
          #include <color_fragment>
          float archRoughSample = isRoofSurface ? 0.90 : texture2D(roughnessMap, pomUv).g;
          float archGlassMask = isRoofSurface ? 0.0 : smoothstep(0.26, 0.07, archRoughSample);

          // 4. IMPERFECCIONES DE SUPERFICIE: suciedad acumulada en zócalo/base, musgo húmedo, chorreaduras de hollín/óxido
          float wallMacro = envFbm3(vec2((vFacadeWorldPos.x + vFacadeWorldPos.z) * 0.16, vFacadeWorldPos.y * 0.09));
          float dripStreaks = envFbm3(vec2((vFacadeWorldPos.x - vFacadeWorldPos.z) * 0.85, vFacadeWorldPos.y * 0.12));

          float baseHeight = max(0.0, vFacadeWorldPos.y + 0.15);
          float plinthDirtMask = (1.0 - smoothstep(0.0, 3.8 + wallMacro * 1.9, baseHeight)) * (0.58 + 0.42 * dripStreaks);
          float basalMossMask = (1.0 - smoothstep(0.0, 1.65 + wallMacro * 0.8, baseHeight))
            * smoothstep(0.46, 0.78, envFbm3(vFacadeWorldPos.xz * 0.9 + vec2(baseHeight * 0.7)))
            * (1.0 - archGlassMask * 0.85);
          float upperGrunge = smoothstep(0.38, 0.84, dripStreaks * 0.62 + wallMacro * 0.38) * (1.0 - archGlassMask * 0.72);

          // Oscurecimiento de zócalo por hollín vial, barro seco y humedad ascendente
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.34, 0.30, 0.26), plinthDirtMask * 0.76);
          // Desprendimiento localizado no repetitivo en coordenadas mundiales cerca del zócalo
          float worldSpallNoise = envFbm3(vec2((vFacadeWorldPos.x - vFacadeWorldPos.z) * 0.42, vFacadeWorldPos.y * 0.38));
          float worldSpallMask = smoothstep(0.74, 0.85, worldSpallNoise)
            * (1.0 - smoothstep(1.5, 9.5, baseHeight))
            * (1.0 - archGlassMask)
            * (1.0 - uIsCurtainTower);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.25, 0.17), worldSpallMask * 0.62);
          // Musgo verde-oliva sutil en la base junto a la vereda
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.14, 0.20, 0.09), basalMossMask * 0.56);
          // Pátina industrial no uniforme en muros
          diffuseColor.rgb *= mix(1.04, 0.74, upperGrunge * 0.55);
          `,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `
          float roughnessFactor = roughness;
          #ifdef USE_ROUGHNESSMAP
            roughnessFactor *= isRoofSurface ? 0.94 : texture2D(roughnessMap, pomUv).g;
          #endif
          float roughImperfection = (envFbm3(vFacadeWorldPos.xz * 0.45 + vec2(vFacadeWorldPos.y * 0.35)) - 0.5) * 0.22;
          roughnessFactor = clamp(
            roughnessFactor + roughImperfection * (1.0 - archGlassMask * 0.85) + plinthDirtMask * 0.10 - basalMossMask * 0.12,
            0.04,
            0.99
          );
          `,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `
          #ifdef USE_NORMALMAP_TANGENTSPACE
            if (!isRoofSurface) {
              vec3 mapN = texture2D(normalMap, pomUv).xyz * 2.0 - 1.0;
              mapN.xy *= normalScale;
              vec3 worldPerturbedN = normalize(
                vWorldTangent * mapN.x + vWorldBitangent * mapN.y + vWorldNormalVec * mapN.z
              );
              normal = normalize((viewMatrix * vec4(worldPerturbedN, 0.0)).xyz);
            }
          #endif
          `,
        )
        .replace(
          '#include <opaque_fragment>',
          `
          // Shader reflectivo de ventanas arquitectónicas: refleja el cielo dorado de otoño, horizonte y silueta urbana al pasar
          if (archGlassMask > 0.02) {
            vec3 nWorld = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
            vec3 reflDir = reflect(-worldViewDir, nWorld);
            float fresnel = 0.14 + 0.84 * pow(1.0 - clamp(dot(worldViewDir, nWorld), 0.0, 1.0), 3.8);

            float horizonGlow = exp(-abs(reflDir.y) * 4.2);
            vec3 goldenSkyRefl = mix(vec3(0.22, 0.20, 0.17), vec3(0.92, 0.72, 0.42), horizonGlow);
            goldenSkyRefl = mix(goldenSkyRefl, vec3(0.36, 0.46, 0.56), smoothstep(0.18, 0.78, reflDir.y));

            float sunGlint = pow(clamp(dot(reflDir, normalize(uSunDirWorld)), 0.0, 1.0), 28.0);
            goldenSkyRefl += vec3(1.85, 1.28, 0.58) * sunGlint;

            // Silueta urbana reflejada en el hemisferio inferior/medio del vidrio
            float streetSilhouette = step(reflDir.y, 0.08 + 0.06 * sin(reflDir.z * 9.0 + vFacadeWorldPos.z * 0.08));
            goldenSkyRefl = mix(goldenSkyRefl, vec3(0.11, 0.10, 0.09), streetSilhouette * 0.58);

            float reflBoost = mix(0.58, 0.78, uIsCurtainTower);
            outgoingLight = mix(outgoingLight, outgoingLight * 0.42 + goldenSkyRefl * reflBoost, archGlassMask * fresnel);
          }
          #include <opaque_fragment>
          `,
        );
  };
  material.needsUpdate = true;
}

export function enhanceConcreteSurfaceImperfections(
  material: THREE.MeshStandardMaterial,
  cacheKey: string,
): void {
  material.customProgramCacheKey = () => cacheKey;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      `varying vec3 vConcWorldPos;\n` +
      shader.vertexShader.replace(
        '#include <project_vertex>',
        `
        #include <project_vertex>
        vec4 concInst = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          concInst = instanceMatrix * concInst;
        #endif
        vConcWorldPos = (modelMatrix * concInst).xyz;
        `,
      );

    shader.fragmentShader =
      `varying vec3 vConcWorldPos;\n${GLSL_WORLD_NOISE_HELPERS}\n` +
      shader.fragmentShader
        .replace(
          '#include <color_fragment>',
          `
          #include <color_fragment>
          float concDirt = envFbm3(vConcWorldPos.xz * 0.28 + vec2(vConcWorldPos.y * 0.25));
          float concMoss = smoothstep(0.64, 0.88, envFbm3(vConcWorldPos.xz * 0.75 + vec2(11.4, 3.8)))
            * (1.0 - smoothstep(0.1, 1.4, max(0.0, vConcWorldPos.y)));
          diffuseColor.rgb *= mix(0.72, 1.08, concDirt);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.17, 0.22, 0.11), concMoss * 0.42);
          `,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `
          #include <roughnessmap_fragment>
          float concRoughNoise = (envNoise2(vConcWorldPos.xz * 0.9) - 0.5) * 0.20;
          roughnessFactor = clamp(roughnessFactor + concRoughNoise, 0.48, 0.98);
          `,
        );
  };
  material.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// FÁBRICA UNIFICADA DE MATERIALES DEL ENTORNO (0 CAMBIOS DE GEOMETRÍA)
// ---------------------------------------------------------------------------

export function createPhotorealEnvironmentMaterials(
  options: PhotorealEnvironmentOptions = {},
): PhotorealEnvironmentController {
  const historical = Boolean(options.historical);
  const wet = Boolean(options.wet);
  const halfRoadWidth = options.halfRoadWidth ?? 10.5;
  const maxAnisotropy = Math.max(1, options.maxAnisotropy ?? 16);

  const textures: THREE.Texture[] = [];
  const disposableMaterials: THREE.Material[] = [];
  const reflectiveMaterials: Array<THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial> = [];

  const sharedUniforms = {
    uEnvTime: { value: 0 },
    uSunDirWorld: { value: new THREE.Vector3(0.56, 0.518, -0.646).normalize() },
  };

  // 1. Corteza y follaje PBR con SSS + animación de viento + ramas foliares alpha-clipped
  const barkMaps = generateBarkPbrMaps(256);
  barkMaps.albedo.repeat.set(2, 3);
  barkMaps.normal.repeat.set(2, 3);
  barkMaps.roughness.repeat.set(2, 3);
  textures.push(barkMaps.albedo, barkMaps.normal, barkMaps.roughness);

  const trunkMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: barkMaps.albedo,
    normalMap: barkMaps.normal,
    normalScale: new THREE.Vector2(1.35, 1.35),
    roughnessMap: barkMaps.roughness,
    roughness: 0.94,
    metalness: 0.02,
  });
  enhanceBarkMaterialWithBaseMoss(trunkMaterial, 'nfsmw_tree_bark_v1');
  disposableMaterials.push(trunkMaterial);

  const palmTrunkMaterial = new THREE.MeshStandardMaterial({
    color: '#b8a58e',
    map: barkMaps.albedo,
    normalMap: barkMaps.normal,
    normalScale: new THREE.Vector2(1.15, 1.45),
    roughnessMap: barkMaps.roughness,
    roughness: 0.92,
    metalness: 0.02,
  });
  enhanceBarkMaterialWithBaseMoss(palmTrunkMaterial, 'nfsmw_palm_bark_v1');
  disposableMaterials.push(palmTrunkMaterial);

  const foliageMaps = generateFoliageCanopyPbrMaps(256);
  foliageMaps.albedo.repeat.set(2, 2);
  foliageMaps.normal.repeat.set(2, 2);
  foliageMaps.roughness.repeat.set(2, 2);
  textures.push(foliageMaps.albedo, foliageMaps.normal, foliageMaps.roughness);

  const foliageMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: foliageMaps.albedo,
    normalMap: foliageMaps.normal,
    normalScale: new THREE.Vector2(1.55, 1.55),
    roughnessMap: foliageMaps.roughness,
    roughness: 0.78,
    metalness: 0.02,
  });
  enhanceFoliageMaterialWithSSSAndWind(foliageMaterial, sharedUniforms, {
    sssIntensity: 0.86,
    windAmplitude: 0.075,
    cacheKey: 'nfsmw_foliage_sss_wind_v2',
  });
  disposableMaterials.push(foliageMaterial);

  // Ramas volumétricas con recorte alfa preciso (alphaTest) manteniendo idéntico shader SSS + viento
  const foliageCutoutMaps = generateFoliageCutoutPbrMaps(256);
  textures.push(foliageCutoutMaps.albedo, foliageCutoutMaps.normal, foliageCutoutMaps.roughness);

  const foliageCutoutMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: foliageCutoutMaps.albedo,
    normalMap: foliageCutoutMaps.normal,
    normalScale: new THREE.Vector2(1.45, 1.45),
    roughnessMap: foliageCutoutMaps.roughness,
    roughness: 0.74,
    metalness: 0.02,
    alphaTest: 0.44,
    side: THREE.DoubleSide,
    shadowSide: THREE.DoubleSide,
  });
  enhanceFoliageMaterialWithSSSAndWind(foliageCutoutMaterial, sharedUniforms, {
    sssIntensity: 0.92,
    windAmplitude: 0.09,
    cacheKey: 'nfsmw_foliage_cutout_sss_wind_v1',
  });
  disposableMaterials.push(foliageCutoutMaterial);

  // Infraestructura urbana de alta fidelidad: postes de madera/óxido, aisladores cerámicos, guardarrieles y muros de contención
  const woodPoleMaps = generateUtilityWoodPolePbrMaps(256);
  woodPoleMaps.albedo.repeat.set(2, 5);
  woodPoleMaps.normal.repeat.set(2, 5);
  woodPoleMaps.roughness.repeat.set(2, 5);
  textures.push(woodPoleMaps.albedo, woodPoleMaps.normal, woodPoleMaps.roughness);

  const utilityWoodPoleMaterial = new THREE.MeshStandardMaterial({
    color: '#c8baa8',
    map: woodPoleMaps.albedo,
    normalMap: woodPoleMaps.normal,
    normalScale: new THREE.Vector2(1.3, 1.3),
    roughnessMap: woodPoleMaps.roughness,
    roughness: 0.90,
    metalness: 0.05,
  });
  enhanceBarkMaterialWithBaseMoss(utilityWoodPoleMaterial, 'nfsmw_utility_wood_pole_v1');
  disposableMaterials.push(utilityWoodPoleMaterial);

  const guardrailMaps = generateGuardrailSteelPbrMaps(256);
  guardrailMaps.albedo.repeat.set(3, 1);
  guardrailMaps.normal.repeat.set(3, 1);
  guardrailMaps.roughness.repeat.set(3, 1);
  textures.push(guardrailMaps.albedo, guardrailMaps.normal, guardrailMaps.roughness);

  const rustedUtilityMetalMaterial = new THREE.MeshStandardMaterial({
    color: '#7d736b',
    map: guardrailMaps.albedo,
    normalMap: guardrailMaps.normal,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughnessMap: guardrailMaps.roughness,
    roughness: 0.62,
    metalness: 0.68,
    envMapIntensity: 1.35,
  });
  disposableMaterials.push(rustedUtilityMetalMaterial);
  reflectiveMaterials.push(rustedUtilityMetalMaterial);

  const ceramicInsulatorMaterial = new THREE.MeshPhysicalMaterial({
    color: '#d9e2e4',
    roughness: 0.14,
    metalness: 0.06,
    clearcoat: 0.92,
    clearcoatRoughness: 0.08,
    reflectivity: 0.90,
    envMapIntensity: 1.75,
  });
  disposableMaterials.push(ceramicInsulatorMaterial);
  reflectiveMaterials.push(ceramicInsulatorMaterial);

  const guardrailMetalMaterial = new THREE.MeshStandardMaterial({
    color: '#dde3e8',
    map: guardrailMaps.albedo,
    normalMap: guardrailMaps.normal,
    normalScale: new THREE.Vector2(1.25, 1.25),
    roughnessMap: guardrailMaps.roughness,
    roughness: 0.42,
    metalness: 0.78,
    envMapIntensity: 1.75,
  });
  disposableMaterials.push(guardrailMetalMaterial);
  reflectiveMaterials.push(guardrailMetalMaterial);

  const retainingWallMaps = generateRetainingWallPbrMaps(256);
  retainingWallMaps.albedo.repeat.set(2, 1);
  retainingWallMaps.normal.repeat.set(2, 1);
  retainingWallMaps.roughness.repeat.set(2, 1);
  textures.push(retainingWallMaps.albedo, retainingWallMaps.normal, retainingWallMaps.roughness);

  const retainingWallMaterial = new THREE.MeshStandardMaterial({
    color: historical ? '#d2c9b8' : '#d6d4cd',
    map: retainingWallMaps.albedo,
    normalMap: retainingWallMaps.normal,
    normalScale: new THREE.Vector2(1.35, 1.35),
    roughnessMap: retainingWallMaps.roughness,
    roughness: 0.88,
    metalness: 0.06,
  });
  enhanceConcreteSurfaceImperfections(retainingWallMaterial, 'nfsmw_retaining_wall_conc_v1');
  disposableMaterials.push(retainingWallMaterial);

  const palmLeafMaterial = new THREE.MeshStandardMaterial({
    color: '#4e6f3a',
    map: foliageMaps.albedo,
    normalMap: foliageMaps.normal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: foliageMaps.roughness,
    roughness: 0.74,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  enhanceFoliageMaterialWithSSSAndWind(palmLeafMaterial, sharedUniforms, {
    sssIntensity: 0.66,
    windAmplitude: 0.055,
    cacheKey: 'nfsmw_palm_sss_wind_v1',
  });
  disposableMaterials.push(palmLeafMaterial);

  const hedgeMaterial = new THREE.MeshStandardMaterial({
    color: '#485d34',
    map: foliageMaps.albedo,
    normalMap: foliageMaps.normal,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughnessMap: foliageMaps.roughness,
    roughness: 0.84,
    metalness: 0.02,
  });
  enhanceFoliageMaterialWithSSSAndWind(hedgeMaterial, sharedUniforms, {
    sssIntensity: 0.48,
    windAmplitude: 0.022,
    cacheKey: 'nfsmw_hedge_sss_wind_v1',
  });
  disposableMaterials.push(hedgeMaterial);

  // 2. Césped fotorrealista con normal map, AO de raíz y parches otoñales
  const grassMaps = generateGrassGroundPbrMaps(256);
  grassMaps.albedo.repeat.set(42, 42);
  grassMaps.normal.repeat.set(42, 42);
  grassMaps.roughness.repeat.set(42, 42);
  textures.push(grassMaps.albedo, grassMaps.normal, grassMaps.roughness);

  const lushGrassMaps = {
    albedo: grassMaps.albedo.clone(),
    normal: grassMaps.normal.clone(),
    roughness: grassMaps.roughness.clone(),
  };
  lushGrassMaps.albedo.colorSpace = THREE.SRGBColorSpace;
  lushGrassMaps.albedo.repeat.set(6, 28);
  lushGrassMaps.normal.repeat.set(6, 28);
  lushGrassMaps.roughness.repeat.set(6, 28);
  lushGrassMaps.albedo.needsUpdate = true;
  lushGrassMaps.normal.needsUpdate = true;
  lushGrassMaps.roughness.needsUpdate = true;
  textures.push(lushGrassMaps.albedo, lushGrassMaps.normal, lushGrassMaps.roughness);

  const groundGrassMaterial = new THREE.MeshStandardMaterial({
    color: historical ? '#e2dec8' : '#f2ebd6',
    map: grassMaps.albedo,
    normalMap: grassMaps.normal,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughnessMap: grassMaps.roughness,
    roughness: 0.92,
    metalness: 0.02,
  });
  enhanceGrassMaterialWithMacroVariation(groundGrassMaterial, {
    halfRoadWidth,
    wet,
    cacheKey: `nfsmw_ground_grass_${wet ? 'wet' : 'dry'}_v1`,
  });
  disposableMaterials.push(groundGrassMaterial);

  const lushGrassMaterial = new THREE.MeshStandardMaterial({
    color: '#f5efe0',
    map: lushGrassMaps.albedo,
    normalMap: lushGrassMaps.normal,
    normalScale: new THREE.Vector2(1.25, 1.25),
    roughnessMap: lushGrassMaps.roughness,
    roughness: 0.88,
    metalness: 0.02,
  });
  enhanceGrassMaterialWithMacroVariation(lushGrassMaterial, {
    halfRoadWidth,
    wet,
    cacheKey: `nfsmw_lush_grass_${wet ? 'wet' : 'dry'}_v1`,
  });
  disposableMaterials.push(lushGrassMaterial);

  const distantBankGrassMaterial = new THREE.MeshStandardMaterial({
    color: '#d4d0b8',
    map: grassMaps.albedo,
    normalMap: grassMaps.normal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: grassMaps.roughness,
    roughness: 0.94,
    metalness: 0.02,
  });
  enhanceGrassMaterialWithMacroVariation(distantBankGrassMaterial, {
    halfRoadWidth,
    wet,
    cacheKey: 'nfsmw_bank_grass_v1',
  });
  disposableMaterials.push(distantBankGrassMaterial);

  // 3. Veredas, cordones y remates de azotea con imperfecciones de superficie
  const sidewalkMaps = generateWeatheredSidewalkPbrMaps(256);
  sidewalkMaps.albedo.repeat.set(2, 24);
  sidewalkMaps.normal.repeat.set(2, 24);
  sidewalkMaps.roughness.repeat.set(2, 24);
  textures.push(sidewalkMaps.albedo, sidewalkMaps.normal, sidewalkMaps.roughness);

  const sidewalkMaterial = new THREE.MeshStandardMaterial({
    color: historical ? '#ddd5c5' : '#e4e0d6',
    map: sidewalkMaps.albedo,
    normalMap: sidewalkMaps.normal,
    normalScale: new THREE.Vector2(0.95, 0.95),
    roughnessMap: sidewalkMaps.roughness,
    roughness: 0.86,
    metalness: 0.04,
  });
  enhanceConcreteSurfaceImperfections(sidewalkMaterial, 'nfsmw_sidewalk_conc_v1');
  disposableMaterials.push(sidewalkMaterial);

  const curbMaterial = new THREE.MeshStandardMaterial({
    color: '#cfc9bc',
    map: sidewalkMaps.albedo,
    normalMap: sidewalkMaps.normal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: sidewalkMaps.roughness,
    roughness: 0.84,
    metalness: 0.05,
  });
  enhanceConcreteSurfaceImperfections(curbMaterial, 'nfsmw_curb_conc_v1');
  disposableMaterials.push(curbMaterial);

  const roofCapMaterial = new THREE.MeshStandardMaterial({
    color: '#5a6066',
    map: sidewalkMaps.albedo,
    normalMap: sidewalkMaps.normal,
    normalScale: new THREE.Vector2(1.05, 1.05),
    roughnessMap: sidewalkMaps.roughness,
    roughness: 0.78,
    metalness: 0.28,
  });
  enhanceConcreteSurfaceImperfections(roofCapMaterial, 'nfsmw_roofcap_ind_v1');
  disposableMaterials.push(roofCapMaterial);

  // 4. Cuatro arquetipos de fachadas urbanas (hormigón visto, ladrillo envejecido, mampostería ocre y metal oxidado)
  const archetypes: BuildingArchetype[] = [
    'concrete',
    'brick',
    'stucco',
    'industrial_metal',
  ];

  const facadeMaterials = archetypes.map((arch, idx) => {
    const maps = generateBuildingArchetypePbrMaps(arch, 512);
    textures.push(maps.albedo, maps.normal, maps.roughness, maps.height);

    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: maps.albedo,
      normalMap: maps.normal,
      normalScale: new THREE.Vector2(1.25, 1.25),
      roughnessMap: maps.roughness,
      roughness: 1.0,
      metalness: arch === 'industrial_metal' ? 0.42 : 0.14,
      envMapIntensity: 1.65,
    });
    enhanceBuildingFacadeMaterial(mat, {
      heightMap: maps.height,
      pomScale: arch === 'brick' || arch === 'concrete' ? 0.032 : 0.026,
      tileWidthMeters: 10.6,
      tileHeightMeters: 10.2,
      isCurtainTower: false,
      sharedSunDir: sharedUniforms.uSunDirWorld,
      cacheKey: `nfsmw_facade_${arch}_${idx}_v1`,
    });
    disposableMaterials.push(mat);
    reflectiveMaterials.push(mat);
    return mat;
  });

  // 5. Torres de muro cortina y paños vidriados reflectivos con suciedad basal
  const curtainMaps = generateCurtainWallPbrMaps(512);
  textures.push(curtainMaps.albedo, curtainMaps.normal, curtainMaps.roughness, curtainMaps.height);

  const towerTints = ['#b8dced', '#dfd8c8'];
  const towerMaterials = towerTints.map((tintHex, idx) => {
    const tMat = new THREE.MeshPhysicalMaterial({
      color: tintHex,
      map: curtainMaps.albedo,
      normalMap: curtainMaps.normal,
      normalScale: new THREE.Vector2(0.95, 0.95),
      roughnessMap: curtainMaps.roughness,
      roughness: 1.0,
      metalness: 0.48,
      clearcoat: 0.94,
      clearcoatRoughness: 0.05,
      reflectivity: 0.96,
      envMapIntensity: 2.05,
    });
    enhanceBuildingFacadeMaterial(tMat, {
      heightMap: curtainMaps.height,
      pomScale: 0.020,
      tileWidthMeters: 14.0,
      tileHeightMeters: 22.0,
      isCurtainTower: true,
      sharedSunDir: sharedUniforms.uSunDirWorld,
      cacheKey: `nfsmw_curtain_tower_${idx}_v1`,
    });
    disposableMaterials.push(tMat);
    reflectiveMaterials.push(tMat);
    return tMat;
  });

  // Paños de ventana adicionales hacia la avenida con shader de reflejo de cielo dorado y horizonte
  const windowPaneMaterial = new THREE.MeshPhysicalMaterial({
    color: '#223648',
    normalMap: curtainMaps.normal,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: 0.045,
    metalness: 0.55,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    reflectivity: 1.0,
    envMapIntensity: 2.35,
    transparent: true,
    opacity: 0.90,
  });
  windowPaneMaterial.customProgramCacheKey = () => 'nfsmw_reflective_window_pane_v1';
  windowPaneMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uSunDirWorld = sharedUniforms.uSunDirWorld;
    shader.vertexShader =
      `varying vec3 vWinWorldPos;\nvarying vec3 vWinWorldNormal;\n` +
      shader.vertexShader.replace(
        '#include <project_vertex>',
        `
        #include <project_vertex>
        mat4 winInst = mat4(1.0);
        #ifdef USE_INSTANCING
          winInst = instanceMatrix;
        #endif
        mat4 winFull = modelMatrix * winInst;
        vWinWorldPos = (winFull * vec4(transformed, 1.0)).xyz;
        vWinWorldNormal = normalize((winFull * vec4(normal, 0.0)).xyz);
        `,
      );
    shader.fragmentShader =
      `uniform vec3 uSunDirWorld;\nvarying vec3 vWinWorldPos;\nvarying vec3 vWinWorldNormal;\n` +
      shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `
        vec3 winView = normalize(cameraPosition - vWinWorldPos);
        vec3 winRefl = reflect(-winView, normalize(vWinWorldNormal));
        float winFresnel = 0.22 + 0.76 * pow(1.0 - clamp(dot(winView, normalize(vWinWorldNormal)), 0.0, 1.0), 3.4);
        float winHorizon = exp(-abs(winRefl.y) * 3.8);
        vec3 skyMirror = mix(vec3(0.20, 0.19, 0.16), vec3(0.98, 0.76, 0.44), winHorizon);
        skyMirror = mix(skyMirror, vec3(0.34, 0.46, 0.58), smoothstep(0.16, 0.80, winRefl.y));
        float winSunSpec = pow(clamp(dot(winRefl, normalize(uSunDirWorld)), 0.0, 1.0), 32.0);
        skyMirror += vec3(2.1, 1.45, 0.65) * winSunSpec;
        outgoingLight = mix(outgoingLight, outgoingLight * 0.35 + skyMirror * 0.82, winFresnel);
        #include <opaque_fragment>
        `,
      );
  };
  disposableMaterials.push(windowPaneMaterial);
  reflectiveMaterials.push(windowPaneMaterial);

  const applyMaxAnisotropy = (aniso: number) => {
    const clamped = Math.max(1, Math.floor(aniso));
    for (const tex of textures) {
      tex.anisotropy = clamped;
      tex.needsUpdate = true;
    }
  };
  applyMaxAnisotropy(maxAnisotropy);

  return {
    textures,
    trunkMaterial,
    foliageMaterial,
    foliageCutoutMaterial,
    palmTrunkMaterial,
    palmLeafMaterial,
    hedgeMaterial,
    utilityWoodPoleMaterial,
    rustedUtilityMetalMaterial,
    ceramicInsulatorMaterial,
    guardrailMetalMaterial,
    retainingWallMaterial,
    groundGrassMaterial,
    lushGrassMaterial,
    distantBankGrassMaterial,
    sidewalkMaterial,
    curbMaterial,
    roofCapMaterial,
    facadeMaterials,
    towerMaterials,
    windowPaneMaterial,
    reflectiveMaterials,
    applyMaxAnisotropy,
    update: (timeSec, sunDir) => {
      sharedUniforms.uEnvTime.value = timeSec;
      if (sunDir) {
        sharedUniforms.uSunDirWorld.value.set(sunDir[0], sunDir[1], sunDir[2]).normalize();
      }
    },
    dispose: () => {
      textures.forEach((t) => t.dispose());
      disposableMaterials.forEach((m) => m.dispose());
    },
  };
}
