import * as THREE from 'three';
import type { CurvedRoadPath } from './curvedRoadPath.ts';
import {
  CROSSWALK_OFFSET_Z,
  DOUBLE_YELLOW_X,
  PEDESTRIANS_PER_CROSSWALK,
  TRAFFIC_3D_CATALOG_SPECS,
  evaluateCrosswalkPedestrians,
  getTrafficLightState,
  type CrosswalkPedestrianState,
  type OncomingTrafficCar,
  type SpeedLimitZone,
  type TrafficLightNode,
} from './urbanTrafficRules.ts';
import {
  createCalibratedVehicle3DInstance,
  resolveDedicatedVehicleGLTF,
} from './vehicle3DModelLoader.ts';
import { createVehicleWheelRig, type VehicleWheelRig } from './vehicleWheelRig.ts';
import { createContactShadowTexture } from './race3dTextures.ts';
import { createFaithfulVehicle3D } from './faithfulVehicleChassis3D.ts';
import { PRESET_VEHICLES } from '../data/presetVehicles.ts';

/**
 * Visualización 3D de tránsito urbano para DATACAR ARENA:
 * - Avenida ancha de doble mano con doble línea amarilla central (X = 0.0)
 * - Pórticos completos de semáforos 3D sobre ambos sentidos y líneas blancas PARE
 * - Carteles viales reglamentarios de Velocidad MÁXIMA (aro rojo) y MÍNIMA (disco azul)
 * - Arcos intermedios de VUELTA (cuando laps > 1)
 * - Vehículos 3D GLB reales en tránsito de mano contraria con ruedas giratorias, faros y freno
 * - Sistema de salpicadura 3D (Water Splash) sin asignaciones por frame (0 GC)
 */

export interface UrbanTrafficVisualsController {
  group: THREE.Group;
  splashGroup: THREE.Group;
  update: (
    timeSec: number,
    dt: number,
    oncomingCars: readonly OncomingTrafficCar[],
    focusZ?: number,
    isDroneView?: boolean,
  ) => void;
  triggerSplash: (worldX: number, worldZ: number, intensity: number) => void;
  dispose: () => void;
}

interface SplashDrop {
  active: boolean;
  age: number;
  life: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  scale: number;
}

function createSpeedSignTexture(
  valueKmh: number,
  kind: 'max' | 'min',
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 256, 256);
    ctx.fillStyle = '#0b1320';
    ctx.beginPath();
    ctx.roundRect(10, 10, 236, 236, 28);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 5;
    ctx.stroke();

    if (kind === 'max') {
      ctx.beginPath();
      ctx.arc(128, 120, 88, 0, Math.PI * 2);
      ctx.fillStyle = '#f8fafc';
      ctx.fill();
      ctx.lineWidth = 22;
      ctx.strokeStyle = '#ef4444';
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = '900 84px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(valueKmh), 128, 118);

      ctx.fillStyle = '#fca5a5';
      ctx.font = 'bold 24px Arial, sans-serif';
      ctx.fillText('MÁX km/h', 128, 228);
    } else {
      ctx.beginPath();
      ctx.arc(128, 120, 88, 0, Math.PI * 2);
      ctx.fillStyle = '#0284c7';
      ctx.fill();
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#f8fafc';
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 80px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(valueKmh), 128, 118);

      ctx.fillStyle = '#7dd3fc';
      ctx.font = 'bold 24px Arial, sans-serif';
      ctx.fillText('MÍN km/h', 128, 228);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 2;
  return tex;
}

function createLapBannerTexture(lapNumber: number, totalLaps: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#061322';
    ctx.fillRect(0, 0, 1024, 192);
    ctx.fillStyle = '#00e5ff';
    ctx.fillRect(0, 0, 1024, 14);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(0, 178, 1024, 14);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'italic 900 72px Arial, sans-serif';
    ctx.fillText(`VUELTA ${lapNumber} / ${totalLaps} · DATACAR ARENA`, 512, 98);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createUrbanTrafficVisuals3D(args: {
  roadPath: CurvedRoadPath;
  roadWidth: number;
  trackDistanceMeters: number;
  laps: number;
  lights: readonly TrafficLightNode[];
  speedZones: readonly SpeedLimitZone[];
  oncomingCount: number;
  envMap?: THREE.Texture | null;
}): UrbanTrafficVisualsController {
  const {
    roadPath,
    roadWidth,
    trackDistanceMeters,
    laps,
    lights,
    speedZones,
    oncomingCount,
    envMap,
  } = args;
  const halfRoad = roadWidth * 0.5;
  const group = new THREE.Group();
  group.name = 'urban_traffic_rules_3d';
  const splashGroup = new THREE.Group();
  splashGroup.name = 'wet_pothole_splashes_3d';

  let disposed = false;
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

  // 1. DOBLE LÍNEA AMARILLA CENTRAL (separa simétricamente ambas manos de la avenida)
  const segLen = 5.5;
  const segCount = Math.max(1, Math.floor((trackDistanceMeters + 80) / segLen));
  const yellowLineGeo = trackGeo(new THREE.PlaneGeometry(0.13, segLen * 0.96));
  const yellowLineMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: '#facc15',
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
  );
  const doubleYellowInst = new THREE.InstancedMesh(yellowLineGeo, yellowLineMat, segCount * 2);
  doubleYellowInst.frustumCulled = false;
  const dummy = new THREE.Object3D();
  let yellowIdx = 0;
  for (let i = 0; i < segCount; i++) {
    const s = -10 + i * segLen + segLen * 0.5;
    for (const offset of [-0.15, 0.15]) {
      const wp = roadPath.world(s, DOUBLE_YELLOW_X + offset);
      dummy.position.set(wp.x, 0.032, wp.z);
      dummy.rotation.set(-Math.PI / 2, 0, -wp.yaw);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      doubleYellowInst.setMatrixAt(yellowIdx++, dummy.matrix);
    }
  }
  doubleYellowInst.count = yellowIdx;
  doubleYellowInst.instanceMatrix.needsUpdate = true;
  group.add(doubleYellowInst);

  // 2. PÓRTICOS COMPLETOS DE SEMÁFOROS 3D + LÍNEAS DE DETENCIÓN EN AMBAS MANOS
  const poleMat = trackMat(
    new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.42, metalness: 0.74 }),
  );
  const housingMat = trackMat(
    new THREE.MeshStandardMaterial({ color: '#090d16', roughness: 0.52, metalness: 0.35 }),
  );
  const stopLineMat = trackMat(
    new THREE.MeshBasicMaterial({ color: '#f8fafc', side: THREE.DoubleSide }),
  );
  const carriageWidth = Math.max(6.2, halfRoad - 0.75);
  const stopLineGeo = trackGeo(new THREE.PlaneGeometry(carriageWidth, 0.54));
  const postGeo = trackGeo(new THREE.CylinderGeometry(0.13, 0.17, 5.9, 10));
  const portalSpan = roadWidth + 2.2;
  const portalBeamGeo = trackGeo(new THREE.BoxGeometry(portalSpan, 0.22, 0.22));
  const boxGeo = trackGeo(new THREE.BoxGeometry(0.58, 1.58, 0.44));
  const bulbGeo = trackGeo(new THREE.SphereGeometry(0.175, 14, 14));

  const lightMeshes: {
    node: TrafficLightNode;
    redMat: THREE.MeshBasicMaterial;
    yellowMat: THREE.MeshBasicMaterial;
    greenMat: THREE.MeshBasicMaterial;
    pedWalkMat: THREE.MeshBasicMaterial;
    pedStopMat: THREE.MeshBasicMaterial;
  }[] = [];

  // Cabezales repartidos sobre los carriles derechos de avance (-X) y los izquierdos de frente (+X)
  const headPositionsX = [-halfRoad * 0.72, -halfRoad * 0.32, halfRoad * 0.34, halfRoad * 0.72];
  const zebraBarCount = Math.max(7, Math.floor((roadWidth - 1.6) / 1.85));
  const zebraBarGeo = trackGeo(new THREE.PlaneGeometry(0.92, 2.85));
  const zebraBarMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: '#f8fafc',
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -3,
    }),
  );
  const pedBoxGeo = trackGeo(new THREE.BoxGeometry(0.36, 0.72, 0.28));
  const pedBulbGeo = trackGeo(new THREE.SphereGeometry(0.11, 10, 10));

  for (const node of lights) {
    const centerWorld = roadPath.world(node.z, 0);
    const gantry = new THREE.Group();
    gantry.position.set(centerWorld.x, 0, centerWorld.z);
    gantry.rotation.y = centerWorld.yaw;

    const postRight = new THREE.Mesh(postGeo, poleMat);
    postRight.position.set(-halfRoad - 0.95, 2.95, 0);
    const postLeft = new THREE.Mesh(postGeo, poleMat);
    postLeft.position.set(halfRoad + 0.95, 2.95, 0);
    const beam = new THREE.Mesh(portalBeamGeo, poleMat);
    beam.position.set(0, 5.65, 0);
    gantry.add(postRight, postLeft, beam);

    const redMat = trackMat(new THREE.MeshBasicMaterial({ color: '#450a0a' }));
    const yellowMat = trackMat(new THREE.MeshBasicMaterial({ color: '#422006' }));
    const greenMat = trackMat(new THREE.MeshBasicMaterial({ color: '#052e16' }));
    // Semáforos peatonales laterales: VERDE PEATÓN cuando el semáforo vehicular está en ROJO
    const pedWalkMat = trackMat(new THREE.MeshBasicMaterial({ color: '#052e16' }));
    const pedStopMat = trackMat(new THREE.MeshBasicMaterial({ color: '#450a0a' }));

    for (const headX of headPositionsX) {
      const box = new THREE.Mesh(boxGeo, housingMat);
      box.position.set(headX, 5.18, 0);
      gantry.add(box);

      for (const faceZ of [-0.23, 0.23]) {
        const rBulb = new THREE.Mesh(bulbGeo, redMat);
        rBulb.position.set(headX, 5.65, faceZ);
        const yBulb = new THREE.Mesh(bulbGeo, yellowMat);
        yBulb.position.set(headX, 5.18, faceZ);
        const gBulb = new THREE.Mesh(bulbGeo, greenMat);
        gBulb.position.set(headX, 4.71, faceZ);
        gantry.add(rBulb, yBulb, gBulb);
      }
    }

    // Semáforos peatonales en ambas veredas mirando hacia la senda peatonal y hacia el conductor
    for (const side of [-1, 1]) {
      const px = side * (halfRoad + 0.88);
      const pBox = new THREE.Mesh(pedBoxGeo, housingMat);
      pBox.position.set(px, 2.55, CROSSWALK_OFFSET_Z);
      gantry.add(pBox);
      for (const fz of [-0.15, 0.15]) {
        const stopBulb = new THREE.Mesh(pedBulbGeo, pedStopMat);
        stopBulb.position.set(px, 2.72, CROSSWALK_OFFSET_Z + fz);
        const walkBulb = new THREE.Mesh(pedBulbGeo, pedWalkMat);
        walkBulb.position.set(px, 2.38, CROSSWALK_OFFSET_Z + fz);
        gantry.add(stopBulb, walkBulb);
      }
    }
    group.add(gantry);

    // FRANJA PEATONAL CEBRA BLANCA A TRAVÉS DE TODA LA AVENIDA (ambos sentidos)
    const crosswalkZ = node.z + CROSSWALK_OFFSET_Z;
    const zebraSpan = roadWidth - 2.0;
    for (let b = 0; b < zebraBarCount; b++) {
      const barX =
        zebraBarCount === 1
          ? 0
          : -zebraSpan * 0.5 + (b / (zebraBarCount - 1)) * zebraSpan;
      const barWorld = roadPath.world(crosswalkZ, barX);
      const barMesh = new THREE.Mesh(zebraBarGeo, zebraBarMat);
      barMesh.position.set(barWorld.x, 0.033, barWorld.z);
      barMesh.rotation.set(-Math.PI / 2, 0, -barWorld.yaw);
      group.add(barMesh);
    }

    // Línea blanca de detención mano derecha (avance +Z, justo antes de la franja peatonal)
    const forwardCenter = -(carriageWidth * 0.5 + 0.32);
    const stopWorld = roadPath.world(node.z - 5.5, forwardCenter);
    const stopMesh = new THREE.Mesh(stopLineGeo, stopLineMat);
    stopMesh.position.set(stopWorld.x, 0.031, stopWorld.z);
    stopMesh.rotation.set(-Math.PI / 2, 0, -stopWorld.yaw);
    group.add(stopMesh);

    // Línea blanca de detención mano contraria (avance -Z)
    const oncomingCenter = carriageWidth * 0.5 + 0.32;
    const oncomingStopWorld = roadPath.world(node.z + 5.8, oncomingCenter);
    const oncomingStopMesh = new THREE.Mesh(stopLineGeo, stopLineMat);
    oncomingStopMesh.position.set(oncomingStopWorld.x, 0.031, oncomingStopWorld.z);
    oncomingStopMesh.rotation.set(-Math.PI / 2, 0, -oncomingStopWorld.yaw);
    group.add(oncomingStopMesh);

    lightMeshes.push({ node, redMat, yellowMat, greenMat, pedWalkMat, pedStopMat });
  }

  // 2B. PEATONES 3D ANIMADOS CRUZANDO LAS FRANJAS PEATONALES EN ROJO (sincronizados 1:1 con la física)
  const totalCrosswalkPeds = lights.length * PEDESTRIANS_PER_CROSSWALK;
  const cwPedScratch: CrosswalkPedestrianState[] = [];
  let cwLegsL: THREE.InstancedMesh | null = null;
  let cwLegsR: THREE.InstancedMesh | null = null;
  let cwTorso: THREE.InstancedMesh | null = null;
  let cwHead: THREE.InstancedMesh | null = null;
  let cwHair: THREE.InstancedMesh | null = null;
  let cwArms: THREE.InstancedMesh | null = null;

  if (totalCrosswalkPeds > 0) {
    const legG = trackGeo(new THREE.CapsuleGeometry(0.09, 0.54, 4, 6));
    const torsoG = trackGeo(new THREE.CapsuleGeometry(0.18, 0.48, 4, 8));
    const headG = trackGeo(new THREE.SphereGeometry(0.14, 10, 10));
    const hairG = trackGeo(new THREE.SphereGeometry(0.148, 8, 8, 0, Math.PI * 2, 0, Math.PI * 0.58));
    const armG = trackGeo(new THREE.CapsuleGeometry(0.064, 0.42, 3, 6));
    const mkPedMat = () =>
      trackMat(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.72, metalness: 0.05 }));

    cwLegsL = new THREE.InstancedMesh(legG, mkPedMat(), totalCrosswalkPeds);
    cwLegsR = new THREE.InstancedMesh(legG, mkPedMat(), totalCrosswalkPeds);
    cwTorso = new THREE.InstancedMesh(torsoG, mkPedMat(), totalCrosswalkPeds);
    cwHead = new THREE.InstancedMesh(headG, mkPedMat(), totalCrosswalkPeds);
    cwHair = new THREE.InstancedMesh(hairG, mkPedMat(), totalCrosswalkPeds);
    cwArms = new THREE.InstancedMesh(armG, mkPedMat(), totalCrosswalkPeds * 2);

    const shirts = ['#38bdf8', '#facc15', '#fb7185', '#f8fafc', '#34d399', '#f97316'].map(
      (c) => new THREE.Color(c),
    );
    const pants = ['#1e293b', '#1d4ed8', '#334155', '#27272a'].map((c) => new THREE.Color(c));
    const skins = ['#f1c27d', '#e0ac69', '#ffdbac', '#c68642'].map((c) => new THREE.Color(c));
    const hairs = ['#111827', '#451a03', '#78350f', '#cbd5e1'].map((c) => new THREE.Color(c));

    for (let i = 0; i < totalCrosswalkPeds; i++) {
      const sh = shirts[i % shirts.length];
      const pa = pants[(i * 3) % pants.length];
      const sk = skins[(i * 5) % skins.length];
      const ha = hairs[(i * 2) % hairs.length];
      cwLegsL.setColorAt(i, pa);
      cwLegsR.setColorAt(i, pa);
      cwTorso.setColorAt(i, sh);
      cwHead.setColorAt(i, sk);
      cwHair.setColorAt(i, ha);
      cwArms.setColorAt(i * 2, sh);
      cwArms.setColorAt(i * 2 + 1, sh);
    }

    for (const im of [cwLegsL, cwLegsR, cwTorso, cwHead, cwHair, cwArms]) {
      im.frustumCulled = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      group.add(im);
    }
  }

  // 3. CARTELES REGLAMENTARIOS DE LÍMITE DE VELOCIDAD (MÁXIMA Y MÍNIMA)
  const signPoleGeo = trackGeo(new THREE.CylinderGeometry(0.068, 0.08, 3.6, 8));
  const signPlateGeo = trackGeo(new THREE.PlaneGeometry(1.24, 1.24));
  const signTexCache = new Map<string, THREE.MeshBasicMaterial>();

  const getSpeedSignMat = (val: number, kind: 'max' | 'min') => {
    const key = `${kind}_${val}`;
    let m = signTexCache.get(key);
    if (!m) {
      const tex = createSpeedSignTexture(val, kind);
      disposableTexs.push(tex);
      m = trackMat(new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
      signTexCache.set(key, m);
    }
    return m;
  };

  for (const zone of speedZones) {
    const signWorld = roadPath.world(zone.signZ, -halfRoad - 1.25);
    const signPostGroup = new THREE.Group();
    signPostGroup.position.set(signWorld.x, 0, signWorld.z);
    signPostGroup.rotation.y = signWorld.yaw;

    const pole = new THREE.Mesh(signPoleGeo, poleMat);
    pole.position.set(0, 1.8, 0);
    signPostGroup.add(pole);

    const maxBoard = new THREE.Mesh(signPlateGeo, getSpeedSignMat(zone.maxKmh, 'max'));
    maxBoard.position.set(0.16, 3.22, -0.06);
    maxBoard.rotation.y = Math.PI;
    signPostGroup.add(maxBoard);

    const minBoard = new THREE.Mesh(signPlateGeo, getSpeedSignMat(zone.minKmh, 'min'));
    minBoard.position.set(0.16, 1.94, -0.06);
    minBoard.rotation.y = Math.PI;
    signPostGroup.add(minBoard);

    group.add(signPostGroup);
  }

  // 4. ARCOS INTERMEDIOS DE VUELTA (cuando el jugador elige 2 o 3 vueltas)
  if (laps > 1) {
    const lapLength = trackDistanceMeters / laps;
    const archColumnGeo = trackGeo(new THREE.BoxGeometry(0.52, 6.8, 0.52));
    const archBeamGeo = trackGeo(new THREE.BoxGeometry(roadWidth + 3.0, 1.18, 0.64));
    const archBannerGeo = trackGeo(new THREE.PlaneGeometry(roadWidth * 0.72, 1.05));

    for (let lapIdx = 1; lapIdx < laps; lapIdx++) {
      const lapZ = lapLength * lapIdx;
      const centerWorld = roadPath.world(lapZ, 0);
      const arch = new THREE.Group();
      arch.position.set(centerWorld.x, 0, centerWorld.z);
      arch.rotation.y = centerWorld.yaw;

      const colL = new THREE.Mesh(archColumnGeo, poleMat);
      colL.position.set(-halfRoad - 1.0, 3.4, 0);
      const colR = new THREE.Mesh(archColumnGeo, poleMat);
      colR.position.set(halfRoad + 1.0, 3.4, 0);
      const beam = new THREE.Mesh(archBeamGeo, poleMat);
      beam.position.set(0, 6.6, 0);

      const bannerTex = createLapBannerTexture(lapIdx + 1, laps);
      disposableTexs.push(bannerTex);
      const bannerMat = trackMat(new THREE.MeshBasicMaterial({ map: bannerTex }));
      const banner = new THREE.Mesh(archBannerGeo, bannerMat);
      banner.position.set(0, 6.6, -0.35);
      banner.rotation.y = Math.PI;

      arch.add(colL, colR, beam, banner);
      group.add(arch);
    }
  }

  // 5. VEHÍCULOS 3D FIELES EN MANO CONTRARIA (GLB propio o carrocería OEM fiel, con ruedas giratorias y freno)
  const shadowGeo = trackGeo(new THREE.PlaneGeometry(2.45, 4.9));
  const contactShadowTex = createContactShadowTexture();
  disposableTexs.push(contactShadowTex);

  const headlampGlowCanvas = document.createElement('canvas');
  headlampGlowCanvas.width = headlampGlowCanvas.height = 64;
  const hCtx = headlampGlowCanvas.getContext('2d');
  if (hCtx) {
    const g = hCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(240, 249, 255, 0.92)');
    g.addColorStop(0.28, 'rgba(186, 230, 253, 0.42)');
    g.addColorStop(1, 'rgba(186, 230, 253, 0)');
    hCtx.fillStyle = g;
    hCtx.fillRect(0, 0, 64, 64);
  }
  const headlampGlowTex = new THREE.CanvasTexture(headlampGlowCanvas);
  headlampGlowTex.colorSpace = THREE.SRGBColorSpace;
  disposableTexs.push(headlampGlowTex);

  const headlampGlowMat = trackMat(
    new THREE.SpriteMaterial({
      map: headlampGlowTex,
      color: '#e0f2fe',
      transparent: true,
      opacity: 0.56,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );

  const tailGlowMatOn = trackMat(
    new THREE.MeshBasicMaterial({ color: '#ff2b2b', side: THREE.DoubleSide }),
  );
  const tailGlowMatOff = trackMat(
    new THREE.MeshBasicMaterial({ color: '#7f1d1d', side: THREE.DoubleSide }),
  );
  const tailLampGeo = trackGeo(new THREE.PlaneGeometry(0.24, 0.06));
  const shadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    }),
  );

  interface OncomingVisualSlot {
    root: THREE.Group;
    wheelRig: VehicleWheelRig | null;
    tailLeft: THREE.Mesh;
    tailRight: THREE.Mesh;
    setBrakeLit?: (braking: boolean) => void;
    disposeExtra?: () => void;
  }

  const oncomingVisuals: OncomingVisualSlot[] = [];

  for (let i = 0; i < oncomingCount; i++) {
    const spec = TRAFFIC_3D_CATALOG_SPECS[i % TRAFFIC_3D_CATALOG_SPECS.length];
    const presetVehicle =
      PRESET_VEHICLES.find((v) => v.id === spec.modelId) || PRESET_VEHICLES[0];
    const root = new THREE.Group();
    root.name = `oncoming_3d_slot_${i + 1}_${spec.modelId}`;

    // Sombra suave de contacto sobre el asfalto
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.022;
    root.add(shadow);

    // Halos discretos en esquinas de faros y ópticas traseras alineadas a la carrocería real
    const halfLen = spec.lengthM * 0.5;
    const lampX = spec.widthM * 0.36;
    for (const sx of [-1, 1]) {
      const hlHalo = new THREE.Sprite(headlampGlowMat);
      hlHalo.position.set(sx * lampX, 0.78, halfLen + 0.03);
      hlHalo.scale.set(0.38, 0.22, 1);
      root.add(hlHalo);
    }

    const tailLeft = new THREE.Mesh(tailLampGeo, tailGlowMatOff);
    tailLeft.position.set(-lampX, 0.88, -halfLen - 0.02);
    tailLeft.rotation.y = Math.PI;
    const tailRight = new THREE.Mesh(tailLampGeo, tailGlowMatOff);
    tailRight.position.set(lampX, 0.88, -halfLen - 0.02);
    tailRight.rotation.y = Math.PI;
    root.add(tailLeft, tailRight);

    // Modelo base inmediato fiel al catálogo (garantiza apariencia OEM instantánea desde el frame 0)
    const faithfulInitial = createFaithfulVehicle3D(presetVehicle, envMap);
    root.add(faithfulInitial.group);

    const slot: OncomingVisualSlot = {
      root,
      wheelRig: faithfulInitial.wheelRig,
      tailLeft,
      tailRight,
      setBrakeLit: faithfulInitial.setBrakeLit,
      disposeExtra: faithfulInitial.dispose,
    };

    // Si el vehículo posee su propio archivo .glb dedicado en /public/models/, reemplazar por la malla GLB real
    void resolveDedicatedVehicleGLTF(spec.modelId)
      .then((resolved) => {
        if (disposed || !resolved) return;
        const calibratedConfig = {
          ...resolved.config,
          targetLengthMeters: spec.lengthM,
        };
        const glbInstance = createCalibratedVehicle3DInstance(
          calibratedConfig,
          resolved.gltf,
          envMap,
        );
        const innerModel = glbInstance.children[0] as THREE.Group | undefined;

        glbInstance.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            obj.castShadow = false;
            obj.receiveShadow = false;
          }
        });

        root.remove(faithfulInitial.group);
        faithfulInitial.dispose();

        slot.wheelRig = innerModel
          ? createVehicleWheelRig(innerModel, innerModel.scale.x)
          : null;
        slot.setBrakeLit = undefined;
        slot.disposeExtra = () => glbInstance.userData.disposeMaterials?.();
        root.add(glbInstance);
      })
      .catch(() => {
        // Conserva el modelo 3D OEM fiel sin interrumpir el tránsito
      });

    root.visible = false;
    group.add(root);
    oncomingVisuals.push(slot);
  }

  // 6. SISTEMA DE SALPICADURA 3D (WATER SPLASH) CON POOL FIJO (0 GC EN RENDER LOOP)
  const MAX_DROPS = 140;
  const dropGeo = trackGeo(new THREE.PlaneGeometry(0.32, 0.46));
  const dropCanvas = document.createElement('canvas');
  dropCanvas.width = 64;
  dropCanvas.height = 64;
  const dCtx = dropCanvas.getContext('2d');
  if (dCtx) {
    const g = dCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(224, 242, 254, 0.92)');
    g.addColorStop(0.55, 'rgba(125, 211, 252, 0.55)');
    g.addColorStop(1, 'rgba(56, 189, 248, 0)');
    dCtx.fillStyle = g;
    dCtx.fillRect(0, 0, 64, 64);
  }
  const dropTex = new THREE.CanvasTexture(dropCanvas);
  dropTex.colorSpace = THREE.SRGBColorSpace;
  disposableTexs.push(dropTex);

  const dropMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: dropTex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const splashInst = new THREE.InstancedMesh(dropGeo, dropMat, MAX_DROPS);
  splashInst.frustumCulled = false;
  splashInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  splashGroup.add(splashInst);

  const drops: SplashDrop[] = Array.from({ length: MAX_DROPS }, () => ({
    active: false,
    age: 0,
    life: 0.6,
    x: 0,
    y: -10,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    scale: 1,
  }));
  let dropCursor = 0;
  const _dropMat4 = new THREE.Matrix4();
  const _dropPos = new THREE.Vector3();
  const _dropQuat = new THREE.Quaternion();
  const _dropScale = new THREE.Vector3();
  const _dropEuler = new THREE.Euler();

  _dropScale.set(0, 0, 0);
  for (let i = 0; i < MAX_DROPS; i++) {
    _dropMat4.compose(_dropPos, _dropQuat, _dropScale);
    splashInst.setMatrixAt(i, _dropMat4);
  }
  splashInst.instanceMatrix.needsUpdate = true;

  const triggerSplash = (worldX: number, worldZ: number, intensity: number) => {
    const strength = Math.max(0.35, Math.min(1.25, intensity));
    const spawnCount = Math.round(22 + strength * 20);
    for (let i = 0; i < spawnCount; i++) {
      const slot = drops[dropCursor % MAX_DROPS];
      dropCursor++;
      const side = i % 2 === 0 ? -1 : 1;
      const spreadAngle = (Math.random() - 0.5) * 1.1;
      slot.active = true;
      slot.age = 0;
      slot.life = 0.42 + Math.random() * 0.34;
      slot.x = worldX + side * (0.72 + Math.random() * 0.38);
      slot.y = 0.18 + Math.random() * 0.22;
      slot.z = worldZ + (Math.random() - 0.5) * 2.1;
      slot.vx = side * (2.2 + Math.random() * 3.4) * strength + Math.sin(spreadAngle);
      slot.vy = (3.4 + Math.random() * 3.8) * strength;
      slot.vz = (Math.random() - 0.35) * 2.8;
      slot.scale = (0.75 + Math.random() * 0.85) * strength;
    }
  };

  const update = (
    timeSec: number,
    dt: number,
    oncomingCars: readonly OncomingTrafficCar[],
    focusZ = 0,
    isDroneView = false,
  ) => {
    // Actualizar colores emisivos de semáforos vehiculares y peatonales
    for (const lm of lightMeshes) {
      const st = getTrafficLightState(lm.node, timeSec);
      lm.redMat.color.setHex(st.phase === 'red' ? 0xff2b2b : 0x3b0a0a);
      lm.yellowMat.color.setHex(st.phase === 'yellow' ? 0xfbbf24 : 0x3b2506);
      lm.greenMat.color.setHex(st.phase === 'green' ? 0x22c55e : 0x063218);
      // Cuando el semáforo vehicular está en ROJO, el semáforo peatonal brilla en VERDE y cruzan
      lm.pedWalkMat.color.setHex(st.phase === 'red' ? 0x22c55e : 0x063218);
      lm.pedStopMat.color.setHex(st.phase !== 'red' ? 0xff2b2b : 0x3b0a0a);
    }

    // Actualizar peatones 3D cruzando las franjas peatonales cuando el semáforo está en rojo
    if (cwLegsL && cwLegsR && cwTorso && cwHead && cwHair && cwArms && totalCrosswalkPeds > 0) {
      const peds = evaluateCrosswalkPedestrians(lights, timeSec, halfRoad, cwPedScratch);
      for (let i = 0; i < peds.length; i++) {
        const ped = peds[i];
        const wp = roadPath.world(ped.z, ped.x);
        const headingYaw = wp.yaw + ped.headingYawOffset;
        const sinY = Math.sin(headingYaw);
        const cosY = Math.cos(headingYaw);
        const rightX = cosY;
        const rightZ = -sinY;
        const stride = ped.walking ? Math.sin(ped.stridePhase) * 0.42 : 0;
        const bob = ped.walking ? Math.abs(Math.cos(ped.stridePhase)) * 0.03 : 0;
        const hs = ped.heightScale;

        _dropScale.set(hs, hs, hs);

        // Piernas L / R
        _dropPos.set(
          wp.x - rightX * 0.10 + sinY * stride * 0.16,
          0.43 * hs + bob,
          wp.z - rightZ * 0.10 + cosY * stride * 0.16,
        );
        _dropEuler.set(stride, headingYaw, 0, 'YXZ');
        _dropQuat.setFromEuler(_dropEuler);
        _dropMat4.compose(_dropPos, _dropQuat, _dropScale);
        cwLegsL.setMatrixAt(i, _dropMat4);

        _dropPos.set(
          wp.x + rightX * 0.10 - sinY * stride * 0.16,
          0.43 * hs + bob,
          wp.z + rightZ * 0.10 - cosY * stride * 0.16,
        );
        _dropEuler.set(-stride, headingYaw, 0, 'YXZ');
        _dropQuat.setFromEuler(_dropEuler);
        _dropMat4.compose(_dropPos, _dropQuat, _dropScale);
        cwLegsR.setMatrixAt(i, _dropMat4);

        // Torso, cabeza y cabello
        _dropPos.set(wp.x, 1.06 * hs + bob, wp.z);
        _dropEuler.set(0, headingYaw, 0, 'YXZ');
        _dropQuat.setFromEuler(_dropEuler);
        _dropMat4.compose(_dropPos, _dropQuat, _dropScale);
        cwTorso.setMatrixAt(i, _dropMat4);

        _dropPos.set(wp.x, 1.52 * hs + bob, wp.z);
        _dropMat4.compose(_dropPos, _dropQuat, _dropScale);
        cwHead.setMatrixAt(i, _dropMat4);

        _dropPos.set(wp.x, 1.54 * hs + bob, wp.z);
        _dropMat4.compose(_dropPos, _dropQuat, _dropScale);
        cwHair.setMatrixAt(i, _dropMat4);

        // Brazos oscilando
        _dropPos.set(
          wp.x - rightX * 0.25 - sinY * stride * 0.14,
          1.05 * hs + bob,
          wp.z - rightZ * 0.25 - cosY * stride * 0.14,
        );
        _dropEuler.set(-stride * 0.9, headingYaw, 0, 'YXZ');
        _dropQuat.setFromEuler(_dropEuler);
        _dropMat4.compose(_dropPos, _dropQuat, _dropScale);
        cwArms.setMatrixAt(i * 2, _dropMat4);

        _dropPos.set(
          wp.x + rightX * 0.25 + sinY * stride * 0.14,
          1.05 * hs + bob,
          wp.z + rightZ * 0.25 + cosY * stride * 0.14,
        );
        _dropEuler.set(stride * 0.9, headingYaw, 0, 'YXZ');
        _dropQuat.setFromEuler(_dropEuler);
        _dropMat4.compose(_dropPos, _dropQuat, _dropScale);
        cwArms.setMatrixAt(i * 2 + 1, _dropMat4);
      }
      cwLegsL.instanceMatrix.needsUpdate = true;
      cwLegsR.instanceMatrix.needsUpdate = true;
      cwTorso.instanceMatrix.needsUpdate = true;
      cwHead.instanceMatrix.needsUpdate = true;
      cwHair.instanceMatrix.needsUpdate = true;
      cwArms.instanceMatrix.needsUpdate = true;
    }

    // Ventana de visibilidad inteligente para no procesar triángulos GLB lejanos fuera de plano
    const maxVisAhead = isDroneView ? 310 : 215;
    const maxVisBehind = isDroneView ? 120 : 65;

    for (let i = 0; i < oncomingVisuals.length; i++) {
      const vis = oncomingVisuals[i];
      const car = oncomingCars[i];
      if (
        !car ||
        car.z < -30 ||
        car.z > trackDistanceMeters + 150 ||
        car.z - focusZ > maxVisAhead ||
        focusZ - car.z > maxVisBehind
      ) {
        vis.root.visible = false;
        continue;
      }
      vis.root.visible = true;
      const wp = roadPath.world(car.z, car.x);
      vis.root.position.set(wp.x, 0, wp.z);
      vis.root.rotation.y = wp.yaw + Math.PI; // Mira hacia -Z sobre la tangente de la ruta

      if (vis.wheelRig) {
        vis.wheelRig.setDistanceMeters(car.distanceTraveledM);
      }
      vis.setBrakeLit?.(car.braking);

      const brakeMat = car.braking ? tailGlowMatOn : tailGlowMatOff;
      vis.tailLeft.material = brakeMat;
      vis.tailRight.material = brakeMat;
    }

    // Actualizar partículas de agua (salpicadura en bache mojado)
    let anyDropChanged = false;
    for (let i = 0; i < MAX_DROPS; i++) {
      const d = drops[i];
      if (!d.active) continue;
      anyDropChanged = true;
      d.age += dt;
      if (d.age >= d.life || d.y < -0.05) {
        d.active = false;
        _dropPos.set(0, -20, 0);
        _dropScale.set(0, 0, 0);
        _dropMat4.compose(_dropPos, _dropQuat, _dropScale);
        splashInst.setMatrixAt(i, _dropMat4);
        continue;
      }
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;
      d.vy -= 11.8 * dt;
      const lifeRatio = d.age / d.life;
      const s = d.scale * (1 + lifeRatio * 0.85) * (1 - lifeRatio * 0.55);
      _dropPos.set(d.x, d.y, d.z);
      _dropEuler.set(0, (i % 5) * 0.62, 0);
      _dropQuat.setFromEuler(_dropEuler);
      _dropScale.set(s, s, s);
      _dropMat4.compose(_dropPos, _dropQuat, _dropScale);
      splashInst.setMatrixAt(i, _dropMat4);
    }
    if (anyDropChanged) {
      splashInst.instanceMatrix.needsUpdate = true;
    }
  };

  const dispose = () => {
    disposed = true;
    oncomingVisuals.forEach((vis) => vis.disposeExtra?.());
    disposableGeos.forEach((g) => g.dispose());
    disposableMats.forEach((m) => m.dispose());
    disposableTexs.forEach((t) => t.dispose());
  };

  return {
    group,
    splashGroup,
    update,
    triggerSplash,
    dispose,
  };
}
