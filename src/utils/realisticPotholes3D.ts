import * as THREE from 'three';
import type { TrackHazard } from './interactiveRacePhysics';
import type { CircuitHazardProfile } from '../data/asuncionCircuits';

/**
 * DATACAR ARENA V7.7 — Baches urbanos.
 * La calzada recorta aberturas reales; este módulo agrega bordes quebrados,
 * paredes y texturas de aproximación antes del pozo para leerlo desde atrás.
 * No se amplía el radio físico de interacción ni se reescribe la suspensión.
 */
const SIZE = 512;
const STEPS = 72;
const TAU = Math.PI * 2;

function randomFactory(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function jaggedPath(
  ctx: CanvasRenderingContext2D,
  radii: number[],
  multiplier: number,
  shiftX = 0,
  shiftY = 0,
) {
  ctx.beginPath();
  for (let i = 0; i < radii.length; i++) {
    const angle = i / radii.length * TAU;
    const r = radii[i] * multiplier;
    const x = SIZE / 2 + shiftX + Math.cos(angle) * r;
    const y = SIZE / 2 + shiftY + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function createPotholeTexture(profile: CircuitHazardProfile | undefined, variation: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  if (!ctx) return texture;

  const rand = randomFactory(1019 + variation * 2027 + (profile?.length ?? 0) * 83);
  const wet = profile === 'flood' || (profile === 'chains' && variation === 1);
  const severe = profile === 'craters' || profile === 'trenches';
  const edgeBase = profile === 'cobbles' ? '#777471' : '#6b6863';
  const radius = 179 + (severe ? 16 : 0);
  const rad: number[] = [];
  for (let i = 0; i < STEPS; i++) {
    const a = TAU * i / STEPS;
    // Ruptura orgánica reproducible: ondas largas + bordes mellados.
    rad.push(radius * (1 + .075 * Math.sin(3 * a + variation * 1.8)
      + .06 * Math.cos(7 * a + variation)
      + .03 * Math.sin(13 * a + variation * .9)
      + (rand() - .5) * .08));
  }

  // Mancha de desgaste que se funde con el asfalto circundante.
  const wear = ctx.createRadialGradient(256, 256, 98, 256, 256, 251);
  wear.addColorStop(0, 'rgba(16,17,17,0.35)');
  wear.addColorStop(.70, 'rgba(23,23,22,0.32)');
  wear.addColorStop(.88, 'rgba(64,59,52,0.16)');
  wear.addColorStop(1, 'rgba(64,59,52,0)');
  ctx.fillStyle = wear;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Rotura exterior del pavimento con borde irregular y grava expuesta.
  jaggedPath(ctx, rad, 1.13);
  ctx.fillStyle = '#302e2a';
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(100,96,89,.45)';
  ctx.stroke();

  jaggedPath(ctx, rad, 1.025);
  const edge = ctx.createRadialGradient(228, 210, 36, 256, 256, 235);
  edge.addColorStop(0, '#444342');
  edge.addColorStop(.68, '#4e4a44');
  edge.addColorStop(.90, edgeBase);
  edge.addColorStop(1, '#2e2d2b');
  ctx.fillStyle = edge;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(146,139,126,.46)';
  ctx.stroke();

  // Oscurecimiento en el borde interior para simular un desprendimiento profundo.
  jaggedPath(ctx, rad, .88, 4, 4);
  ctx.fillStyle = '#080b0d';
  ctx.fill();
  ctx.lineWidth = 13;
  ctx.strokeStyle = 'rgba(7,10,13,.78)';
  ctx.stroke();

  jaggedPath(ctx, rad, .73, 3, 6);
  const pit = ctx.createRadialGradient(217, 197, 14, 262, 263, 176);
  pit.addColorStop(0, '#111719');
  pit.addColorStop(.54, wet ? '#202f37' : '#222626');
  pit.addColorStop(1, '#343536');
  ctx.fillStyle = pit;
  ctx.fill();

  // Reborde iluminado en la cara que recibe la luz y sombra en la opuesta.
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 7; i <= 28; i++) {
    const a = TAU * i / STEPS;
    const r = rad[i] * .90;
    const x = 256 + Math.cos(a) * r;
    const y = 256 + Math.sin(a) * r;
    if (i === 7) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = 'rgba(176,164,143,.50)';
  ctx.stroke();

  // Charcos parciales en los circuitos húmedos, sin cubrir el agujero entero.
  if (wet) {
    ctx.save();
    ctx.translate(267, 286);
    ctx.rotate(-.20 + .17 * variation);
    ctx.scale(1, .60);
    const water = ctx.createRadialGradient(-24, -17, 4, 0, 0, 105);
    water.addColorStop(0, 'rgba(78,110,128,.72)');
    water.addColorStop(.72, 'rgba(48,75,87,.80)');
    water.addColorStop(1, 'rgba(15,31,39,.25)');
    ctx.fillStyle = water;
    ctx.beginPath();
    ctx.ellipse(0, 0, 115, 77, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(166,203,216,.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(-10, -7, 66, 34, 0, 3.2, 5.9);
    ctx.stroke();
    ctx.restore();
  }

  // Ramificaciones de grietas periféricas (no círculos perfectos).
  for (let crack = 0; crack < 10; crack++) {
    const angle = rand() * TAU;
    const base = radius * (.92 + rand() * .10);
    const length = 22 + rand() * 39;
    ctx.beginPath();
    for (let j = 0; j < 4; j++) {
      const r = base + length * j / 3;
      const a = angle + Math.sin(j * 1.7 + crack) * .07;
      const x = 256 + Math.cos(a) * r;
      const y = 256 + Math.sin(a) * r;
      if (j === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineWidth = 1 + rand() * 2;
    ctx.strokeStyle = 'rgba(12,14,15,.58)';
    ctx.stroke();
  }

  // Grava, fragmentos de asfalto y textura mineral muy fina.
  for (let i = 0; i < 540; i++) {
    const a = rand() * TAU;
    const r = radius * (.63 + rand() * .61);
    const x = 256 + Math.cos(a) * r;
    const y = 256 + Math.sin(a) * r;
    const d = .3 + rand() * (i < 65 ? 6 : 2.0);
    ctx.fillStyle = i < 65
      ? (rand() > .4 ? 'rgba(156,145,129,.65)' : 'rgba(22,22,21,.65)')
      : (rand() > .45 ? 'rgba(155,152,145,.20)' : 'rgba(6,9,10,.20)');
    ctx.beginPath();
    ctx.ellipse(x, y, d, Math.max(.3, d * (.3 + rand() * .9)), rand() * TAU, 0, TAU);
    ctx.fill();
  }

  texture.needsUpdate = true;
  return texture;
}

/** Mancha previa al pozo: asfalto desgastado, marcas de rodadura y grietas.
 * Se representa antes del borde, sin cubrir ni ampliar el agujero físico.
 * Es más perceptible desde una cámara de persecución baja.
 */
function createApproachAsphaltTexture(variation: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (!ctx) return tex;
  const random = randomFactory(74717 + variation * 9341);
  const gradient = ctx.createRadialGradient(128, 314, 12, 128, 280, 244);
  gradient.addColorStop(0, 'rgba(12,13,14,.39)');
  gradient.addColorStop(.55, 'rgba(24,26,27,.27)');
  gradient.addColorStop(.82, 'rgba(35,35,33,.08)');
  gradient.addColorStop(1, 'rgba(35,35,33,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 512);

  // Cracks ran in broken segments, not painted circular outlines.
  for (let c = 0; c < 19; c++) {
    const x = 22 + random() * 212;
    const y = 80 + random() * 345;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let j = 0; j < 5; j++) {
      ctx.lineTo(x + j * (random() * 12 - 6), y + j * (7 + random() * 9));
    }
    ctx.lineWidth = .65 + random() * 2.3;
    ctx.strokeStyle = random() > .55 ? 'rgba(3,5,6,.45)' : 'rgba(166,155,141,.24)';
    ctx.stroke();
  }
  // Small worn road-stone marks; very faint at long range.
  for (let n = 0; n < 120; n++) {
    const x = 10 + random() * 236;
    const y = 35 + random() * 445;
    const r = .4 + random() * 1.7;
    ctx.fillStyle = random() > .5 ? 'rgba(176,163,144,.21)' : 'rgba(0,0,0,.18)';
    ctx.fillRect(x, y, r * 2.2, r);
  }
  return tex;
}

export interface PotholeVisualKit {
  create(hazard: TrackHazard): THREE.Group;
  dispose(): void;
}

/** Los distintos baches se ven diferentes, pero siguen usando el radio del motor físico. */
export function createPotholeVisualKit(profile?: CircuitHazardProfile): PotholeVisualKit {
  const textures = [0, 1, 2].map(i => createPotholeTexture(profile, i));
  const decalMaterials = textures.map(map => new THREE.MeshBasicMaterial({
    map, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2,
  }));
  const approachTextures = [0, 1, 2].map(i => createApproachAsphaltTexture(i));
  const approachMaterials = approachTextures.map(map => new THREE.MeshBasicMaterial({
    map, transparent: true, depthWrite: false, opacity: .87, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -3,
  }));
  const gravelGeo = new THREE.TetrahedronGeometry(1, 0);
  const gravelMat = new THREE.MeshStandardMaterial({ color: '#82796d', roughness: 1 });
  const rimMat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: .98, metalness: 0,
    side: THREE.DoubleSide, depthWrite: true,
  });

  return {
    create(hazard: TrackHazard) {
      const visual = new THREE.Group();
      visual.name = `pothole_realista_${hazard.id}`;
      const seed = hazard.id * 1.937 + hazard.x * .3;
      const variant = ((hazard.id * 7) % 3 + 3) % 3;
      const w = hazard.radius * (profile === 'trenches' ? 2.95 : 2.75);
      const h = hazard.radius * (profile === 'trenches' ? 2.30 : 2.65);

      // Faja previa visible desde la cámara trasera. NO tapa el agujero ni
      // modifica el radio de contacto de la suspensión.
      const approachWidth = hazard.radius * 2.65;
      const approachLength = hazard.radius * 2.72;
      const approach = new THREE.Mesh(
        new THREE.PlaneGeometry(approachWidth, approachLength),
        approachMaterials[variant],
      );
      approach.rotation.x = -Math.PI / 2;
      approach.position.set(0, .024, -hazard.radius * 2.36);
      approach.renderOrder = 10;
      approach.name = 'asfalto_agrietado_previo_al_bache';
      visual.add(approach);

      // Decal ANULAR: el centro queda abierto. La malla principal de carretera
      // tiene aquí una perforación real, no una mancha encima del asfalto.
      const steps = 52;
      const groundGeo = new THREE.RingGeometry(hazard.radius * .965, hazard.radius * 1.38, steps);
      const uv = groundGeo.getAttribute('uv');
      const positions = groundGeo.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        uv.setXY(i, .5 + positions.getX(i) / w, .5 + positions.getY(i) / h);
      }
      uv.needsUpdate = true;
      const ground = new THREE.Mesh(groundGeo, decalMaterials[variant]);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = .018;
      ground.renderOrder = 12;
      ground.name = 'asfalto_quebrado_anular';
      visual.add(ground);

      // Cono irregular con cinco anillos: borde al nivel del asfalto, paredes
      // descendentes y fondo a -17 cm. Misma magnitud usada por la suspensión.
      const contour = [
        { r: 1.035, y: .016, color: '#91877b' },
        { r: .965, y: -.007, color: '#474441' },
        { r: .76, y: -.052, color: '#343331' },
        { r: .56, y: -.128, color: '#252525' },
        { r: .42, y: -.17, color: profile === 'flood' ? '#273844' : '#1e2020' },
        { r: 0, y: -.17, color: profile === 'flood' ? '#334e5b' : '#262929' },
      ];
      const vertices: number[] = [];
      const colors: number[] = [];
      const indices: number[] = [];
      for (let ring = 0; ring < contour.length; ring++) {
        const layer = contour[ring];
        for (let i = 0; i <= steps; i++) {
          const angle = i / steps * TAU;
          // Ruptura determinista, idéntica para pared y reborde; no vibrar por frame.
          const variation = 1 + .035 * Math.sin(angle * 7 + seed) + .027 * Math.cos(angle * 11 - seed);
          const radius = hazard.radius * layer.r * variation;
          vertices.push(Math.cos(angle) * radius, layer.y, Math.sin(angle) * radius);
          const c = new THREE.Color(layer.color);
          colors.push(c.r, c.g, c.b);
        }
      }
      for (let ring = 0; ring < contour.length - 1; ring++) {
        for (let i = 0; i < steps; i++) {
          const a = ring * (steps + 1) + i;
          const b = (ring + 1) * (steps + 1) + i;
          indices.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
      const bowlGeometry = new THREE.BufferGeometry();
      bowlGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      bowlGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      bowlGeometry.setIndex(indices);
      bowlGeometry.computeVertexNormals();
      const bowl = new THREE.Mesh(bowlGeometry, rimMat);
      bowl.name = 'cavidad_real_profunda_17cm';
      bowl.receiveShadow = true;
      visual.add(bowl);

      // Algunas piedras en el borde de acercamiento aportan un punto de
      // referencia de escala sin crear más de una draw call por bache.
      const gravel = new THREE.InstancedMesh(gravelGeo, gravelMat, 12);
      const dummy = new THREE.Object3D();
      const random = randomFactory(9209 + hazard.id * 71);
      for (let i = 0; i < 12; i++) {
        const angle = Math.PI * 1.07 + random() * Math.PI * .86;
        const r = hazard.radius * (1.02 + random() * .24);
        dummy.position.set(Math.cos(angle) * r, .034, Math.sin(angle) * r);
        const size = .022 + random() * .053;
        dummy.scale.set(size * 1.5, size * .45, size * 1.1);
        dummy.rotation.set(random() * .25, random() * TAU, random() * .22);
        dummy.updateMatrix();
        gravel.setMatrixAt(i, dummy.matrix);
      }
      gravel.instanceMatrix.needsUpdate = true;
      gravel.name = 'fragmentos_asfalto_borde';
      visual.add(gravel);
      visual.rotation.y = 0;
      return visual;
    },
    dispose() {
      textures.forEach(texture => texture.dispose());
      approachTextures.forEach(texture => texture.dispose());
      approachMaterials.forEach(material => material.dispose());
      gravelGeo.dispose();
      gravelMat.dispose();
      decalMaterials.forEach(material => material.dispose());
      rimMat.dispose();
    },
  };
}
