/**
 * DATACAR ARENA — Gestor Global de Música de Fondo (BGM) con estado explícito (`isPlaying`, `currentTrack`).
 * - Realiza seguimiento exacto de `isPlaying` y `currentTrack` para ignorar clics/toques/teclas posteriores
 *   cuando la pista activa ya está sonando sin interrumpir ni reiniciar el audio.
 * - Reproduce la pista de menú en bucle continuo en Intro, Inicio, Garaje, Comparador, Circuitos y Briefing.
 * - Transiciona a la pista de carrera con fade-in progresivo de 4 segundos (`linearRampToValueAtTime`) una sola vez por pista.
 * - Aplica atenuación dinámica (ducking) ante alertas ADAS críticas o sanción de cárcel de 30s.
 */

export type BgmSceneMode = 'menu' | 'race' | 'results';
export type BgmDuckReason = 'adas' | 'jail';

export const BGM_TRACKS = {
  menu: '/assets/aistudio/Race_feaf6661.mp3',
  racePrimary: '/assets/aistudio/NFS_be6bb461.mp3',
  raceSecondary: '/assets/aistudio/NFS2_aec8503f.mp3',
  results: '/assets/aistudio/Optimista_a52b4fad.mp3',
} as const;

export const BGM_MENU_VOLUME = 0.28;
export const BGM_RACE_VOLUME = 0.26;
export const BGM_RESULTS_VOLUME = 0.26;
export const BGM_RACE_FADE_IN_SECONDS = 4.0;
export const BGM_DUCK_FACTOR = 0.26;

export interface BgmTrackSelection {
  mode: BgmSceneMode;
  trackUrl: string;
  targetGain: number;
  fadeInSec: number;
}

export interface BgmPlaybackStateSnapshot {
  isPlaying: boolean;
  currentTrack: string;
  muted: boolean;
  mode: BgmSceneMode;
  unlocked: boolean;
  ducked: boolean;
}

export function shouldIgnoreInteractionUnlock(state: {
  isPlaying: boolean;
  currentTrack: string;
  targetTrack: string;
  muted: boolean;
  elementPaused: boolean;
  elementEnded?: boolean;
  contextState?: string;
}): boolean {
  if (state.muted) return true;
  if (!state.isPlaying) return false;
  if (state.currentTrack !== state.targetTrack) return false;
  if (state.elementPaused || state.elementEnded) return false;
  if (state.contextState && state.contextState !== 'running') return false;
  return true;
}

export function resolveBgmSceneTrack(args: {
  screenOrStage: string;
  circuitId?: string;
  raceMode?: string;
}): BgmTrackSelection {
  const s = args.screenOrStage;
  if (s === 'race' || s === 'race-run') {
    const useAlt =
      args.raceMode === 'speed_pro' ||
      args.circuitId === 'costanera' ||
      args.circuitId === 'mariscal_lopez' ||
      args.circuitId === 'aviadores';
    return {
      mode: 'race',
      trackUrl: useAlt ? BGM_TRACKS.raceSecondary : BGM_TRACKS.racePrimary,
      targetGain: BGM_RACE_VOLUME,
      fadeInSec: BGM_RACE_FADE_IN_SECONDS,
    };
  }
  if (s === 'results' || s === 'race-results' || s === 'replay') {
    return {
      mode: 'results',
      trackUrl: BGM_TRACKS.results,
      targetGain: BGM_RESULTS_VOLUME,
      fadeInSec: 1.2,
    };
  }
  return {
    mode: 'menu',
    trackUrl: BGM_TRACKS.menu,
    targetGain: BGM_MENU_VOLUME,
    fadeInSec: 0.65,
  };
}

export function computeBgmDuckMultiplier(reasons: ReadonlySet<BgmDuckReason>): number {
  return reasons.size > 0 ? BGM_DUCK_FACTOR : 1.0;
}

type BgmListener = (snapshot: {
  muted: boolean;
  mode: BgmSceneMode;
  ducked: boolean;
  isPlaying: boolean;
  currentTrack: string;
}) => void;

class GlobalBgmAudioManager {
  private audioEl: HTMLAudioElement | null = null;

  private mode: BgmSceneMode = 'menu';
  private currentTrack: string = BGM_TRACKS.menu;
  private isPlaying = false;
  private fadedTrack: string | null = null;
  private fadeMultiplier = 1.0;
  private fadeStartMs = 0;
  private fadeDurationMs = 0;
  private currentDuckMultiplier = 1.0;
  private targetDuckMultiplier = 1.0;
  private pendingTargetGain = BGM_MENU_VOLUME;
  private pendingFadeInSec = 0.65;
  private muted = false;
  private unlocked = false;
  private gestureListenersBound = false;
  private onGestureHandler: (() => void) | null = null;
  private envelopeTimer: ReturnType<typeof setInterval> | null = null;
  private adasReleaseTimer: ReturnType<typeof setTimeout> | null = null;
  private duckReasons = new Set<BgmDuckReason>();
  private listeners = new Set<BgmListener>();

  constructor() {
    this.bindGestureUnlock();
  }

  private isActivelyPlayingCurrentTrack(): boolean {
    if (!this.audioEl) return false;
    return shouldIgnoreInteractionUnlock({
      isPlaying: this.isPlaying,
      currentTrack: this.currentTrack,
      targetTrack: this.currentTrack,
      muted: this.muted,
      elementPaused: this.audioEl.paused,
      elementEnded: this.audioEl.ended,
      contextState: 'running',
    });
  }

  private bindGestureUnlock() {
    if (this.gestureListenersBound || typeof window === 'undefined') return;
    this.gestureListenersBound = true;
    const onFirstGesture = () => {
      if (this.isActivelyPlayingCurrentTrack()) {
        this.removeGestureUnlockListeners();
        return;
      }
      this.unlock();
    };
    this.onGestureHandler = onFirstGesture;
    window.addEventListener('pointerdown', onFirstGesture, { capture: true, passive: true });
    window.addEventListener('click', onFirstGesture, { capture: true, passive: true });
    window.addEventListener('touchend', onFirstGesture, { capture: true, passive: true });
    window.addEventListener('keydown', onFirstGesture, { capture: true, passive: true });
  }

  private removeGestureUnlockListeners() {
    if (!this.gestureListenersBound || !this.onGestureHandler || typeof window === 'undefined') {
      return;
    }
    window.removeEventListener('pointerdown', this.onGestureHandler, { capture: true });
    window.removeEventListener('click', this.onGestureHandler, { capture: true });
    window.removeEventListener('touchend', this.onGestureHandler, { capture: true });
    window.removeEventListener('keydown', this.onGestureHandler, { capture: true });
    this.gestureListenersBound = false;
    this.onGestureHandler = null;
  }

  private computeAppliedVolume(): number {
    if (this.muted) return 0;
    return Math.min(
      1,
      Math.max(0, this.pendingTargetGain * this.fadeMultiplier * this.currentDuckMultiplier),
    );
  }

  private applyVolumeNow() {
    if (!this.audioEl) return;
    const vol = this.computeAppliedVolume();
    this.audioEl.muted = this.muted;
    this.audioEl.volume = vol;
  }

  private ensureEnvelopeLoop() {
    if (this.envelopeTimer !== null || typeof window === 'undefined') return;
    this.envelopeTimer = globalThis.setInterval(() => {
      const now = performance.now();
      let settled = true;

      if (this.fadeDurationMs > 0 && this.fadeMultiplier < 1.0) {
        const progress = Math.min(1, Math.max(0, (now - this.fadeStartMs) / this.fadeDurationMs));
        this.fadeMultiplier = 0.04 + 0.96 * progress;
        if (progress < 1) {
          settled = false;
        } else {
          this.fadeMultiplier = 1.0;
          this.fadeDurationMs = 0;
        }
      }

      if (Math.abs(this.currentDuckMultiplier - this.targetDuckMultiplier) > 0.01) {
        this.currentDuckMultiplier += (this.targetDuckMultiplier - this.currentDuckMultiplier) * 0.25;
        settled = false;
      } else {
        this.currentDuckMultiplier = this.targetDuckMultiplier;
      }

      this.applyVolumeNow();

      if (settled && this.envelopeTimer !== null) {
        clearInterval(this.envelopeTimer);
        this.envelopeTimer = null;
      }
    }, 50);
  }

  private stopEnvelopeLoop() {
    if (this.envelopeTimer !== null) {
      clearInterval(this.envelopeTimer);
      this.envelopeTimer = null;
    }
  }

  private ensureAudioGraph() {
    if (typeof window === 'undefined') return;
    if (!this.audioEl) {
      const audio = new Audio();
      audio.loop = true;
      audio.preload = 'auto';
      audio.src = this.currentTrack;
      audio.volume = this.computeAppliedVolume();
      audio.addEventListener('playing', () => {
        this.isPlaying = true;
        this.removeGestureUnlockListeners();
        this.notify();
      });
      audio.addEventListener('pause', () => {
        this.isPlaying = false;
        this.notify();
      });
      audio.addEventListener('ended', () => {
        this.isPlaying = false;
        this.notify();
      });
      this.audioEl = audio;
    }
  }

  unlock() {
    // Si la pista actual ya está sonando activamente, ignorar el evento de interacción por completo
    if (this.isActivelyPlayingCurrentTrack()) {
      this.removeGestureUnlockListeners();
      return;
    }

    this.unlocked = true;
    if (this.muted) {
      return;
    }

    this.ensureAudioGraph();
    const needsFade = this.fadedTrack !== this.currentTrack;
    this.startOrSyncPlayback(needsFade);
  }

  private applyFadeRamp(fadeSec: number) {
    this.fadedTrack = this.currentTrack;
    if (fadeSec <= 0.15) {
      this.fadeMultiplier = 1.0;
      this.fadeDurationMs = 0;
      this.applyVolumeNow();
      return;
    }
    this.fadeMultiplier = 0.04;
    this.fadeStartMs = performance.now();
    this.fadeDurationMs = fadeSec * 1000;
    this.applyVolumeNow();
    this.ensureEnvelopeLoop();
  }

  private startOrSyncPlayback(forceFadeRamp = false) {
    if (!this.audioEl) return;
    if (this.muted) {
      if (!this.audioEl.paused) {
        this.audioEl.pause();
      }
      this.isPlaying = false;
      this.applyVolumeNow();
      return;
    }

    if (forceFadeRamp && this.fadedTrack !== this.currentTrack) {
      this.applyFadeRamp(this.pendingFadeInSec);
    } else if (this.fadedTrack === null) {
      this.fadedTrack = this.currentTrack;
      this.fadeMultiplier = 1.0;
      this.fadeDurationMs = 0;
    }

    this.applyVolumeNow();

    if (!this.unlocked) return;

    if (this.audioEl.paused || this.audioEl.ended) {
      const playResult = this.audioEl.play();
      if (playResult && typeof playResult.then === 'function') {
        void playResult
          .then(() => {
            this.isPlaying = true;
            this.removeGestureUnlockListeners();
            this.applyVolumeNow();
            this.notify();
          })
          .catch(() => {
            this.isPlaying = false;
            this.bindGestureUnlock();
          });
      }
    } else {
      this.isPlaying = true;
    }
  }

  setSceneContext(args: { screenOrStage: string; circuitId?: string; raceMode?: string }) {
    const selection = resolveBgmSceneTrack(args);
    const trackChanged = selection.trackUrl !== this.currentTrack;
    const modeChanged = selection.mode !== this.mode;

    this.mode = selection.mode;
    this.pendingTargetGain = selection.targetGain;
    this.pendingFadeInSec = selection.fadeInSec;

    if (trackChanged) {
      this.currentTrack = selection.trackUrl;
      this.fadedTrack = null;
      this.isPlaying = false;
      if (this.audioEl) {
        const wasUnlocked = this.unlocked && !this.muted;
        this.audioEl.src = selection.trackUrl;
        this.audioEl.loop = true;
        if (wasUnlocked) {
          this.startOrSyncPlayback(true);
        } else {
          this.fadeMultiplier = selection.mode === 'race' ? 0.04 : 1.0;
          this.applyVolumeNow();
        }
      }
    } else {
      // Misma pista entre pantallas (p.ej. intro -> home -> garaje -> comparador):
      // nunca reiniciar ni re-aplicar fade desde 0.
      if (modeChanged && this.audioEl && !this.muted) {
        this.applyVolumeNow();
      } else if (this.audioEl && !this.audioEl.paused) {
        this.isPlaying = true;
      }
      if (this.unlocked && !this.muted && this.audioEl?.paused) {
        this.startOrSyncPlayback(false);
      }
    }
    this.notify();
  }

  private applyDuckGain() {
    this.targetDuckMultiplier = computeBgmDuckMultiplier(this.duckReasons);
    this.ensureEnvelopeLoop();
  }

  setDuckReason(reason: BgmDuckReason, active: boolean) {
    if (reason === 'adas') {
      if (active) {
        if (this.adasReleaseTimer !== null) {
          clearTimeout(this.adasReleaseTimer);
          this.adasReleaseTimer = null;
        }
      } else if (this.duckReasons.has('adas')) {
        if (this.adasReleaseTimer !== null) return;
        this.adasReleaseTimer = setTimeout(() => {
          this.adasReleaseTimer = null;
          if (!this.duckReasons.has('adas')) return;
          this.duckReasons.delete('adas');
          this.applyDuckGain();
          this.notify();
        }, 450);
        return;
      }
    }

    const hadReason = this.duckReasons.has(reason);
    if (hadReason === active) return;
    if (active) this.duckReasons.add(reason);
    else this.duckReasons.delete(reason);

    this.applyDuckGain();
    this.notify();
  }

  clearAllDucking() {
    if (this.adasReleaseTimer !== null) {
      clearTimeout(this.adasReleaseTimer);
      this.adasReleaseTimer = null;
    }
    if (this.duckReasons.size === 0) return;
    this.duckReasons.clear();
    this.applyDuckGain();
    this.notify();
  }

  setMuted(muted: boolean) {
    if (this.muted === muted) return;
    this.muted = muted;
    if (muted) {
      if (this.audioEl && !this.audioEl.paused) {
        this.audioEl.pause();
      }
      this.isPlaying = false;
      this.applyVolumeNow();
    } else {
      this.unlocked = true;
      this.ensureAudioGraph();
      this.startOrSyncPlayback(this.fadedTrack !== this.currentTrack);
    }
    this.notify();
  }

  isMuted(): boolean {
    return this.muted;
  }

  getPlaybackState(): BgmPlaybackStateSnapshot {
    return {
      isPlaying: this.isPlaying,
      currentTrack: this.currentTrack,
      muted: this.muted,
      mode: this.mode,
      unlocked: this.unlocked,
      ducked: this.duckReasons.size > 0,
    };
  }

  getSnapshot() {
    return {
      muted: this.muted,
      mode: this.mode,
      ducked: this.duckReasons.size > 0,
      isPlaying: this.isPlaying,
      currentTrack: this.currentTrack,
      trackUrl: this.currentTrack,
      volume: this.audioEl?.volume ?? this.computeAppliedVolume(),
      elementPaused: this.audioEl?.paused ?? true,
      currentTime: this.audioEl?.currentTime ?? 0,
    };
  }

  subscribe(listener: BgmListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const snap = {
      muted: this.muted,
      mode: this.mode,
      ducked: this.duckReasons.size > 0,
      isPlaying: this.isPlaying,
      currentTrack: this.currentTrack,
    };
    for (const cb of this.listeners) {
      cb(snap);
    }
  }

  dispose() {
    this.removeGestureUnlockListeners();
    this.stopEnvelopeLoop();
    if (this.adasReleaseTimer !== null) {
      clearTimeout(this.adasReleaseTimer);
      this.adasReleaseTimer = null;
    }
    try {
      this.audioEl?.pause();
      this.isPlaying = false;
    } catch {
      // Ya detenido
    }
  }
}

export const bgmAudioManager = new GlobalBgmAudioManager();
if (typeof window !== 'undefined') {
  (window as Window & { __datacarBgm?: GlobalBgmAudioManager }).__datacarBgm = bgmAudioManager;
}
