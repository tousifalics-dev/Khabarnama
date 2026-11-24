/**
 * Lightweight Web Audio API Newsroom Ambient Bed.
 * Produces an ultra-low-volume broadcast studio drone + soft telemetry pulse
 * when audio is active so there is never dead air, with smooth gain fade-in/out.
 */
class StudioAudioBed {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private oscLow: OscillatorNode | null = null;
  private oscFifth: OscillatorNode | null = null;
  private lfo: OscillatorNode | null = null;
  private isActive = false;
  private isDucked = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  private buildGraph(ctx: AudioContext): void {
    if (this.masterGain) return;

    const now = ctx.currentTime;

    // Warm low-pass filter so the studio bed stays mellow behind speech
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(340, now);
    filter.Q.setValueAtTime(0.7, now);

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);

    // Subtle newsroom pulse sub-stage
    const pulse = ctx.createGain();
    pulse.gain.setValueAtTime(0.65, now);

    // Warm root + fifth harmonic studio drone (A2 + E3)
    const oscLow = ctx.createOscillator();
    oscLow.type = 'sine';
    oscLow.frequency.setValueAtTime(110, now);

    const oscFifth = ctx.createOscillator();
    oscFifth.type = 'triangle';
    oscFifth.frequency.setValueAtTime(164.81, now);

    const fifthGain = ctx.createGain();
    fifthGain.gain.setValueAtTime(0.28, now);

    // Soft rhythmic newsroom pulse LFO (1.35 Hz) modulating pulseGain gently
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(1.35, now);

    const lfoDepth = ctx.createGain();
    lfoDepth.gain.setValueAtTime(0.18, now);

    lfo.connect(lfoDepth);
    lfoDepth.connect(pulse.gain);

    oscLow.connect(pulse);
    oscFifth.connect(fifthGain);
    fifthGain.connect(pulse);
    pulse.connect(filter);
    filter.connect(master);
    master.connect(ctx.destination);

    oscLow.start(now);
    oscFifth.start(now);
    lfo.start(now);

    this.masterGain = master;
    this.oscLow = oscLow;
    this.oscFifth = oscFifth;
    this.lfo = lfo;
  }

  public start(duckForSpeech = true): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.buildGraph(ctx);
    if (!this.masterGain) return;

    this.isActive = true;
    this.isDucked = duckForSpeech;
    const now = ctx.currentTime;
    const targetGain = duckForSpeech ? 0.012 : 0.022;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(targetGain, now, 0.25);
  }

  public setDucked(ducked: boolean): void {
    if (!this.isActive || !this.ctx || !this.masterGain || this.isDucked === ducked) return;
    this.isDucked = ducked;
    const now = this.ctx.currentTime;
    const targetGain = ducked ? 0.012 : 0.022;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(targetGain, now, 0.18);
  }

  public fadeOut(): void {
    if (!this.isActive || !this.ctx || !this.masterGain) return;
    this.isActive = false;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(0.0001, now, 0.22);
  }

  public dispose(): void {
    this.isActive = false;
    try {
      this.oscLow?.stop();
      this.oscFifth?.stop();
      this.lfo?.stop();
    } catch {
      // Ignore already-stopped nodes
    }
    this.oscLow = null;
    this.oscFifth = null;
    this.lfo = null;
    this.masterGain = null;
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

export const studioAudioBed = new StudioAudioBed();
