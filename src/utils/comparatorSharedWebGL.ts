import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// Garantizar caché global activa de Three.js para geometrías, buffers y texturas en toda la app
THREE.Cache.enabled = true;

export interface SharedUiWebGLBundle {
  renderer: THREE.WebGLRenderer;
  envMap: THREE.Texture;
  isSoftwareRenderer: boolean;
}

let sharedBundle: SharedUiWebGLBundle | null = null;
const downscaledTextureCache = new Map<string, THREE.Texture>();

function detectSoftwareRenderer(renderer: THREE.WebGLRenderer): boolean {
  try {
    const gl = renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const name = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    return /SwiftShader|Software|llvmpipe|Mesa OffScreen/i.test(name);
  } catch {
    return false;
  }
}

/**
 * Devuelve una única instancia reutilizable de `THREE.WebGLRenderer` + `envMap`
 * para el Comparador y el Showroom 360°, evitando crear y destruir múltiples contextos
 * WebGL al cambiar o comparar vehículos en mobile.
 */
export function acquireSharedComparatorRenderer(): SharedUiWebGLBundle | null {
  if (sharedBundle) {
    try {
      const ctx = sharedBundle.renderer.getContext();
      if (ctx && !ctx.isContextLost()) {
        return sharedBundle;
      }
    } catch {
      sharedBundle = null;
    }
  }

  try {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.24;

    const isSoftwareRenderer = detectSoftwareRenderer(renderer);
    renderer.shadowMap.enabled = false; // El comparador usa sombras de contacto suaves ultrarrápidas

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    const envMap = envTarget.texture;
    roomEnv.dispose();
    pmrem.dispose();

    sharedBundle = {
      renderer,
      envMap,
      isSoftwareRenderer,
    };
    return sharedBundle;
  } catch {
    return null;
  }
}

/**
 * Calcula las dimensiones reducidas manteniendo la relación de aspecto para texturas de UI.
 */
export function computeDownscaledDimensions(
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number; scaled: boolean } {
  const safeMax = Math.max(64, Math.floor(maxDimension));
  if (width <= safeMax && height <= safeMax) {
    return { width, height, scaled: false };
  }
  const ratio = safeMax / Math.max(width, height);
  return {
    width: Math.max(32, Math.round(width * ratio)),
    height: Math.max(32, Math.round(height * ratio)),
    scaled: true,
  };
}

function downscaleSingleTexture(tex: THREE.Texture, maxDimension: number): THREE.Texture {
  const cacheKey = `${tex.uuid}:${maxDimension}`;
  const cached = downscaledTextureCache.get(cacheKey);
  if (cached) return cached;

  const img = tex.image as
    | (HTMLImageElement | HTMLCanvasElement | ImageBitmap | { width?: number; height?: number })
    | undefined;
  const w = Number(img?.width ?? 0);
  const h = Number(img?.height ?? 0);
  if (!img || !w || !h || typeof document === 'undefined') {
    return tex;
  }

  const target = computeDownscaledDimensions(w, h, maxDimension);
  if (!target.scaled) {
    return tex;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return tex;
    ctx.drawImage(img as CanvasImageSource, 0, 0, target.width, target.height);

    const lightTex = new THREE.CanvasTexture(canvas);
    lightTex.colorSpace = tex.colorSpace;
    lightTex.wrapS = tex.wrapS;
    lightTex.wrapT = tex.wrapT;
    lightTex.repeat.copy(tex.repeat);
    lightTex.offset.copy(tex.offset);
    lightTex.center.copy(tex.center);
    lightTex.rotation = tex.rotation;
    lightTex.flipY = tex.flipY;
    lightTex.generateMipmaps = true;
    lightTex.minFilter = THREE.LinearMipmapLinearFilter;
    lightTex.magFilter = THREE.LinearFilter;
    lightTex.needsUpdate = true;

    downscaledTextureCache.set(cacheKey, lightTex);
    return lightTex;
  } catch {
    return tex;
  }
}

/**
 * Optimiza las texturas de un clon 3D exclusivamente para la vista del Comparador / Showroom,
 * reduciendo mapas pesados (ej. 2048px -> 512px en mobile) sin mutar los materiales originales de carrera.
 */
export function optimizeModelTexturesForComparator(
  modelRoot: THREE.Object3D,
  maxDimension = 512,
): void {
  const mapKeys = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap'] as const;

  modelRoot.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;

    const processMaterial = (mat: THREE.Material): THREE.Material => {
      const anyMat = mat as unknown as Record<string, unknown>;
      let needsClone = false;

      for (const key of mapKeys) {
        const tex = anyMat[key] as THREE.Texture | undefined;
        if (tex && tex.isTexture && tex.image) {
          const w = Number((tex.image as { width?: number }).width ?? 0);
          const h = Number((tex.image as { height?: number }).height ?? 0);
          if (w > maxDimension || h > maxDimension) {
            needsClone = true;
            break;
          }
        }
      }

      if (!needsClone) return mat;

      const clonedMat = mat.clone();
      const clonedRec = clonedMat as unknown as Record<string, unknown>;
      for (const key of mapKeys) {
        const tex = clonedRec[key] as THREE.Texture | undefined;
        if (tex && tex.isTexture) {
          clonedRec[key] = downscaleSingleTexture(tex, maxDimension);
        }
      }
      clonedMat.needsUpdate = true;
      return clonedMat;
    };

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(processMaterial);
    } else {
      mesh.material = processMaterial(mesh.material);
    }
  });
}
