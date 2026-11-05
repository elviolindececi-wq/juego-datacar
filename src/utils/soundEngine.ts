import { Vehicle } from '../types/vehicle';

class EngineSoundSynthesizer {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private oscillators: Map<string, {
    osc1: OscillatorNode;
    osc2: OscillatorNode;
    noiseGain: GainNode;
    filter: BiquadFilterNode;
    gain: GainNode;
    screechGain: GainNode;
  }> = new Map();
  private masterGain: GainNode | null = null;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 0.4, this.ctx.currentTime);
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public startVehicleSound(vehicle: Vehicle) {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;
    if (this.oscillators.has(vehicle.id)) return;

    try {
      const isElectric = vehicle.fuelType === 'electric';
      const isDiesel = vehicle.fuelType === 'diesel';

      // 1. Oscilador primario de frecuencia base (pistones / bobina)
      const osc1 = this.ctx.createOscillator();
      osc1.type = isElectric ? 'sine' : isDiesel ? 'sawtooth' : 'triangle';
      osc1.frequency.setValueAtTime(isElectric ? 180 : isDiesel ? 55 : 65, this.ctx.currentTime);

      // 2. Oscilador secundario (armónicos del escape)
      const osc2 = this.ctx.createOscillator();
      osc2.type = isElectric ? 'triangle' : 'sawtooth';
      osc2.frequency.setValueAtTime(isElectric ? 360 : isDiesel ? 110 : 130, this.ctx.currentTime);

      // 3. Filtro pasa-bajos para cuerpo del motor
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(isElectric ? 1200 : isDiesel ? 450 : 650, this.ctx.currentTime);

      // 4. Ganancia del motor
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, this.ctx.currentTime);

      // 5. Chirrido de frenada o derrape (ruido blanco filtrado en alta frecuencia)
      const bufferSize = this.ctx.sampleRate * 1;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const screechFilter = this.ctx.createBiquadFilter();
      screechFilter.type = 'bandpass';
      screechFilter.frequency.setValueAtTime(2600, this.ctx.currentTime);
      screechFilter.Q.setValueAtTime(4.0, this.ctx.currentTime);

      const screechGain = this.ctx.createGain();
      screechGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

      whiteNoise.connect(screechFilter);
      screechFilter.connect(screechGain);
      screechGain.connect(this.masterGain);
      whiteNoise.start();

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc1.start();
      osc2.start();

      this.oscillators.set(vehicle.id, {
        osc1,
        osc2,
        noiseGain: screechGain,
        filter,
        gain,
        screechGain,
      });
    } catch (e) {
      console.warn('Audio init error:', e);
    }
  }

  public updateTelemetry(
    vehicle: Vehicle,
    rpm: number,
    speedKmh: number,
    isBraking: boolean,
    isFocus: boolean
  ) {
    if (!this.ctx || this.isMuted) return;
    const voice = this.oscillators.get(vehicle.id);
    if (!voice) {
      this.startVehicleSound(vehicle);
      return;
    }

    const isElectric = vehicle.fuelType === 'electric';
    const isDiesel = vehicle.fuelType === 'diesel';

    // Frecuencia según RPM
    const normalizedRpm = Math.max(800, Math.min(8500, rpm));
    let baseFreq = isElectric
      ? 120 + (speedKmh / 200) * 600
      : isDiesel
      ? 45 + (normalizedRpm / 4500) * 120
      : 55 + (normalizedRpm / 6500) * 190;

    const t = this.ctx.currentTime;
    voice.osc1.frequency.setTargetAtTime(baseFreq, t, 0.05);
    voice.osc2.frequency.setTargetAtTime(baseFreq * (isDiesel ? 1.5 : 2.0), t, 0.05);

    // Filtro abre a altas RPM (rugido de escape)
    const filterFreq = isElectric
      ? 1200 + speedKmh * 8
      : 350 + (normalizedRpm / 6000) * 1600;
    voice.filter.frequency.setTargetAtTime(filterFreq, t, 0.05);

    // Volumen: vehículo en foco suena más fuerte
    const targetVol = isFocus ? 0.28 : 0.08;
    voice.gain.gain.setTargetAtTime(speedKmh > 0.5 ? targetVol : 0.06, t, 0.08);

    // Sonido de chirrido de neumáticos al frenar bruscamente en curva
    if (isBraking && speedKmh > 25) {
      const screechVol = isFocus ? 0.22 : 0.08;
      voice.screechGain.gain.setTargetAtTime(screechVol, t, 0.04);
    } else {
      voice.screechGain.gain.setTargetAtTime(0.0001, t, 0.08);
    }
  }

  public stopAll() {
    this.oscillators.forEach(({ osc1, osc2, gain, screechGain }) => {
      try {
        osc1.stop();
        osc2.stop();
        gain.disconnect();
        screechGain.disconnect();
      } catch (e) {
        // already stopped
      }
    });
    this.oscillators.clear();
  }
}

export const soundEngine = new EngineSoundSynthesizer();
