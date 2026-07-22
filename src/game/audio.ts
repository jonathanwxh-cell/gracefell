// GRACEFELL — procedural audio engine (Web Audio API, no assets)

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private musicNodes: AudioNode[] = [];
  private drumTimer: number | null = null;
  muted = false;
  phase = 1;

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = 1;
    this.sfx.connect(this.master);
    this.music = this.ctx.createGain();
    this.music.gain.value = 0.34;
    this.music.connect(this.master);
    this.startDrone();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.05);
  }

  private now() { return this.ctx ? this.ctx.currentTime : 0; }

  // ---- primitives ------------------------------------------------------
  private tone(opts: {
    freq: number; freqEnd?: number; dur: number; type?: OscillatorType;
    gain?: number; attack?: number; dest?: AudioNode; detune?: number;
  }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.now();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(opts.freq, t0);
    if (opts.freqEnd !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.freqEnd), t0 + opts.dur);
    if (opts.detune) o.detune.value = opts.detune;
    const gv = opts.gain ?? 0.3;
    const atk = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gv, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    o.connect(g).connect(opts.dest ?? this.sfx);
    o.start(t0);
    o.stop(t0 + opts.dur + 0.05);
  }

  private noise(opts: {
    dur: number; gain?: number; type?: BiquadFilterType; freq?: number; freqEnd?: number;
    q?: number; attack?: number; dest?: AudioNode;
  }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.now();
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * opts.dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
    f.frequency.setValueAtTime(opts.freq ?? 1200, t0);
    if (opts.freqEnd !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(10, opts.freqEnd), t0 + opts.dur);
    f.Q.value = opts.q ?? 0.8;
    const g = this.ctx.createGain();
    const gv = opts.gain ?? 0.25;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gv, t0 + (opts.attack ?? 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    src.connect(f).connect(g).connect(opts.dest ?? this.sfx);
    src.start(t0);
    src.stop(t0 + opts.dur + 0.05);
  }

  // ---- SFX --------------------------------------------------------------
  swing() { this.noise({ dur: 0.16, gain: 0.16, freq: 2600, freqEnd: 500, q: 1.4 }); }
  swingHeavy() { this.noise({ dur: 0.3, gain: 0.22, freq: 1400, freqEnd: 240, q: 1.2 }); }
  hit(heavy = false) {
    this.tone({ freq: heavy ? 130 : 180, freqEnd: 45, dur: heavy ? 0.28 : 0.16, type: 'sine', gain: heavy ? 0.5 : 0.34 });
    this.noise({ dur: 0.12, gain: 0.3, freq: 3200, freqEnd: 700, q: 0.7 });
    if (heavy) this.noise({ dur: 0.25, gain: 0.2, type: 'lowpass', freq: 900, freqEnd: 120 });
  }
  dodge() { this.noise({ dur: 0.24, gain: 0.14, type: 'lowpass', freq: 3000, freqEnd: 300, q: 0.6 }); }
  playerHurt() {
    this.tone({ freq: 220, freqEnd: 90, dur: 0.22, type: 'square', gain: 0.18 });
    this.noise({ dur: 0.18, gain: 0.22, freq: 900, freqEnd: 200 });
  }
  flask() {
    this.tone({ freq: 520, freqEnd: 760, dur: 0.5, type: 'sine', gain: 0.14, attack: 0.08 });
    this.tone({ freq: 780, freqEnd: 1180, dur: 0.6, type: 'sine', gain: 0.09, attack: 0.12 });
  }
  roar(big = false) {
    const dur = big ? 1.6 : 0.9;
    this.tone({ freq: 90, freqEnd: big ? 38 : 55, dur, type: 'sawtooth', gain: 0.42 });
    this.tone({ freq: 62, freqEnd: 30, dur, type: 'square', gain: 0.2, detune: 12 });
    this.noise({ dur, gain: 0.22, type: 'lowpass', freq: 700, freqEnd: 140, q: 0.5, attack: 0.05 });
  }
  slam() {
    this.tone({ freq: 90, freqEnd: 26, dur: 0.6, type: 'sine', gain: 0.6 });
    this.noise({ dur: 0.4, gain: 0.3, type: 'lowpass', freq: 500, freqEnd: 60 });
  }
  telegraph() { this.tone({ freq: 340, freqEnd: 420, dur: 0.18, type: 'triangle', gain: 0.08 }); }
  projectile() { this.tone({ freq: 880, freqEnd: 220, dur: 0.22, type: 'sawtooth', gain: 0.1 }); this.noise({ dur: 0.14, gain: 0.1, freq: 2400, freqEnd: 900 }); }
  meteor() { this.tone({ freq: 60, freqEnd: 24, dur: 0.7, type: 'sine', gain: 0.5 }); this.noise({ dur: 0.5, gain: 0.26, type: 'lowpass', freq: 800, freqEnd: 80 }); }
  stagger() { this.tone({ freq: 660, freqEnd: 990, dur: 0.35, type: 'triangle', gain: 0.16 }); }
  deathSting() {
    this.tone({ freq: 110, freqEnd: 55, dur: 2.4, type: 'sawtooth', gain: 0.3, attack: 0.02 });
    this.tone({ freq: 116.5, freqEnd: 58, dur: 2.4, type: 'sawtooth', gain: 0.24, attack: 0.02 });
    this.noise({ dur: 1.8, gain: 0.12, type: 'lowpass', freq: 400, freqEnd: 60, attack: 0.1 });
  }
  victoryChord() {
    const notes = [220, 277.2, 329.6, 440, 554.4];
    notes.forEach((f, i) => setTimeout(() => this.tone({ freq: f, dur: 2.8, type: 'triangle', gain: 0.14, attack: 0.05 }), i * 90));
    this.tone({ freq: 110, dur: 3.2, type: 'sine', gain: 0.2, attack: 0.1 });
  }
  heartbeat() {
    this.tone({ freq: 58, freqEnd: 40, dur: 0.16, type: 'sine', gain: 0.34 });
    setTimeout(() => this.tone({ freq: 52, freqEnd: 36, dur: 0.14, type: 'sine', gain: 0.24 }), 140);
  }
  parrySpark() { this.tone({ freq: 1320, freqEnd: 1760, dur: 0.14, type: 'triangle', gain: 0.16 }); this.noise({ dur: 0.1, gain: 0.18, freq: 5200, freqEnd: 2600, q: 2 }); }

  // ---- ambient music ----------------------------------------------------
  private startDrone() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 320;
    filt.Q.value = 2.2;
    filt.connect(this.music);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain).connect(filt.frequency);
    lfo.start();
    const freqs = [55, 55.35, 82.4, 110.2];
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i < 2 ? 'sawtooth' : 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = i < 2 ? 0.05 : 0.045;
      o.connect(g).connect(filt);
      o.start();
      this.musicNodes.push(o, g);
    });
    this.musicNodes.push(lfo, lfoGain, filt);
    this.scheduleDrums();
  }

  private scheduleDrums() {
    if (this.drumTimer !== null) window.clearInterval(this.drumTimer);
    let beat = 0;
    this.drumTimer = window.setInterval(() => {
      if (!this.ctx || this.muted) return;
      const b = beat++ % 8;
      if (this.phase === 1) {
        if (b === 0) this.tone({ freq: 68, freqEnd: 34, dur: 0.8, type: 'sine', gain: 0.4, dest: this.music });
      } else if (this.phase === 2) {
        if (b === 0 || b === 3 || b === 5) this.tone({ freq: 72, freqEnd: 32, dur: 0.7, type: 'sine', gain: 0.5, dest: this.music });
        if (b === 6) this.noise({ dur: 0.3, gain: 0.12, type: 'lowpass', freq: 1200, freqEnd: 200, dest: this.music });
      } else {
        // phase 3 — relentless
        if (b % 2 === 0) this.tone({ freq: 76, freqEnd: 30, dur: 0.55, type: 'sine', gain: 0.52, dest: this.music });
        if (b === 1 || b === 5) this.noise({ dur: 0.22, gain: 0.14, type: 'lowpass', freq: 1600, freqEnd: 260, dest: this.music });
        if (b === 7) this.tone({ freq: 164.8, freqEnd: 155.6, dur: 0.5, type: 'triangle', gain: 0.07, dest: this.music });
      }
    }, 640);
  }

  setPhase(p: number) {
    this.phase = p;
  }
}
