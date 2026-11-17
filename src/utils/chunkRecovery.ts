/**
 * Recuperación automática frente a despliegues nuevos en Vercel / CDN cuando el navegador
 * conserva un `index.html` anterior y un chunk dinámico `.js` o `.css` devuelve 404.
 */

const CHUNK_RELOAD_STORAGE_KEY = 'datacar_chunk_reload_ts_v1';
const CHUNK_RELOAD_COOLDOWN_MS = 20_000;

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === 'string'
        ? error
        : JSON.stringify(error);
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|ChunkLoadError|Loading chunk [\w-]+ failed/i.test(
    message,
  );
}

export function reloadForNewDeploymentOnce(storage?: Pick<Storage, 'getItem' | 'setItem'>): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const store = storage ?? window.sessionStorage;
    const now = Date.now();
    const lastReloadRaw = store.getItem(CHUNK_RELOAD_STORAGE_KEY);
    const lastReloadTs = lastReloadRaw ? Number(lastReloadRaw) : 0;
    if (Number.isFinite(lastReloadTs) && lastReloadTs > 0 && now - lastReloadTs < CHUNK_RELOAD_COOLDOWN_MS) {
      return false;
    }
    store.setItem(CHUNK_RELOAD_STORAGE_KEY, String(now));
    const url = new URL(window.location.href);
    url.searchParams.set('v', String(now));
    window.location.replace(url.toString());
    return true;
  } catch {
    return false;
  }
}

export async function retryDynamicImport<T>(importer: () => Promise<T>): Promise<T> {
  try {
    return await importer();
  } catch (firstErr) {
    // Reintento breve por micro-corte móvil antes de recargar versión
    await new Promise((resolve) => setTimeout(resolve, 220));
    try {
      return await importer();
    } catch (secondErr) {
      if (isChunkLoadError(secondErr)) {
        const reloading = reloadForNewDeploymentOnce();
        if (reloading) {
          // Mantener Suspense en espera mientras el navegador navega a la versión fresca
          return await new Promise<T>(() => {});
        }
      }
      throw secondErr;
    }
  }
}

let globalRecoveryInstalled = false;

export function installGlobalChunkErrorRecovery(): void {
  if (globalRecoveryInstalled || typeof window === 'undefined') return;
  globalRecoveryInstalled = true;

  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    reloadForNewDeploymentOnce();
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason)) {
      const triggered = reloadForNewDeploymentOnce();
      if (triggered) {
        event.preventDefault();
      }
    }
  });
}
