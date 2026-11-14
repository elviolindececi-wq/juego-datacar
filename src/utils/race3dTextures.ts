import * as THREE from 'three';

/**
 * Texturas procedimentales 100% en código para el circuito 3D de DATACAR ARENA V4
 * Cumple con la directiva de Three.js: cero dependencias externas ni archivos 404.
 */

interface TarCrackPath {
  points: Array<[number, number]>;
  width: number;
}

function generateDeterministicTarCracks(seedInit = 77319, count = 26): TarCrackPath[] {
  let seed = seedInit >>> 0;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const cracks: TarCrackPath[] = [];
  for (let j = 0; j < count; j++) {
    let x = 44 + rand() * 936;
    let y = rand() * 1024;
    const pts: Array<[number, number]> = [[x, y]];
    const horizontalBias = j % 4 === 0;
    const steps = 7 + Math.floor(rand() * 5);
    for (let i = 0; i < steps; i++) {
      x += horizontalBias ? (rand() - 0.35) * 62 : (rand() - 0.5) * 38;
      y += horizontalBias ? (rand() - 0.5) * 18 : 14 + rand() * 28;
      x = Math.max(28, Math.min(996, x));
      pts.push([x, y]);
    }
    cracks.push({
      points: pts,
      width: 1.3 + rand() * 2.1,
    });
  }
  return cracks;
}

const LANE_CENTERS_1024 = [98, 263, 428, 596, 761, 926] as const;
const LANE_DASH_DIVIDERS_1024 = [180, 346, 678, 844] as const;
const SHOULDER_LINES_1024 = [22, 1002] as const;

/**
 * Genera una textura PBR de asfalto de alta definición (1024x1024) con granulometría mineral,
 * parches de reparación, fisuras selladas con alquitrán negro brillante, huellas desgastadas
 * de neumáticos en carriles y demarcación vial termoplástica desgastada (carriles y banquinas).
 */
export function createAsphaltTexture(profile?: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);
  let seed = (profile === 'cobbles' ? 91241 : profile === 'flood' ? 58321 : 45172) >>> 0;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // Base asfáltica cálida/antracita realista (evita aspecto plano o plástico)
  ctx.fillStyle = profile === 'cobbles' ? '#36383e' : '#2d3238';
  ctx.fillRect(0, 0, 1024, 1024);

  // Variación longitudinal de compactadora asfáltica y envejecimiento tonal entre paños
  for (let b = 0; b < 24; b++) {
    const bx = (b / 24) * 1024;
    const bw = 34 + rand() * 36;
    const shade = b % 2 === 0 ? 'rgba(18, 22, 27, 0.14)' : 'rgba(148, 152, 146, 0.05)';
    ctx.fillStyle = shade;
    ctx.fillRect(bx, 0, bw, 1024);
  }

  // Parches de reparación asfáltica en frío con bordes irregulares
  for (let i = 0; i < 16; i++) {
    const x = 36 + rand() * 900;
    const y = rand() * 1024;
    const w = 32 + rand() * 94;
    const h = 28 + rand() * 175;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(16, 20, 26, 0.28)' : 'rgba(116, 122, 128, 0.09)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(10, 13, 18, 0.34)';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(x, y, w, h);
  }

  // Huellas desgastadas de rodadura de neumáticos a lo largo de cada carril + leve sombra de aceite central
  for (const laneCenter of LANE_CENTERS_1024) {
    const oilGrad = ctx.createLinearGradient(laneCenter - 18, 0, laneCenter + 18, 0);
    oilGrad.addColorStop(0, 'rgba(8, 10, 14, 0)');
    oilGrad.addColorStop(0.5, 'rgba(8, 10, 14, 0.16)');
    oilGrad.addColorStop(1, 'rgba(8, 10, 14, 0)');
    ctx.fillStyle = oilGrad;
    ctx.fillRect(laneCenter - 18, 0, 36, 1024);

    for (const trackOff of [-38, 38]) {
      const grad = ctx.createLinearGradient(
        laneCenter + trackOff - 30,
        0,
        laneCenter + trackOff + 30,
        0,
      );
      grad.addColorStop(0, 'rgba(12, 15, 20, 0)');
      grad.addColorStop(0.35, 'rgba(14, 18, 24, 0.22)');
      grad.addColorStop(0.5, 'rgba(62, 68, 76, 0.14)');
      grad.addColorStop(0.65, 'rgba(14, 18, 24, 0.22)');
      grad.addColorStop(1, 'rgba(12, 15, 20, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(laneCenter + trackOff - 30, 0, 60, 1024);
    }
  }

  // Árido basáltico, granítico y cuarcítico denso de granulometría nítida para primer plano
  for (let i = 0; i < 68000; i++) {
    const x = rand() * 1024;
    const y = rand() * 1024;
    const r = 0.45 + rand() * 2.15;
    const roll = rand();
    ctx.fillStyle =
      roll > 0.82
        ? 'rgba(218, 214, 202, 0.25)'
        : roll > 0.54
          ? 'rgba(128, 134, 140, 0.20)'
          : roll > 0.26
            ? 'rgba(56, 62, 70, 0.22)'
            : 'rgba(9, 12, 17, 0.28)';
    ctx.fillRect(x, y, r, r * (0.62 + rand() * 0.76));
  }

  // Fisuras selladas con alquitrán (tar-sealed cracks: banda de betún oscuro sobre la grieta)
  const cracks = generateDeterministicTarCracks(77319, 28);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const crack of cracks) {
    ctx.beginPath();
    ctx.moveTo(crack.points[0][0], crack.points[0][1]);
    for (let i = 1; i < crack.points.length; i++) {
      ctx.lineTo(crack.points[i][0], crack.points[i][1]);
    }
    ctx.lineWidth = crack.width + 2.0;
    ctx.strokeStyle = 'rgba(12, 15, 20, 0.56)';
    ctx.stroke();

    ctx.lineWidth = Math.max(0.8, crack.width * 0.55);
    ctx.strokeStyle = 'rgba(4, 6, 10, 0.72)';
    ctx.stroke();
  }

  // Demarcación vial pintada y ligeramente desgastada: líneas continuas de banquina y guiones de carril
  ctx.fillStyle = 'rgba(232, 228, 216, 0.86)';
  for (const sx of SHOULDER_LINES_1024) {
    ctx.fillRect(sx - 4, 0, 8, 1024);
  }
  const dashSegments: Array<[number, number]> = [
    [56, 360],
    [568, 360],
  ];
  for (const lx of LANE_DASH_DIVIDERS_1024) {
    for (const [dy, dh] of dashSegments) {
      ctx.fillStyle = 'rgba(230, 226, 214, 0.84)';
      ctx.fillRect(lx - 3, dy, 6, dh);
    }
  }

  // Micro-abrasión y desportillado realista de neumáticos sobre la pintura vial
  for (let w = 0; w < 2600; w++) {
    const pickShoulder = w % 3 === 0;
    const lineX = pickShoulder
      ? SHOULDER_LINES_1024[w % 2]
      : LANE_DASH_DIVIDERS_1024[w % LANE_DASH_DIVIDERS_1024.length];
    const wx = lineX + (rand() - 0.5) * 9;
    const wy = rand() * 1024;
    ctx.fillStyle = rand() > 0.4 ? 'rgba(43, 48, 54, 0.58)' : 'rgba(182, 178, 168, 0.32)';
    ctx.fillRect(wx, wy, 1.2 + rand() * 2.6, 1.4 + rand() * 4.5);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 20);
  tex.anisotropy = 16;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Mapa PBR de rugosidad del asfalto (1024x1024 linear data texture: sin SRGBColorSpace):
 * huellas de neumáticos pulidas, costuras de alquitrán brillantes, parches húmedos sutiles
 * y árido mineral mate para micro-destellos realistas frente a la cámara.
 */
export function createAsphaltRoughnessTexture(profile?: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = profile === 'flood' ? '#a6a6a6' : '#cbcbcb'; // ~0.80 rugosidad seca base
    ctx.fillRect(0, 0, 1024, 1024);

    // Huellas de rodadura pulidas por el paso constante de cubiertas (especular rasante cálido)
    for (const laneCenter of LANE_CENTERS_1024) {
      for (const trackOff of [-38, 38]) {
        const g = ctx.createLinearGradient(
          laneCenter + trackOff - 30,
          0,
          laneCenter + trackOff + 30,
          0,
        );
        g.addColorStop(0, 'rgba(110, 110, 110, 0)');
        g.addColorStop(0.5, 'rgba(84, 84, 84, 0.80)');
        g.addColorStop(1, 'rgba(110, 110, 110, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(laneCenter + trackOff - 30, 0, 60, 1024);
      }
    }

    let seed = 8819;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    // Parches de humedad capilar sutiles sobre el pavimento
    for (let p = 0; p < 24; p++) {
      const px = rand() * 1024;
      const py = rand() * 1024;
      const pr = 28 + rand() * 76;
      const pg = ctx.createRadialGradient(px, py, 4, px, py, pr);
      pg.addColorStop(0, 'rgba(46, 46, 46, 0.72)');
      pg.addColorStop(0.62, 'rgba(82, 82, 82, 0.38)');
      pg.addColorStop(1, 'rgba(130, 130, 130, 0)');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Costuras de alquitrán sellado (muy baja rugosidad -> reflejo especular nítido al sol y faros)
    const cracks = generateDeterministicTarCracks(77319, 28);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const crack of cracks) {
      ctx.beginPath();
      ctx.moveTo(crack.points[0][0], crack.points[0][1]);
      for (let i = 1; i < crack.points.length; i++) {
        ctx.lineTo(crack.points[i][0], crack.points[i][1]);
      }
      ctx.lineWidth = crack.width + 2.4;
      ctx.strokeStyle = 'rgb(38, 38, 38)';
      ctx.stroke();
    }

    // Pintura termoplástica con microesferas reflectivas moderadas
    ctx.fillStyle = 'rgb(156, 156, 156)';
    for (const sx of SHOULDER_LINES_1024) {
      ctx.fillRect(sx - 4, 0, 8, 1024);
    }
    for (const lx of LANE_DASH_DIVIDERS_1024) {
      ctx.fillRect(lx - 3, 56, 6, 360);
      ctx.fillRect(lx - 3, 568, 6, 360);
    }

    // Variación grano a grano de árido expuesto para micro-glints
    for (let i = 0; i < 28000; i++) {
      const x = rand() * 1024;
      const y = rand() * 1024;
      const v = Math.round(92 + rand() * 145);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 1 + rand() * 2.2, 1 + rand() * 2.2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 20);
  tex.anisotropy = 16;
  return tex;
}

/**
 * Mapa PBR de normales macro/meso en espacio tangente (512x512, linear NoColorSpace)
 * con relieve de árido, fisuras selladas y espesor de pintura termoplástica.
 */
export function createAsphaltNormalTexture(_profile?: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 20);
  tex.anisotropy = 16;
  if (!ctx) return tex;

  const size = 512;
  const heights = new Float32Array(size * size);
  let seed = 61423;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fine = rand() * 0.74;
      const wave =
        Math.sin((x / size) * Math.PI * 16 + (y / size) * Math.PI * 8) *
        Math.cos((y / size) * Math.PI * 14 - (x / size) * Math.PI * 6) *
        0.26;
      heights[y * size + x] = fine + wave;
    }
  }

  // Ligero espesor físico de líneas pintadas
  for (const sx1024 of SHOULDER_LINES_1024) {
    const cx = Math.round(sx1024 * 0.5);
    for (let y = 0; y < size; y++) {
      for (let dx = -2; dx <= 2; dx++) {
        const px = (cx + dx + size) % size;
        heights[y * size + px] += 0.35;
      }
    }
  }

  const img = ctx.createImageData(size, size);
  const strength = 2.05;
  for (let y = 0; y < size; y++) {
    const ym = ((y - 1 + size) % size) * size;
    const yp = ((y + 1) % size) * size;
    const yc = y * size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;
      const dx = (heights[yc + xp] - heights[yc + xm]) * strength;
      const dy = (heights[yp + x] - heights[ym + x]) * strength;
      const invLen = 1 / Math.hypot(dx, dy, 1);
      const idx = (yc + x) * 4;
      img.data[idx] = Math.round((-dx * invLen * 0.5 + 0.5) * 255);
      img.data[idx + 1] = Math.round((-dy * invLen * 0.5 + 0.5) * 255);
      img.data[idx + 2] = Math.round((invLen * 0.5 + 0.5) * 255);
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Mapa de normales de altísima frecuencia (512x512 seamless en coordenadas mundiales)
 * con piedras de basalto triturado, grava compactada y micro-poros de alquitrán para
 * máxima nitidez en primerísimo plano justo delante de la cámara.
 */
export function createAsphaltCloseUpDetailNormalTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 16;
  if (!ctx) return tex;

  const heights = new Float32Array(size * size);
  let seed = 904177;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // Base micro-porosa bituminosa
  for (let i = 0; i < size * size; i++) {
    heights[i] = (rand() - 0.5) * 0.28;
  }

  // Piedras de árido compactado (pebbles angulares envueltos de forma seamless en bordes)
  for (let p = 0; p < 14500; p++) {
    const cx = Math.floor(rand() * size);
    const cy = Math.floor(rand() * size);
    const rx = 1 + Math.floor(rand() * 3.4);
    const ry = 1 + Math.floor(rand() * 3.4);
    const peak = 0.42 + rand() * 0.78;
    const pit = rand() < 0.16 ? -0.55 : 1.0;
    for (let oy = -ry; oy <= ry; oy++) {
      const yy = ((cy + oy) % size + size) % size;
      const ny = oy / (ry + 0.45);
      for (let ox = -rx; ox <= rx; ox++) {
        const xx = ((cx + ox) % size + size) % size;
        const nx = ox / (rx + 0.45);
        const d2 = nx * nx + ny * ny;
        if (d2 < 1.0) {
          const facet = Math.sqrt(1.0 - d2);
          heights[yy * size + xx] += facet * peak * pit;
        }
      }
    }
  }

  const img = ctx.createImageData(size, size);
  const strength = 2.65;
  for (let y = 0; y < size; y++) {
    const ym = ((y - 1 + size) % size) * size;
    const yp = ((y + 1) % size) * size;
    const yc = y * size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;
      const dx = (heights[yc + xp] - heights[yc + xm]) * strength;
      const dy = (heights[yp + x] - heights[ym + x]) * strength;
      const invLen = 1 / Math.hypot(dx, dy, 1);
      const idx = (yc + x) * 4;
      img.data[idx] = Math.round((-dx * invLen * 0.5 + 0.5) * 255);
      img.data[idx + 1] = Math.round((-dy * invLen * 0.5 + 0.5) * 255);
      img.data[idx + 2] = Math.round((invLen * 0.5 + 0.5) * 255);
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Genera textura de bordillos / pianitos de competición (rojo y blanco)
 */
export function createKerbTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Segmentos alternados blanco y rojo
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 64, 128, 64);

  // Relieve de borde
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillRect(0, 0, 16, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 40);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Genera una textura de sombra de contacto elíptica suave para los neumáticos
 */
export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.clearRect(0, 0, 256, 256);
  const grad = ctx.createRadialGradient(128, 128, 20, 128, 128, 120);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
  grad.addColorStop(0.4, 'rgba(0, 0, 0, 0.65)');
  grad.addColorStop(0.75, 'rgba(0, 0, 0, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Genera textura para la línea de meta ajedrezada (checkered pattern)
 */
export function createCheckeredFinishTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const rows = 2;
  const cols = 8;
  const cellW = canvas.width / cols;
  const cellH = canvas.height / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#f8fafc' : '#020617';
      ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Genera textura de haz de luz proyectado de faros sobre el pavimento
 */
export function createHeadlightBeamTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.clearRect(0, 0, 256, 512);

  // Gradiente cónico alargado hacia adelante
  const grad = ctx.createRadialGradient(128, 30, 10, 128, 260, 240);
  grad.addColorStop(0, 'rgba(255, 255, 240, 0.55)');
  grad.addColorStop(0.3, 'rgba(224, 242, 254, 0.35)');
  grad.addColorStop(0.7, 'rgba(186, 230, 253, 0.12)');
  grad.addColorStop(1, 'rgba(186, 230, 253, 0.0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(100, 20);
  ctx.lineTo(20, 500);
  ctx.lineTo(236, 500);
  ctx.lineTo(156, 20);
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Textura para carteles kilométricos (50m, 100m, etc.)
 */
export function createDistanceSignTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Fondo azul vial reflectivo con borde blanco
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 244, 116);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 54px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 64);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Mapa de micro-relieve original para dar lectura de grava y árido al asfalto
 * próximo a cámara, sin cargar una textura externa pesada. Es una aproximación
 * visual, no desplaza la malla ni altera la fricción física. */
export function createAsphaltMicroRelief(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  if (!ctx) return tex;
  const img = ctx.createImageData(512, 512);
  let seed = 20531;
  const random = () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    const i = (y * 512 + x) * 4;
    const grain = random();
    const mineral = Math.sin(x * .49 + y * .27) * Math.cos(y * .57 - x * .35);
    const value = Math.round(Math.max(0, Math.min(255, 119 + grain * 34 + mineral * 14)));
    img.data[i] = img.data[i + 1] = img.data[i + 2] = value;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  tex.needsUpdate = true;
  return tex;
}
