import * as THREE from 'three';
import type { Vehicle } from '../types/vehicle.ts';
import {
  getFaithfulVehicleSpec,
  type FaithfulVehicleSpec,
} from './faithfulVehicleSpecs.ts';
import type { VehicleWheelRig } from './vehicleWheelRig.ts';

export interface FaithfulVehicleBuildResult {
  group: THREE.Group;
  spec: FaithfulVehicleSpec;
  wheelRig: VehicleWheelRig;
  setBrakeLit: (braking: boolean) => void;
  dispose: () => void;
}

function createFrontFasciaTexture(spec: FaithfulVehicleSpec): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#090d14';
    ctx.fillRect(0, 0, 512, 256);

    if (spec.grilleStyle === 'chery_diamond') {
      // Parrilla hexagonal/octogonal negra con diamantes cromados Chery
      ctx.fillStyle = '#0b0f17';
      ctx.beginPath();
      ctx.moveTo(46, 26);
      ctx.lineTo(466, 26);
      ctx.lineTo(426, 204);
      ctx.lineTo(86, 204);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 4;
      ctx.stroke();

      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 15; col++) {
          const x = 78 + col * 25 + (row % 2) * 12;
          const y = 42 + row * 24;
          const grad = ctx.createLinearGradient(x - 5, y - 4, x + 5, y + 4);
          grad.addColorStop(0, '#f8fafc');
          grad.addColorStop(0.5, '#cbd5e1');
          grad.addColorStop(1, '#475569');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(x, y - 4.5);
          ctx.lineTo(x + 7, y);
          ctx.lineTo(x, y + 4.5);
          ctx.lineTo(x - 7, y);
          ctx.closePath();
          ctx.fill();
        }
      }
      // Emblema cromado central Chery (óvalo estilizado)
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(256, 84, 34, 18, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(228, 92);
      ctx.lineTo(256, 67);
      ctx.lineTo(284, 92);
      ctx.stroke();
    } else if (spec.grilleStyle === 'nissan_slat_bars') {
      // Parrilla ancha Nissan Kicks 2027 de lamas horizontales negro piano
      ctx.fillStyle = '#070a0f';
      ctx.fillRect(16, 16, 480, 212);
      for (let r = 0; r < 5; r++) {
        const y = 32 + r * 34;
        const g = ctx.createLinearGradient(0, y, 0, y + 18);
        g.addColorStop(0, '#27303d');
        g.addColorStop(0.45, '#11161f');
        g.addColorStop(1, '#06080c');
        ctx.fillStyle = g;
        ctx.fillRect(28, y, 456, 18);
      }
      // Emblema circular Nissan con barra horizontal
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(256, 108, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(216, 98, 80, 20);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('NISSAN', 256, 108);
    } else if (spec.grilleStyle === 'suzuki_chrome_bar') {
      // Parrilla hexagonal nido de abeja con barra cromada ancha + S Suzuki
      ctx.fillStyle = '#090d14';
      ctx.fillRect(36, 20, 440, 195);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3;
      for (let y = 38; y < 200; y += 18) {
        for (let x = 52; x < 460; x += 26) {
          ctx.strokeRect(x + ((y / 18) % 2) * 12, y, 16, 11);
        }
      }
      const barGrad = ctx.createLinearGradient(0, 42, 0, 68);
      barGrad.addColorStop(0, '#ffffff');
      barGrad.addColorStop(0.55, '#cbd5e1');
      barGrad.addColorStop(1, '#64748b');
      ctx.fillStyle = barGrad;
      ctx.fillRect(24, 44, 464, 20);
      // Emblema S central
      ctx.fillStyle = '#f8fafc';
      ctx.font = '900 54px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('S', 256, 86);
    } else if (spec.grilleStyle === 'kia_tiger_chrome') {
      // Nariz Kia con franja cromada horizontal superior y entramado inferior
      ctx.fillStyle = '#090e17';
      ctx.fillRect(20, 24, 472, 190);
      const chromeG = ctx.createLinearGradient(0, 30, 0, 48);
      chromeG.addColorStop(0, '#f8fafc');
      chromeG.addColorStop(0.6, '#cbd5e1');
      chromeG.addColorStop(1, '#64748b');
      ctx.fillStyle = chromeG;
      ctx.fillRect(18, 28, 476, 16);
      // Entramado deportivo inferior
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.5;
      for (let y = 66; y < 200; y += 16) {
        for (let x = 36; x < 476; x += 28) {
          ctx.strokeRect(x + ((y / 16) % 2) * 12, y, 18, 10);
        }
      }
      // Marco plateado en U alrededor de la boca inferior
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(76, 208);
      ctx.lineTo(106, 98);
      ctx.lineTo(406, 98);
      ctx.lineTo(436, 208);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#0b111b';
      ctx.fillRect(24, 24, 464, 196);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 3;
      for (let y = 40; y < 204; y += 20) {
        ctx.beginPath();
        ctx.moveTo(38, y);
        ctx.lineTo(474, y);
        ctx.stroke();
      }
    }

    // Placa identificatoria de concesionaria abajo al centro
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(156, 150, 200, 56);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.strokeRect(156, 150, 200, 56);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.modelBadgeText, 256, 179);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createRearPlateTexture(spec: FaithfulVehicleSpec): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 384, 128);
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(0, 0, 384, 28);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${spec.brandLabel} · DATACAR PY`, 192, 15);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, 376, 120);
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 34px sans-serif';
    ctx.fillText(spec.modelBadgeText, 192, 80);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createAlloyWheelMesh(
  radiusM: number,
  widthM: number,
  isLeft: boolean,
  style: FaithfulVehicleSpec['alloyStyle'],
  spokeCount: number,
  shared: {
    tireMat: THREE.Material;
    rimSilverMat: THREE.Material;
    rimDarkMat: THREE.Material;
    discMat: THREE.Material;
    caliperMat: THREE.Material;
    geos: THREE.BufferGeometry[];
  },
): {
  steeringPivot: THREE.Group;
  rollingPivot: THREE.Group;
} {
  const steeringPivot = new THREE.Group();
  const rollingPivot = new THREE.Group();
  steeringPivot.add(rollingPivot);

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    shared.geos.push(g);
    return g;
  };

  // Neumático con hombro suavizado
  const tireGeo = trackGeo(new THREE.CylinderGeometry(radiusM, radiusM, widthM, 28));
  tireGeo.rotateZ(Math.PI / 2);
  const tireMesh = new THREE.Mesh(tireGeo, shared.tireMat);
  tireMesh.castShadow = true;
  tireMesh.receiveShadow = true;
  rollingPivot.add(tireMesh);

  // Hombros redondeados del neumático (aristas biseladas exteriores e interiores)
  const shoulderGeo = trackGeo(new THREE.TorusGeometry(radiusM * 0.87, radiusM * 0.13, 10, 28));
  shoulderGeo.rotateY(Math.PI / 2);
  for (const sideSign of [-1, 1]) {
    const sh = new THREE.Mesh(shoulderGeo, shared.tireMat);
    sh.position.x = sideSign * (widthM * 0.42);
    rollingPivot.add(sh);
  }

  // Barril interno negro brillante de llanta
  const rimRadius = radiusM * 0.67;
  const barrelGeo = trackGeo(new THREE.CylinderGeometry(rimRadius, rimRadius, widthM + 0.008, 22));
  barrelGeo.rotateZ(Math.PI / 2);
  const barrel = new THREE.Mesh(barrelGeo, shared.rimDarkMat);
  rollingPivot.add(barrel);

  // Disco de freno metálico y pinza fija (no gira sobre el eje con la rueda; va en steeringPivot)
  const outFaceX = isLeft ? widthM * 0.50 : -widthM * 0.50;
  const brakeDiscGeo = trackGeo(new THREE.CylinderGeometry(rimRadius * 0.72, rimRadius * 0.72, 0.025, 18));
  brakeDiscGeo.rotateZ(Math.PI / 2);
  const brakeDisc = new THREE.Mesh(brakeDiscGeo, shared.discMat);
  brakeDisc.position.x = outFaceX * 0.28;
  steeringPivot.add(brakeDisc);

  const caliperGeo = trackGeo(new THREE.BoxGeometry(0.05, radiusM * 0.34, radiusM * 0.22));
  const caliper = new THREE.Mesh(caliperGeo, shared.caliperMat);
  caliper.position.set(outFaceX * 0.36, radiusM * 0.20, -radiusM * 0.22);
  steeringPivot.add(caliper);

  // Aro exterior mecanizado brillante y radios dobles bi-tono hacia el lado visible
  const lipGeo = trackGeo(new THREE.TorusGeometry(rimRadius * 0.96, 0.017, 8, 24));
  lipGeo.rotateY(Math.PI / 2);
  const lip = new THREE.Mesh(lipGeo, shared.rimSilverMat);
  lip.position.x = outFaceX * 0.94;
  rollingPivot.add(lip);

  const spokeGeo = trackGeo(new THREE.BoxGeometry(0.024, rimRadius * 0.88, style === 'machined_twinspoke' ? 0.036 : 0.052));
  for (let i = 0; i < spokeCount; i++) {
    const angle = (i / spokeCount) * Math.PI * 2;
    if (style === 'machined_twinspoke') {
      for (const pairOff of [-0.14, 0.14]) {
        const a = angle + pairOff;
        const spoke = new THREE.Mesh(spokeGeo, shared.rimSilverMat);
        spoke.position.set(
          outFaceX * 0.96,
          Math.cos(a) * rimRadius * 0.48,
          Math.sin(a) * rimRadius * 0.48,
        );
        spoke.rotation.x = -a;
        rollingPivot.add(spoke);
      }
    } else {
      const spoke = new THREE.Mesh(spokeGeo, shared.rimSilverMat);
      spoke.position.set(
        outFaceX * 0.96,
        Math.cos(angle) * rimRadius * 0.48,
        Math.sin(angle) * rimRadius * 0.48,
      );
      spoke.rotation.x = -angle;
      rollingPivot.add(spoke);
    }
  }

  // Tapa central de aluminio
  const capGeo = trackGeo(new THREE.CylinderGeometry(rimRadius * 0.22, rimRadius * 0.24, 0.03, 14));
  capGeo.rotateZ(Math.PI / 2);
  const cap = new THREE.Mesh(capGeo, shared.rimSilverMat);
  cap.position.x = outFaceX * 0.97;
  rollingPivot.add(cap);

  return { steeringPivot, rollingPivot };
}

/**
 * Construye una carrocería 3D OEM de alta fidelidad (silueta SUV/Coupé/MPV perfilada,
 * techo flotante bicolor cuando corresponde, parrilla frontal fiel a la marca, ópticas DRL,
 * faros proyectores, espejos, manijas, barras de techo y 4 ruedas de aleación independientes).
 */
export function createFaithfulVehicle3D(
  vehicle: Vehicle,
  envMap?: THREE.Texture | null,
): FaithfulVehicleBuildResult {
  const spec = getFaithfulVehicleSpec(vehicle);
  const group = new THREE.Group();
  group.name = `faithful_oem_3d_${spec.modelId}`;

  const disposableGeos: THREE.BufferGeometry[] = [];
  const disposableMats: THREE.Material[] = [];
  const disposableTexs: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposableGeos.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposableMats.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    disposableTexs.push(t);
    return t;
  };

  const L = spec.lengthM;
  const W = spec.widthM;
  const H = spec.heightM;
  const halfL = L * 0.5;
  const halfW = W * 0.5;
  const clearY = spec.clearanceM;
  const beltY = clearY + (H - clearY) * spec.beltlineRatio;
  const hoodY = clearY + (H - clearY) * spec.hoodLineRatio;
  const roofY = H - 0.045;

  const frontAxleZ = halfL - L * spec.frontOverhangRatio;
  const rearAxleZ = frontAxleZ - L * spec.wheelbaseRatio;

  // Materiales PBR automotrices calibrados (basecoat pigmentado + laca transparente clearcoat)
  // Metalness moderado (~0.34) preserva el color OEM fiel bajo el sol sin lavar el techo en blanco espejo.
  const tunedMetalness = Math.min(0.36, spec.metallicFactor * 0.46);
  const bodyPaintMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: spec.bodyColorHex,
      metalness: tunedMetalness,
      roughness: Math.max(0.22, spec.paintRoughness + 0.06),
      clearcoat: Math.min(0.62, spec.clearcoat * 0.68),
      clearcoatRoughness: 0.11,
      reflectivity: 0.78,
      envMap: envMap || null,
      envMapIntensity: 0.82,
    }),
  );

  const isBlackFloatingRoof = spec.roofColorHex === '#0b0e14';
  const roofPaintMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: spec.roofColorHex,
      metalness: isBlackFloatingRoof ? 0.18 : tunedMetalness,
      roughness: isBlackFloatingRoof ? 0.18 : Math.max(0.22, spec.paintRoughness + 0.06),
      clearcoat: 0.62,
      clearcoatRoughness: 0.10,
      envMap: envMap || null,
      envMapIntensity: 0.80,
    }),
  );

  const secondaryAccentMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: spec.secondaryAccentHex,
      metalness: 0.38,
      roughness: 0.26,
      clearcoat: 0.55,
      envMap: envMap || null,
      envMapIntensity: 0.82,
    }),
  );

  const mirrorMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: spec.mirrorColorHex,
      metalness: spec.mirrorColorHex === '#0b0e14' || spec.mirrorColorHex === '#0e131b' ? 0.20 : tunedMetalness,
      roughness: 0.20,
      clearcoat: 0.60,
      envMap: envMap || null,
      envMapIntensity: 0.82,
    }),
  );

  const claddingMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: spec.claddingColorHex,
      roughness: 0.76,
      metalness: 0.08,
      envMap: envMap || null,
      envMapIntensity: 0.55,
    }),
  );

  const chromeMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: '#e5ecf3',
      metalness: 0.88,
      roughness: 0.18,
      clearcoat: 0.6,
      envMap: envMap || null,
      envMapIntensity: 1.05,
    }),
  );

  const skidMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: spec.skidPlateColorHex,
      metalness: 0.48,
      roughness: 0.36,
      envMap: envMap || null,
      envMapIntensity: 0.78,
    }),
  );

  const glassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: '#0b1522',
      metalness: 0.08,
      roughness: 0.08,
      clearcoat: 0.82,
      clearcoatRoughness: 0.06,
      reflectivity: 0.88,
      envMap: envMap || null,
      envMapIntensity: 1.05,
    }),
  );

  const pillarBlackMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: '#0a0e14',
      metalness: 0.16,
      roughness: 0.18,
      clearcoat: 0.62,
      envMap: envMap || null,
      envMapIntensity: 0.80,
    }),
  );

  const drlMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#f0f8ff',
      emissive: '#dbeafe',
      emissiveIntensity: 2.2,
      roughness: 0.15,
      metalness: 0.1,
    }),
  );

  const tailLampMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#dc2626',
      emissive: '#b91c1c',
      emissiveIntensity: 1.45,
      roughness: 0.18,
      metalness: 0.15,
    }),
  );

  const exhaustMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#cbd5e1',
      metalness: 0.88,
      roughness: 0.24,
      envMap: envMap || null,
    }),
  );

  const chassisBodyGroup = new THREE.Group();
  chassisBodyGroup.name = 'chassis_body_shell';
  group.add(chassisBodyGroup);

  const hoodTipZ = halfL - 0.03;
  const windshieldBaseZ = L * 0.16;
  const tailBaseZ = -halfL + 0.04;
  const rearBeltZ = -halfL + 0.15;
  const roofFrontZ = windshieldBaseZ - L * (spec.bodyType === 'mpv_3row' ? 0.165 : 0.185);
  const roofRearZ = -halfL + L * (0.075 + (1 - spec.rearSlope) * 0.23);

  // 1. CARROCERÍA INFERIOR LOFTED 3D CON CURVATURA COMPUESTA
  // (ahusamiento en planta de trompa y cola + guardabarros musculosos + cintura entallada + capó abombado)
  const buildLoftedTube = (
    stations: number,
    ringPts: number,
    sampleRing: (u: number, vAngle: number) => [number, number, number],
  ): THREE.BufferGeometry => {
    const positions: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= stations; i++) {
      const u = i / stations;
      for (let j = 0; j <= ringPts; j++) {
        const theta = (j / ringPts) * Math.PI * 2;
        const [px, py, pz] = sampleRing(u, theta);
        positions.push(px, py, pz);
      }
    }
    const stride = ringPts + 1;
    for (let i = 0; i < stations; i++) {
      for (let j = 0; j < ringPts; j++) {
        const a = i * stride + j;
        const b = (i + 1) * stride + j;
        const c = (i + 1) * stride + (j + 1);
        const d = i * stride + (j + 1);
        indices.push(a, c, b, a, d, c);
      }
    }
    // Tapas cerradas trasera (u=0) y delantera (u=1)
    const rearCenterIdx = positions.length / 3;
    const [, rCy, rCz] = sampleRing(0, Math.PI * 0.5);
    const [, rBy] = sampleRing(0, Math.PI * 1.5);
    positions.push(0, (rCy + rBy) * 0.5, rCz);
    for (let j = 0; j < ringPts; j++) {
      indices.push(rearCenterIdx, j + 1, j);
    }

    const frontCenterIdx = positions.length / 3;
    const [, fCy, fCz] = sampleRing(1, Math.PI * 0.5);
    const [, fBy] = sampleRing(1, Math.PI * 1.5);
    positions.push(0, (fCy + fBy) * 0.5, fCz);
    const fBase = stations * stride;
    for (let j = 0; j < ringPts; j++) {
      indices.push(frontCenterIdx, fBase + j, fBase + j + 1);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  };

  const lowerBodyGeo = trackGeo(
    buildLoftedTube(28, 24, (u, theta) => {
      // u = 0 cola trasera -> u = 1 trompa delantera
      // Curva longitudinal suave con redondeo en paragolpes delantero y trasero
      const zLinear = THREE.MathUtils.lerp(tailBaseZ, hoodTipZ, u);
      const endCurve =
        u < 0.06
          ? -Math.cos((u / 0.06) * Math.PI * 0.5) * 0.045
          : u > 0.93
            ? Math.cos(((1 - u) / 0.07) * Math.PI * 0.5) * 0.055
            : 0;
      const z = zLinear + endCurve * (Math.abs(Math.cos(theta)) * 0.55);

      // Ahusamiento en planta (boat-tail trasero + nariz aerodinámica + ensanche en guardabarros)
      let planW = halfW * 0.955;
      if (u < 0.16) {
        const t = u / 0.16;
        planW *= 0.78 + 0.22 * Math.sin(t * Math.PI * 0.5);
      } else if (u > 0.80) {
        const t = (1 - u) / 0.20;
        planW *= 0.74 + 0.26 * Math.sin(t * Math.PI * 0.5);
      }
      const distFrontAxle = Math.abs(zLinear - frontAxleZ);
      const distRearAxle = Math.abs(zLinear - rearAxleZ);
      const flare =
        Math.exp(-Math.pow(distFrontAxle / (spec.wheelRadiusM * 1.35), 2)) * 0.032 +
        Math.exp(-Math.pow(distRearAxle / (spec.wheelRadiusM * 1.38), 2)) * 0.034;
      planW += flare;

      // Perfil superior moderno SUV/Crossover (capó alto y orgulloso con frente vertical limpio)
      const hoodStartU = (windshieldBaseZ - tailBaseZ) / (hoodTipZ - tailBaseZ);
      let topY = beltY;
      if (u >= hoodStartU) {
        const hu = (u - hoodStartU) / Math.max(0.01, 1 - hoodStartU);
        topY = THREE.MathUtils.lerp(hoodY + 0.018, hoodY - 0.042, Math.pow(hu, 1.15));
        if (hu > 0.91) {
          topY -= ((hu - 0.91) / 0.09) * 0.042;
        }
      } else {
        const bu = 1 - u / Math.max(0.01, hoodStartU);
        topY = THREE.MathUtils.lerp(beltY - 0.008, beltY + 0.042, Math.min(1, bu * 1.1));
        if (u < 0.05) {
          topY -= ((0.05 - u) / 0.05) * 0.055;
        }
      }

      const botY =
        clearY +
        0.032 +
        (u < 0.08 ? ((0.08 - u) / 0.08) * 0.062 : 0) +
        (u > 0.90 ? ((u - 0.90) / 0.10) * 0.048 : 0);

      // Sección transversal superelíptica automotriz con nervadura de hombro definida
      const c = Math.cos(theta);
      const s = Math.sin(theta);
      const signC = Math.sign(c) || 1;
      const signS = Math.sign(s) || 1;
      const superX = signC * Math.pow(Math.abs(c), 0.46);
      const superY = signS * Math.pow(Math.abs(s), 0.50);

      const y01 = (superY + 1) * 0.5;
      const shoulderCrease = Math.exp(-Math.pow((y01 - 0.76) / 0.09, 2)) * 0.022;
      const sectionProfile =
        y01 < 0.20
          ? THREE.MathUtils.lerp(0.85, 0.99, y01 / 0.20)
          : y01 > 0.86
            ? THREE.MathUtils.lerp(1.01, 0.91, (y01 - 0.86) / 0.14)
            : 0.99 + shoulderCrease;

      const x = superX * planW * sectionProfile;
      const crown = s > 0 ? (1 - Math.min(1, Math.abs(superX))) * 0.028 * s : 0;
      const y = THREE.MathUtils.lerp(botY, topY, y01) + crown;
      return [x, y, z];
    }),
  );
  const lowerBodyMesh = new THREE.Mesh(lowerBodyGeo, bodyPaintMat);
  lowerBodyMesh.castShadow = true;
  lowerBodyMesh.receiveShadow = true;
  chassisBodyGroup.add(lowerBodyMesh);

  // 2. ZÓCALOS LATERALES CONTORNEADOS, PASARRUEDAS CON GUARDAPOLVO INTERNO OSCURO Y DIFUSORES
  const wheelWellMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#06080d',
      roughness: 0.94,
      metalness: 0.04,
    }),
  );
  const wheelWellGeo = trackGeo(
    new THREE.CylinderGeometry(spec.wheelRadiusM * 1.04, spec.wheelRadiusM * 1.04, W * 0.86, 20, 1, false, 0, Math.PI),
  );
  wheelWellGeo.rotateZ(Math.PI / 2);
  for (const axZ of [frontAxleZ, rearAxleZ]) {
    const well = new THREE.Mesh(wheelWellGeo, wheelWellMat);
    well.position.set(0, spec.wheelRadiusM * 0.99, axZ);
    chassisBodyGroup.add(well);
  }

  const wheelSpanLen = frontAxleZ - rearAxleZ - spec.wheelRadiusM * 1.95;
  if (wheelSpanLen > 0.3) {
    for (const sx of [-1, 1]) {
      const rockerCladding = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.045, 0.095, wheelSpanLen)),
        claddingMat,
      );
      rockerCladding.position.set(sx * (halfW * 0.89), clearY + 0.085, (frontAxleZ + rearAxleZ) * 0.5);
      chassisBodyGroup.add(rockerCladding);

      const sideStripe = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.032, 0.038, wheelSpanLen * 0.88)),
        secondaryAccentMat,
      );
      sideStripe.position.set(sx * (halfW * 0.905), clearY + 0.135, (frontAxleZ + rearAxleZ) * 0.5);
      chassisBodyGroup.add(sideStripe);

      // Moldura inferior de ventanillas (beltline sill trim)
      const beltTrim = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.026, 0.022, (windshieldBaseZ - rearBeltZ) * 0.92)),
        spec.doorHandleChrome ? chromeMat : pillarBlackMat,
      );
      beltTrim.position.set(sx * (halfW * 0.825), beltY + 0.012, (windshieldBaseZ + rearBeltZ) * 0.5);
      chassisBodyGroup.add(beltTrim);
    }
  }

  if (spec.modelId === 'chery-t4-pro-luxury-hev') {
    const frontAccent = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(W * 0.50, 0.028, 0.05)),
      secondaryAccentMat,
    );
    frontAccent.position.set(0, clearY + 0.115, hoodTipZ - 0.045);
    chassisBodyGroup.add(frontAccent);
  }

  // Protectores inferiores satinados integrados al paragolpes ahusado
  const frontSkid = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(W * 0.46, 0.065, 0.08)),
    skidMat,
  );
  frontSkid.position.set(0, clearY + 0.082, hoodTipZ - 0.05);
  chassisBodyGroup.add(frontSkid);

  const rearDiffuser = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(W * 0.54, 0.105, 0.085)),
    claddingMat,
  );
  rearDiffuser.position.set(0, clearY + 0.11, tailBaseZ + 0.035);
  chassisBodyGroup.add(rearDiffuser);

  const rearSkid = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(W * 0.42, 0.058, 0.072)),
    skidMat,
  );
  rearSkid.position.set(0, clearY + 0.085, tailBaseZ + 0.022);
  chassisBodyGroup.add(rearSkid);

  for (const sx of [-1, 1]) {
    const tip = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.036, 0.04, 0.09, 12)),
      exhaustMat,
    );
    tip.rotation.x = Math.PI / 2;
    tip.position.set(sx * halfW * 0.42, clearY + 0.085, tailBaseZ + 0.01);
    chassisBodyGroup.add(tip);
  }

  // Arcos guardabarros oscuros empotrados al filo de la carrocería
  const archR = spec.wheelRadiusM * 1.11;
  const archGeo = trackGeo(new THREE.TorusGeometry(archR, 0.038, 8, 20, Math.PI));
  archGeo.rotateY(Math.PI / 2);
  for (const axZ of [frontAxleZ, rearAxleZ]) {
    for (const sx of [-1, 1]) {
      const arch = new THREE.Mesh(archGeo, claddingMat);
      arch.position.set(sx * (halfW * 0.935), spec.wheelRadiusM * 1.01, axZ);
      chassisBodyGroup.add(arch);
    }
  }

  // 3. CABINA ACRISTALADA Y TECHO ABOVEDADO 3D (tumblehome + caída coupé Fronx / 3 filas Carens + D-pillars curvos)
  const cabinStartZ = rearBeltZ + 0.02;
  const cabinEndZ = windshieldBaseZ + 0.02;
  const cabinBaseHalfW = halfW * 0.81;
  const cabinRoofHalfW = halfW * 0.65;

  const cabinGeo = trackGeo(
    buildLoftedTube(20, 22, (u, theta) => {
      const z = THREE.MathUtils.lerp(cabinStartZ, cabinEndZ, u);
      const rearSpan = Math.max(0.08, (roofRearZ - cabinStartZ) / (cabinEndZ - cabinStartZ));
      const frontSpan = Math.max(0.08, (cabinEndZ - roofFrontZ) / (cabinEndZ - cabinStartZ));

      let localTopY = roofY;
      if (u < rearSpan) {
        const t = u / rearSpan;
        localTopY = THREE.MathUtils.lerp(beltY + 0.03, roofY - 0.015, Math.pow(t, 0.78));
      } else if (u > 1 - frontSpan) {
        const t = (1 - u) / frontSpan;
        localTopY = THREE.MathUtils.lerp(hoodY + 0.02, roofY, Math.pow(t, 0.82));
      } else {
        const midT = (u - rearSpan) / Math.max(0.01, 1 - rearSpan - frontSpan);
        localTopY = roofY + Math.sin(midT * Math.PI) * 0.018;
      }

      // Ahusamiento en planta de la cabina (más angosta hacia luneta trasera y parabrisas)
      const planScale =
        u < 0.22
          ? THREE.MathUtils.lerp(0.80, 1.0, Math.sin((u / 0.22) * Math.PI * 0.5))
          : u > 0.78
            ? THREE.MathUtils.lerp(0.86, 1.0, Math.sin(((1 - u) / 0.22) * Math.PI * 0.5))
            : 1.0;

      const c = Math.cos(theta);
      const s = Math.sin(theta);
      const signC = Math.sign(c) || 1;
      const signS = Math.sign(s) || 1;
      const sx = signC * Math.pow(Math.abs(c), 0.68);
      const sy = signS * Math.pow(Math.abs(s), 0.65);
      const y01 = (sy + 1) * 0.5;

      const halfSpanW = THREE.MathUtils.lerp(cabinBaseHalfW, cabinRoofHalfW, Math.pow(y01, 0.88)) * planScale;
      const x = sx * halfSpanW;
      const roofCrown = s > 0 ? (1 - Math.abs(sx)) * 0.032 * y01 : 0;
      const y = THREE.MathUtils.lerp(beltY - 0.03, localTopY, y01) + roofCrown;
      return [x, y, z];
    }),
  );
  const cabinMesh = new THREE.Mesh(cabinGeo, glassMat);
  cabinMesh.castShadow = true;
  chassisBodyGroup.add(cabinMesh);

  // Casquete superior de techo abovedado 3D (negro brillante flotante en Nissan Kicks 2027, color carrocería en demás)
  const roofCapGeo = trackGeo(
    buildLoftedTube(14, 18, (u, theta) => {
      const z = THREE.MathUtils.lerp(roofRearZ - 0.02, roofFrontZ + 0.02, u);
      const endPinch =
        u < 0.14
          ? THREE.MathUtils.lerp(0.88, 1.0, u / 0.14)
          : u > 0.86
            ? THREE.MathUtils.lerp(0.90, 1.0, (1 - u) / 0.14)
            : 1.0;
      const c = Math.cos(theta);
      const s = Math.sin(theta);
      const sx = (Math.sign(c) || 1) * Math.pow(Math.abs(c), 0.72);
      const wCap = cabinRoofHalfW * 0.96 * endPinch;
      const x = sx * wCap;
      const arch = (1 - sx * sx) * 0.034 + Math.sin(u * Math.PI) * 0.018;
      const thickness = s >= 0 ? 0.022 * s : 0.014 * s;
      return [x, roofY + 0.008 + arch + thickness, z];
    }),
  );
  const roofShell = new THREE.Mesh(roofCapGeo, roofPaintMat);
  roofShell.castShadow = true;
  chassisBodyGroup.add(roofShell);

  const roofLen = Math.max(0.85, roofFrontZ - roofRearZ);
  const roofCenterZ = (roofFrontZ + roofRearZ) * 0.5;

  if (spec.hasPanoramicRoof) {
    const sunroof = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(cabinRoofHalfW * 1.18, 0.018, roofLen * 0.52)),
      glassMat,
    );
    sunroof.position.set(0, roofY + 0.052, roofCenterZ + 0.05);
    chassisBodyGroup.add(sunroof);
  }

  // Pilares A, B y C alineados vectorialmente (sin error de signo de cabeceo) al contorno de la cabina
  const aPillarMat = spec.pillarBlackout === 'all_floating' || spec.pillarBlackout === 'a_b' ? pillarBlackMat : roofPaintMat;
  const cPillarMat = spec.pillarBlackout === 'all_floating' ? pillarBlackMat : roofPaintMat;
  const upAxis = new THREE.Vector3(0, 1, 0);
  const placeStrut = (
    p0: THREE.Vector3,
    p1: THREE.Vector3,
    thickX: number,
    thickZ: number,
    mat: THREE.Material,
  ) => {
    const delta = p1.clone().sub(p0);
    const len = delta.length();
    const mesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(thickX, len, thickZ)), mat);
    mesh.position.copy(p0).addScaledVector(delta, 0.5);
    mesh.quaternion.setFromUnitVectors(upAxis, delta.normalize());
    chassisBodyGroup.add(mesh);
  };

  for (const sx of [-1, 1]) {
    placeStrut(
      new THREE.Vector3(sx * cabinBaseHalfW * 0.87, hoodY + 0.01, windshieldBaseZ - 0.02),
      new THREE.Vector3(sx * cabinRoofHalfW * 0.90, roofY + 0.01, roofFrontZ + 0.01),
      0.046,
      0.056,
      aPillarMat,
    );

    placeStrut(
      new THREE.Vector3(sx * cabinBaseHalfW * 0.98, beltY, roofCenterZ + 0.06),
      new THREE.Vector3(sx * cabinRoofHalfW * 0.96, roofY + 0.008, roofCenterZ + 0.05),
      0.034,
      0.092,
      pillarBlackMat,
    );

    placeStrut(
      new THREE.Vector3(sx * cabinBaseHalfW * 0.83, beltY + 0.02, cabinStartZ + 0.04),
      new THREE.Vector3(sx * cabinRoofHalfW * 0.89, roofY + 0.005, roofRearZ - 0.01),
      0.054,
      0.125,
      cPillarMat,
    );

    // Rieles de techo de perfil bajo aerodinámico
    const rail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.026, 0.026, roofLen * 0.82)), skidMat);
    rail.position.set(sx * (cabinRoofHalfW * 0.82), roofY + 0.038, roofCenterZ);
    chassisBodyGroup.add(rail);

    const handleMat = spec.doorHandleChrome ? chromeMat : bodyPaintMat;
    for (const hz of [0.14, -0.54]) {
      const handle = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.028, 0.028, 0.15)), handleMat);
      handle.position.set(sx * (halfW * 0.93), beltY - 0.12, hz);
      chassisBodyGroup.add(handle);
    }

    const mirrorHousing = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.075, 12, 10)), mirrorMat);
    mirrorHousing.scale.set(1.25, 0.78, 0.95);
    mirrorHousing.position.set(sx * (halfW * 0.96 + 0.045), beltY + 0.035, windshieldBaseZ - 0.17);
    chassisBodyGroup.add(mirrorHousing);

    const mirrorStalk = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.032, 0.048)), claddingMat);
    mirrorStalk.position.set(sx * (halfW * 0.88), beltY + 0.01, windshieldBaseZ - 0.18);
    chassisBodyGroup.add(mirrorStalk);
  }

  // Alerón trasero integrado al casquete del techo + antena aleta de tiburón
  const spoiler = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(cabinRoofHalfW * 1.62, 0.038, 0.19)),
    roofPaintMat,
  );
  spoiler.position.set(0, roofY + 0.018, roofRearZ - 0.06);
  spoiler.rotation.x = -0.10;
  chassisBodyGroup.add(spoiler);

  const sharkFin = new THREE.Mesh(
    trackGeo(new THREE.ConeGeometry(0.026, 0.11, 4)),
    roofPaintMat,
  );
  sharkFin.scale.set(0.65, 1, 2.0);
  sharkFin.position.set(0, roofY + 0.068, roofRearZ + 0.18);
  chassisBodyGroup.add(sharkFin);

  const wiperGeo = trackGeo(new THREE.BoxGeometry(0.48, 0.016, 0.022));
  const wiperL = new THREE.Mesh(wiperGeo, claddingMat);
  wiperL.position.set(-0.22, hoodY + 0.022, windshieldBaseZ - 0.01);
  wiperL.rotation.z = 0.05;
  const wiperR = new THREE.Mesh(wiperGeo, claddingMat);
  wiperR.position.set(0.24, hoodY + 0.022, windshieldBaseZ - 0.01);
  wiperR.rotation.z = 0.05;
  chassisBodyGroup.add(wiperL, wiperR);

  // 4. PARRILLA FRONTAL OEM CON EMBLEMA + PATENTE + FIRMA DE FAROS LED DRL AL RAS DEL FRENTE AHUSADO
  const frontTex = trackTex(createFrontFasciaTexture(spec));
  const frontFasciaMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: frontTex,
      roughness: 0.34,
      metalness: 0.42,
      envMap: envMap || null,
    }),
  );
  const fasciaW = W * 0.46;
  const fasciaH = (hoodY - clearY) * 0.54;
  const fasciaMesh = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(fasciaW, fasciaH, 0.042)),
    frontFasciaMat,
  );
  fasciaMesh.position.set(0, clearY + (hoodY - clearY) * 0.46, hoodTipZ - 0.032);
  chassisBodyGroup.add(fasciaMesh);

  const headlampY = hoodY - 0.095;
  const fogPodY = clearY + 0.22;
  const lampX = W * 0.285;
  const drlZ = hoodTipZ - 0.068;

  for (const sx of [-1, 1]) {
    const cornerYaw = sx * -0.28;
    const lampHousing = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.26, 0.082, 0.046)),
      claddingMat,
    );
    lampHousing.position.set(sx * lampX, headlampY, drlZ - 0.012);
    lampHousing.rotation.y = cornerYaw;
    chassisBodyGroup.add(lampHousing);

    if (spec.drlStyle === 'chery_t2_slit_pod') {
      const slit = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.25, 0.030, 0.038)), drlMat);
      slit.position.set(sx * lampX, headlampY + 0.016, drlZ);
      slit.rotation.y = cornerYaw;
      chassisBodyGroup.add(slit);

      const lowerHousing = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.19, 0.17, 0.042)), claddingMat);
      lowerHousing.position.set(sx * (lampX + 0.008), fogPodY, drlZ - 0.018);
      lowerHousing.rotation.y = cornerYaw;
      chassisBodyGroup.add(lowerHousing);

      const podLed = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.11, 0.088, 0.038)), drlMat);
      podLed.position.set(sx * (lampX + 0.008), fogPodY + 0.022, drlZ - 0.004);
      podLed.rotation.y = cornerYaw;
      chassisBodyGroup.add(podLed);
    } else if (spec.drlStyle === 'chery_t4_twinbar') {
      const mainBeam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.064, 0.038)), drlMat);
      mainBeam.position.set(sx * lampX, headlampY, drlZ);
      mainBeam.rotation.y = cornerYaw;
      chassisBodyGroup.add(mainBeam);

      const fogHousing = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.19, 0.17, 0.042)), claddingMat);
      fogHousing.position.set(sx * (lampX + 0.01), fogPodY, drlZ - 0.016);
      fogHousing.rotation.y = cornerYaw;
      chassisBodyGroup.add(fogHousing);

      for (const fyOff of [0.038, -0.038]) {
        const bar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 0.026, 0.035)), drlMat);
        bar.position.set(sx * (lampX + 0.01), fogPodY + fyOff, drlZ - 0.002);
        bar.rotation.y = cornerYaw;
        chassisBodyGroup.add(bar);
      }
    } else if (spec.drlStyle === 'nissan_triple_bar') {
      for (let b = 0; b < 3; b++) {
        const barW = b === 0 ? 0.25 : b === 1 ? 0.21 : 0.16;
        const bar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(barW, 0.024, 0.038)), drlMat);
        bar.position.set(sx * lampX, headlampY + 0.024 - b * 0.040, drlZ);
        bar.rotation.y = cornerYaw;
        chassisBodyGroup.add(bar);
      }
    } else if (spec.drlStyle === 'kia_starmap_y') {
      const upperBar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.25, 0.024, 0.035)), drlMat);
      upperBar.position.set(sx * lampX, headlampY + 0.036, drlZ);
      upperBar.rotation.y = cornerYaw;
      chassisBodyGroup.add(upperBar);

      const lowerFork = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.11, 0.022, 0.035)), drlMat);
      lowerFork.position.set(sx * (lampX + 0.04), headlampY + 0.006, drlZ - 0.008);
      lowerFork.rotation.set(0, cornerYaw, sx * -0.55);
      chassisBodyGroup.add(lowerFork);

      const quadCluster = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.19, 0.068, 0.038)), drlMat);
      quadCluster.position.set(sx * lampX, headlampY - 0.042, drlZ);
      quadCluster.rotation.y = cornerYaw;
      chassisBodyGroup.add(quadCluster);
    } else if (spec.drlStyle === 'suzuki_tricube') {
      for (let c = 0; c < 3; c++) {
        const cube = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.058, 0.032, 0.035)), drlMat);
        cube.position.set(sx * (lampX - 0.068 + c * 0.070), headlampY + 0.018, drlZ - c * 0.010);
        chassisBodyGroup.add(cube);
      }
      const lowerBezel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.19, 0.17, 0.042)), claddingMat);
      lowerBezel.position.set(sx * (lampX + 0.008), fogPodY, drlZ - 0.016);
      lowerBezel.rotation.y = cornerYaw;
      chassisBodyGroup.add(lowerBezel);
      const podGrid = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.12, 0.10, 0.038)), drlMat);
      podGrid.position.set(sx * (lampX + 0.008), fogPodY, drlZ - 0.002);
      podGrid.rotation.y = cornerYaw;
      chassisBodyGroup.add(podGrid);
    } else {
      const stdLed = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.25, 0.055, 0.038)), drlMat);
      stdLed.position.set(sx * lampX, headlampY, drlZ);
      stdLed.rotation.y = cornerYaw;
      chassisBodyGroup.add(stdLed);
    }
  }

  if (spec.grilleStyle === 'kia_tiger_chrome') {
    const noseBar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(W * 0.45, 0.024, 0.038)), chromeMat);
    noseBar.position.set(0, headlampY + 0.016, hoodTipZ - 0.026);
    chassisBodyGroup.add(noseBar);
  }

  // 5. ÓPTICAS TRASERAS LED ENVOLVENTES AL RAS DE LA ZAGA AHUSADA + PORTAPATENTE
  const tailZ = tailBaseZ + 0.012;
  const tailY = beltY - 0.06;
  for (const sx of [-1, 1]) {
    const tailCluster = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.28, 0.072, 0.048)),
      tailLampMat,
    );
    tailCluster.position.set(sx * W * 0.255, tailY, tailZ + 0.012);
    tailCluster.rotation.y = sx * 0.20;
    chassisBodyGroup.add(tailCluster);

    const wrapTail = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.036, 0.065, 0.16)),
      tailLampMat,
    );
    wrapTail.position.set(sx * (halfW * 0.76), tailY, tailZ + 0.085);
    wrapTail.rotation.y = sx * 0.12;
    chassisBodyGroup.add(wrapTail);
  }

  const centerTailStrip = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(W * 0.44, 0.024, 0.032)),
    tailLampMat,
  );
  centerTailStrip.position.set(0, tailY + 0.015, tailZ);
  chassisBodyGroup.add(centerTailStrip);

  const highBrake = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.32, 0.018, 0.026)),
    tailLampMat,
  );
  highBrake.position.set(0, roofY + 0.016, roofRearZ - 0.14);
  chassisBodyGroup.add(highBrake);

  const rearPlateTex = trackTex(createRearPlateTexture(spec));
  const rearPlateMat = trackMat(
    new THREE.MeshStandardMaterial({ map: rearPlateTex, roughness: 0.35, metalness: 0.15 }),
  );
  const rearPlate = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.42, 0.135)), rearPlateMat);
  rearPlate.position.set(0, tailY - 0.19, tailZ - 0.024);
  rearPlate.rotation.y = Math.PI;
  chassisBodyGroup.add(rearPlate);

  // 6. CUATRO RUEDAS DE ALEACIÓN BI-TONO INDEPENDIENTES CON PINZAS DE FRENO Y RIG DE SUSPENSIÓN
  const wheelShared = {
    tireMat: trackMat(
      new THREE.MeshStandardMaterial({
        color: '#14181f',
        roughness: 0.84,
        metalness: 0.08,
        envMap: envMap || null,
        envMapIntensity: 0.55,
      }),
    ),
    rimSilverMat: chromeMat,
    rimDarkMat: trackMat(
      new THREE.MeshStandardMaterial({
        color: '#111827',
        metalness: 0.72,
        roughness: 0.28,
        envMap: envMap || null,
      }),
    ),
    discMat: trackMat(
      new THREE.MeshStandardMaterial({
        color: '#94a3b8',
        metalness: 0.88,
        roughness: 0.32,
        envMap: envMap || null,
      }),
    ),
    caliperMat: trackMat(
      new THREE.MeshStandardMaterial({
        color: spec.modelId === 'chery-t4-pro-luxury-hev' ? '#dc2626' : '#334155',
        metalness: 0.35,
        roughness: 0.42,
      }),
    ),
    geos: disposableGeos,
  };

  const trackHalfW = halfW - spec.wheelWidthM * 0.48;
  const cornerDefs: Array<{
    id: 'FL' | 'FR' | 'RL' | 'RR';
    x: number;
    z: number;
    front: boolean;
    left: boolean;
  }> = [
    { id: 'FL', x: trackHalfW, z: frontAxleZ, front: true, left: true },
    { id: 'FR', x: -trackHalfW, z: frontAxleZ, front: true, left: false },
    { id: 'RL', x: trackHalfW, z: rearAxleZ, front: false, left: true },
    { id: 'RR', x: -trackHalfW, z: rearAxleZ, front: false, left: false },
  ];

  const riggedCorners: Array<{
    id: 'FL' | 'FR' | 'RL' | 'RR';
    x: number;
    z: number;
    front: boolean;
    initialY: number;
    steering: THREE.Group;
    rolling: THREE.Group;
  }> = [];

  for (const c of cornerDefs) {
    const built = createAlloyWheelMesh(
      spec.wheelRadiusM,
      spec.wheelWidthM,
      c.left,
      spec.alloyStyle,
      spec.alloySpokeCount,
      wheelShared,
    );
    built.steeringPivot.name = `WheelPivot_${c.id}`;
    built.steeringPivot.position.set(c.x, spec.wheelRadiusM, c.z);
    group.add(built.steeringPivot);
    riggedCorners.push({
      id: c.id,
      x: c.x,
      z: c.z,
      front: c.front,
      initialY: spec.wheelRadiusM,
      steering: built.steeringPivot,
      rolling: built.rollingPivot,
    });
  }

  const wheelRig: VehicleWheelRig = {
    wheelCount: riggedCorners.length,
    setDistanceMeters(distanceMeters: number) {
      const rad = distanceMeters / spec.wheelRadiusM;
      for (const w of riggedCorners) {
        w.rolling.rotation.x = rad;
      }
    },
    setSteeringRadians(angle: number, deltaSeconds: number) {
      const clamped = THREE.MathUtils.clamp(angle, -Math.PI / 6, Math.PI / 6);
      for (const w of riggedCorners) {
        w.steering.rotation.y = THREE.MathUtils.damp(
          w.steering.rotation.y,
          w.front ? clamped : 0,
          12,
          Math.max(0, deltaSeconds),
        );
      }
    },
    setSuspensionContact(road, heaveM, pitchRad, rollRad, dt) {
      for (const w of riggedCorners) {
        const bodyTiltAtWheel = -pitchRad * w.z + rollRad * w.x;
        const shift = THREE.MathUtils.clamp(
          road[w.id] - heaveM - bodyTiltAtWheel,
          -0.22,
          0.22,
        );
        w.steering.position.y = THREE.MathUtils.damp(
          w.steering.position.y,
          w.initialY + shift,
          22,
          Math.max(0, dt),
        );
      }
    },
  };

  const setBrakeLit = (braking: boolean) => {
    tailLampMat.emissiveIntensity = braking ? 3.2 : 1.35;
    tailLampMat.color.setHex(braking ? 0xff2b2b : 0xdc2626);
  };

  return {
    group,
    spec,
    wheelRig,
    setBrakeLit,
    dispose: () => {
      disposableGeos.forEach((g) => g.dispose());
      disposableMats.forEach((m) => m.dispose());
      disposableTexs.forEach((t) => t.dispose());
    },
  };
}
