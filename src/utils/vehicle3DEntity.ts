import * as THREE from 'three';
import { Vehicle } from '../types/vehicle';
import { 
  getVehicle3DConfig, 
  loadVehicleGLTF, 
  resolveDedicatedVehicleGLTF,
  createCalibratedVehicle3DInstance,
  Vehicle3DConfig,
  GENERIC_CUSTOM_CAR_GLB_URL,
  getCustomVehicleGlbUrl,
} from './vehicle3DModelLoader';
import { createContactShadowTexture } from './race3dTextures';
import { createVehicleWheelRig, VehicleWheelRig } from './vehicleWheelRig';
import { VehicleSteeringDynamics } from './vehicleSteeringDynamics';
import { screenRightSteeringToWorldYaw } from './cinematicDirector';
import {
  createFaithfulVehicle3D,
  type FaithfulVehicleBuildResult,
} from './faithfulVehicleChassis3D';
import { getFaithfulVehicleSpec } from './faithfulVehicleSpecs';

export interface InteractiveVehiclePose {
  x: number;
  z: number;
  yaw: number;
  slip: number;
  bump: number;
  suspension?: { heaveM: number; pitchRad: number; rollRad: number; wheelRoadM: { FL: number; FR: number; RL: number; RR: number }; impact: number };
}

export interface VehicleEntityOptions {
  preferProceduralModel?: boolean;
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
  setHeadlights: (enabled: boolean, illuminateTrack: boolean) => void;
  setTurnSignals?: (leftLit: boolean, rightLit: boolean) => void;
  setNameplateVisible: (visible: boolean) => void;
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

/** Halo de LED pequeño y difuso: NO genera rectángulos blancos flotantes. */
function createHeadlightGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(32, 32, 3, 32, 32, 31);
    gradient.addColorStop(0, 'rgba(235,246,255,.88)');
    gradient.addColorStop(0.16, 'rgba(195,224,255,.48)');
    gradient.addColorStop(0.56, 'rgba(130,175,235,.10)');
    gradient.addColorStop(1, 'rgba(90,150,220,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(canvas);
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
  private brakeLight: THREE.PointLight;
  private config: Vehicle3DConfig;
  private steeringDynamics = new VehicleSteeringDynamics();
  private headlightGroup = new THREE.Group();
  private headlightBeam: THREE.SpotLight;
  private headlightGlowTexture: THREE.CanvasTexture;
  private headlightGlowMaterial: THREE.SpriteMaterial;
  private headlightRoadPool: THREE.Mesh;
  private headlightRoadTexture: THREE.CanvasTexture;
  private turnSignalLeftGroup = new THREE.Group();
  private turnSignalRightGroup = new THREE.Group();
  private turnSignalLensMaterial: THREE.MeshStandardMaterial;
  private turnSignalGlowTexture: THREE.CanvasTexture;
  private turnSignalGlowMaterial: THREE.SpriteMaterial;
  private isLoaded: boolean = false;
  private isDisposed: boolean = false;
  private envMap?: THREE.Texture | null;

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

    // 6. Luz de freno roja en las ópticas traseras (sin placas cuadradas pegadas al baúl)
    const oemSpec = getFaithfulVehicleSpec(vehicle);
    const halfLength = oemSpec.lengthM * 0.5;
    const halfWidth = oemSpec.widthM * 0.44;
    const frontLampY = Math.max(0.68, oemSpec.heightM * 0.49);
    const rearLampY = Math.max(0.76, oemSpec.heightM * 0.56);

    this.brakeLight = new THREE.PointLight('#ef4444', 0, 8);
    this.brakeLight.position.set(0, rearLampY, -(halfLength + 0.08));
    this.effectsGroup.add(this.brakeLight);

    // 7. Halos ópticos suaves calibrados a la altura real de los faros de cada modelo
    this.headlightGroup.name = `faros_${vehicle.id}`;
    this.headlightGlowTexture = createHeadlightGlowTexture();
    this.headlightGlowMaterial = new THREE.SpriteMaterial({
      map: this.headlightGlowTexture,
      color: '#e0f2fe',
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.44,
    });
    const lampOffsetX = oemSpec.widthM * 0.36;
    for (const x of [-lampOffsetX, lampOffsetX]) {
      const halo = new THREE.Sprite(this.headlightGlowMaterial);
      halo.position.set(x, frontLampY, halfLength + 0.04);
      halo.scale.set(0.42, 0.24, 1);
      this.headlightGroup.add(halo);
    }
    this.headlightBeam = new THREE.SpotLight('#d9e8ff', 14, 28, 0.42, 0.97, 2);
    this.headlightBeam.name = `haz_faroles_${vehicle.id}`;
    this.headlightBeam.position.set(0, frontLampY, halfLength - 0.04);
    this.headlightBeam.target.position.set(0, 0.04, 17);
    this.headlightBeam.castShadow = false;
    this.headlightGroup.add(this.headlightBeam, this.headlightBeam.target);
    this.effectsGroup.add(this.headlightGroup);

    // Un degradado de luz de muy baja opacidad sobre el asfalto elimina
    // el borde rígido de los círculos blancos, sin pases de render adicionales.
    this.headlightRoadTexture = createSoftRoadBeamTexture();
    this.headlightRoadPool = new THREE.Mesh(
      new THREE.PlaneGeometry(5.0, 13.0),
      new THREE.MeshBasicMaterial({
        map: this.headlightRoadTexture,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    this.headlightRoadPool.name = `iluminacion_asfalto_${vehicle.id}`;
    this.headlightRoadPool.rotation.x = -Math.PI / 2;
    this.headlightRoadPool.position.set(0, 0.033, 8.2);
    this.group.add(this.headlightRoadPool);
    this.setHeadlights(true, false);

    // 7b. Señaleros / indicadores de giro ámbar (delanteros y traseros):
    // En avance hacia +Z, +X corresponde al lado izquierdo del conductor y -X al lado derecho.
    this.turnSignalLensMaterial = new THREE.MeshStandardMaterial({
      color: '#fbbf24',
      emissive: '#f59e0b',
      emissiveIntensity: 2.6,
      roughness: 0.25,
      metalness: 0.05,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const tsCanvas = document.createElement('canvas');
    tsCanvas.width = tsCanvas.height = 64;
    const tsCtx = tsCanvas.getContext('2d');
    if (tsCtx) {
      const tsGrad = tsCtx.createRadialGradient(32, 32, 3, 32, 32, 30);
      tsGrad.addColorStop(0, 'rgba(255, 208, 70, 0.95)');
      tsGrad.addColorStop(0.32, 'rgba(245, 158, 11, 0.55)');
      tsGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
      tsCtx.fillStyle = tsGrad;
      tsCtx.fillRect(0, 0, 64, 64);
    }
    this.turnSignalGlowTexture = new THREE.CanvasTexture(tsCanvas);
    this.turnSignalGlowMaterial = new THREE.SpriteMaterial({
      map: this.turnSignalGlowTexture,
      color: '#fbbf24',
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.88,
    });

    const attachSignalSide = (targetGroup: THREE.Group, sideX: number) => {
      for (const zPos of [halfLength - 0.04, -(halfLength - 0.04)]) {
        const yPos = zPos > 0 ? frontLampY : rearLampY;
        const bar = new THREE.Mesh(
          new THREE.PlaneGeometry(0.14, 0.042),
          this.turnSignalLensMaterial,
        );
        bar.position.set(sideX, yPos, zPos);
        if (zPos < 0) bar.rotation.y = Math.PI;
        targetGroup.add(bar);

        const glow = new THREE.Sprite(this.turnSignalGlowMaterial);
        glow.position.set(sideX * 1.02, yPos, zPos + (zPos > 0 ? 0.03 : -0.03));
        glow.scale.set(0.30, 0.18, 1);
        targetGroup.add(glow);
      }
      targetGroup.visible = false;
      this.effectsGroup.add(targetGroup);
    };
    this.turnSignalLeftGroup.name = `senalero_izq_${vehicle.id}`;
    this.turnSignalRightGroup.name = `senalero_der_${vehicle.id}`;
    attachSignalSide(this.turnSignalLeftGroup, halfWidth);
    attachSignalSide(this.turnSignalRightGroup, -halfWidth);

    // 8. Cargar modelo 3D GLB propio del vehículo; si ese modelo aún no posee GLB dedicado,
    // renderizar su carrocería 3D OEM fiel (geometría, pintura bicolor, parrilla, DRL y 4 ruedas)
    // en lugar de clonar otro vehículo distinto.
    const targetLengthMeters = oemSpec.lengthM;

    const attachModel = (gltf: any, activeConfig: Vehicle3DConfig) => {
      if (this.isDisposed) return;
      this.modelInstance = createCalibratedVehicle3DInstance(
        { ...activeConfig, targetLengthMeters },
        gltf,
        this.envMap,
      );
      const calibratedModel = this.modelInstance.children[0] as THREE.Group;
      this.wheelRig = createVehicleWheelRig(calibratedModel, calibratedModel.scale.x);
      this.wheelRig?.setDistanceMeters(this.lastDistanceMeters);
      this.wheelRig?.setSteeringRadians(this.currentSteeringAngle, 1);
      this.effectsGroup.add(this.modelInstance);
      this.isLoaded = true;
      if (onLoaded) onLoaded();
    };

    const attachFaithfulOemModel = () => {
      if (this.isDisposed) return;
      const built = createFaithfulVehicle3D(vehicle, this.envMap);
      this.faithfulBuild = built;
      this.modelInstance = built.group;
      this.wheelRig = built.wheelRig;
      this.wheelRig.setDistanceMeters(this.lastDistanceMeters);
      this.wheelRig.setSteeringRadians(this.currentSteeringAngle, 1);
      this.effectsGroup.add(built.group);
      this.usesProceduralModel = true;
      this.isLoaded = true;
      if (onLoaded) onLoaded();
    };

    const tryLoadSequence = async () => {
      if (options?.preferProceduralModel) {
        attachFaithfulOemModel();
        return;
      }

      if (vehicle.isCustom) {
        const customUrls = [
          ...(getCustomVehicleGlbUrl(vehicle.id) ? [getCustomVehicleGlbUrl(vehicle.id)!] : []),
          GENERIC_CUSTOM_CAR_GLB_URL,
        ];
        for (const url of customUrls) {
          try {
            const gltf = await loadVehicleGLTF(url);
            attachModel(gltf, { ...config, glbUrl: url, isProvisional3D: false });
            return;
          } catch {
            // Intentar siguiente candidato personalizado
          }
        }
        attachFaithfulOemModel();
        return;
      }

      try {
        const dedicated = await resolveDedicatedVehicleGLTF(vehicle.id);
        if (dedicated) {
          attachModel(dedicated.gltf, dedicated.config);
          return;
        }
      } catch {
        // Respaldo OEM inmediato
      }

      attachFaithfulOemModel();
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
    this.lastDistanceMeters = distanceMeters;
    // El juego se mira desde -Z hacia +Z: pantalla derecha equivale a -X.
    // Convertir una vez el ángulo de entrada para sincronizar ruedas y carrocería.
    const worldSteerAngle = screenRightSteeringToWorldYaw(steeringAngleRadians);
    this.currentSteeringAngle = worldSteerAngle;
    this.wheelRig?.setDistanceMeters(distanceMeters);
    this.wheelRig?.setSteeringRadians(worldSteerAngle, frameDeltaSeconds);
    if (dynamicPose?.suspension) {
      const s = dynamicPose.suspension;
      this.wheelRig?.setSuspensionContact(s.wheelRoadM, s.heaveM, s.pitchRad, s.rollRad, frameDeltaSeconds);
    } else {
      this.wheelRig?.setSuspensionContact({ FL:0, FR:0, RL:0, RR:0 }, 0, 0, 0, frameDeltaSeconds);
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

    // 3. Luces de freno incandescentes al desacelerar
    this.brakeLight.intensity = THREE.MathUtils.damp(
      this.brakeLight.intensity, isBraking ? 3.2 : 0,
      12, Math.max(0, frameDeltaSeconds),
    );
    this.faithfulBuild?.setBrakeLit(isBraking);
  }

  /** Mantiene el rodamiento visible durante la toma final de 18 km/h. */
  public advanceFinishWheelRotation(additionalMeters: number) {
    if (!Number.isFinite(additionalMeters) || additionalMeters < 0) return;
    // updateState() restablece la distancia física cada frame. Aplicamos el
    // avance cinematográfico después, sin acumularlo dos veces.
    this.wheelRig?.setDistanceMeters(this.lastDistanceMeters + additionalMeters);
  }

  public setNameplateVisible(visible: boolean) {
    this.nameplateSprite.visible = visible;
  }

  public setHeadlights(enabled: boolean, illuminateTrack: boolean) {
    this.headlightGroup.visible = enabled;
    this.headlightBeam.visible = enabled && illuminateTrack;
    this.headlightRoadPool.visible = enabled && illuminateTrack;
  }

  public setTurnSignals(leftLit: boolean, rightLit: boolean) {
    this.turnSignalLeftGroup.visible = leftLit;
    this.turnSignalRightGroup.visible = rightLit;
  }

  public dispose() {
    this.isDisposed = true;
    this.headlightGroup.traverse(obj => {
      if (obj instanceof THREE.Mesh) obj.geometry.dispose();
    });
    this.turnSignalLeftGroup.traverse(obj => {
      if (obj instanceof THREE.Mesh) obj.geometry.dispose();
    });
    this.turnSignalRightGroup.traverse(obj => {
      if (obj instanceof THREE.Mesh) obj.geometry.dispose();
    });
    this.headlightGlowMaterial.dispose();
    this.headlightGlowTexture.dispose();
    this.turnSignalLensMaterial.dispose();
    this.turnSignalGlowMaterial.dispose();
    this.turnSignalGlowTexture.dispose();
    this.headlightRoadPool.geometry.dispose();
    (this.headlightRoadPool.material as THREE.Material).dispose();
    this.headlightRoadTexture.dispose();
    this.shadowMesh.geometry.dispose();
    (this.shadowMesh.material as THREE.Material).dispose();

    this.underglowMesh.geometry.dispose();
    (this.underglowMesh.material as THREE.Material).dispose();

    this.nameplateSprite.material.map?.dispose();
    this.nameplateSprite.material.dispose();

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
