import * as THREE from 'three';
import { Vehicle } from '../types/vehicle';
import { 
  getVehicle3DConfig, 
  getCachedDedicatedVehicleGLTF,
  loadVehicleGLTF, 
  resolveDedicatedVehicleGLTF,
  createCalibratedVehicle3DInstance,
  recordVehicleModelDiagnostic,
  Vehicle3DConfig,
  GENERIC_CUSTOM_CAR_GLB_URL,
  getCustomVehicleGlbUrl,
} from './vehicle3DModelLoader';
import {
  createContactShadowTexture,
  createHeadlightBeamTexture,
} from './race3dTextures';
import { createVehicleWheelRig, VehicleWheelRig } from './vehicleWheelRig';
import { VehicleSteeringDynamics } from './vehicleSteeringDynamics';
import { screenRightSteeringToWorldYaw } from './cinematicDirector';
import {
  createFaithfulVehicle3D,
  type FaithfulVehicleBuildResult,
  type VehicleLampAnchors,
} from './faithfulVehicleChassis3D';
import { getFaithfulVehicleSpec } from './faithfulVehicleSpecs';
import { resolveVehicleDimensionsM, type VehicleDimensionsM } from './dynamicChaseCamera';

export interface InteractiveVehiclePose {
  x: number;
  z: number;
  yaw: number;
  slip: number;
  bump: number;
  /** Velocidad longitudinal firmada (m/s): >0 avance, <0 marcha atrás, 0 detenido */
  signedSpeedMps?: number;
  /** Severidad de bloqueo de rueda (0..1) calculada por brakingDynamics */
  wheelLock?: number;
  /** Deslizamiento longitudinal de frenado (0..1) */
  brakeSlip?: number;
  /** Estado real de modulación ABS del vehículo */
  absActive?: boolean;
  suspension?: { heaveM: number; pitchRad: number; rollRad: number; wheelRoadM: { FL: number; FR: number; RL: number; RR: number }; impact: number };
}

export interface VehicleEntityOptions {
  preferProceduralModel?: boolean;
  onModelModeChange?: (usesProceduralModel: boolean) => void;
  onDownloadProgress?: (percent: number, loadedBytes: number, totalBytes: number) => void;
}

export interface VehicleWorldLampState {
  headLeft: THREE.Vector3;
  headRight: THREE.Vector3;
  headDir: THREE.Vector3;
  headIntensity: number;
  brakeLeft: THREE.Vector3;
  brakeRight: THREE.Vector3;
  brakeIntensity: number;
}

export interface VehicleEntityRunner {
  group: THREE.Group; // VehicleRoot (posición y orientación física oficial)
  vehicle: Vehicle;
  laneX: number;
  is3DModel: boolean;
  usesProceduralModel?: boolean;
  updateState: (
    distanceMeters: number,
    speedKmh: number,
    accelG: number,
    isBraking: boolean,
    cameraPos: THREE.Vector3,
    outOfFuel: boolean,
    steeringAngleRadians?: number,
    frameDeltaSeconds?: number,
    dynamicPose?: InteractiveVehiclePose,
  ) => void;
  setHeadlights: (enabled: boolean, illuminateTrack: boolean, roadBeamScale?: number) => void;
  setTurnSignals?: (leftLit: boolean, rightLit: boolean) => void;
  setNameplateVisible: (visible: boolean) => void;
  getWorldLampState?: (out: VehicleWorldLampState) => boolean;
  getResolvedDimensionsM?: () => VehicleDimensionsM;
  getWheelRig?: () => VehicleWheelRig | null;
  // Metros recorridos solo en la toma de llegada; no altera la física.
  advanceFinishWheelRotation?: (additionalMeters: number) => void;
  dispose: () => void;
}

/**
 * Genera una textura nítida tipo placa / pill flotante para identificar inequívocamente al vehículo
 */
function createNameplateTexture(name: string, colorHex: string, isProvisional: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.clearRect(0, 0, 640, 128);

  // Contenedor semitransparente con borde del color del vehículo
  ctx.fillStyle = 'rgba(10, 15, 29, 0.88)';
  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 4;
  
  const x = 16, y = 16, w = 608, h = 96, r = 48;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.stroke();

  // Punto luminoso del color
  ctx.fillStyle = colorHex;
  ctx.beginPath();
  ctx.arc(60, 64, 16, 0, Math.PI * 2);
  ctx.fill();

  // Nombre del vehículo con ajuste dinámico para que quepa completo
  const text = name.toUpperCase();
  let fontSize = 32;
  ctx.font = `bold ${fontSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
  const maxAllowedWidth = isProvisional ? 390 : 490;
  while (ctx.measureText(text).width > maxAllowedWidth && fontSize > 18) {
    fontSize -= 2;
    ctx.font = `bold ${fontSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
  }

  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 90, 64);

  // Badge discreto si es 3D provisional
  if (isProvisional) {
    ctx.font = 'bold 18px "JetBrains Mono", monospace';
    ctx.fillStyle = colorHex;
    ctx.fillText('3D TEMP', 500, 64);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

/**
 * Genera textura radial suave para el halo underglow en el asfalto
 */
function createUnderglowTexture(colorHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 60);
  grad.addColorStop(0, colorHex);
  grad.addColorStop(0.5, colorHex);
  grad.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

/** Halo de faro LED blanco puro nítido con núcleo HDR para bloom realista. */
function createHeadlightGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
    gradient.addColorStop(0, 'rgba(255,255,255,0.98)');
    gradient.addColorStop(0.22, 'rgba(252,253,255,0.68)');
    gradient.addColorStop(0.58, 'rgba(240,245,255,0.18)');
    gradient.addColorStop(1, 'rgba(235,242,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Mancha ovalada de iluminación tenue; sigue al vehículo sin sombras extra. */
function createSoftRoadBeamTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.save();
    ctx.translate(64, 128);
    ctx.scale(0.90, 1.96);
    const gradient = ctx.createRadialGradient(0, 0, 1, 0, 0, 62);
    gradient.addColorStop(0, 'rgba(210,229,255,.34)');
    gradient.addColorStop(0.30, 'rgba(200,222,255,.20)');
    gradient.addColorStop(0.72, 'rgba(180,205,240,.045)');
    gradient.addColorStop(1, 'rgba(170,195,240,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  return new THREE.CanvasTexture(canvas);
}

/** Halo de freno rojo difuso HDR para bloom realista en ambas ópticas traseras. */
function createBrakeGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
    gradient.addColorStop(0, 'rgba(255, 76, 64, 0.98)');
    gradient.addColorStop(0.24, 'rgba(244, 34, 34, 0.65)');
    gradient.addColorStop(0.62, 'rgba(185, 22, 22, 0.18)');
    gradient.addColorStop(1, 'rgba(140, 12, 12, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const _calBox3 = new THREE.Box3();
const _calRaycaster = new THREE.Raycaster();
const _calOrigin = new THREE.Vector3();
const _calDir = new THREE.Vector3();
const _localAnchorScratch = new THREE.Vector3();

/**
 * Entidad 3D con arquitectura desacoplada de transformaciones:
 * - group (VehicleRoot): Control de posición física oficial (X carril, Z avance en pista)
 * - effectsGroup (VehicleEffects): Cabeceo dinámico de suspensión (dive/squat) y luces
 * - visualGroup (VehicleVisual): Malla 3D GLB calibrada con librea y materiales únicos
 */
export class Vehicle3DGLBEntity implements VehicleEntityRunner {
  public group: THREE.Group; // VehicleRoot
  public vehicle: Vehicle;
  public laneX: number;
  public is3DModel: boolean = true;
  public usesProceduralModel: boolean = false;

  private effectsGroup: THREE.Group; // VehicleEffects
  private modelInstance: THREE.Group | null = null;
  private faithfulBuild: FaithfulVehicleBuildResult | null = null;
  private wheelRig: VehicleWheelRig | null = null;
  private lastDistanceMeters = 0;
  private currentSteeringAngle = 0;
  private shadowMesh: THREE.Mesh;
  private underglowMesh: THREE.Mesh;
  private nameplateSprite: THREE.Sprite;

  // Sistema simétrico de faros delanteros (izquierdo +X, derecho -X)
  private headlightGroup = new THREE.Group();
  private headlightLensMaterial: THREE.MeshBasicMaterial;
  private headlightLensLeft: THREE.Mesh;
  private headlightLensRight: THREE.Mesh;
  private headlightHaloLeft: THREE.Sprite;
  private headlightHaloRight: THREE.Sprite;
  private headlightBeamLeft: THREE.SpotLight;
  private headlightBeamRight: THREE.SpotLight;
  private headlightGlowTexture: THREE.CanvasTexture;
  private headlightGlowMaterial: THREE.SpriteMaterial;
  private headlightRoadBeamGroup = new THREE.Group();
  private headlightRoadPoolLeft: THREE.Mesh;
  private headlightRoadPoolRight: THREE.Mesh;
  private headlightRoadTexture: THREE.CanvasTexture;
  private headlightsEnabled = true;
  private headlightsIlluminateTrack = false;
  private headlightRoadScale = 1.0;
  private headlightRoadMat: THREE.MeshBasicMaterial;

  // Sistema simétrico dual de luces traseras de freno (izquierda +X, derecha -X)
  private rearBrakeGroup = new THREE.Group();
  private brakeLensMaterial: THREE.MeshBasicMaterial;
  private brakeLensLeft: THREE.Mesh;
  private brakeLensRight: THREE.Mesh;
  private brakeHaloLeft: THREE.Sprite;
  private brakeHaloRight: THREE.Sprite;
  private brakeLightLeft: THREE.PointLight;
  private brakeLightRight: THREE.PointLight;
  private brakeGlowTexture: THREE.CanvasTexture;
  private brakeGlowMaterial: THREE.SpriteMaterial;
  private brakeRoadPoolGroup = new THREE.Group();
  private brakeRoadPoolLeft: THREE.Mesh;
  private brakeRoadPoolRight: THREE.Mesh;
  private brakeRoadPoolMaterial: THREE.MeshBasicMaterial;
  private brakeGlowLevel = 0;

  private lampAnchors: VehicleLampAnchors;
  private hasProceduralLenses = false;
  private config: Vehicle3DConfig;
  private steeringDynamics = new VehicleSteeringDynamics();
  private turnSignalLeftGroup = new THREE.Group();
  private turnSignalRightGroup = new THREE.Group();
  private turnSignalFrontLeftLens!: THREE.Mesh;
  private turnSignalRearLeftLens!: THREE.Mesh;
  private turnSignalFrontRightLens!: THREE.Mesh;
  private turnSignalRearRightLens!: THREE.Mesh;
  private turnSignalFrontLeftGlow!: THREE.Sprite;
  private turnSignalRearLeftGlow!: THREE.Sprite;
  private turnSignalFrontRightGlow!: THREE.Sprite;
  private turnSignalRearRightGlow!: THREE.Sprite;
  private glbTurnSignalMatsLeft: THREE.MeshStandardMaterial[] = [];
  private glbTurnSignalMatsRight: THREE.MeshStandardMaterial[] = [];
  private lastTurnLeftLit = false;
  private lastTurnRightLit = false;
  private turnSignalLensMaterial: THREE.MeshBasicMaterial;
  private turnSignalGlowTexture: THREE.CanvasTexture;
  private turnSignalGlowMaterial: THREE.SpriteMaterial;
  private hasTrackHeadlightBeams = true;
  private onModelModeChange?: (usesProceduralModel: boolean) => void;
  private onDownloadProgress?: (percent: number, loadedBytes: number, totalBytes: number) => void;
  private isLoaded: boolean = false;
  private isDisposed: boolean = false;
  private envMap?: THREE.Texture | null;
  private resolvedDimensionsM: VehicleDimensionsM;
  private accumulatedWheelTravelMeters = 0;
  private prevRawDistanceMeters = 0;
  private hasInitializedWheelDistance = false;
  private absModulationPhaseSec = 0;

  constructor(
    vehicle: Vehicle, 
    laneIndex: number, 
    totalLanes: number, 
    config: Vehicle3DConfig,
    onLoaded?: () => void,
    onError?: (err: unknown) => void,
    envMap?: THREE.Texture | null,
    options?: VehicleEntityOptions,
  ) {
    this.vehicle = vehicle;
    this.config = config;
    this.envMap = envMap;
    this.onModelModeChange = options?.onModelModeChange;
    this.onDownloadProgress = options?.onDownloadProgress;
    this.hasTrackHeadlightBeams = !options?.preferProceduralModel;
    this.resolvedDimensionsM = resolveVehicleDimensionsM(
      vehicle.dimensions,
      null,
      getFaithfulVehicleSpec(vehicle),
    );

    // 1. VehicleRoot: controla las coordenadas físicas mundiales
    this.group = new THREE.Group();
    this.group.name = `vehicle_root_${vehicle.id}`;

    // Calcular posición X del carril
    const laneWidth = 3.6;
    const centerOffset = ((totalLanes - 1) * laneWidth) / 2;
    this.laneX = laneIndex * laneWidth - centerOffset;
    this.group.position.x = this.laneX;
    this.group.position.y = 0;
    this.group.position.z = 0;

    // 2. VehicleEffects: aloja las inclinaciones visuales sin perturbar el Root
    this.effectsGroup = new THREE.Group();
    this.effectsGroup.name = `vehicle_effects_${vehicle.id}`;
    this.group.add(this.effectsGroup);

    // 3. Sombra de contacto de 4 ruedas en el pavimento
    const shadowGeo = new THREE.PlaneGeometry(2.2, 4.5);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: createContactShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.72,
    });
    this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowMesh.rotation.x = -Math.PI / 2;
    this.shadowMesh.position.set(0, 0.015, 0);
    this.group.add(this.shadowMesh);

    // 4. Halo luminoso underglow en el asfalto (color de identificación del auto)
    const underglowGeo = new THREE.PlaneGeometry(2.6, 5.0);
    const underglowMat = new THREE.MeshBasicMaterial({
      map: createUnderglowTexture(config.brandColor),
      transparent: true,
      depthWrite: false,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
    });
    this.underglowMesh = new THREE.Mesh(underglowGeo, underglowMat);
    this.underglowMesh.rotation.x = -Math.PI / 2;
    this.underglowMesh.position.set(0, 0.018, 0);
    this.underglowMesh.visible = false; // Evitar halo artificial sobre el asfalto.
    this.group.add(this.underglowMesh);

    // 5. Etiqueta flotante 3D (Billboard nameplate sobre el techo)
    const nameplateTex = createNameplateTexture(config.identificationName, config.brandColor, false);
    const nameplateMat = new THREE.SpriteMaterial({
      map: nameplateTex,
      transparent: true,
      depthTest: true,
    });
    this.nameplateSprite = new THREE.Sprite(nameplateMat);
    this.nameplateSprite.scale.set(2.8, 0.56, 1);
    this.nameplateSprite.position.set(0, 2.25, 0);
    this.group.add(this.nameplateSprite);

    // 6. Posiciones iniciales de ópticas calibradas para silueta SUV (y refinadas al montar GLB/OEM)
    const oemSpec = getFaithfulVehicleSpec(vehicle);
    const halfLength = oemSpec.lengthM * 0.5;
    const halfWidth = oemSpec.widthM * 0.44;
    const initFrontX = oemSpec.widthM * 0.345;
    const initRearX = oemSpec.widthM * 0.352;
    const frontLampY = Math.max(0.76, oemSpec.heightM * 0.51);
    const rearLampY = Math.max(0.92, oemSpec.heightM * 0.58);
    const initFrontZ = halfLength - 0.05;
    const initRearZ = -(halfLength - 0.04);

    this.lampAnchors = {
      frontLeft: [initFrontX, frontLampY, initFrontZ],
      frontRight: [-initFrontX, frontLampY, initFrontZ],
      rearLeft: [initRearX, rearLampY, initRearZ],
      rearRight: [-initRearX, rearLampY, initRearZ],
    };

    // 6A. DOS LUCES DE FRENO ROJAS SIMÉTRICAS (izquierda +X y derecha -X) en el portón trasero
    this.rearBrakeGroup.name = `frenos_duales_${vehicle.id}`;
    this.brakeLensMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.55, 0.04, 0.03),
      transparent: true,
      opacity: 0.18,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      side: THREE.DoubleSide,
    });
    const brakeLensGeo = new THREE.CapsuleGeometry(0.026, 0.155, 6, 12);
    brakeLensGeo.rotateZ(Math.PI * 0.5);
    this.brakeLensLeft = new THREE.Mesh(brakeLensGeo, this.brakeLensMaterial);
    this.brakeLensRight = new THREE.Mesh(brakeLensGeo.clone(), this.brakeLensMaterial);
    this.rearBrakeGroup.add(this.brakeLensLeft, this.brakeLensRight);

    this.brakeGlowTexture = createBrakeGlowTexture();
    this.brakeGlowMaterial = new THREE.SpriteMaterial({
      map: this.brakeGlowTexture,
      color: new THREE.Color(7.5, 0.09, 0.04),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.0,
    });
    this.brakeHaloLeft = new THREE.Sprite(this.brakeGlowMaterial);
    this.brakeHaloLeft.scale.set(0.66, 0.36, 1);
    this.brakeHaloRight = new THREE.Sprite(this.brakeGlowMaterial);
    this.brakeHaloRight.scale.set(0.66, 0.36, 1);
    this.rearBrakeGroup.add(this.brakeHaloLeft, this.brakeHaloRight);

    this.brakeLightLeft = new THREE.PointLight('#ff1e1e', 0, 9.5, 1.8);
    this.brakeLightRight = new THREE.PointLight('#ff1e1e', 0, 9.5, 1.8);
    this.rearBrakeGroup.add(this.brakeLightLeft, this.brakeLightRight);
    this.effectsGroup.add(this.rearBrakeGroup);

    // Reflexión roja dual proyectada sobre el asfalto detrás de cada luz de freno trasera
    this.brakeRoadPoolGroup.name = `reflejo_frenos_asfalto_${vehicle.id}`;
    this.brakeRoadPoolMaterial = new THREE.MeshBasicMaterial({
      map: this.brakeGlowTexture,
      color: new THREE.Color(2.8, 0.12, 0.06),
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const brakePoolGeo = new THREE.PlaneGeometry(2.35, 5.2);
    this.brakeRoadPoolLeft = new THREE.Mesh(brakePoolGeo, this.brakeRoadPoolMaterial);
    this.brakeRoadPoolLeft.rotation.x = -Math.PI / 2;
    this.brakeRoadPoolRight = new THREE.Mesh(brakePoolGeo.clone(), this.brakeRoadPoolMaterial);
    this.brakeRoadPoolRight.rotation.x = -Math.PI / 2;
    this.brakeRoadPoolGroup.add(this.brakeRoadPoolLeft, this.brakeRoadPoolRight);
    this.group.add(this.brakeRoadPoolGroup);

    // 7. DOS FAROS DELANTEROS BLANCOS SIMÉTRICOS (izquierdo +X y derecho -X) con bloom HDR y doble haz blanco en calzada
    this.headlightGroup.name = `faros_simetricos_${vehicle.id}`;
    this.headlightLensMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(4.6, 4.65, 4.72),
      polygonOffset: true,
      polygonOffsetFactor: -3,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const headLensGeo = new THREE.BoxGeometry(0.24, 0.068, 0.038);
    this.headlightLensLeft = new THREE.Mesh(headLensGeo, this.headlightLensMaterial);
    this.headlightLensRight = new THREE.Mesh(headLensGeo.clone(), this.headlightLensMaterial);
    this.headlightGroup.add(this.headlightLensLeft, this.headlightLensRight);

    this.headlightGlowTexture = createHeadlightGlowTexture();
    this.headlightGlowMaterial = new THREE.SpriteMaterial({
      map: this.headlightGlowTexture,
      color: new THREE.Color(3.6, 3.65, 3.72),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.92,
      toneMapped: false,
    });
    this.headlightHaloLeft = new THREE.Sprite(this.headlightGlowMaterial);
    this.headlightHaloLeft.scale.set(0.62, 0.34, 1);
    this.headlightHaloRight = new THREE.Sprite(this.headlightGlowMaterial);
    this.headlightHaloRight.scale.set(0.62, 0.34, 1);
    this.headlightGroup.add(this.headlightHaloLeft, this.headlightHaloRight);

    this.headlightBeamLeft = new THREE.SpotLight('#ffffff', 0, 34, 0.38, 0.88, 1.7);
    this.headlightBeamLeft.castShadow = false;
    this.headlightBeamRight = new THREE.SpotLight('#ffffff', 0, 34, 0.38, 0.88, 1.7);
    this.headlightBeamRight.castShadow = false;
    if (this.hasTrackHeadlightBeams) {
      // Mantener SpotLights siempre visibles (`intensity = 0` al apagar) para evitar recompilar todos los shaders PBR de la escena
      this.headlightBeamLeft.visible = true;
      this.headlightBeamRight.visible = true;
      this.headlightGroup.add(
        this.headlightBeamLeft,
        this.headlightBeamLeft.target,
        this.headlightBeamRight,
        this.headlightBeamRight.target,
      );
    }
    this.effectsGroup.add(this.headlightGroup);

    // Doble haz blanco proyectado sobre el asfalto (cono izquierdo y cono derecho independientes)
    this.headlightRoadBeamGroup.name = `iluminacion_dual_asfalto_${vehicle.id}`;
    this.headlightRoadTexture = createHeadlightBeamTexture();
    const headBeamMat = new THREE.MeshBasicMaterial({
      map: this.headlightRoadTexture,
      color: new THREE.Color(1.75, 1.78, 1.82),
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    this.headlightRoadMat = headBeamMat;
    const headBeamGeo = new THREE.PlaneGeometry(2.75, 14.5);
    this.headlightRoadPoolLeft = new THREE.Mesh(headBeamGeo, headBeamMat);
    this.headlightRoadPoolLeft.rotation.x = Math.PI / 2;
    this.headlightRoadPoolRight = new THREE.Mesh(headBeamGeo.clone(), headBeamMat);
    this.headlightRoadPoolRight.rotation.x = Math.PI / 2;
    this.headlightRoadBeamGroup.add(this.headlightRoadPoolLeft, this.headlightRoadPoolRight);
    this.group.add(this.headlightRoadBeamGroup);

    // 7b. Señaleros / balizas ámbar 3D realistas en las 4 esquinas de las ópticas (delantera izq/der + trasera izq/der)
    this.turnSignalLensMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(4.2, 2.35, 0.16),
      polygonOffset: true,
      polygonOffsetFactor: -5,
      polygonOffsetUnits: -5,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const tsCanvas = document.createElement('canvas');
    tsCanvas.width = tsCanvas.height = 64;
    const tsCtx = tsCanvas.getContext('2d');
    if (tsCtx) {
      const tsGrad = tsCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
      tsGrad.addColorStop(0, 'rgba(255, 214, 78, 0.98)');
      tsGrad.addColorStop(0.28, 'rgba(245, 158, 11, 0.62)');
      tsGrad.addColorStop(0.68, 'rgba(217, 119, 6, 0.16)');
      tsGrad.addColorStop(1, 'rgba(217, 119, 6, 0)');
      tsCtx.fillStyle = tsGrad;
      tsCtx.fillRect(0, 0, 64, 64);
    }
    this.turnSignalGlowTexture = new THREE.CanvasTexture(tsCanvas);
    this.turnSignalGlowTexture.colorSpace = THREE.SRGBColorSpace;
    this.turnSignalGlowMaterial = new THREE.SpriteMaterial({
      map: this.turnSignalGlowTexture,
      color: new THREE.Color(2.8, 1.65, 0.18),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.90,
      toneMapped: false,
    });

    const signalCapsuleGeo = new THREE.CapsuleGeometry(0.015, 0.105, 5, 10);
    signalCapsuleGeo.rotateZ(Math.PI * 0.5);

    this.turnSignalFrontLeftLens = new THREE.Mesh(signalCapsuleGeo, this.turnSignalLensMaterial);
    this.turnSignalRearLeftLens = new THREE.Mesh(signalCapsuleGeo.clone(), this.turnSignalLensMaterial);
    this.turnSignalFrontRightLens = new THREE.Mesh(signalCapsuleGeo.clone(), this.turnSignalLensMaterial);
    this.turnSignalRearRightLens = new THREE.Mesh(signalCapsuleGeo.clone(), this.turnSignalLensMaterial);

    this.turnSignalFrontLeftGlow = new THREE.Sprite(this.turnSignalGlowMaterial);
    this.turnSignalFrontLeftGlow.scale.set(0.34, 0.19, 1);
    this.turnSignalRearLeftGlow = new THREE.Sprite(this.turnSignalGlowMaterial);
    this.turnSignalRearLeftGlow.scale.set(0.36, 0.20, 1);
    this.turnSignalFrontRightGlow = new THREE.Sprite(this.turnSignalGlowMaterial);
    this.turnSignalFrontRightGlow.scale.set(0.34, 0.19, 1);
    this.turnSignalRearRightGlow = new THREE.Sprite(this.turnSignalGlowMaterial);
    this.turnSignalRearRightGlow.scale.set(0.36, 0.20, 1);

    this.turnSignalLeftGroup.name = `senalero_izq_${vehicle.id}`;
    this.turnSignalLeftGroup.add(
      this.turnSignalFrontLeftLens,
      this.turnSignalRearLeftLens,
      this.turnSignalFrontLeftGlow,
      this.turnSignalRearLeftGlow,
    );
    this.turnSignalLeftGroup.visible = false;
    this.effectsGroup.add(this.turnSignalLeftGroup);

    this.turnSignalRightGroup.name = `senalero_der_${vehicle.id}`;
    this.turnSignalRightGroup.add(
      this.turnSignalFrontRightLens,
      this.turnSignalRearRightLens,
      this.turnSignalFrontRightGlow,
      this.turnSignalRearRightGlow,
    );
    this.turnSignalRightGroup.visible = false;
    this.effectsGroup.add(this.turnSignalRightGroup);

    this.applyLampAnchors(this.lampAnchors, false);
    this.setHeadlights(true, false);

    // 8. Cargar modelo 3D GLB propio del vehículo; para los rivales CGI emplear SUV PBR procedural realista
    const targetLengthMeters = oemSpec.lengthM;

    const enableVehicleMeshShadows = (root: THREE.Object3D) => {
      root.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mat = (child as THREE.Mesh).material;
          const primaryMat = Array.isArray(mat) ? mat[0] : mat;
          if (primaryMat && primaryMat.blending !== THREE.AdditiveBlending) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        }
      });
    };

    const calibrateGlbSuvLampAnchors = (modelRoot: THREE.Object3D): VehicleLampAnchors => {
      modelRoot.updateMatrixWorld(true);
      _calBox3.setFromObject(modelRoot);
      const sizeX = Math.max(1.65, _calBox3.max.x - _calBox3.min.x);
      const sizeY = Math.max(1.48, _calBox3.max.y - _calBox3.min.y);
      const minZ = _calBox3.min.z;
      const maxZ = _calBox3.max.z;

      const fx = sizeX * 0.315;
      const rx = sizeX * 0.282;
      const fy = _calBox3.min.y + sizeY * 0.52;
      const ry = _calBox3.min.y + sizeY * 0.635;

      const probeSurfaceZ = (x: number, y: number, fromFront: boolean, fallbackZ: number): number => {
        _calOrigin.set(x, y, fromFront ? maxZ + 0.8 : minZ - 0.8);
        _calDir.set(0, 0, fromFront ? -1 : 1);
        _calRaycaster.set(_calOrigin, _calDir);
        const hits = _calRaycaster.intersectObject(modelRoot, true);
        if (hits.length > 0) {
          const hitZ = hits[0].point.z;
          if (fromFront && hitZ > maxZ - sizeX * 0.48) return hitZ + 0.028;
          if (!fromFront && hitZ < minZ + sizeX * 0.48) return hitZ - 0.024;
        }
        return fallbackZ;
      };

      const fzL = probeSurfaceZ(fx, fy, true, maxZ - 0.07);
      const fzR = probeSurfaceZ(-fx, fy, true, maxZ - 0.07);
      const fz = (fzL + fzR) * 0.5;

      const rzL = probeSurfaceZ(rx, ry, false, minZ + 0.04);
      const rzR = probeSurfaceZ(-rx, ry, false, minZ + 0.04);
      const rz = Math.min(rzL, rzR);

      return {
        frontLeft: [fx, fy, fz],
        frontRight: [-fx, fy, fz],
        rearLeft: [rx, ry, rz],
        rearRight: [-rx, ry, rz],
      };
    };

    let loadedNotified = false;
    const notifyLoadedOnce = () => {
      if (loadedNotified || this.isDisposed) return;
      loadedNotified = true;
      this.isLoaded = true;
      if (onLoaded) onLoaded();
    };

    const collectGlbTurnSignalMaterials = (root: THREE.Object3D) => {
      this.glbTurnSignalMatsLeft = [];
      this.glbTurnSignalMatsRight = [];
      const indicatorRegex = /(turn[_-]?signal|indicator|blinker|intermitente|guino|guiño)/i;
      root.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (!m || !(m as THREE.MeshStandardMaterial).isMeshStandardMaterial) continue;
          const std = m as THREE.MeshStandardMaterial;
          const tag = `${mesh.name || ''} ${std.name || ''}`;
          if (!indicatorRegex.test(tag)) continue;
          mesh.getWorldPosition(_localAnchorScratch);
          const localX = this.effectsGroup.worldToLocal(_localAnchorScratch).x;
          if (/left|izq|_l\b/i.test(tag) || localX > 0.05) {
            this.glbTurnSignalMatsLeft.push(std);
          } else if (/right|der|_r\b/i.test(tag) || localX < -0.05) {
            this.glbTurnSignalMatsRight.push(std);
          } else {
            this.glbTurnSignalMatsLeft.push(std);
            this.glbTurnSignalMatsRight.push(std);
          }
        }
      });
    };

    const mountCalibratedGlb = (gltf: any, activeConfig: Vehicle3DConfig) => {
      if (this.isDisposed) return;
      this.wheelRig?.dispose?.();
      if (this.faithfulBuild) {
        this.effectsGroup.remove(this.faithfulBuild.group);
        this.faithfulBuild.dispose();
        this.faithfulBuild = null;
      } else if (this.modelInstance) {
        this.modelInstance.userData.disposeMaterials?.();
        this.effectsGroup.remove(this.modelInstance);
      }
      this.usesProceduralModel = false;
      this.modelInstance = createCalibratedVehicle3DInstance(
        { ...activeConfig, targetLengthMeters },
        gltf,
        this.envMap,
      );
      enableVehicleMeshShadows(this.modelInstance);
      const calibratedModel = this.modelInstance.children[0] as THREE.Group;
      this.wheelRig = createVehicleWheelRig(calibratedModel, calibratedModel.scale.x);
      this.wheelRig?.setDistanceMeters(this.accumulatedWheelTravelMeters);
      this.wheelRig?.setSteeringRadians(this.currentSteeringAngle, 1);
      this.effectsGroup.add(this.modelInstance);
      collectGlbTurnSignalMaterials(this.modelInstance);
      const calibratedAnchors = calibrateGlbSuvLampAnchors(this.modelInstance);
      const groundMinY = _calBox3.min.y;
      this.resolvedDimensionsM = resolveVehicleDimensionsM(
        this.vehicle.dimensions,
        {
          lengthM: _calBox3.max.z - _calBox3.min.z,
          widthM: _calBox3.max.x - _calBox3.min.x,
          heightM: _calBox3.max.y - _calBox3.min.y,
        },
        getFaithfulVehicleSpec(this.vehicle),
      );
      this.applyLampAnchors(calibratedAnchors, false);
      this.setHeadlights(this.headlightsEnabled, this.headlightsIlluminateTrack, this.headlightRoadScale);
      this.setTurnSignals(this.lastTurnLeftLit, this.lastTurnRightLit);
      recordVehicleModelDiagnostic(this.vehicle.id, {
        activeUrl: activeConfig.glbUrl,
        stage: 'rendered_glb',
        progressPercent: 100,
        wheelRigMode: this.wheelRig?.mode ?? 'none',
        wheelCount: this.wheelRig?.wheelCount ?? 0,
        groundMinY: Number.isFinite(groundMinY) ? Number(groundMinY.toFixed(4)) : 0,
        calibratedLengthM: Number(this.resolvedDimensionsM.lengthM.toFixed(3)),
        lastError: null,
      });
      this.onDownloadProgress?.(100, 1, 1);
      this.onModelModeChange?.(false);
    };

    const attachModel = (gltf: any, activeConfig: Vehicle3DConfig) => {
      if (this.isDisposed) return;
      mountCalibratedGlb(gltf, activeConfig);
      notifyLoadedOnce();
    };

    const attachFaithfulOemModel = () => {
      if (this.isDisposed) return;
      // Si es un rival CGI liviano, aplicar proporciones SUV modernas y colores realistas de tráfico
      const rivalTrafficPalette = ['#0d1016', '#bcc4ce', '#eef2f7', '#102648', '#2b313a'];
      const hashIdx =
        Math.abs(
          vehicle.id.split('').reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 7),
        ) % rivalTrafficPalette.length;
      const isRivalSuv = Boolean(options?.preferProceduralModel);
      const built = createFaithfulVehicle3D(
        vehicle,
        this.envMap,
        isRivalSuv
          ? {
              trafficSuvMode: true,
              paintHexOverride: rivalTrafficPalette[hashIdx],
            }
          : undefined,
      );
      enableVehicleMeshShadows(built.group);
      this.glbTurnSignalMatsLeft = [];
      this.glbTurnSignalMatsRight = [];
      this.faithfulBuild = built;
      this.modelInstance = built.group;
      this.wheelRig = built.wheelRig;
      this.wheelRig.setDistanceMeters(this.accumulatedWheelTravelMeters);
      this.wheelRig.setSteeringRadians(this.currentSteeringAngle, 1);
      this.effectsGroup.add(built.group);
      this.applyLampAnchors(built.lampAnchors, true);
      built.setHeadlightsLit(this.headlightsEnabled);
      built.setTurnSignalsLit(this.lastTurnLeftLit, this.lastTurnRightLit);
      this.usesProceduralModel = true;
      recordVehicleModelDiagnostic(this.vehicle.id, {
        stage: 'provisional_active',
        wheelRigMode: built.wheelRig.mode ?? 'procedural_oem',
        wheelCount: built.wheelRig.wheelCount,
      });
      this.onModelModeChange?.(true);
      notifyLoadedOnce();
    };

    const emitByteProgress = (loadedBytes: number, totalBytes: number) => {
      if (this.isDisposed || !this.onDownloadProgress) return;
      const pct =
        totalBytes > 0
          ? Math.max(1, Math.min(99, Math.round((loadedBytes / totalBytes) * 100)))
          : 0;
      this.onDownloadProgress(pct, loadedBytes, totalBytes);
    };

    const tryLoadSequence = async () => {
      if (options?.preferProceduralModel) {
        attachFaithfulOemModel();
        return;
      }

      if (vehicle.isCustom) {
        // Montar carrocería OEM de inmediato para no bloquear la largada mientras se resuelve el .glb personalizado
        attachFaithfulOemModel();
        const customUrls = [
          ...(getCustomVehicleGlbUrl(vehicle.id) ? [getCustomVehicleGlbUrl(vehicle.id)!] : []),
          GENERIC_CUSTOM_CAR_GLB_URL,
        ];
        for (const url of customUrls) {
          try {
            const gltf = await loadVehicleGLTF(url, emitByteProgress, { vehicleId: vehicle.id });
            if (!this.isDisposed) {
              mountCalibratedGlb(gltf, { ...config, glbUrl: url, isProvisional3D: false });
            }
            return;
          } catch {
            // Intentar siguiente candidato personalizado
          }
        }
        return;
      }

      // 1. Vía rápida síncrona (0 ms): si el .glb dedicado ya está en caché, montarlo en el frame 0
      const cachedDedicated = getCachedDedicatedVehicleGLTF(vehicle.id);
      if (cachedDedicated) {
        attachModel(cachedDedicated.gltf, cachedDedicated.config);
        return;
      }

      // 2. Montaje progresivo instantáneo (< 3 ms): montar la carrocería 3D OEM fiel de inmediato
      // mientras el .glb definitivo se descarga con progreso real y reintentos controlados.
      attachFaithfulOemModel();

      try {
        const dedicated = await resolveDedicatedVehicleGLTF(vehicle.id, emitByteProgress);
        if (dedicated && !this.isDisposed) {
          mountCalibratedGlb(dedicated.gltf, dedicated.config);
        }
      } catch {
        // Conservar la carrocería 3D OEM fiel ya montada sin reiniciar carrera ni físicas
      }
    };

    void tryLoadSequence();
  }

  public updateState(
    distanceMeters: number,
    speedKmh: number,
    accelG: number,
    isBraking: boolean,
    _cameraPos: THREE.Vector3,
    _outOfFuel: boolean,
    steeringAngleRadians = 0,
    frameDeltaSeconds = 1/60,
    dynamicPose?: InteractiveVehiclePose,
  ) {
    const dtSafeForWheels = Math.max(0, Number.isFinite(frameDeltaSeconds) ? frameDeltaSeconds : 0);
    this.lastDistanceMeters = distanceMeters;

    // Integración exacta del desplazamiento periférico firmado de las 4 ruedas:
    // - Avance (v > 0): rotación positiva proporcional a velocidad real.
    // - Detenido (|v| < 0.015 m/s): rotación 0 (las ruedas se detienen por completo).
    // - Reversa (v < 0): rotación en sentido inverso proporcional a la velocidad de retroceso.
    // - Frenada fuerte / ABS / bloqueo: respuesta coherente con wheelLock y absActive del motor físico.
    if (dynamicPose && typeof dynamicPose.signedSpeedMps === 'number') {
      const signedV = dynamicPose.signedSpeedMps;
      if (Math.abs(signedV) < 0.015) {
        // Completamente detenido: 0 rotación residual
      } else {
        let brakeSlipFactor = 1.0;
        if (isBraking && (dynamicPose.wheelLock ?? 0) > 0.01) {
          brakeSlipFactor = 1 - THREE.MathUtils.clamp((dynamicPose.wheelLock ?? 0) * 0.88, 0, 0.90);
        } else if (isBraking && dynamicPose.absActive && (dynamicPose.brakeSlip ?? 0) > 0.02) {
          this.absModulationPhaseSec += dtSafeForWheels;
          const pulse = 0.26 + 0.18 * Math.sin(this.absModulationPhaseSec * 44);
          brakeSlipFactor = 1 - THREE.MathUtils.clamp((dynamicPose.brakeSlip ?? 0) * pulse, 0, 0.48);
        }
        this.accumulatedWheelTravelMeters += signedV * brakeSlipFactor * dtSafeForWheels;
      }
      this.prevRawDistanceMeters = distanceMeters;
      this.hasInitializedWheelDistance = true;
    } else if (!this.hasInitializedWheelDistance) {
      this.accumulatedWheelTravelMeters = distanceMeters;
      this.prevRawDistanceMeters = distanceMeters;
      this.hasInitializedWheelDistance = true;
    } else {
      const deltaDist = distanceMeters - this.prevRawDistanceMeters;
      if (Math.abs(speedKmh) >= 0.05 || Math.abs(deltaDist) >= 1e-4) {
        this.accumulatedWheelTravelMeters += deltaDist;
      }
      this.prevRawDistanceMeters = distanceMeters;
    }

    // El juego se mira desde -Z hacia +Z: pantalla derecha equivale a -X.
    // Convertir una vez el ángulo de entrada para sincronizar ruedas y carrocería.
    const worldSteerAngle = screenRightSteeringToWorldYaw(steeringAngleRadians);
    this.currentSteeringAngle = worldSteerAngle;
    this.wheelRig?.setDistanceMeters(this.accumulatedWheelTravelMeters);
    this.wheelRig?.setSteeringRadians(worldSteerAngle, dtSafeForWheels);
    if (dynamicPose?.suspension) {
      const s = dynamicPose.suspension;
      this.wheelRig?.setSuspensionContact(s.wheelRoadM, s.heaveM, s.pitchRad, s.rollRad, dtSafeForWheels);
    } else {
      this.wheelRig?.setSuspensionContact({ FL:0, FR:0, RL:0, RR:0 }, 0, 0, 0, dtSafeForWheels);
    }
    // 1. El eje Z mantiene la distancia oficial del motor físico. La
    // dirección del volante sí modifica la posición X y orientación del auto.
    // Mantener estas magnitudes desacopladas respeta tiempos y clasificación.
    const steerState = dynamicPose ? null : this.steeringDynamics.update(
      distanceMeters, speedKmh, worldSteerAngle, frameDeltaSeconds,
      this.laneX,
    );
    const drivenYaw = dynamicPose?.yaw ?? steerState?.yaw ?? 0;
    this.group.position.set(dynamicPose?.x ?? steerState?.x ?? this.laneX, 0, dynamicPose?.z ?? distanceMeters);
    this.group.rotation.y = drivenYaw;

    // 2. Dinámica de cabeceo de carrocería en VehicleEffects
    // Aceleración fuerte: la trompa sube suavemente (squat)
    // Frenada brusca: la trompa se clava adelante (dive)
    if (this.effectsGroup) {
      const suspension = dynamicPose?.suspension;
      const pitchTarget = (isBraking ? -0.024 : accelG > 0.15 && speedKmh < 100 ? 0.014 : 0) +
        (suspension?.pitchRad ?? 0);
      this.effectsGroup.rotation.x = THREE.MathUtils.damp(
        this.effectsGroup.rotation.x, pitchTarget, 10, Math.max(0, frameDeltaSeconds),
      );
      // Balanceo sutil en curvas, también independiente de la tasa de cuadros.
      const rollTarget = dynamicPose
        ? THREE.MathUtils.clamp(-this.group.rotation.y * 0.10 + dynamicPose.slip * Math.sign(worldSteerAngle) * 0.075, -0.09, 0.09)
        : THREE.MathUtils.clamp(-(steerState?.yaw ?? 0) * 0.11, -0.018, 0.018);
      const rollWithSuspension = THREE.MathUtils.clamp(rollTarget + (suspension?.rollRad ?? 0), -.14, .14);
      // El movimiento vertical NO se inventa con senos de distancia: se integra
      // en cuatro muelles amortiguados sobre la altura de cada neumático.
      this.effectsGroup.position.y = THREE.MathUtils.damp(
        this.effectsGroup.position.y,
        suspension?.heaveM ?? 0, 22, Math.max(0, frameDeltaSeconds),
      );
      this.effectsGroup.rotation.z = THREE.MathUtils.damp(
        this.effectsGroup.rotation.z, rollWithSuspension, 12, Math.max(0, frameDeltaSeconds),
      );
    }

    // 3. DOS luces de freno traseras simétricas incandescentes HDR al frenar + reflejo rojo en asfalto
    const dtSafe = Math.max(0, frameDeltaSeconds);
    this.brakeGlowLevel = THREE.MathUtils.damp(
      this.brakeGlowLevel,
      isBraking ? 1.0 : 0.0,
      isBraking ? 48 : 18,
      dtSafe,
    );

    const activeRearLights = this.headlightsIlluminateTrack ? 4.2 : 0.0;
    this.brakeLightLeft.intensity = this.brakeGlowLevel * activeRearLights;
    this.brakeLightRight.intensity = this.brakeGlowLevel * activeRearLights;

    if (this.brakeGlowLevel > 0.03) {
      const hdrR = THREE.MathUtils.lerp(0.75, 10.5, this.brakeGlowLevel);
      const hdrG = THREE.MathUtils.lerp(0.04, 0.08, this.brakeGlowLevel);
      const hdrB = THREE.MathUtils.lerp(0.03, 0.04, this.brakeGlowLevel);
      this.brakeLensMaterial.color.setRGB(hdrR, hdrG, hdrB);
      this.brakeLensMaterial.opacity = THREE.MathUtils.lerp(0.22, 1.0, this.brakeGlowLevel);
      this.brakeGlowMaterial.opacity = this.brakeGlowLevel * 0.96;
      this.brakeHaloLeft.visible = true;
      this.brakeHaloRight.visible = true;
      this.brakeRoadPoolMaterial.opacity = this.brakeGlowLevel * 0.58;
      this.brakeRoadPoolGroup.visible = true;
    } else {
      this.brakeLensMaterial.color.setRGB(0.55, 0.038, 0.028);
      this.brakeLensMaterial.opacity = 0.16;
      this.brakeGlowMaterial.opacity = 0;
      this.brakeHaloLeft.visible = false;
      this.brakeHaloRight.visible = false;
      this.brakeRoadPoolMaterial.opacity = 0;
      this.brakeRoadPoolGroup.visible = false;
    }

    this.faithfulBuild?.setBrakeLit(isBraking);
  }

  private applyLampAnchors(anchors: VehicleLampAnchors, hasProceduralLenses: boolean) {
    this.lampAnchors = anchors;
    this.hasProceduralLenses = hasProceduralLenses;
    const { frontLeft, frontRight, rearLeft, rearRight } = anchors;

    // Si el modelo procedural ya tiene lentes 3D en esas coordenadas, ocultar las lentes auxiliares superpuestas
    this.headlightLensLeft.visible = this.headlightsEnabled && !hasProceduralLenses;
    this.headlightLensRight.visible = this.headlightsEnabled && !hasProceduralLenses;
    this.brakeLensLeft.visible = !hasProceduralLenses;
    this.brakeLensRight.visible = !hasProceduralLenses;

    this.headlightLensLeft.position.set(frontLeft[0], frontLeft[1], frontLeft[2]);
    this.headlightLensLeft.rotation.y = -0.14;
    this.headlightLensRight.position.set(frontRight[0], frontRight[1], frontRight[2]);
    this.headlightLensRight.rotation.y = 0.14;

    this.headlightHaloLeft.position.set(frontLeft[0], frontLeft[1], frontLeft[2] + 0.035);
    this.headlightHaloRight.position.set(frontRight[0], frontRight[1], frontRight[2] + 0.035);

    this.headlightBeamLeft.position.set(frontLeft[0], frontLeft[1], frontLeft[2] + 0.02);
    this.headlightBeamLeft.target.position.set(frontLeft[0] * 1.18, 0.02, frontLeft[2] + 18.5);
    this.headlightBeamRight.position.set(frontRight[0], frontRight[1], frontRight[2] + 0.02);
    this.headlightBeamRight.target.position.set(frontRight[0] * 1.18, 0.02, frontRight[2] + 18.5);

    this.headlightRoadPoolLeft.position.set(frontLeft[0] * 1.06, 0.033, frontLeft[2] + 6.9);
    this.headlightRoadPoolRight.position.set(frontRight[0] * 1.06, 0.033, frontRight[2] + 6.9);

    this.brakeLensLeft.position.set(rearLeft[0], rearLeft[1], rearLeft[2]);
    this.brakeLensLeft.rotation.y = 0.20;
    this.brakeLensRight.position.set(rearRight[0], rearRight[1], rearRight[2]);
    this.brakeLensRight.rotation.y = -0.20;

    this.brakeHaloLeft.position.set(rearLeft[0], rearLeft[1], rearLeft[2] - 0.04);
    this.brakeHaloRight.position.set(rearRight[0], rearRight[1], rearRight[2] - 0.04);

    this.brakeLightLeft.position.set(rearLeft[0], rearLeft[1], rearLeft[2] - 0.18);
    this.brakeLightRight.position.set(rearRight[0], rearRight[1], rearRight[2] - 0.18);

    this.brakeRoadPoolLeft.position.set(rearLeft[0] * 1.14, 0.032, rearLeft[2] - 2.45);
    this.brakeRoadPoolRight.position.set(rearRight[0] * 1.14, 0.032, rearRight[2] - 2.45);

    // Anclar los 4 señaleros ámbar directamente al borde exterior de cada óptica real (sin planos flotantes)
    const fOutOffset = 0.074;
    const rOutOffset = 0.072;
    this.turnSignalFrontLeftLens.visible = !hasProceduralLenses;
    this.turnSignalRearLeftLens.visible = !hasProceduralLenses;
    this.turnSignalFrontRightLens.visible = !hasProceduralLenses;
    this.turnSignalRearRightLens.visible = !hasProceduralLenses;

    this.turnSignalFrontLeftLens.position.set(frontLeft[0] + fOutOffset, frontLeft[1] - 0.030, frontLeft[2] - 0.008);
    this.turnSignalFrontLeftLens.rotation.y = -0.22;
    this.turnSignalFrontLeftGlow.position.set(frontLeft[0] + fOutOffset, frontLeft[1] - 0.030, frontLeft[2] + 0.022);

    this.turnSignalFrontRightLens.position.set(frontRight[0] - fOutOffset, frontRight[1] - 0.030, frontRight[2] - 0.008);
    this.turnSignalFrontRightLens.rotation.y = 0.22;
    this.turnSignalFrontRightGlow.position.set(frontRight[0] - fOutOffset, frontRight[1] - 0.030, frontRight[2] + 0.022);

    this.turnSignalRearLeftLens.position.set(rearLeft[0] + rOutOffset, rearLeft[1] - 0.042, rearLeft[2] + 0.006);
    this.turnSignalRearLeftLens.rotation.y = 0.22;
    this.turnSignalRearLeftGlow.position.set(rearLeft[0] + rOutOffset, rearLeft[1] - 0.042, rearLeft[2] - 0.026);

    this.turnSignalRearRightLens.position.set(rearRight[0] - rOutOffset, rearRight[1] - 0.042, rearRight[2] + 0.006);
    this.turnSignalRearRightLens.rotation.y = -0.22;
    this.turnSignalRearRightGlow.position.set(rearRight[0] - rOutOffset, rearRight[1] - 0.042, rearRight[2] - 0.026);
  }

  public getWorldLampState(out: VehicleWorldLampState): boolean {
    this.effectsGroup.updateMatrixWorld(true);
    const { frontLeft, frontRight, rearLeft, rearRight } = this.lampAnchors;

    _localAnchorScratch.set(frontLeft[0], frontLeft[1], frontLeft[2]);
    out.headLeft.copy(_localAnchorScratch).applyMatrix4(this.effectsGroup.matrixWorld);

    _localAnchorScratch.set(frontRight[0], frontRight[1], frontRight[2]);
    out.headRight.copy(_localAnchorScratch).applyMatrix4(this.effectsGroup.matrixWorld);

    const sinY = Math.sin(this.group.rotation.y);
    const cosY = Math.cos(this.group.rotation.y);
    out.headDir.set(sinY, -0.085, cosY).normalize();
    out.headIntensity = this.headlightsEnabled ? 1.0 : 0.0;

    _localAnchorScratch.set(rearLeft[0], rearLeft[1], rearLeft[2]);
    out.brakeLeft.copy(_localAnchorScratch).applyMatrix4(this.effectsGroup.matrixWorld);

    _localAnchorScratch.set(rearRight[0], rearRight[1], rearRight[2]);
    out.brakeRight.copy(_localAnchorScratch).applyMatrix4(this.effectsGroup.matrixWorld);

    out.brakeIntensity = this.brakeGlowLevel;
    return true;
  }

  public getResolvedDimensionsM(): VehicleDimensionsM {
    return this.resolvedDimensionsM;
  }

  public getWheelRig(): VehicleWheelRig | null {
    return this.wheelRig;
  }

  /** Mantiene el rodamiento visible durante la toma final de 18 km/h. */
  public advanceFinishWheelRotation(additionalMeters: number) {
    if (!Number.isFinite(additionalMeters) || additionalMeters < 0) return;
    this.wheelRig?.setDistanceMeters(this.accumulatedWheelTravelMeters + additionalMeters);
  }

  public setNameplateVisible(visible: boolean) {
    this.nameplateSprite.visible = visible;
  }

  public setHeadlights(enabled: boolean, illuminateTrack: boolean, roadBeamScale = 1.0) {
    this.headlightsEnabled = enabled;
    this.headlightsIlluminateTrack = illuminateTrack;
    this.headlightRoadScale = THREE.MathUtils.clamp(roadBeamScale, 0, 1);

    // NUNCA alternar `.visible` sobre SpotLights ni su grupo contenedor: evita recompilación síncrona de shaders PBR
    this.headlightGroup.visible = true;
    this.headlightLensLeft.visible = enabled && !this.hasProceduralLenses;
    this.headlightLensRight.visible = enabled && !this.hasProceduralLenses;
    this.headlightHaloLeft.visible = enabled;
    this.headlightHaloRight.visible = enabled;
    this.faithfulBuild?.setHeadlightsLit(enabled);

    const beamIntensity =
      this.hasTrackHeadlightBeams && enabled && illuminateTrack && this.headlightRoadScale > 0.12
        ? 14 * this.headlightRoadScale
        : 0;
    this.headlightBeamLeft.intensity = beamIntensity;
    this.headlightBeamRight.intensity = beamIntensity;

    this.headlightRoadBeamGroup.visible = enabled && this.headlightRoadScale > 0.06;
    if (this.headlightRoadMat) {
      this.headlightRoadMat.opacity = 0.46 * this.headlightRoadScale;
    }
  }

  public setTurnSignals(leftLit: boolean, rightLit: boolean) {
    if (this.lastTurnLeftLit === leftLit && this.lastTurnRightLit === rightLit) {
      this.turnSignalLeftGroup.visible = leftLit;
      this.turnSignalRightGroup.visible = rightLit;
      return;
    }
    this.lastTurnLeftLit = leftLit;
    this.lastTurnRightLit = rightLit;
    this.turnSignalLeftGroup.visible = leftLit;
    this.turnSignalRightGroup.visible = rightLit;
    this.faithfulBuild?.setTurnSignalsLit(leftLit, rightLit);
    for (const mat of this.glbTurnSignalMatsLeft) {
      mat.emissive.setRGB(leftLit ? 4.8 : 0.04, leftLit ? 2.15 : 0.02, leftLit ? 0.08 : 0.005);
      mat.emissiveIntensity = leftLit ? 1.0 : 0.2;
    }
    for (const mat of this.glbTurnSignalMatsRight) {
      mat.emissive.setRGB(rightLit ? 4.8 : 0.04, rightLit ? 2.15 : 0.02, rightLit ? 0.08 : 0.005);
      mat.emissiveIntensity = rightLit ? 1.0 : 0.2;
    }
  }

  public dispose() {
    this.isDisposed = true;
    this.headlightGroup.traverse(obj => {
      if (obj instanceof THREE.Mesh) obj.geometry.dispose();
    });
    this.rearBrakeGroup.traverse(obj => {
      if (obj instanceof THREE.Mesh) obj.geometry.dispose();
    });
    this.headlightRoadBeamGroup.traverse(obj => {
      if (obj instanceof THREE.Mesh) obj.geometry.dispose();
    });
    this.brakeRoadPoolGroup.traverse(obj => {
      if (obj instanceof THREE.Mesh) obj.geometry.dispose();
    });
    this.turnSignalLeftGroup.traverse(obj => {
      if (obj instanceof THREE.Mesh) obj.geometry.dispose();
    });
    this.turnSignalRightGroup.traverse(obj => {
      if (obj instanceof THREE.Mesh) obj.geometry.dispose();
    });
    this.headlightLensMaterial.dispose();
    this.headlightGlowMaterial.dispose();
    this.headlightGlowTexture.dispose();
    (this.headlightRoadPoolLeft.material as THREE.Material).dispose();
    this.headlightRoadTexture.dispose();

    this.brakeLensMaterial.dispose();
    this.brakeGlowMaterial.dispose();
    this.brakeGlowTexture.dispose();
    this.brakeRoadPoolMaterial.dispose();

    this.turnSignalLensMaterial.dispose();
    this.turnSignalGlowMaterial.dispose();
    this.turnSignalGlowTexture.dispose();

    this.shadowMesh.geometry.dispose();
    (this.shadowMesh.material as THREE.Material).dispose();

    this.underglowMesh.geometry.dispose();
    (this.underglowMesh.material as THREE.Material).dispose();

    this.nameplateSprite.material.map?.dispose();
    this.nameplateSprite.material.dispose();

    this.wheelRig?.dispose?.();
    if (this.modelInstance) {
      this.modelInstance.userData.disposeMaterials?.();
      this.effectsGroup.remove(this.modelInstance);
    }
    this.faithfulBuild?.dispose();
  }
}

/**
 * Fábrica polimórfica que crea una entidad 3D GLB
 */
export function createVehicleEntity(
  vehicle: Vehicle,
  laneIndex: number,
  totalLanes: number,
  onGLBLoaded?: () => void,
  onGLBError?: (err: unknown) => void,
  envMap?: THREE.Texture | null,
  customLabel?: string,
  options?: VehicleEntityOptions,
): VehicleEntityRunner {
  const config = getVehicle3DConfig(vehicle.id);
  const targetLengthMeters = (vehicle.dimensions?.lengthMm || 4300) / 1000;
  if (config) {
    const effectiveConfig: Vehicle3DConfig = {
      ...config,
      identificationName: customLabel || config.identificationName,
      brandColor: customLabel ? '#00e5ff' : vehicle.color || config.brandColor,
      targetLengthMeters,
      scale: targetLengthMeters / 0.12,
    };
    return new Vehicle3DGLBEntity(vehicle, laneIndex, totalLanes, effectiveConfig, onGLBLoaded, onGLBError, envMap, options);
  }

  // Fallback seguro en caso de vehículo no registrado
  const defaultConfig: Vehicle3DConfig = {
    modelId: vehicle.id,
    name: vehicle.name,
    identificationName: customLabel || vehicle.name,
    brandColor: customLabel ? '#00e5ff' : vehicle.color || '#3b82f6',
    glbUrl: '/models/tracker-rs-wheels.glb',
    targetLengthMeters,
    scale: targetLengthMeters / 0.12,
    rotationY: Math.PI / 2,
    verticalOffset: 0,
    isUnifiedMesh: false,
    isProvisional3D: true,
  };
  return new Vehicle3DGLBEntity(vehicle, laneIndex, totalLanes, defaultConfig, onGLBLoaded, onGLBError, envMap, options);
}
