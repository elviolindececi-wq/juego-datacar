import * as THREE from 'three';
import {
  ACTIVE_FUEL_SPONSOR,
  type FuelStationSponsorBrand,
} from '../config/featureFlags.ts';
import { FUEL_PRODUCTS_CATALOG } from './fuelStationSponsorConfig.ts';

export interface FuelStation3DController {
  group: THREE.Group;
  stationDistanceS: number;
  setHighlighted: (active: boolean, refueled?: boolean) => void;
  dispose: () => void;
}

export interface CreateFuelStation3DOptions {
  sponsor?: FuelStationSponsorBrand;
  stationDistanceS: number;
  envMap?: THREE.Texture | null;
}

function createSponsorSignTexture(
  title: string,
  subtitle: string,
  bgHex: string,
  primaryHex: string,
  accentHex: string,
): THREE.Texture {
  if (typeof document === 'undefined') {
    const data = new Uint8Array([10, 28, 44, 255]);
    const tex = new THREE.DataTexture(data, 1, 1);
    tex.needsUpdate = true;
    return tex;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, 1024, 192);

    // Franja superior e inferior luminosa del sponsor
    ctx.fillStyle = primaryHex;
    ctx.fillRect(0, 0, 1024, 16);
    ctx.fillStyle = accentHex;
    ctx.fillRect(0, 174, 1024, 18);

    // Emblema lateral
    ctx.fillStyle = accentHex;
    ctx.beginPath();
    ctx.roundRect(36, 36, 120, 120, 22);
    ctx.fill();

    ctx.fillStyle = '#041019';
    ctx.font = '900 italic 54px "Barlow Condensed", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⛽', 96, 96);

    // Nombre de la marca Sponsor
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 italic 68px "Barlow Condensed", system-ui, sans-serif';
    ctx.fillText(title.toUpperCase(), 182, 82);

    ctx.fillStyle = primaryHex;
    ctx.font = '700 28px "JetBrains Mono", monospace';
    ctx.fillText(subtitle.toUpperCase(), 184, 138);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createTotemTexture(sponsor: FuelStationSponsorBrand): THREE.Texture {
  if (typeof document === 'undefined') {
    const data = new Uint8Array([10, 28, 44, 255]);
    const tex = new THREE.DataTexture(data, 1, 1);
    tex.needsUpdate = true;
    return tex;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#05101c';
    ctx.fillRect(0, 0, 512, 1024);

    ctx.strokeStyle = sponsor.primaryColorHex;
    ctx.lineWidth = 14;
    ctx.strokeRect(10, 10, 492, 1004);

    // Cabecera Sponsor
    ctx.fillStyle = sponsor.canopyFasciaHex;
    ctx.fillRect(22, 22, 468, 210);
    ctx.fillStyle = sponsor.secondaryColorHex;
    ctx.font = '900 italic 52px "Barlow Condensed", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(sponsor.displayName.toUpperCase(), 256, 105);

    ctx.fillStyle = sponsor.primaryColorHex;
    ctx.font = '700 24px "JetBrains Mono", monospace';
    ctx.fillText('SURTIDORES 24 HS · PIT LANE', 256, 165);

    // Filas de combustibles LED
    const rows = [
      { label: 'SUPRA 97 RON', tag: 'GDI / HEV', color: '#f59e0b' },
      { label: 'ULTRA DIÉSEL S10', tag: 'CRDi PRO', color: '#10b981' },
      { label: 'ECO-FLEX E85/97', tag: 'FLEX 6DCT', color: '#00e5f5' },
      { label: 'SUPER 95 RON', tag: 'DUALJET', color: '#38bdf8' },
    ];

    rows.forEach((r, idx) => {
      const y = 270 + idx * 165;
      ctx.fillStyle = '#091a2a';
      ctx.fillRect(36, y, 440, 138);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 4;
      ctx.strokeRect(36, y, 440, 138);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.font = '800 34px "Barlow Condensed", system-ui, sans-serif';
      ctx.fillText(r.label, 58, y + 56);

      ctx.fillStyle = r.color;
      ctx.font = '700 26px "JetBrains Mono", monospace';
      ctx.fillText(`★ ${r.tag} · ACTIVO`, 58, y + 106);
    });

    ctx.fillStyle = sponsor.secondaryColorHex;
    ctx.textAlign = 'center';
    ctx.font = '800 24px "JetBrains Mono", monospace';
    ctx.fillText('CARRIL DERECHO → CARGA RÁPIDA', 256, 975);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createPitLaneAsphaltBannerTexture(sponsorName: string): THREE.Texture {
  if (typeof document === 'undefined') {
    const data = new Uint8Array([0, 229, 245, 255]);
    const tex = new THREE.DataTexture(data, 1, 1);
    tex.needsUpdate = true;
    return tex;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 512, 1024);
    ctx.fillStyle = 'rgba(4, 18, 30, 0.78)';
    ctx.fillRect(24, 20, 464, 984);

    ctx.strokeStyle = '#00E5F5';
    ctx.lineWidth = 10;
    ctx.setLineDash([36, 20]);
    ctx.strokeRect(32, 28, 448, 968);
    ctx.setLineDash([]);

    ctx.fillStyle = '#FFAA12';
    ctx.textAlign = 'center';
    ctx.font = '900 italic 44px "Barlow Condensed", system-ui, sans-serif';
    ctx.fillText('⛽ ZONA DE CARGA', 256, 160);
    ctx.fillStyle = '#00E5F5';
    ctx.font = '800 32px "JetBrains Mono", monospace';
    ctx.fillText(sponsorName.toUpperCase(), 256, 225);

    // Chevrons luminosos apuntando hacia adelante
    for (let i = 0; i < 4; i++) {
      const cy = 360 + i * 155;
      ctx.strokeStyle = i % 2 === 0 ? '#00E5F5' : '#FFAA12';
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.moveTo(140, cy + 50);
      ctx.lineTo(256, cy);
      ctx.lineTo(372, cy + 50);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Construye una Estación de Servicio 3D hiperrealista (marquesina iluminada, 4 islas de surtidores
 * digitales, tótem LED de precios, tienda Full 24hs y bahía de carga en el carril derecho)
 * lista para personalizar con cualquier marca Sponsor (`ACTIVE_FUEL_SPONSOR`).
 */
export function createFuelStationBuilding3D(
  options: CreateFuelStation3DOptions,
): FuelStation3DController {
  const sponsor = options.sponsor ?? ACTIVE_FUEL_SPONSOR;
  const group = new THREE.Group();
  group.name = 'DatacarFuelStation3D';

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    textures.push(t);
    return t;
  };

  // 1. CIRCUITO INTERNO DE ESTACIÓN DE SERVICIO (RAMPA DE ENTRADA, PLAYA DE SURTIDORES Y RAMPA DE SALIDA)
  const apronGeo = trackGeo(new THREE.BoxGeometry(24, 0.06, 132));
  const apronMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#182232',
      roughness: 0.55,
      metalness: 0.12,
    }),
  );
  const apronMesh = new THREE.Mesh(apronGeo, apronMat);
  apronMesh.position.set(0.5, 0.01, 0);
  apronMesh.receiveShadow = true;
  group.add(apronMesh);

  // Carriles internos demarcados bajo la marquesina (2 carriles de paso por surtidores + rampa de entrada/salida)
  const internalLaneTex = trackTex(createPitLaneAsphaltBannerTexture(`${sponsor.displayName} · SURTIDORES`));
  const pitLaneMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: internalLaneTex,
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
    }),
  );

  // Carril interno 1 (entre islas de surtidores bajo techo: local X = +1.2 -> road X = -20.5)
  const innerBayLaneGeo = trackGeo(new THREE.PlaneGeometry(4.2, 42));
  const innerBayLane = new THREE.Mesh(innerBayLaneGeo, pitLaneMat);
  innerBayLane.rotation.x = -Math.PI / 2;
  innerBayLane.position.set(1.2, 0.055, 0);
  group.add(innerBayLane);

  // Carril interno 2 (junto a primera fila de surtidores: local X = +7.6 -> road X = -14.1)
  const outerBayLane = new THREE.Mesh(innerBayLaneGeo, pitLaneMat);
  outerBayLane.rotation.x = -Math.PI / 2;
  outerBayLane.position.set(7.6, 0.055, 0);
  group.add(outerBayLane);

  // Rampa de Entrada asfaltada diagonal desde el carril derecho de la avenida hacia los surtidores (z = -44 .. -18)
  const rampGeo = trackGeo(new THREE.PlaneGeometry(4.6, 34));
  const entryRampDecal = new THREE.Mesh(rampGeo, pitLaneMat);
  entryRampDecal.rotation.x = -Math.PI / 2;
  entryRampDecal.rotation.z = -0.22;
  entryRampDecal.position.set(8.2, 0.052, -34);
  group.add(entryRampDecal);

  // Rampa de Salida asfaltada diagonal desde los surtidores de regreso a la avenida (z = +18 .. +44)
  const exitRampDecal = new THREE.Mesh(rampGeo, pitLaneMat);
  exitRampDecal.rotation.x = -Math.PI / 2;
  exitRampDecal.rotation.z = 0.22;
  exitRampDecal.position.set(8.2, 0.052, 34);
  group.add(exitRampDecal);

  // Carril de aviso en el borde derecho de la calzada principal
  const pitLaneGeo = trackGeo(new THREE.PlaneGeometry(4.2, 44));
  const pitLaneDecal = new THREE.Mesh(pitLaneGeo, pitLaneMat);
  pitLaneDecal.rotation.x = -Math.PI / 2;
  pitLaneDecal.position.set(11.2, 0.05, -24);
  group.add(pitLaneDecal);

  // 2. GRAN MARQUESINA (CANOPY) CON FASCIA LED DEL SPONSOR Y PLAFONES DE LUZ
  const canopyGroup = new THREE.Group();
  const canopyRoofGeo = trackGeo(new THREE.BoxGeometry(13.5, 0.95, 28));
  const canopyRoofMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: sponsor.canopyFasciaHex,
      roughness: 0.28,
      metalness: 0.45,
      envMap: options.envMap ?? null,
    }),
  );
  const canopyRoof = new THREE.Mesh(canopyRoofGeo, canopyRoofMat);
  canopyRoof.position.set(1.2, 6.2, 0);
  canopyRoof.castShadow = true;
  canopyGroup.add(canopyRoof);

  // Cielo raso blanco reflectivo bajo la marquesina
  const ceilingGeo = trackGeo(new THREE.PlaneGeometry(12.8, 27.2));
  const ceilingMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: '#f1f5f9',
    }),
  );
  const ceilingMesh = new THREE.Mesh(ceilingGeo, ceilingMat);
  ceilingMesh.rotation.x = Math.PI / 2;
  ceilingMesh.position.set(1.2, 5.71, 0);
  canopyGroup.add(ceilingMesh);

  // Carteles fascia laterales y frontales con marca del Sponsor
  const fasciaTex = trackTex(
    createSponsorSignTexture(
      sponsor.displayName,
      sponsor.stationTitle,
      sponsor.canopyFasciaHex,
      sponsor.primaryColorHex,
      sponsor.secondaryColorHex,
    ),
  );
  const fasciaMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: fasciaTex,
    }),
  );
  const fasciaLongGeo = trackGeo(new THREE.PlaneGeometry(28, 1.05));
  const fasciaRoadside = new THREE.Mesh(fasciaLongGeo, fasciaMat);
  fasciaRoadside.rotation.y = Math.PI / 2;
  fasciaRoadside.position.set(1.2 + 6.78, 6.2, 0);
  canopyGroup.add(fasciaRoadside);

  const fasciaShortGeo = trackGeo(new THREE.PlaneGeometry(13.5, 1.05));
  const fasciaFront = new THREE.Mesh(fasciaShortGeo, fasciaMat);
  fasciaFront.rotation.y = Math.PI;
  fasciaFront.position.set(1.2, 6.2, -14.03);
  canopyGroup.add(fasciaFront);

  const fasciaBack = new THREE.Mesh(fasciaShortGeo, fasciaMat);
  fasciaBack.position.set(1.2, 6.2, 14.03);
  canopyGroup.add(fasciaBack);

  // Tira de neón perimetral reactiva en la marquesina
  const neonStripMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: sponsor.primaryColorHex,
    }),
  );
  const neonStripGeo = trackGeo(new THREE.BoxGeometry(13.7, 0.14, 28.2));
  const neonStrip = new THREE.Mesh(neonStripGeo, neonStripMat);
  neonStrip.position.set(1.2, 5.72, 0);
  canopyGroup.add(neonStrip);

  // 6 Columnas estructurales de aluminio cepillado
  const pillarGeo = trackGeo(new THREE.CylinderGeometry(0.32, 0.36, 5.8, 16));
  const pillarMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#cbd5e1',
      roughness: 0.25,
      metalness: 0.78,
    }),
  );
  const pillarPositions: Array<[number, number]> = [
    [-2.2, -9.5],
    [4.6, -9.5],
    [-2.2, 0],
    [4.6, 0],
    [-2.2, 9.5],
    [4.6, 9.5],
  ];
  for (const [px, pz] of pillarPositions) {
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(px, 2.9, pz);
    pillar.castShadow = true;
    canopyGroup.add(pillar);
  }

  // 3. ISLAS DE SURTIDORES DIGITALES (4 DISPENSADORES CON PANTALLA LED Y MANGUERAS)
  const islandBaseGeo = trackGeo(new THREE.BoxGeometry(1.7, 0.22, 4.8));
  const islandBaseMat = trackMat(
    new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.5 }),
  );
  const pumpBodyGeo = trackGeo(new THREE.BoxGeometry(0.95, 2.25, 1.45));
  const pumpBodyMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#0f172a',
      roughness: 0.32,
      metalness: 0.5,
    }),
  );
  const pumpScreenGeo = trackGeo(new THREE.PlaneGeometry(0.65, 0.45));
  const bollardGeo = trackGeo(new THREE.CylinderGeometry(0.09, 0.09, 1.05, 12));
  const bollardMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: sponsor.secondaryColorHex,
      roughness: 0.4,
      metalness: 0.3,
    }),
  );

  const pumpSpots: Array<[number, number, string]> = [
    [4.6, -4.8, FUEL_PRODUCTS_CATALOG[0].badgeColorHex],
    [4.6, 4.8, FUEL_PRODUCTS_CATALOG[1].badgeColorHex],
    [-2.2, -4.8, FUEL_PRODUCTS_CATALOG[2].badgeColorHex],
    [-2.2, 4.8, FUEL_PRODUCTS_CATALOG[3].badgeColorHex],
  ];

  for (const [ix, iz, accentHex] of pumpSpots) {
    const island = new THREE.Mesh(islandBaseGeo, islandBaseMat);
    island.position.set(ix, 0.19, iz);
    canopyGroup.add(island);

    const pump = new THREE.Mesh(pumpBodyGeo, pumpBodyMat);
    pump.position.set(ix, 1.38, iz);
    pump.castShadow = true;
    canopyGroup.add(pump);

    const screenMat = trackMat(new THREE.MeshBasicMaterial({ color: accentHex }));
    const screenFront = new THREE.Mesh(pumpScreenGeo, screenMat);
    screenFront.rotation.y = Math.PI / 2;
    screenFront.position.set(ix + 0.49, 1.65, iz);
    canopyGroup.add(screenFront);

    // Bolardos protectores en los extremos de la isla
    for (const bz of [-2.0, 2.0]) {
      const bollard = new THREE.Mesh(bollardGeo, bollardMat);
      bollard.position.set(ix + 0.65, 0.6, iz + bz);
      canopyGroup.add(bollard);
    }
  }

  group.add(canopyGroup);

  // 4. TIENDA DE CONVENIENCIA 24 HS ("FULL MARKET & CAFÉ") DETRÁS DE LOS SURTIDORES
  const shopGroup = new THREE.Group();
  const shopBodyGeo = trackGeo(new THREE.BoxGeometry(7.2, 4.4, 22));
  const shopBodyMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#0b1524',
      roughness: 0.42,
      metalness: 0.35,
    }),
  );
  const shopBody = new THREE.Mesh(shopBodyGeo, shopBodyMat);
  shopBody.position.set(-6.8, 2.2, 0);
  shopBody.castShadow = true;
  shopGroup.add(shopBody);

  // Ventanal iluminado cálido de la tienda 24 hs
  const shopGlassGeo = trackGeo(new THREE.PlaneGeometry(18.5, 2.9));
  const shopGlassMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: '#fde68a',
    }),
  );
  const shopGlass = new THREE.Mesh(shopGlassGeo, shopGlassMat);
  shopGlass.rotation.y = Math.PI / 2;
  shopGlass.position.set(-3.18, 1.85, 0);
  shopGroup.add(shopGlass);

  group.add(shopGroup);

  // 5. TÓTEM MONUMENTAL DE PRECIOS Y MARCA SPONSOR AL BORDE DE LA AVENIDA (11 METROS DE ALTURA)
  const totemTex = trackTex(createTotemTexture(sponsor));
  const totemMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: totemTex,
    }),
  );
  const totemBodyGeo = trackGeo(new THREE.BoxGeometry(0.65, 10.6, 3.1));
  const totemFrameMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#091524',
      roughness: 0.3,
      metalness: 0.7,
    }),
  );
  const totemMesh = new THREE.Mesh(totemBodyGeo, totemFrameMat);
  totemMesh.position.set(10.6, 5.3, -44.0);
  totemMesh.castShadow = true;
  group.add(totemMesh);

  const totemFaceGeo = trackGeo(new THREE.PlaneGeometry(2.95, 10.2));
  const totemFaceFront = new THREE.Mesh(totemFaceGeo, totemMat);
  totemFaceFront.rotation.y = Math.PI;
  totemFaceFront.position.set(10.6, 5.3, -44.35);
  group.add(totemFaceFront);

  const totemFaceRear = new THREE.Mesh(totemFaceGeo, totemMat);
  totemFaceRear.position.set(10.6, 5.3, -43.65);
  group.add(totemFaceRear);

  return {
    group,
    stationDistanceS: options.stationDistanceS,
    setHighlighted: (active: boolean, refueled = false) => {
      if (refueled) {
        neonStripMat.color.set('#10b981');
      } else if (active) {
        neonStripMat.color.set(sponsor.secondaryColorHex);
      } else {
        neonStripMat.color.set(sponsor.primaryColorHex);
      }
    },
    dispose: () => {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
    },
  };
}
