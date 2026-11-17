import * as THREE from 'three';
import { Vehicle } from '../types/vehicle';
import { 
  getCalibrationForVehicle, 
  getCalibratedFrameIndex, 
  getCalibratedRaceFrameUrl,
  getCalibratedFrameUrl 
} from './vehicle360Calibration';
import { createContactShadowTexture } from './race3dTextures';

// Cache global de texturas optimizadas en WebP con canal alfa
const raceTextureCache = new Map<string, THREE.Texture>();
const textureLoader = new THREE.TextureLoader();

/**
 * Carga o recupera de la caché una textura fotográfica transparente de carrera
 */
export function loadCachedRaceTexture(url: string, onLoad?: (tex: THREE.Texture) => void): THREE.Texture {
  if (raceTextureCache.has(url)) {
    const cached = raceTextureCache.get(url)!;
    if (onLoad) onLoad(cached);
    return cached;
  }

  const tex = textureLoader.load(
    url,
    (loaded) => {
      loaded.colorSpace = THREE.SRGBColorSpace;
      loaded.generateMipmaps = true;
      loaded.minFilter = THREE.LinearMipmapLinearFilter;
      loaded.magFilter = THREE.LinearFilter;
      raceTextureCache.set(url, loaded);
      if (onLoad) onLoad(loaded);
    },
    undefined,
    () => {
      // Fallback si el WebP aún está terminando de exportar
      const fallbackUrl = url.replace('360_race_frames', '360_frames').replace('.webp', '.jpg');
      textureLoader.load(fallbackUrl, (fallbackTex) => {
        fallbackTex.colorSpace = THREE.SRGBColorSpace;
        raceTextureCache.set(url, fallbackTex);
        if (onLoad) onLoad(fallbackTex);
      });
    }
  );

  tex.colorSpace = THREE.SRGBColorSpace;
  raceTextureCache.set(url, tex);
  return tex;
}

/**
 * Pre-carga los fotogramas clave de carrera (traseros, laterales y frontales)
 */
export function preloadKeyRaceFrames(vehicleId: string) {
  const calib = getCalibrationForVehicle(vehicleId);
  const keyIndices = [
    calib.rearFrameIndex,
    calib.rearFrameIndex - 2,
    calib.rearFrameIndex + 2,
    calib.rightSideFrameIndex,
    calib.leftSideFrameIndex,
    calib.frontFrameIndex,
  ];

  keyIndices.forEach((idx) => {
    const url = getCalibratedRaceFrameUrl(vehicleId, idx);
    loadCachedRaceTexture(url);
  });
}

/**
 * Representa una entidad de vehículo fotográfico 2.5D en el espacio 3D
 * con soporte de escala realista, sombra de contacto suave y cero residuos rectangulares.
 */
export class Vehicle3DSpriteEntity {
  public group: THREE.Group;
  public spriteMesh: THREE.Mesh;
  public shadowMesh: THREE.Mesh;
  public brakeLight: THREE.PointLight;
  public vehicle: Vehicle;
  public currentFrameIndex: number = -1;
  private material: THREE.MeshBasicMaterial;
  public laneX: number;

  constructor(vehicle: Vehicle, laneIndex: number, totalLanes: number) {
    this.vehicle = vehicle;
    this.group = new THREE.Group();

    const calib = getCalibrationForVehicle(vehicle.id);

    // Calcular posición X del carril (ancho de carril 3.6m)
    const laneWidth = 3.6;
    const centerOffset = ((totalLanes - 1) * laneWidth) / 2;
    this.laneX = laneIndex * laneWidth - centerOffset;
    this.group.position.x = this.laneX;

    // 1. Sombra de contacto suave en el pavimento (elíptica y suave, sin bordes rectangulares)
    const shadowGeo = new THREE.PlaneGeometry(calib.worldWidthMeters * 0.72, 3.2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: createContactShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.70,
    });
    this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowMesh.rotation.x = -Math.PI / 2;
    this.shadowMesh.position.set(0, 0.02, 0);
    this.group.add(this.shadowMesh);

    // 2. Luz de freno suave emitida desde la parte trasera del vehículo
    this.brakeLight = new THREE.PointLight('#ef4444', 0, 8);
    this.brakeLight.position.set(0, 0.9, -1.0);
    this.group.add(this.brakeLight);

    // 3. Malla del sprite del vehículo con proporción de aspecto original intacta
    const spriteGeo = new THREE.PlaneGeometry(calib.worldWidthMeters, calib.worldHeightMeters);
    this.material = new THREE.MeshBasicMaterial({
      transparent: true,
      alphaTest: 0.02,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.spriteMesh = new THREE.Mesh(spriteGeo, this.material);
    this.spriteMesh.position.y = calib.groundOffsetMeters;
    this.group.add(this.spriteMesh);

    // Cargar fotograma inicial trasero
    this.updateAngle(0);
    preloadKeyRaceFrames(vehicle.id);
  }

  /**
   * Actualiza el ángulo relativo de la cámara y selecciona el fotograma calibrado correspondiente
   */
  public updateAngle(relativeAngleDeg: number) {
    const frameIdx = getCalibratedFrameIndex(this.vehicle.id, relativeAngleDeg);
    if (frameIdx === this.currentFrameIndex) return;

    this.currentFrameIndex = frameIdx;
    const url = getCalibratedRaceFrameUrl(this.vehicle.id, frameIdx);

    loadCachedRaceTexture(url, (tex) => {
      this.material.map = tex;
      this.material.needsUpdate = true;
    });
  }

  /**
   * Sincroniza posición longitudinal (Z), rotación hacia la cámara y telemetría
   */
  public updateState(
    distanceMeters: number,
    speedKmh: number,
    isBraking: boolean,
    cameraPos: THREE.Vector3,
    outOfFuel: boolean
  ) {
    // Posición Z a lo largo de la pista (0m es largada)
    this.group.position.z = distanceMeters;

    // Calcular vector hacia la cámara en el plano XZ para determinar la orientación relativa
    const dx = cameraPos.x - this.group.position.x;
    const dz = cameraPos.z - this.group.position.z;

    // Dirección de vista:
    // dz < 0 (cámara detrás del auto): ángulo = 0° (vista trasera)
    // dx > 0 (cámara a la derecha): ángulo = 90° (perfil derecho)
    // dz > 0 (cámara delante del auto): ángulo = 180° (vista frontal)
    const viewAngleRad = Math.atan2(dx, -dz);
    let viewAngleDeg = (viewAngleRad * 180) / Math.PI;
    if (viewAngleDeg < 0) viewAngleDeg += 360;

    this.updateAngle(viewAngleDeg);

    // Orientar el plano del sprite suavemente hacia la cámara
    this.spriteMesh.rotation.y = Math.atan2(dx, dz);

    // Efecto de frenado incandescente en ópticas traseras
    if (isBraking) {
      this.brakeLight.intensity = THREE.MathUtils.lerp(this.brakeLight.intensity, 2.2, 0.2);
    } else {
      this.brakeLight.intensity = THREE.MathUtils.lerp(this.brakeLight.intensity, 0, 0.2);
    }
  }

  public dispose() {
    this.spriteMesh.geometry.dispose();
    this.material.dispose();
    this.shadowMesh.geometry.dispose();
    (this.shadowMesh.material as THREE.Material).dispose();
  }
}
