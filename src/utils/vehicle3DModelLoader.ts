import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface Vehicle3DConfig {
  modelId: string;
  name: string;
  identificationName: string;
  brandColor: string;
  glbUrl: string;
  scale: number;
  rotationY: number;
  verticalOffset: number; // Elevación para que las ruedas toquen exactamente el asfalto (y=0)
  isUnifiedMesh: boolean;  // Si la malla es unificada (generada por IA) o tiene piezas separadas
  isProvisional3D: boolean;
  blenderNotes?: string;
}

export const VEHICLE_3D_REGISTRY: Record<string, Vehicle3DConfig> = {

  // Carens NO tiene GLB propio en los recursos proporcionados. Se reutiliza su
  // sustituto 3D anterior (Tracker segmentada) hasta recibir un GLB Carens real.
  'chery-t4-pro-luxury-hev': {
    modelId:'chery-t4-pro-luxury-hev',name:'Chery T4 Pro Luxury HEV',identificationName:'CHERY T4 PRO HEV',
    brandColor:'#b7c2c6',glbUrl:'/models/tracker-rs-wheels.glb',scale:4.32/.12,
    rotationY:Math.PI/2,verticalOffset:0,isUnifiedMesh:false,isProvisional3D:true,
    blenderNotes:'Sin GLB Chery: utiliza el mismo 3D provisional que Carens, que actualmente es Tracker RS. Física propia híbrida.'
  },
  'chery-t2-pro-max': {
    modelId:'chery-t2-pro-max',name:'Chery T2 Pro Max',identificationName:'CHERY T2 PRO MAX',
    brandColor:'#ef4444',glbUrl:'/models/tracker-rs-wheels.glb',scale:4.20/.12,
    rotationY:Math.PI/2,verticalOffset:0,isUnifiedMesh:false,isProvisional3D:true,
    blenderNotes:'Sin GLB Chery: utiliza sustituto de Carens (Tracker RS). Potencia y torque de simulación, no oficiales.'
  },
  'suzuki-fronx': {
    modelId:'suzuki-fronx',name:'Suzuki Fronx',identificationName:'SUZUKI FRONX',
    brandColor:'#f97316',glbUrl:'/models/tracker-rs-wheels.glb',scale:3.995/.12,
    rotationY:Math.PI/2,verticalOffset:0,isUnifiedMesh:false,isProvisional3D:true,
    blenderNotes:'Sin GLB Fronx: utiliza sustituto de Carens (Tracker RS). Mild hybrid simulado independientemente.'
  },

  'toyota-corolla-cross-seg-2027': {
    modelId: 'toyota-corolla-cross-seg-2027',
    name: 'Toyota Corolla Cross SEG 2027',
    identificationName: 'TOYOTA COROLLA CROSS',
    brandColor: '#e5e7eb',
    glbUrl: '/models/toyota-corolla-cross-seg-2027.glb',
    // La longitud X del Meshy es 0,12 unidades y la ficha indica 4,46 m.
    scale: 4.46 / 0.12,
    rotationY: Math.PI / 2,
    verticalOffset: 0,
    isUnifiedMesh: false,
    isProvisional3D: false,
    blenderNotes: 'GLB de Meshy con 8 mallas: carrocería y 7 subpiezas agrupadas en cuatro ruedas animables por Three.js.',
  },
  'nissan-kicks-2027': {
    modelId: 'nissan-kicks-2027',
    name: 'Nissan Kicks',
    identificationName: 'NISSAN KICKS',
    brandColor: '#eab308', // Amarillo dorado característico
    glbUrl: '/models/tracker-rs-wheels.glb', // Geometría provisional compartida
    scale: 4.27 / 0.12,
    rotationY: Math.PI / 2,
    verticalOffset: 0,
    isUnifiedMesh: false,
    isProvisional3D: true,
    blenderNotes: 'Modelo 3D provisional basado en carrocería Tracker RS. Conserva ficha física y telemetría 100% propia de Kicks.',
  },
  'kia-carens-ex': {
    modelId: 'kia-carens-ex',
    name: 'Kia Carens',
    identificationName: 'KIA CARENS',
    brandColor: '#06b6d4', // Celeste vibrante característico
    glbUrl: '/models/tracker-rs-wheels.glb', // Geometría provisional compartida
    // La ficha cargada de Carens registra 4.540 mm de largo; el sustituto Tracker
    // mide 0,12 unidades locales. La carrocería continúa siendo PROVISIONAL.
    scale: 4.54 / 0.12,
    rotationY: Math.PI / 2,
    verticalOffset: 0,
    isUnifiedMesh: false,
    isProvisional3D: true,
    blenderNotes: 'Sustituto Tracker RS escalado longitudinalmente a 4,54 m según ficha cargada. NO reproduce la silueta ni altura exacta de Carens.',
  },
  'chevrolet-tracker-lite': {
    modelId: 'chevrolet-tracker-lite',
    name: 'Chevrolet Tracker (malla RS provisional)',
    identificationName: 'CHEVROLET TRACKER',
    brandColor: '#3b82f6', // Azul eléctrico oficial
    glbUrl: '/models/tracker-rs-wheels.glb',
    scale: 4.27 / 0.12,
    rotationY: Math.PI / 2,
    verticalOffset: 0,
    isUnifiedMesh: false,
    isProvisional3D: false,
    blenderNotes: 'Modelo nativo de Chevrolet Tracker RS generado en Meshy.',
  },
};

/**
 * Comprueba si un vehículo tiene un modelo 3D GLB registrado
 */
export function hasVehicle3DModel(vehicleId: string): boolean {
  return vehicleId in VEHICLE_3D_REGISTRY;
}

export function getVehicle3DConfig(vehicleId: string): Vehicle3DConfig | undefined {
  return VEHICLE_3D_REGISTRY[vehicleId];
}

// Caché global de modelos GLTF parseados en memoria para evitar re-descargas
const gltfCache = new Map<string, GLTF>();
const loadingPromises = new Map<string, Promise<GLTF>>();

/**
 * Carga asíncrona y en caché de un modelo GLB mediante GLTFLoader
 */
export async function loadVehicleGLTF(
  url: string,
  onProgress?: (loadedBytes: number, totalBytes: number) => void
): Promise<GLTF> {
  if (gltfCache.has(url)) {
    return gltfCache.get(url)!;
  }

  if (loadingPromises.has(url)) {
    return loadingPromises.get(url)!;
  }

  const promise = new Promise<GLTF>((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        // Optimizar materiales y sombras
        gltf.scene.traverse((node) => {
          if ((node as THREE.Mesh).isMesh) {
            const mesh = node as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

          }
        });

        gltfCache.set(url, gltf);
        loadingPromises.delete(url);
        resolve(gltf);
      },
      (xhr) => {
        if (onProgress && xhr.total > 0) {
          onProgress(xhr.loaded, xhr.total);
        }
      },
      (error) => {
        loadingPromises.delete(url);
        console.error(`[Vehicle3DLoader] Error cargando modelo GLB desde ${url}:`, error);
        reject(error);
      }
    );
  });

  loadingPromises.set(url, promise);
  return promise;
}

/**
 * Clona una instancia del modelo 3D calibrado listo para colocar en la escena
 */
export function createCalibratedVehicle3DInstance(config: Vehicle3DConfig, gltf: GLTF): THREE.Group {
  const container = new THREE.Group();
  container.name = `vehicle_3d_${config.modelId}`;

  // Clonar la jerarquía de nodos de la escena
  const model = gltf.scene.clone(true);

  // Conservar los materiales PBR/texturas originales: la identificación de Kicks,
  // Carens y Tracker se muestra en las etiquetas, no tiñendo la carrocería.
  // GLTFLoader comparte la geometría en memoria; cada escena clonada tiene sus
  // propios nodos, para animar ruedas independientemente.

  // Aplicar escala física calibrada (4.27m)
  model.scale.set(config.scale, config.scale, config.scale);

  // Aplicar rotación para orientar el frente hacia +Z
  model.rotation.y = config.rotationY;

  // Elevar el modelo para que los neumáticos toquen exactamente el asfalto (y=0)
  model.position.y = config.verticalOffset;

  container.add(model);
  return container;
}

