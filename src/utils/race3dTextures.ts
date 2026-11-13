import * as THREE from 'three';

/**
 * Texturas procedimentales 100% en código para el circuito 3D de DATACAR ARENA V4
 * Cumple con la directiva de Three.js: cero dependencias externas ni archivos 404.
 */

/**
 * Genera una textura de asfalto con textura de árido, desgaste y líneas divisorias
 */
export function createAsphaltTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);
  let seed = 45172;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  ctx.fillStyle = '#31363c';
  ctx.fillRect(0, 0, 1024, 1024);

  // Huellas sutiles de rodadura de neumáticos en cada carril
  for (const laneCenter of [140, 310, 480, 544, 714, 884]) {
    for (const trackOff of [-42, 42]) {
      const grad = ctx.createLinearGradient(laneCenter + trackOff - 32, 0, laneCenter + trackOff + 32, 0);
      grad.addColorStop(0, 'rgba(10, 13, 18, 0)');
      grad.addColorStop(0.5, 'rgba(10, 13, 18, 0.24)');
      grad.addColorStop(1, 'rgba(10, 13, 18, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(laneCenter + trackOff - 32, 0, 64, 1024);
    }
  }

  // Árido basáltico y cuarcítico de granulometría variada
  for (let i = 0; i < 46000; i++) {
    const x = rand() * 1024;
    const y = rand() * 1024;
    const r = 0.35 + rand() * 2.3;
    const roll = rand();
    ctx.fillStyle =
      roll > 0.72
        ? 'rgba(206, 210, 204, 0.19)'
        : roll > 0.38
          ? 'rgba(84, 92, 100, 0.16)'
          : 'rgba(8, 11, 16, 0.22)';
    ctx.fillRect(x, y, r, r * (0.55 + rand() * 0.9));
  }

  // Parches de sellado asfáltico
  for (let i = 0; i < 12; i++) {
    const x = 22 + rand() * 920;
    const y = rand() * 1024;
    const w = 24 + rand() * 78;
    const h = 16 + rand() * 150;
    ctx.fillStyle = i % 2 ? 'rgba(15, 20, 26, 0.20)' : 'rgba(136, 144, 152, 0.09)';
    ctx.fillRect(x, y, w, h);
  }

  // Fisuras capilares selladas con alquitrán
  for (let j = 0; j < 15; j++) {
    ctx.beginPath();
    let x = rand() * 1024;
    let y = rand() * 1024;
    ctx.moveTo(x, y);
    for (let i = 0; i < 7; i++) {
      x += (rand() - 0.5) * 48;
      y += rand() * 19;
      ctx.lineTo(x, y);
    }
    ctx.lineWidth = 0.65 + rand() * 1.5;
    ctx.strokeStyle = 'rgba(9, 13, 18, 0.42)';
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 20);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Mapa PBR de rugosidad del asfalto (linear data texture: sin SRGBColorSpace):
 * huellas de neumáticos ligeramente pulidas vs árido mate en banquinas.
 */
export function createAsphaltRoughnessTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#d4d4d4'; // ~0.83 base roughness
    ctx.fillRect(0, 0, 512, 512);

    for (const laneCenter of [70, 155, 240, 272, 357, 442]) {
      for (const trackOff of [-21, 21]) {
        const g = ctx.createLinearGradient(laneCenter + trackOff - 18, 0, laneCenter + trackOff + 18, 0);
        g.addColorStop(0, 'rgba(135, 135, 135, 0)');
        g.addColorStop(0.5, 'rgba(112, 112, 112, 0.68)'); // más especular en huella pulida
        g.addColorStop(1, 'rgba(135, 135, 135, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(laneCenter + trackOff - 18, 0, 36, 512);
      }
    }

    let seed = 8819;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 9500; i++) {
      const x = rand() * 512;
      const y = rand() * 512;
      const v = Math.round(135 + rand() * 95);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 1 + rand() * 2.5, 1 + rand() * 2.5);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 20);
  tex.anisotropy = 8;
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
