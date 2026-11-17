import { useSyncExternalStore } from 'react';

export type OrientationFallbackMode = 'none' | 'native-landscape' | 'css-rotate-90';

export interface OrientationControllerState {
  /** Si se activó la rotación por software CSS (`transform: rotate(90deg)`) al fallar el bloqueo nativo en iOS/móvil. */
  softwareRotated: boolean;
  /** Modo activo de orientación horizontal. */
  mode: OrientationFallbackMode;
  /** Si debemos mostrar el aviso amigable para iOS/bloqueo vertical físico. */
  showIosUnlockHint: boolean;
  /** Mensaje explicativo actual para el usuario. */
  hintMessage: string;
}

export interface OrientationEnvironmentAdapter {
  isPortraitViewport: () => boolean;
  requestFullscreen: () => Promise<boolean>;
  lockLandscape: () => Promise<boolean>;
}

const IOS_FALLBACK_HINT =
  'Modo horizontal activado en pantalla (90°). Si preferís giro nativo en iPhone/iOS, desactivá el bloqueo vertical en Centro de Control y girá tu dispositivo.';

let currentState: OrientationControllerState = {
  softwareRotated: false,
  mode: 'none',
  showIosUnlockHint: false,
  hintMessage: '',
};

const listeners = new Set<() => void>();

function emitChange(): void {
  if (typeof document !== 'undefined') {
    if (currentState.softwareRotated) {
      document.documentElement.dataset.forcedLandscape = 'true';
    } else {
      delete document.documentElement.dataset.forcedLandscape;
    }
  }
  listeners.forEach((fn) => fn());
}

export function getOrientationState(): OrientationControllerState {
  return currentState;
}

export function subscribeOrientationState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function createDefaultBrowserAdapter(target?: string | HTMLElement | null): OrientationEnvironmentAdapter {
  return {
    isPortraitViewport: () => {
      if (typeof window === 'undefined') return false;
      return window.innerHeight > window.innerWidth;
    },
    requestFullscreen: async () => {
      if (typeof document === 'undefined') return false;
      const docWithWebkit = document as Document & {
        webkitFullscreenElement?: Element | null;
      };
      if (document.fullscreenElement || docWithWebkit.webkitFullscreenElement) {
        return true;
      }
      const candidate =
        (typeof target === 'string'
          ? (document.querySelector(target) as HTMLElement | null)
          : target) || document.documentElement;
      const elWithWebkit = candidate as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void> | void;
      };
      try {
        if (typeof candidate.requestFullscreen === 'function') {
          await candidate.requestFullscreen();
          return true;
        }
        if (typeof elWithWebkit.webkitRequestFullscreen === 'function') {
          await elWithWebkit.webkitRequestFullscreen();
          return true;
        }
      } catch {
        // iOS Safari bloquea requestFullscreen en contenedores HTML generales.
      }
      return false;
    },
    lockLandscape: async () => {
      if (typeof screen === 'undefined') return false;
      try {
        const orientation = screen.orientation as ScreenOrientation & {
          lock?: (mode: string) => Promise<void>;
        };
        if (orientation && typeof orientation.lock === 'function') {
          await orientation.lock('landscape');
          return true;
        }
      } catch {
        // iOS Safari o navegadores sin Fullscreen activo rechazan orientation.lock.
      }
      return false;
    },
  };
}

/**
 * Ejecuta la secuencia robusta de rotación horizontal:
 * 1) Solicita Fullscreen (`requestFullscreen()` / `webkitRequestFullscreen()`).
 * 2) Intenta bloquear `screen.orientation.lock('landscape')` con `try/catch`.
 * 3) Si iOS/Safari bloquea la API y el viewport continúa en vertical, activa el fallback
 *    por CSS (`transform: rotate(90deg)`) junto con una guía clara para desbloquear el giro físico.
 *    Si el fallback por CSS ya estaba activo, permite alternarlo de regreso a vertical.
 */
export async function executeLandscapeRotationFlow(
  adapter: OrientationEnvironmentAdapter = createDefaultBrowserAdapter(),
): Promise<OrientationControllerState> {
  // Si el usuario ya está en modo CSS rotado 90° y vuelve a tocar el botón de rotar, permitimos salir a vertical.
  if (currentState.softwareRotated) {
    currentState = {
      softwareRotated: false,
      mode: 'none',
      showIosUnlockHint: false,
      hintMessage: '',
    };
    emitChange();
    return currentState;
  }

  // Paso 1: Solicitar pantalla completa primero (requerido por muchos navegadores móviles antes de orientation.lock)
  await adapter.requestFullscreen();

  // Paso 2: Intentar bloqueo nativo a horizontal
  const lockedNatively = await adapter.lockLandscape();

  // Pequeña pausa en navegador real para permitir que el cambio de dimensiones se refleje
  if (typeof window !== 'undefined' && lockedNatively) {
    await new Promise<void>((resolve) => setTimeout(resolve, 60));
  }

  const stillPortrait = adapter.isPortraitViewport();

  if (lockedNatively && !stillPortrait) {
    currentState = {
      softwareRotated: false,
      mode: 'native-landscape',
      showIosUnlockHint: false,
      hintMessage: '',
    };
    emitChange();
    return currentState;
  }

  // Si el dispositivo ya estaba físicamente en horizontal aunque orientation.lock no exista:
  if (!stillPortrait) {
    currentState = {
      softwareRotated: false,
      mode: 'native-landscape',
      showIosUnlockHint: false,
      hintMessage: '',
    };
    emitChange();
    return currentState;
  }

  // Paso 3: Fallback para iPhone / iOS Safari o bloqueo físico activo -> rotación CSS 90° + aviso amigable
  currentState = {
    softwareRotated: true,
    mode: 'css-rotate-90',
    showIosUnlockHint: true,
    hintMessage: IOS_FALLBACK_HINT,
  };
  emitChange();
  return currentState;
}

export async function requestLandscapeOrientation(
  target?: string | HTMLElement | null,
): Promise<OrientationControllerState> {
  return executeLandscapeRotationFlow(createDefaultBrowserAdapter(target));
}

export function disableSoftwareLandscapeFallback(): void {
  if (!currentState.softwareRotated && !currentState.showIosUnlockHint) return;
  currentState = {
    softwareRotated: false,
    mode: 'none',
    showIosUnlockHint: false,
    hintMessage: '',
  };
  emitChange();
}

export function dismissOrientationHint(): void {
  if (!currentState.showIosUnlockHint) return;
  currentState = {
    ...currentState,
    showIosUnlockHint: false,
  };
  emitChange();
}

export function resetOrientationStateForTests(): void {
  currentState = {
    softwareRotated: false,
    mode: 'none',
    showIosUnlockHint: false,
    hintMessage: '',
  };
  emitChange();
}

// Auto-desactivar el giro por CSS si el jugador desbloquea su iPhone y lo gira físicamente a horizontal
let resizeListenerBound = false;
function ensurePhysicalRotationWatcher(): void {
  if (resizeListenerBound || typeof window === 'undefined') return;
  resizeListenerBound = true;
  const checkPhysicalLandscape = () => {
    if (currentState.softwareRotated && window.innerWidth > window.innerHeight) {
      currentState = {
        softwareRotated: false,
        mode: 'native-landscape',
        showIosUnlockHint: false,
        hintMessage: '',
      };
      emitChange();
    }
  };
  window.addEventListener('resize', checkPhysicalLandscape, { passive: true });
  window.addEventListener('orientationchange', checkPhysicalLandscape, { passive: true });
}

export function useForcedLandscapeOrientation(): OrientationControllerState {
  ensurePhysicalRotationWatcher();
  return useSyncExternalStore(subscribeOrientationState, getOrientationState, getOrientationState);
}
