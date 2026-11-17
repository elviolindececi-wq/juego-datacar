import type { Vehicle } from '../types/vehicle';
import type { WeatherMode } from './weatherDynamics.ts';
import { detectMobilePerformanceMode } from './mobilePerformanceProfile';

export const MOBILE_SFX_BOOST_MULTIPLIER = 1.3;
export const ENGINE_MASTER_GAIN = 0.96;

export function resolveMobileSfxGainMultiplier(isMobile: boolean): number {
  return isMobile ? MOBILE_SFX_BOOST_MULTIPLIER : 1.0;
}

/**
 * DATACAR ARENA V8.1 — Banco ORIGINAL de sonidos procedimentales grabados a WAV.
 * Son aproximaciones de timbre por arquitectura de motor, NO muestras de los autos reales.
 * WebAudio cruza los clips idle/cruise/load y adapta su velocidad a las RPM en tiempo real.
 * Si el navegador no carga los WAV se mantiene el sintetizador como respaldo.
 */
type ClipName = 'idle' | 'cruise' | 'load';
const CLIPS: ClipName[] = ['idle', 'cruise', 'load'];

export type AudioProfile = {
  name: 'tracker' | 'corolla' | 'kicks' | 'carens';
  sampleRPM: Record<ClipName, number>;
  tone: number;
};
const PROFILES: Record<string, AudioProfile> = {
  'chevrolet-tracker-lite': { name: 'tracker', sampleRPM: { idle: 800, cruise: 2600, load: 4800 }, tone: 1.00 },
  'toyota-corolla-cross-seg-2027': { name: 'corolla', sampleRPM: { idle: 900, cruise: 2700, load: 4800 }, tone: 0.96 },
  'nissan-kicks-2027': { name: 'kicks', sampleRPM: { idle: 900, cruise: 2700, load: 4800 }, tone: 1.04 },
  'kia-carens-ex': { name: 'carens', sampleRPM: { idle: 900, cruise: 2400, load: 3900 }, tone: 0.91 },
  'chery-t2-pro-max': { name: 'tracker', sampleRPM: { idle: 820, cruise: 2450, load: 4550 }, tone: 0.92 },
  'chery-t4-pro-luxury-hev': { name: 'corolla', sampleRPM: { idle: 880, cruise: 2650, load: 4750 }, tone: 0.98 },
  'suzuki-fronx': { name: 'kicks', sampleRPM: { idle: 860, cruise: 2650, load: 4850 }, tone: 1.06 },
};

const DEFAULT_ICE_PROFILE: AudioProfile = {
  name: 'corolla',
  sampleRPM: { idle: 880, cruise: 2650, load: 4750 },
  tone: 1.0,
};

export function resolveAudioProfile(v: Pick<Vehicle, 'id' | 'fuelType'>): AudioProfile | undefined {
  if (PROFILES[v.id]) return PROFILES[v.id];
  if (v.fuelType === 'electric') return undefined;
  return DEFAULT_ICE_PROFILE;
}

const clamp = (value: number, a: number, b: number) => Math.max(a, Math.min(b, value));

export const RAIN_GAIN_BY_WEATHER: Record<WeatherMode, number> = {
  sunny: 0,
  dawn: 0,
  cloudy: 0,
  rain: 0.26,
  flood: 0.32,
  storm: 0.38,
};

export function computeEngineVoiceLevels(params: {
  focus: boolean;
  throttle: number;
  rpm: number;
  kmh: number;
  hasSampledClips: boolean;
}): { synthGain: number; sampledLevel: number } {
  if (!params.focus) {
    return {
      synthGain: params.hasSampledClips ? 0.012 : 0.028,
      sampledLevel: 0.042,
    };
  }
  const thr = clamp(params.throttle, 0, 1);
  const rpmNorm = clamp((params.rpm - 850) / 5000, 0, 1);
  const speedNorm = clamp(Math.abs(params.kmh) / 135, 0, 1);
  // Ralentí suave y discreto (~0.20 sampled / ~0.06 synth); al acelerar sube con fuerza hasta ~1.54 sampled / ~0.48 synth
  const rawSynth = 0.15 + thr * 0.64 + rpmNorm * 0.20 + speedNorm * 0.07;
  const sampledLevel = 0.20 + thr * 0.96 + rpmNorm * 0.32 + speedNorm * 0.08;
  return {
    synthGain: params.hasSampledClips ? rawSynth * 0.45 : rawSynth,
    sampledLevel,
  };
}

export function computeBrakingAudioLevels(params: {
  focus: boolean;
  brakeIntensity: number;
  kmh: number;
  brakeSlip: number;
  tireSlip: number;
  absActive: boolean;
  timeSec: number;
}): { brakeGain: number; absGain: number; tireSkidGain: number; filterHz: number } {
  const speedAbs = Math.abs(params.kmh);
  const hardBrake =
    clamp((params.brakeIntensity - 0.45) / 0.40, 0, 1) *
    clamp((speedAbs - 16) / 36, 0, 1);
  const friction = clamp(params.brakeSlip, 0, 1);

  if (!params.focus) {
    const rivalSkid = clamp(params.tireSlip * 0.5 + (params.absActive ? 0 : friction * 0.5), 0, 1);
    return {
      brakeGain: 0,
      absGain: 0,
      tireSkidGain: rivalSkid * 0.02,
      filterHz: 1650,
    };
  }

  // Modulación sutil de presión (14 Hz) cuando interviene el ABS
  const absWave01 = 0.5 + 0.5 * Math.sin(2 * Math.PI * 14 * params.timeSec);
  const absPulse = params.absActive ? 0.84 + 0.16 * Math.sin(2 * Math.PI * 14 * params.timeSec) : 1.0;

  // Frenada brusca: fricción audible de pastilla/neumático sobre asfalto
  const brakeGain = hardBrake * (0.38 + friction * 0.44) * absPulse;

  // Leve sonido mecánico/hidráulico de ABS (14 Hz) únicamente cuando ABS está modulando en frenada fuerte
  const absSpeedFactor = clamp((speedAbs - 16) / 34, 0.35, 1);
  const absGain =
    params.absActive && hardBrake > 0.04
      ? (0.045 + 0.085 * (absWave01 * absWave01)) * absSpeedFactor
      : 0;

  // Chirrido/carga de neumático en derrape o transferencia brusca de peso
  const skidDemand = clamp(
    params.tireSlip * 0.55 + (params.absActive ? hardBrake * 0.28 : friction * 0.62 + hardBrake * 0.35),
    0,
    1,
  );
  const tireSkidGain = skidDemand * 0.34;
  const filterHz = params.absActive ? 1520 + 240 * absWave01 : 1720 + friction * 1050 + hardBrake * 280;

  return { brakeGain, absGain, tireSkidGain, filterHz };
}

type SampleVoice = { sources: AudioBufferSourceNode[]; gains: GainNode[] };
type Voice = {
  engine: OscillatorNode;
  harmonic: OscillatorNode;
  absOsc: OscillatorNode;
  source: AudioBufferSourceNode;
  exhaustBody: BiquadFilterNode;
  tone: BiquadFilterNode;
  gain: GainNode;
  tireGain: GainNode;
  brakeGain: GainNode;
  brakeFilter: BiquadFilterNode;
  absFilter: BiquadFilterNode;
  absGain: GainNode;
  profile?: AudioProfile;
  sampled?: SampleVoice;
  audibleRPM: number;
  lastThrottle: number;
  lastKmh: number;
  previousUpdateAt: number;
  isFocus: boolean;
};

class EngineSoundSynthesizer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private sfxBoostGain: GainNode | null = null;
  private mobileBoostActive = false;
  private rainGain: GainNode | null = null;
  private rainSource: AudioBufferSourceNode | null = null;
  private muted = false;
  private weather: WeatherMode = 'sunny';
  private lastImpactAt = -Infinity;
  private lastSuspensionHitAt = -Infinity;
  private suspensionHitCount = 0;
  private lastSuspensionStrength = 0;
  private thunderCount = 0;
  private lastThunderPeakGain = 0;
  private voices = new Map<string, Voice>();
  private sampleCache = new Map<string, Promise<AudioBuffer[] | null>>();
  private startingTones = new Set<{ oscillator: OscillatorNode; harmonic: OscillatorNode; gain: GainNode }>();
  private thunderTimers = new Set<number>();
  private activeThunderDisposers = new Set<() => void>();
  private lastThunderAt = -Infinity;
  private suspendTimer: number | null = null;
  private gestureListenersBound = false;
  private onGestureHandler: (() => void) | null = null;
  private lastResumeAttemptMs = 0;

  constructor() {
    this.bindGestureUnlock();
  }

  private bindGestureUnlock() {
    if (this.gestureListenersBound || typeof window === 'undefined') return;
    this.gestureListenersBound = true;
    const onGesture = () => {
      if (this.muted) return;
      if (this.ctx && this.ctx.state === 'running') {
        this.removeGestureUnlockListeners();
        return;
      }
      this.unlock();
    };
    this.onGestureHandler = onGesture;
    window.addEventListener('pointerdown', onGesture, { capture: true, passive: true });
    window.addEventListener('click', onGesture, { capture: true, passive: true });
    window.addEventListener('touchend', onGesture, { capture: true, passive: true });
    window.addEventListener('keydown', onGesture, { capture: true, passive: true });
  }

  private removeGestureUnlockListeners() {
    if (!this.gestureListenersBound || !this.onGestureHandler || typeof window === 'undefined') return;
    window.removeEventListener('pointerdown', this.onGestureHandler, { capture: true });
    window.removeEventListener('click', this.onGestureHandler, { capture: true });
    window.removeEventListener('touchend', this.onGestureHandler, { capture: true });
    window.removeEventListener('keydown', this.onGestureHandler, { capture: true });
    this.gestureListenersBound = false;
    this.onGestureHandler = null;
  }

  private clearSuspendTimer() {
    if (this.suspendTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.suspendTimer);
      this.suspendTimer = null;
    }
  }

  private clearThunderAudio() {
    if (typeof window !== 'undefined') {
      for (const timerId of this.thunderTimers) {
        window.clearTimeout(timerId);
      }
    }
    this.thunderTimers.clear();
    for (const disposeFn of Array.from(this.activeThunderDisposers)) {
      try {
        disposeFn();
      } catch {
        // Nodo ya desconectado
      }
    }
    this.activeThunderDisposers.clear();
  }

  private noise(): AudioBuffer {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const a = buffer.getChannelData(0);
    for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /** Debe iniciarse desde un clic/tecla/toque de usuario: los navegadores bloquean audio automático. */
  unlock() {
    this.clearSuspendTimer();
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const Constructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Constructor) return;
      this.ctx = new Constructor();
      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -3.0;
      this.limiter.knee.value = 8.0;
      this.limiter.ratio.value = 5.0;
      this.limiter.attack.value = 0.003;
      this.limiter.release.value = 0.12;
      this.limiter.connect(this.ctx.destination);
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : ENGINE_MASTER_GAIN;
      this.master.connect(this.limiter);
      this.mobileBoostActive = detectMobilePerformanceMode();
      this.sfxBoostGain = this.ctx.createGain();
      this.sfxBoostGain.gain.value = resolveMobileSfxGainMultiplier(this.mobileBoostActive);
      this.sfxBoostGain.connect(this.master);
      const rainLowFilter = this.ctx.createBiquadFilter();
      rainLowFilter.type = 'lowpass';
      rainLowFilter.frequency.value = 1800;
      const rainDropsFilter = this.ctx.createBiquadFilter();
      rainDropsFilter.type = 'bandpass';
      rainDropsFilter.frequency.value = 3100;
      rainDropsFilter.Q.value = 0.85;
      const rainDropsGain = this.ctx.createGain();
      rainDropsGain.gain.value = 0.62;
      this.rainGain = this.ctx.createGain();
      this.rainGain.gain.value = RAIN_GAIN_BY_WEATHER[this.weather];
      this.rainSource = this.ctx.createBufferSource();
      this.rainSource.buffer = this.noise();
      this.rainSource.loop = true;
      this.rainSource.connect(rainLowFilter);
      rainLowFilter.connect(this.rainGain);
      this.rainSource.connect(rainDropsFilter);
      rainDropsFilter.connect(rainDropsGain);
      rainDropsGain.connect(this.rainGain);
      this.rainGain.connect(this.sfxBoostGain);
      this.rainSource.start();
    } else if (this.sfxBoostGain && this.ctx) {
      const mobile = detectMobilePerformanceMode();
      if (mobile !== this.mobileBoostActive) {
        this.mobileBoostActive = mobile;
        this.sfxBoostGain.gain.setTargetAtTime(
          resolveMobileSfxGainMultiplier(mobile),
          this.ctx.currentTime,
          0.08,
        );
      }
      if (this.master) {
        this.master.gain.setTargetAtTime(this.muted ? 0 : ENGINE_MASTER_GAIN, this.ctx.currentTime, 0.04);
      }
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().then(() => {
        if (this.ctx?.state === 'running') {
          this.removeGestureUnlockListeners();
        }
      }).catch(() => {});
    } else if (this.ctx.state === 'running') {
      this.removeGestureUnlockListeners();
    }
    this.applyWeatherGain();
    this.prewarmEngineSamples();
  }

  private prewarmEngineSamples() {
    if (!this.ctx || typeof fetch === 'undefined') return;
    const uniqueProfiles = new Map<string, AudioProfile>();
    for (const p of Object.values(PROFILES)) {
      if (!uniqueProfiles.has(p.name)) uniqueProfiles.set(p.name, p);
    }
    for (const p of uniqueProfiles.values()) {
      void this.loadProfile(p);
    }
  }

  getSfxBoostMultiplier(): number {
    return this.sfxBoostGain?.gain.value ?? resolveMobileSfxGainMultiplier(detectMobilePerformanceMode());
  }

  isMobileAudioBoostActive(): boolean {
    return this.sfxBoostGain ? this.sfxBoostGain.gain.value > 1.05 : detectMobilePerformanceMode();
  }

  getDebugState() {
    let focusSynthGain = 0;
    let focusSampleGainSum = 0;
    let focusBrakeGain = 0;
    let focusAbsGain = 0;
    let focusTireGain = 0;
    let focusRpm = 0;
    for (const v of this.voices.values()) {
      if (v.isFocus) {
        focusSynthGain = v.gain.gain.value;
        focusSampleGainSum = v.sampled ? v.sampled.gains.reduce((acc, g) => acc + g.gain.value, 0) : 0;
        focusBrakeGain = v.brakeGain.gain.value;
        focusAbsGain = v.absGain.gain.value;
        focusTireGain = v.tireGain.gain.value;
        focusRpm = Math.round(v.audibleRPM);
        break;
      }
    }
    return {
      hasContext: !!this.ctx,
      contextState: this.ctx?.state ?? 'uninitialized',
      muted: this.muted,
      weather: this.weather,
      rainGain: this.rainGain?.gain.value ?? 0,
      activeVoices: this.voices.size,
      masterGain: this.master?.gain.value ?? 0,
      sfxBoostMultiplier: this.getSfxBoostMultiplier(),
      focusSynthGain,
      focusSampleGainSum,
      focusBrakeGain,
      focusAbsGain,
      focusTireGain,
      focusRpm,
      suspensionHitCount: this.suspensionHitCount,
      lastSuspensionStrength: this.lastSuspensionStrength,
      thunderCount: this.thunderCount,
      lastThunderPeakGain: this.lastThunderPeakGain,
    };
  }

  private getSfxOutput(): GainNode | null {
    return this.sfxBoostGain ?? this.master;
  }

  /** 3 pitidos cortos + un tono largo. El navegador exige iniciar el audio desde un clic. */
  playCountdownTone(step: 3 | 2 | 1 | 0) {
    this.clearSuspendTimer();
    if (this.muted || !this.ctx || !this.master) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
    const now = this.ctx.currentTime;
    const finalTone = step === 0;
    const duration = finalTone ? 0.72 : 0.18;
    const frequency = finalTone ? 1175 : 870;
    const gain = this.ctx.createGain();
    const oscillator = this.ctx.createOscillator();
    const harmonic = this.ctx.createOscillator();
    oscillator.type = 'sine'; harmonic.type = 'triangle';
    oscillator.frequency.value = frequency; harmonic.frequency.value = frequency * 2;
    const harmonicGain = this.ctx.createGain(); harmonicGain.gain.value = 0.10;
    oscillator.connect(gain); harmonic.connect(harmonicGain); harmonicGain.connect(gain);
    gain.connect(this.master);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(finalTone ? 0.36 : 0.28, now + 0.012);
    gain.gain.setValueAtTime(finalTone ? 0.36 : 0.28, now + duration * .72);
    gain.gain.linearRampToValueAtTime(0.0001, now + duration);
    const tone = { oscillator, harmonic, gain };
    this.startingTones.add(tone);
    oscillator.start(now); harmonic.start(now);
    oscillator.stop(now + duration + .02); harmonic.stop(now + duration + .02);
    oscillator.onended = () => {
      this.startingTones.delete(tone);
      oscillator.disconnect(); harmonic.disconnect(); harmonicGain.disconnect(); gain.disconnect();
    };
  }

  stopCountdownTones() {
    for (const tone of this.startingTones) {
      try { tone.oscillator.stop(); } catch { /* tono finalizado */ }
      try { tone.harmonic.stop(); } catch { /* tono finalizado */ }
    }
    this.startingTones.clear();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) {
      this.clearThunderAudio();
    } else {
      this.unlock();
    }
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(muted ? 0 : ENGINE_MASTER_GAIN, this.ctx.currentTime, .06);
  }
  getIsMuted() { return this.muted; }

  private applyWeatherGain() {
    if (!this.ctx || !this.rainGain) return;
    const now = this.ctx.currentTime;
    const vol = this.muted ? 0 : RAIN_GAIN_BY_WEATHER[this.weather];
    this.rainGain.gain.cancelScheduledValues(now);
    this.rainGain.gain.setTargetAtTime(vol, now, 0.14);
  }

  setWeather(mode: WeatherMode) {
    this.weather = mode;
    if (mode !== 'storm') {
      this.clearThunderAudio();
    }
    this.applyWeatherGain();
  }

  private async loadProfile(profile: AudioProfile): Promise<AudioBuffer[] | null> {
    const ctx = this.ctx;
    if (!ctx) return null;
    const existing = this.sampleCache.get(profile.name);
    if (existing) return existing;
    const promise = Promise.all(CLIPS.map(async clip => {
      const res = await fetch(`/audio/engines/${profile.name}_${clip}.wav`);
      if (!res.ok) throw new Error(`Audio ${profile.name}/${clip}: HTTP ${res.status}`);
      return ctx.decodeAudioData(await res.arrayBuffer());
    })).catch(() => null);
    this.sampleCache.set(profile.name, promise);
    return promise;
  }

  private attachSamples(vehicleId: string, voice: Voice, buffers: AudioBuffer[]) {
    const ctx = this.ctx;
    const output = this.getSfxOutput();
    if (!ctx || !output || this.voices.get(vehicleId) !== voice || voice.sampled || !voice.profile) return;
    const now = ctx.currentTime;
    const p = voice.profile;
    const rev = voice.audibleRPM;
    const idleW = clamp((2200 - rev) / 1250, 0, 1);
    const cruiseW = clamp((rev - 900) / 1200, 0, 1) * clamp((5900 - rev) / 1750, 0, 1);
    const loadW = clamp((rev - 2700) / 1850, 0, 1);
    const weights = [idleW, cruiseW, loadW];
    const sum = weights.reduce((a, b) => a + b, 0) || 1;
    const levels = computeEngineVoiceLevels({
      focus: voice.isFocus,
      throttle: voice.lastThrottle,
      rpm: rev,
      kmh: voice.lastKmh,
      hasSampledClips: true,
    });

    const sources: AudioBufferSourceNode[] = [];
    const gains: GainNode[] = [];
    buffers.forEach((buffer, idx) => {
      const clip = CLIPS[idx] ?? 'idle';
      const src = ctx.createBufferSource();
      src.buffer = buffer; src.loop = true;
      src.playbackRate.value = clamp(rev / p.sampleRPM[clip], 0.68, 1.68) * p.tone;
      const targetGain = (weights[idx] / sum) * levels.sampledLevel;
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(Math.max(0.0001, targetGain), now + 0.045);
      src.connect(gain); gain.connect(output);
      src.start(now + 0.01);
      sources.push(src); gains.push(gain);
    });
    voice.sampled = { sources, gains };
    voice.gain.gain.setTargetAtTime(levels.synthGain, now, 0.06);
  }

  startVehicleSound(v: Vehicle, focus = false, throttle = 0, kmh = 0) {
    const output = this.getSfxOutput();
    if (!this.ctx || !output || this.voices.has(v.id)) return;
    const ctx = this.ctx;
    const isElectric = v.fuelType === 'electric';
    const engine = ctx.createOscillator();
    engine.type = isElectric ? 'sine' : 'sawtooth'; engine.frequency.value = isElectric ? 130 : 58;
    const harmonic = ctx.createOscillator();
    harmonic.type = isElectric ? 'triangle' : 'triangle'; harmonic.frequency.value = isElectric ? 250 : 116;
    const exhaustBody = ctx.createBiquadFilter();
    exhaustBody.type = 'peaking';
    exhaustBody.frequency.value = isElectric ? 340 : 165;
    exhaustBody.Q.value = 1.35;
    exhaustBody.gain.value = isElectric ? 3.0 : 7.5;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 780;
    tone.Q.value = 1.45;
    const gain = ctx.createGain(); gain.gain.value = .0001;
    engine.connect(exhaustBody); harmonic.connect(exhaustBody); exhaustBody.connect(tone); tone.connect(gain); gain.connect(output);
    const source = ctx.createBufferSource(); source.buffer = this.noise(); source.loop = true;
    const tireFilter = ctx.createBiquadFilter(); tireFilter.type = 'bandpass'; tireFilter.frequency.value = 1800; tireFilter.Q.value = 2;
    const tireGain = ctx.createGain(); tireGain.gain.value = 0;
    source.connect(tireFilter); tireFilter.connect(tireGain); tireGain.connect(output);
    // Capa separada de fricción de frenado brusco: silenciosa en frenadas suaves, clara y progresiva en frenada de emergencia.
    const brakeFilter = ctx.createBiquadFilter();
    brakeFilter.type = 'bandpass'; brakeFilter.frequency.value = 1720; brakeFilter.Q.value = 1.65;
    const brakeGain = ctx.createGain(); brakeGain.gain.value = 0;
    source.connect(brakeFilter); brakeFilter.connect(brakeGain); brakeGain.connect(output);
    // Capa sutil de modulación mecánica/hidráulica de ABS (14 Hz)
    const absOsc = ctx.createOscillator();
    absOsc.type = 'triangle';
    absOsc.frequency.value = 132;
    const absFilter = ctx.createBiquadFilter();
    absFilter.type = 'bandpass';
    absFilter.frequency.value = 235;
    absFilter.Q.value = 1.9;
    const absGain = ctx.createGain();
    absGain.gain.value = 0;
    absOsc.connect(absFilter);
    absFilter.connect(absGain);
    absGain.connect(output);
    engine.start(); harmonic.start(); absOsc.start(); source.start();
    const profile = resolveAudioProfile(v);
    const voice: Voice = {
      engine,
      harmonic,
      absOsc,
      source,
      exhaustBody,
      tone,
      gain,
      tireGain,
      brakeGain,
      brakeFilter,
      absFilter,
      absGain,
      profile,
      audibleRPM: 900,
      lastThrottle: throttle,
      lastKmh: kmh,
      previousUpdateAt: ctx.currentTime,
      isFocus: focus,
    };
    this.voices.set(v.id, voice);
    if (profile) void this.loadProfile(profile).then(buffers => {
      if (buffers) this.attachSamples(v.id, voice, buffers);
    });
  }

  updateTelemetry(v: Vehicle, rpm: number, kmh: number, braking: boolean, focus: boolean,
    slip = 0, throttle = 0, brakeIntensity = 0, absActive = false, brakeSlip = 0) {
    if (!this.ctx || this.muted) return;
    if (this.ctx.state === 'suspended') {
      const perfNow = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (perfNow - this.lastResumeAttemptMs > 600) {
        this.lastResumeAttemptMs = perfNow;
        void this.ctx.resume().catch(() => {});
      }
      this.bindGestureUnlock();
    }
    // Garantizar que la lluvia permanezca audible tras reinicios o cambios de escena
    const targetRain = RAIN_GAIN_BY_WEATHER[this.weather];
    if (focus && targetRain > 0 && this.rainGain && this.rainGain.gain.value < targetRain * 0.45) {
      this.applyWeatherGain();
    }
    if (!this.voices.has(v.id)) this.startVehicleSound(v, focus, throttle, kmh);
    const voice = this.voices.get(v.id); if (!voice) return;
    voice.isFocus = focus;
    voice.lastThrottle = throttle;
    voice.lastKmh = kmh;
    const now = this.ctx.currentTime;
    const dt = clamp(now - voice.previousUpdateAt, 0, .06);
    voice.previousUpdateAt = now;

    // Respuesta ágil de RPM para sentir cada aceleración y rebaje con contundencia.
    const targetRPM = clamp(Number.isFinite(rpm) ? rpm : 900, 780, v.fuelType === 'diesel' ? 4500 : 6600);
    const smoothing = 1 - Math.exp(-dt / .095);
    voice.audibleRPM += (targetRPM - voice.audibleRPM) * smoothing;
    const rev = voice.audibleRPM;
    const base = v.fuelType === 'electric' ? 110 + Math.abs(kmh) * 2.3 : 50 + rev * .031;
    voice.engine.frequency.setTargetAtTime(base, now, .055);
    voice.harmonic.frequency.setTargetAtTime(base * 2.02, now, .055);
    voice.exhaustBody.frequency.setTargetAtTime(v.fuelType === 'electric' ? 360 + Math.abs(kmh) * 2.5 : 132 + rev * .042, now, .06);
    voice.exhaustBody.gain.setTargetAtTime(v.fuelType === 'electric' ? 2.5 : 2.5 + clamp(throttle, 0, 1) * 5.5, now, .07);
    voice.tone.frequency.setTargetAtTime(420 + rev * .38 + throttle * 1380, now, .06);

    const levels = computeEngineVoiceLevels({
      focus,
      throttle,
      rpm: rev,
      kmh,
      hasSampledClips: Boolean(voice.sampled && voice.profile),
    });
    voice.gain.gain.setTargetAtTime(levels.synthGain, now, .08);

    if (voice.sampled && voice.profile) {
      const p = voice.profile;
      // Mezcla por regiones de RPM, sin cambiar de sonido abruptamente.
      const idleW = clamp((2200 - rev) / 1250, 0, 1);
      const cruiseW = clamp((rev - 900) / 1200, 0, 1) * clamp((5900 - rev) / 1750, 0, 1);
      const loadW = clamp((rev - 2700) / 1850, 0, 1);
      const weights = [idleW, cruiseW, loadW];
      const sum = weights.reduce((a, b) => a + b, 0) || 1;
      CLIPS.forEach((clip, i) => {
        const speed = clamp(rev / p.sampleRPM[clip], .68, 1.68) * p.tone;
        voice.sampled!.sources[i].playbackRate.setTargetAtTime(speed, now, .07);
        const gain = (weights[i] / sum) * levels.sampledLevel;
        voice.sampled!.gains[i].gain.setTargetAtTime(gain, now, .07);
      });
    }

    // Frenada brusca + leve pulsación mecánica de ABS (14 Hz)
    const brakingAudio = computeBrakingAudioLevels({
      focus,
      brakeIntensity,
      kmh,
      brakeSlip,
      tireSlip: slip,
      absActive,
      timeSec: now,
    });
    voice.brakeFilter.frequency.setTargetAtTime(brakingAudio.filterHz, now, .045);
    voice.brakeGain.gain.setTargetAtTime(brakingAudio.brakeGain, now, .035);
    voice.absOsc.frequency.setTargetAtTime(118 + clamp(Math.abs(kmh) * 0.45, 0, 48), now, .04);
    voice.absGain.gain.setTargetAtTime(brakingAudio.absGain, now, .025);
    voice.tireGain.gain.setTargetAtTime(brakingAudio.tireSkidGain, now, .065);
    void braking;
  }

  playImpact(strength = .6) {
    const output = this.getSfxOutput();
    if (!this.ctx || !output || this.muted) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
    const t = this.ctx.currentTime;
    if (t - this.lastImpactAt < .12) return;
    this.lastImpactAt = t;
    const v = clamp(strength, .12, 1);
    const source = this.ctx.createOscillator(); source.type = 'triangle';
    source.frequency.setValueAtTime(115 + v * 95, t);
    source.frequency.exponentialRampToValueAtTime(38, t + .19);
    const gain = this.ctx.createGain(); gain.gain.setValueAtTime(.0001, t);
    gain.gain.exponentialRampToValueAtTime(.56 * v, t + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, t + .22);
    source.connect(gain); gain.connect(output);
    source.start(t); source.stop(t + .23);
    source.onended = () => { source.disconnect(); gain.disconnect(); };
  }

  /** Golpe fuerte y realista de bache/suspensión: sub-grave de neumático + golpe metálico de amortiguador + crujido de asfalto. */
  playSuspensionHit(strength = .75, isPothole = false) {
    const output = this.getSfxOutput();
    if (!this.ctx || !output || this.muted) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
    const t = this.ctx.currentTime;
    if (t - this.lastSuspensionHitAt < (isPothole ? .14 : .22)) return;
    this.lastSuspensionHitAt = t;
    const v = clamp(isPothole ? Math.max(0.68, strength) : strength, .20, 1);
    this.suspensionHitCount += 1;
    this.lastSuspensionStrength = v;

    // 1. Sub-grave profundo de compresión de cubierta y chasis (132 -> 36 Hz)
    const bass = this.ctx.createOscillator();
    bass.type = 'sine';
    bass.frequency.setValueAtTime(132 + v * 46, t);
    bass.frequency.exponentialRampToValueAtTime(36, t + .20);
    const body = this.ctx.createGain();
    body.gain.setValueAtTime(.0001, t);
    body.gain.linearRampToValueAtTime(.92 * v, t + .006);
    body.gain.exponentialRampToValueAtTime(.0001, t + .26);
    bass.connect(body); body.connect(output);
    bass.start(t); bass.stop(t + .27);

    // 2. Golpe seco medio-grave de torreta/amortiguador (285 -> 78 Hz, muy audible en parlantes de celular y notebook)
    const knock = this.ctx.createOscillator();
    knock.type = 'triangle';
    knock.frequency.setValueAtTime(285 + v * 75, t);
    knock.frequency.exponentialRampToValueAtTime(78, t + .12);
    const knockGain = this.ctx.createGain();
    knockGain.gain.setValueAtTime(.0001, t);
    knockGain.gain.linearRampToValueAtTime(.72 * v, t + .005);
    knockGain.gain.exponentialRampToValueAtTime(.0001, t + .15);
    knock.connect(knockGain); knockGain.connect(output);
    knock.start(t); knock.stop(t + .16);

    bass.onended = () => {
      bass.disconnect(); body.disconnect();
      knock.disconnect(); knockGain.disconnect();
    };

    // 3. Crujido de borde de asfalto, piedras y llanta
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * .21));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const env = Math.exp(-i / (length * .24));
      samples[i] = (Math.random() * 2 - 1) * env;
    }
    const grit = this.ctx.createBufferSource(); grit.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 540 + v * 680;
    filter.Q.value = .75;
    const gritGain = this.ctx.createGain();
    gritGain.gain.setValueAtTime(.74 * v, t);
    gritGain.gain.exponentialRampToValueAtTime(.001, t + .20);
    grit.connect(filter); filter.connect(gritGain); gritGain.connect(output);

    // 4. Latigazo agudo de talón/llanta cuando cae en bache profundo
    let rimFilter: BiquadFilterNode | null = null;
    let rimGain: GainNode | null = null;
    if (isPothole || v > 0.55) {
      rimFilter = this.ctx.createBiquadFilter();
      rimFilter.type = 'bandpass';
      rimFilter.frequency.setValueAtTime(1680, t);
      rimFilter.frequency.exponentialRampToValueAtTime(520, t + .065);
      rimFilter.Q.value = 1.1;
      rimGain = this.ctx.createGain();
      rimGain.gain.setValueAtTime(.52 * v, t);
      rimGain.gain.exponentialRampToValueAtTime(.001, t + .07);
      grit.connect(rimFilter);
      rimFilter.connect(rimGain);
      rimGain.connect(output);
    }

    grit.start(t); grit.stop(t + .22);
    grit.onended = () => {
      grit.disconnect(); filter.disconnect(); gritGain.disconnect();
      rimFilter?.disconnect(); rimGain?.disconnect();
    };
  }

  private lastSplashAt = -Infinity;
  private lastWarningToneAt = -Infinity;

  /** Salpicadura de agua sobre bache/charco mojado: spray agudo + chapoteo medio. */
  playWaterSplash(strength = .7) {
    const output = this.getSfxOutput();
    if (!this.ctx || !output || this.muted) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
    const t = this.ctx.currentTime;
    if (t - this.lastSplashAt < .20) return;
    this.lastSplashAt = t;
    const v = clamp(strength, .25, 1);
    const dur = .38 + v * .20;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const u = i / length;
      const env = Math.sin(Math.min(1, u * 9) * Math.PI * .5) * Math.exp(-u * 4.0);
      samples[i] = (Math.random() * 2 - 1) * env;
    }
    const spray = this.ctx.createBufferSource();
    spray.buffer = buffer;
    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(1750 + v * 950, t);
    band.frequency.exponentialRampToValueAtTime(620, t + dur);
    band.Q.value = .85;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(.64 * v, t);
    gain.gain.exponentialRampToValueAtTime(.001, t + dur);
    spray.connect(band);
    band.connect(gain);
    gain.connect(output);
    spray.start(t);
    spray.stop(t + dur + .02);
    spray.onended = () => { spray.disconnect(); band.disconnect(); gain.disconnect(); };
  }

  /** Aviso acústico vial (semáforo en rojo, exceso de velocidad, cinturón o punto ciego). */
  playTrafficWarningTone(urgent = false) {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime;
    if (t - this.lastWarningToneAt < (urgent ? .45 : .85)) return;
    this.lastWarningToneAt = t;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = urgent ? 'sawtooth' : 'triangle';
    const f1 = urgent ? 880 : 660;
    const f2 = urgent ? 620 : 820;
    osc.frequency.setValueAtTime(f1, t);
    osc.frequency.setValueAtTime(f2, t + .09);
    gain.gain.setValueAtTime(.0001, t);
    gain.gain.linearRampToValueAtTime(urgent ? .12 : .085, t + .015);
    gain.gain.setValueAtTime(urgent ? .11 : .075, t + .16);
    gain.gain.exponentialRampToValueAtTime(.0001, t + .24);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + .25);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  /** Clic mecánico al abrochar el cinturón de seguridad. */
  playSeatbeltClick() {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1420, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + .045);
    osc.frequency.setValueAtTime(1880, t + .055);
    osc.frequency.exponentialRampToValueAtTime(760, t + .10);
    gain.gain.setValueAtTime(.0001, t);
    gain.gain.linearRampToValueAtTime(.14, t + .006);
    gain.gain.exponentialRampToValueAtTime(.02, t + .048);
    gain.gain.linearRampToValueAtTime(.15, t + .06);
    gain.gain.exponentialRampToValueAtTime(.0001, t + .115);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + .12);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  /** Sonido de notificación tipo mensaje al recibir comunicaciones de CENTRAL DATACAR. */
  playMessageNotification() {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx || !this.master) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(1318.5, t + .075);
    gain.gain.setValueAtTime(.0001, t);
    gain.gain.linearRampToValueAtTime(.11, t + .012);
    gain.gain.exponentialRampToValueAtTime(.045, t + .072);
    gain.gain.linearRampToValueAtTime(.13, t + .085);
    gain.gain.exponentialRampToValueAtTime(.0001, t + .24);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + .25);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  /** Sirena policial bitonal al atropellar a un peatón e ir detenido a la comisaría. */
  playPoliceSiren() {
    this.clearSuspendTimer();
    if (!this.ctx || !this.master || this.muted) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    const cycles = 4;
    for (let i = 0; i < cycles; i++) {
      const base = t + i * 0.42;
      osc.frequency.setValueAtTime(670, base);
      osc.frequency.linearRampToValueAtTime(980, base + 0.21);
      osc.frequency.linearRampToValueAtTime(670, base + 0.42);
    }
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.16, t + 0.04);
    gain.gain.setValueAtTime(0.14, t + cycles * 0.42 - 0.12);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + cycles * 0.42 + 0.06);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + cycles * 0.42 + 0.08);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  /**
   * Trueno realista multicapa para el modo Tormenta (`storm`):
   * - Retardo acústico según proximidad del rayo (velocidad del sonido)
   * - Chasquido eléctrico inicial de alta tensión si la centella cae cerca
   * - Onda de choque sub-grave (32–68 Hz) + retumbo rodante de nubes con ecos naturales
   * - Se cancela de inmediato al terminar la carrera (`stopAll`) o silenciar (`setMuted`).
   */
  playThunder(proximity01 = 0.78) {
    if (this.muted || !this.ctx || !this.master || typeof window === 'undefined') return;
    const prox = clamp(proximity01, 0.25, 1);
    const delayMs = Math.round((1 - prox) * 420);

    const triggerThunderSynthesis = () => {
      this.thunderTimers.delete(timerId);
      const output = this.getSfxOutput();
      if (this.muted || !this.ctx || !output || this.weather !== 'storm') return;
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});

      const ctx = this.ctx;
      const t = ctx.currentTime;
      if (t - this.lastThunderAt < 0.85) return;
      this.lastThunderAt = t;

      const rumbleDur = 2.75 + (1 - prox * 0.28) * 1.10;
      const sampleLen = Math.max(1, Math.floor(ctx.sampleRate * rumbleDur));
      const rumbleBuf = ctx.createBuffer(1, sampleLen, ctx.sampleRate);
      const ch = rumbleBuf.getChannelData(0);

      // Ruido atmosférico de alta energía normalizado con 3 oleadas de eco entre nubes (audible en parlantes chicos y grandes)
      let lp = 0;
      let maxAbs = 0.001;
      for (let i = 0; i < sampleLen; i++) {
        const sec = i / ctx.sampleRate;
        const u = i / sampleLen;
        const white = Math.random() * 2 - 1;
        lp = lp * 0.84 + white * 0.16;
        const mix = lp * 0.72 + white * 0.28;
        const swell1 = Math.exp(-Math.pow((sec - 0.10) / 0.22, 2)) * 1.0;
        const swell2 = Math.exp(-Math.pow((sec - 0.66) / 0.44, 2)) * 0.82;
        const swell3 = Math.exp(-Math.pow((sec - 1.48) / 0.72, 2)) * 0.54;
        const tail = Math.exp(-u * 2.8) * 0.38;
        const crackleMod = 0.74 + 0.26 * Math.sin(sec * 29.0 + Math.sin(sec * 11.0) * 2.4);
        const val = mix * (swell1 + swell2 + swell3 + tail) * crackleMod;
        ch[i] = val;
        const a = Math.abs(val);
        if (a > maxAbs) maxAbs = a;
      }
      const normScale = 0.94 / maxAbs;
      for (let i = 0; i < sampleLen; i++) {
        ch[i] = clamp(ch[i] * normScale, -1, 1);
      }

      const rumbleSrc = ctx.createBufferSource();
      rumbleSrc.buffer = rumbleBuf;

      const rumbleLowpass = ctx.createBiquadFilter();
      rumbleLowpass.type = 'lowpass';
      rumbleLowpass.frequency.setValueAtTime(680 + prox * 560, t);
      rumbleLowpass.frequency.exponentialRampToValueAtTime(135, t + rumbleDur);
      rumbleLowpass.Q.value = 1.05;

      const rumbleGain = ctx.createGain();
      const peakGain = 0.76 + prox * 0.30;
      this.thunderCount += 1;
      this.lastThunderPeakGain = peakGain;
      rumbleGain.gain.setValueAtTime(0.0001, t);
      rumbleGain.gain.linearRampToValueAtTime(peakGain, t + 0.035);
      rumbleGain.gain.setValueAtTime(peakGain * 0.88, t + rumbleDur * 0.36);
      rumbleGain.gain.exponentialRampToValueAtTime(0.0001, t + rumbleDur);

      rumbleSrc.connect(rumbleLowpass);
      rumbleLowpass.connect(rumbleGain);
      rumbleGain.connect(output);

      // Sub-grave + medio-bajo de onda de choque (115 -> 30 Hz)
      const subOsc = ctx.createOscillator();
      subOsc.type = 'triangle';
      subOsc.frequency.setValueAtTime(92 + prox * 36, t);
      subOsc.frequency.exponentialRampToValueAtTime(30, t + 1.05);
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.0001, t);
      subGain.gain.linearRampToValueAtTime(0.56 * prox, t + 0.02);
      subGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.12);
      subOsc.connect(subGain);
      subGain.connect(output);

      // Estallido eléctrico seco inicial de rayo
      let snapSrc: AudioBufferSourceNode | null = null;
      let snapFilter: BiquadFilterNode | null = null;
      let snapGain: GainNode | null = null;
      if (prox > 0.30) {
        const snapLen = Math.max(1, Math.floor(ctx.sampleRate * 0.24));
        const snapBuf = ctx.createBuffer(1, snapLen, ctx.sampleRate);
        const snapData = snapBuf.getChannelData(0);
        for (let i = 0; i < snapLen; i++) {
          const u = i / snapLen;
          snapData[i] = (Math.random() * 2 - 1) * Math.exp(-u * 7.8);
        }
        snapSrc = ctx.createBufferSource();
        snapSrc.buffer = snapBuf;
        snapFilter = ctx.createBiquadFilter();
        snapFilter.type = 'bandpass';
        snapFilter.frequency.setValueAtTime(1850, t);
        snapFilter.frequency.exponentialRampToValueAtTime(420, t + 0.22);
        snapFilter.Q.value = 0.85;
        snapGain = ctx.createGain();
        snapGain.gain.setValueAtTime(0.62 * prox, t);
        snapGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.23);
        snapSrc.connect(snapFilter);
        snapFilter.connect(snapGain);
        snapGain.connect(output);
        snapSrc.start(t);
        snapSrc.stop(t + 0.24);
      }

      const cleanupThunder = () => {
        this.activeThunderDisposers.delete(cleanupThunder);
        try { rumbleSrc.stop(); } catch { /* finalizado */ }
        try { subOsc.stop(); } catch { /* finalizado */ }
        try { snapSrc?.stop(); } catch { /* finalizado */ }
        try { rumbleSrc.disconnect(); } catch { /* desconectado */ }
        try { rumbleLowpass.disconnect(); } catch { /* desconectado */ }
        try { rumbleGain.disconnect(); } catch { /* desconectado */ }
        try { subOsc.disconnect(); } catch { /* desconectado */ }
        try { subGain.disconnect(); } catch { /* desconectado */ }
        try { snapSrc?.disconnect(); } catch { /* desconectado */ }
        try { snapFilter?.disconnect(); } catch { /* desconectado */ }
        try { snapGain?.disconnect(); } catch { /* desconectado */ }
      };

      this.activeThunderDisposers.add(cleanupThunder);
      rumbleSrc.onended = cleanupThunder;

      rumbleSrc.start(t);
      rumbleSrc.stop(t + rumbleDur + 0.03);
      subOsc.start(t);
      subOsc.stop(t + 1.15);
    };

    const timerId = window.setTimeout(triggerThunderSynthesis, Math.max(0, delayMs));
    this.thunderTimers.add(timerId);
  }

  stopAll(fadeSeconds = 0.12) {
    this.stopCountdownTones();
    this.clearThunderAudio();
    this.clearSuspendTimer();
    const ctx = this.ctx;
    const now = ctx?.currentTime ?? 0;
    const safeFade = Math.max(0.03, fadeSeconds);
    const endAt = now + safeFade;
    const fadeGain = (gain: GainNode) => {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
      gain.gain.linearRampToValueAtTime(0.0001, endAt);
    };
    for (const voice of this.voices.values()) {
      fadeGain(voice.gain);
      fadeGain(voice.tireGain);
      fadeGain(voice.brakeGain);
      fadeGain(voice.absGain);
      const sources = [voice.engine, voice.harmonic, voice.absOsc, voice.source];
      for (const src of sources) {
        try { src.stop(endAt + 0.02); } catch { /* stopped */ }
        src.onended = () => {
          try { src.disconnect(); } catch { /* liberado */ }
          if (src === voice.source) {
            voice.exhaustBody.disconnect();
            voice.tone.disconnect(); voice.gain.disconnect(); voice.tireGain.disconnect();
            voice.brakeFilter.disconnect(); voice.brakeGain.disconnect();
            voice.absFilter.disconnect(); voice.absGain.disconnect();
          }
        };
      }
      if (voice.sampled) {
        voice.sampled.gains.forEach(fadeGain);
        voice.sampled.sources.forEach((src, i) => {
          try { src.stop(endAt + 0.02); } catch { /* stopped */ }
          const g = voice.sampled!.gains[i];
          src.onended = () => { src.disconnect(); g.disconnect(); };
        });
      }
    }
    this.voices.clear();
    if (this.rainGain && ctx) {
      this.rainGain.gain.cancelScheduledValues(now);
      this.rainGain.gain.setValueAtTime(Math.max(0.0001, this.rainGain.gain.value), now);
      this.rainGain.gain.linearRampToValueAtTime(0, endAt);
    }
  }
}
export const soundEngine = new EngineSoundSynthesizer();
if (typeof window !== 'undefined') {
  (window as Window & { __datacarSfx?: EngineSoundSynthesizer }).__datacarSfx = soundEngine;
}
