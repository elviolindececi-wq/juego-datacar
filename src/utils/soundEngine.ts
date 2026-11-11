import type { Vehicle } from '../types/vehicle';
import type { WeatherMode } from './weatherDynamics.ts';

/**
 * DATACAR ARENA V8.1 — Banco ORIGINAL de sonidos procedimentales grabados a WAV.
 * Son aproximaciones de timbre por arquitectura de motor, NO muestras de los autos reales.
 * WebAudio cruza los clips idle/cruise/load y adapta su velocidad a las RPM en tiempo real.
 * Si el navegador no carga los WAV se mantiene el sintetizador como respaldo.
 */
type ClipName = 'idle' | 'cruise' | 'load';
const CLIPS: ClipName[] = ['idle', 'cruise', 'load'];

type AudioProfile = {
  name: 'tracker' | 'corolla' | 'kicks' | 'carens';
  sampleRPM: Record<ClipName, number>;
  tone: number;
};
const PROFILES: Record<string, AudioProfile> = {
  'chevrolet-tracker-lite': { name: 'tracker', sampleRPM: { idle: 800, cruise: 2600, load: 4800 }, tone: 1.00 },
  'toyota-corolla-cross-seg-2027': { name: 'corolla', sampleRPM: { idle: 900, cruise: 2700, load: 4800 }, tone: .96 },
  'nissan-kicks-2027': { name: 'kicks', sampleRPM: { idle: 900, cruise: 2700, load: 4800 }, tone: 1.04 },
  'kia-carens-ex': { name: 'carens', sampleRPM: { idle: 900, cruise: 2400, load: 3900 }, tone: .91 },
};

type SampleVoice = { sources: AudioBufferSourceNode[]; gains: GainNode[] };
type Voice = {
  engine: OscillatorNode;
  harmonic: OscillatorNode;
  source: AudioBufferSourceNode;
  tone: BiquadFilterNode;
  gain: GainNode;
  tireGain: GainNode;
  brakeGain: GainNode;
  brakeFilter: BiquadFilterNode;
  profile?: AudioProfile;
  sampled?: SampleVoice;
  audibleRPM: number;
  previousUpdateAt: number;
};

const clamp = (value: number, a: number, b: number) => Math.max(a, Math.min(b, value));

class EngineSoundSynthesizer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private rainSource: AudioBufferSourceNode | null = null;
  private muted = false;
  private weather: WeatherMode = 'sunny';
  private lastImpactAt = -Infinity;
  private lastSuspensionHitAt = -Infinity;
  private voices = new Map<string, Voice>();
  private sampleCache = new Map<string, Promise<AudioBuffer[] | null>>();
  private startingTones = new Set<{ oscillator: OscillatorNode; harmonic: OscillatorNode; gain: GainNode }>();

  private noise(): AudioBuffer {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const a = buffer.getChannelData(0);
    for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /** Debe iniciarse desde un clic de usuario: los navegadores bloquean audio automático. */
  unlock() {
    if (!this.ctx) {
      const Constructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Constructor) return;
      this.ctx = new Constructor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : .48;
      this.master.connect(this.ctx.destination);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 1900;
      this.rainGain = this.ctx.createGain(); this.rainGain.gain.value = 0;
      this.rainSource = this.ctx.createBufferSource();
      this.rainSource.buffer = this.noise(); this.rainSource.loop = true;
      this.rainSource.connect(filter); filter.connect(this.rainGain); this.rainGain.connect(this.master);
      this.rainSource.start();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    this.setWeather(this.weather);
    // Sin ovación al cruzar meta: no descargar el audio de aplausos.
  }

  /** 3 pitidos cortos + un tono largo. El navegador exige iniciar el audio desde un clic. */
  playCountdownTone(step: 3 | 2 | 1 | 0) {
    if (this.muted || !this.ctx || !this.master) return;
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
    gain.gain.linearRampToValueAtTime(finalTone ? 0.25 : 0.19, now + 0.012);
    gain.gain.setValueAtTime(finalTone ? 0.25 : 0.19, now + duration * .72);
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
    if (!muted) this.unlock();
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(muted ? 0 : .48, this.ctx.currentTime, .06);
  }
  getIsMuted() { return this.muted; }

  setWeather(mode: WeatherMode) {
    this.weather = mode;
    if (!this.ctx || !this.rainGain) return;
    const vol = mode === 'storm' ? .13 : mode === 'flood' ? .11 : mode === 'rain' ? .07 : 0;
    this.rainGain.gain.setTargetAtTime(vol, this.ctx.currentTime, .16);
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
    if (!ctx || !this.master || this.voices.get(vehicleId) !== voice || voice.sampled || !voice.profile) return;
    const sources: AudioBufferSourceNode[] = [];
    const gains: GainNode[] = [];
    buffers.forEach((buffer, idx) => {
      const src = ctx.createBufferSource();
      src.buffer = buffer; src.loop = true;
      src.playbackRate.value = 1;
      const gain = ctx.createGain(); gain.gain.value = .0001;
      src.connect(gain); gain.connect(this.master!);
      src.start(ctx.currentTime + .02);
      sources.push(src); gains.push(gain);
      void idx;
    });
    voice.sampled = { sources, gains };
  }

  startVehicleSound(v: Vehicle) {
    if (!this.ctx || !this.master || this.voices.has(v.id)) return;
    const ctx = this.ctx;
    const isElectric = v.fuelType === 'electric';
    const engine = ctx.createOscillator();
    engine.type = isElectric ? 'sine' : 'triangle'; engine.frequency.value = isElectric ? 130 : 52;
    const harmonic = ctx.createOscillator();
    harmonic.type = isElectric ? 'triangle' : 'sawtooth'; harmonic.frequency.value = isElectric ? 250 : 104;
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 650;
    const gain = ctx.createGain(); gain.gain.value = .0001;
    engine.connect(tone); harmonic.connect(tone); tone.connect(gain); gain.connect(this.master);
    const source = ctx.createBufferSource(); source.buffer = this.noise(); source.loop = true;
    const tireFilter = ctx.createBiquadFilter(); tireFilter.type = 'bandpass'; tireFilter.frequency.value = 1800; tireFilter.Q.value = 2;
    const tireGain = ctx.createGain(); tireGain.gain.value = 0;
    source.connect(tireFilter); tireFilter.connect(tireGain); tireGain.connect(this.master);
    // Capa separada de fricción de frenado: no suena con una frenada suave.
    // Usa el mismo generador de ruido, sin muestras externas ni cortes de audio.
    const brakeFilter = ctx.createBiquadFilter();
    brakeFilter.type = 'bandpass'; brakeFilter.frequency.value = 1450; brakeFilter.Q.value = .8;
    const brakeGain = ctx.createGain(); brakeGain.gain.value = 0;
    source.connect(brakeFilter); brakeFilter.connect(brakeGain); brakeGain.connect(this.master);
    engine.start(); harmonic.start(); source.start();
    const profile = PROFILES[v.id];
    const voice: Voice = { engine, harmonic, source, tone, gain, tireGain, brakeGain, brakeFilter, profile, audibleRPM: 900, previousUpdateAt: ctx.currentTime };
    this.voices.set(v.id, voice);
    if (profile) void this.loadProfile(profile).then(buffers => {
      if (buffers) this.attachSamples(v.id, voice, buffers);
    });
  }

  updateTelemetry(v: Vehicle, rpm: number, kmh: number, braking: boolean, focus: boolean,
    slip = 0, throttle = 0, brakeIntensity = 0, absActive = false, brakeSlip = 0) {
    if (!this.ctx || this.muted) return;
    if (!this.voices.has(v.id)) this.startVehicleSound(v);
    const voice = this.voices.get(v.id); if (!voice) return;
    const now = this.ctx.currentTime;
    const dt = clamp(now - voice.previousUpdateAt, 0, .06);
    voice.previousUpdateAt = now;

    // Las RPM de la física son una aproximación; amortiguamos los saltos entre marchas.
    const targetRPM = clamp(Number.isFinite(rpm) ? rpm : 900, 780, v.fuelType === 'diesel' ? 4500 : 6600);
    const smoothing = 1 - Math.exp(-dt / .16);
    voice.audibleRPM += (targetRPM - voice.audibleRPM) * smoothing;
    const rev = voice.audibleRPM;
    const base = v.fuelType === 'electric' ? 105 + Math.abs(kmh) * 2.2 : 45 + rev * .026;
    voice.engine.frequency.setTargetAtTime(base, now, .07);
    voice.harmonic.frequency.setTargetAtTime(base * 2.05, now, .07);
    voice.tone.frequency.setTargetAtTime(480 + rev * .28 + throttle * 580, now, .07);

    const vol = focus ? .11 + clamp(throttle, 0, 1) * .09 + Math.min(.055, Math.abs(kmh) / 800) : .015;
    // Respaldo sintético de baja intensidad cuando el banco WAV está activo.
    voice.gain.gain.setTargetAtTime(voice.sampled ? vol * .10 : vol, now, .12);

    if (voice.sampled && voice.profile) {
      const p = voice.profile;
      // Mezcla por regiones de RPM, sin cambiar de sonido abruptamente.
      const idleW = clamp((2200 - rev) / 1250, 0, 1);
      const cruiseW = clamp((rev - 900) / 1200, 0, 1) * clamp((5900 - rev) / 1750, 0, 1);
      const loadW = clamp((rev - 2850) / 1900, 0, 1);
      const weights = [idleW, cruiseW, loadW];
      const sum = weights.reduce((a, b) => a + b, 0) || 1;
      const level = focus ? (.19 + .10 * clamp(throttle, 0, 1)) : .018;
      CLIPS.forEach((clip, i) => {
        const speed = clamp(rev / p.sampleRPM[clip], .68, 1.66) * p.tone;
        voice.sampled!.sources[i].playbackRate.setTargetAtTime(speed, now, .09);
        const gain = weights[i] / sum * level;
        voice.sampled!.gains[i].gain.setTargetAtTime(gain, now, .09);
      });
    }

    // Frenada fuerte: fricción neumático-asfalto, más intensa al acercarse al
    // bloqueo; ABS: pequeña modulación de presión en vez de chirrido permanente.
    const emergency = clamp((brakeIntensity - .66) / .34, 0, 1) *
      clamp((Math.abs(kmh) - 18) / 45, 0, 1);
    const friction = clamp(brakeSlip, 0, 1);
    const pulse = absActive ? .78 + .22 * Math.sin(2 * Math.PI * 12 * now) : 1;
    const brakeVolume = focus ? emergency * (.07 + friction * .24) * pulse : 0;
    voice.brakeFilter.frequency.setTargetAtTime(absActive ? 1400 : 1700 + friction * 1100, now, .06);
    voice.brakeGain.gain.setTargetAtTime(brakeVolume, now, .055);
    const skid = clamp(slip * .50 + (absActive ? 0 : friction * .53), 0, 1);
    voice.tireGain.gain.setTargetAtTime(focus ? skid * .18 : skid * .016, now, .09);
    void braking;
  }

  playImpact(strength = .6) {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime;
    if (t - this.lastImpactAt < .12) return;
    this.lastImpactAt = t;
    const v = clamp(strength, .05, 1);
    const source = this.ctx.createOscillator(); source.type = 'triangle';
    source.frequency.setValueAtTime(80 + v * 80, t);
    source.frequency.exponentialRampToValueAtTime(42, t + .16);
    const gain = this.ctx.createGain(); gain.gain.setValueAtTime(.0001, t);
    gain.gain.exponentialRampToValueAtTime(.07 * v, t + .009);
    gain.gain.exponentialRampToValueAtTime(.0001, t + .20);
    source.connect(gain); gain.connect(this.master);
    source.start(t); source.stop(t + .21);
    source.onended = () => { source.disconnect(); gain.disconnect(); };
  }

  /** Golpe seco de suspensión: grave de chasis + traqueteo de piedra, según impacto. */
  playSuspensionHit(strength = .6) {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime;
    if (t - this.lastSuspensionHitAt < .28) return;
    this.lastSuspensionHitAt = t;
    const v = clamp(strength, .12, 1);
    const bass = this.ctx.createOscillator();
    bass.type = 'sine';
    bass.frequency.setValueAtTime(108 + v * 40, t);
    bass.frequency.exponentialRampToValueAtTime(43, t + .15);
    const body = this.ctx.createGain();
    body.gain.setValueAtTime(.0001, t);
    body.gain.exponentialRampToValueAtTime(.23 * v, t + .006);
    body.gain.exponentialRampToValueAtTime(.0001, t + .21);
    bass.connect(body); body.connect(this.master);
    bass.start(t); bass.stop(t + .22);
    bass.onended = () => { bass.disconnect(); body.disconnect(); };

    const length = Math.max(1, Math.floor(this.ctx.sampleRate * .17));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) samples[i] = (Math.random() * 2 - 1) * Math.exp(-i / (length * .20));
    const grit = this.ctx.createBufferSource(); grit.buffer = buffer;
    const filter = this.ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 600 + v * 650; filter.Q.value = .8;
    const gritGain = this.ctx.createGain(); gritGain.gain.value = .25 * v;
    grit.connect(filter); filter.connect(gritGain); gritGain.connect(this.master);
    grit.start(t); grit.stop(t + .18);
    grit.onended = () => { grit.disconnect(); filter.disconnect(); gritGain.disconnect(); };
  }

  stopAll(fadeSeconds = 0.15) {
    this.stopCountdownTones();
    const now = this.ctx?.currentTime ?? 0;
    const endAt = now + Math.max(0.04, fadeSeconds);
    const fadeGain = (gain: GainNode) => {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
      gain.gain.linearRampToValueAtTime(0.0001, endAt);
    };
    for (const voice of this.voices.values()) {
      // Cortar inmediatamente los nodos crea un clic audible. Dejarlos
      // terminar detrás de una rampa de 150–220 ms y liberar al finalizar.
      fadeGain(voice.gain);
      fadeGain(voice.tireGain);
      fadeGain(voice.brakeGain);
      const sources = [voice.engine, voice.harmonic, voice.source];
      for (const src of sources) {
        try { src.stop(endAt + 0.03); } catch { /* stopped */ }
        src.onended = () => {
          try { src.disconnect(); } catch { /* liberado */ }
          if (src === voice.source) {
            voice.tone.disconnect(); voice.gain.disconnect(); voice.tireGain.disconnect();
            voice.brakeFilter.disconnect(); voice.brakeGain.disconnect();
          }
        };
      }
      if (voice.sampled) {
        voice.sampled.gains.forEach(fadeGain);
        voice.sampled.sources.forEach((src, i) => {
          try { src.stop(endAt + 0.03); } catch { /* stopped */ }
          const g = voice.sampled!.gains[i];
          src.onended = () => { src.disconnect(); g.disconnect(); };
        });
      }
      // El GC liberará el resto de nodos después del fade. Evita desconexión
      // sincrónica que podía causar artefactos en la meta.
    }
    this.voices.clear();
    if (this.rainGain && this.ctx) this.rainGain.gain.setTargetAtTime(0, this.ctx.currentTime, .04);
  }
}
export const soundEngine = new EngineSoundSynthesizer();
