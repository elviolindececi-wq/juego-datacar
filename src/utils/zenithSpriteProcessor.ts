/**
 * Cargador y procesador de sprites cenitales realistas para la pista de carreras.
 * Utiliza directamente los PNGs de alta fidelidad con transparencia natural (alpha),
 * sin recortes forzados, sin tintes artificiales y sin bordes falsos.
 */

export interface CachedSprite {
  image: HTMLImageElement;
  canvas: HTMLImageElement | HTMLCanvasElement;
  width: number;
  height: number;
  aspectRatio: number;
}

const spriteCache = new Map<string, CachedSprite>();
const loadingPromises = new Map<string, Promise<CachedSprite | null>>();

export function getCleanZenithSprite(
  vehicleId: string,
  imageSrc: string,
  _colorHex?: string,
  onLoaded?: () => void
): CachedSprite | null {
  if (!imageSrc) return null;

  const cacheKey = `${vehicleId}-${imageSrc}`;
  if (spriteCache.has(cacheKey)) {
    return spriteCache.get(cacheKey)!;
  }

  if (loadingPromises.has(cacheKey)) {
    return null;
  }

  const promise = new Promise<CachedSprite | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;

    const handleSuccess = () => {
      const origW = img.naturalWidth || img.width || 1200;
      const origH = img.naturalHeight || img.height || 600;

      const result: CachedSprite = {
        image: img,
        canvas: img,
        width: origW,
        height: origH,
        aspectRatio: origW / Math.max(1, origH),
      };

      spriteCache.set(cacheKey, result);
      resolve(result);
      if (onLoaded) onLoaded();
    };

    if (img.complete && img.naturalWidth > 0) {
      handleSuccess();
    } else {
      img.onload = handleSuccess;
      img.onerror = () => {
        resolve(null);
      };
    }
  });

  loadingPromises.set(cacheKey, promise);
  return null;
}
