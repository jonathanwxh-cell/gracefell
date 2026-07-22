// GRACEFELL — hybrid audio engine (procedural SFX + generated soundtrack)

export type BossAudioCue = 'ui' | 'swipe' | 'slam' | 'charge' | 'volley' | 'meteor' | 'ring' | 'spiral';

export interface SpatialAudio {
  pan: number;
  distance: number;
}

type VoicePriority = 'normal' | 'critical';
type SpatialInput = SpatialAudio | number;

interface VoiceVariation {
  pitch: number;
  filter: number;
  gain: number;
  duration: number;
  delay: number;
}

interface ToneOptions {
  freq: number;
  freqEnd?: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  dest?: AudioNode;
  detune?: number;
  when?: number;
  spatial?: SpatialInput;
  reverb?: number;
  priority?: VoicePriority;
  variation?: VoiceVariation;
}

interface NoiseOptions {
  dur: number;
  gain?: number;
  type?: BiquadFilterType;
  freq?: number;
  freqEnd?: number;
  q?: number;
  attack?: number;
  dest?: AudioNode;
  when?: number;
  spatial?: SpatialInput;
  reverb?: number;
  priority?: VoicePriority;
  variation?: VoiceVariation;
}

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private proceduralMusic!: GainNode;
  private droneMusic!: GainNode;
  private drumsMusic!: GainNode;
  private tensionMusic!: GainNode;
  private soundtrackMusic!: GainNode;
  private soundtrackFilter!: BiquadFilterNode;
  private limiter!: DynamicsCompressorNode;
  private peakLimiter!: WaveShaperNode;
  private reverb!: ConvolverNode;
  private reverbWet!: GainNode;
  private noiseBuffer: AudioBuffer | null = null;
  private musicNodes: AudioNode[] = [];
  private soundtrackSource: AudioBufferSourceNode | null = null;
  private soundtrackLoadToken = 0;
  private soundtrackState: 'idle' | 'loading' | 'playing' | 'fallback' = 'idle';
  private schedulerTimer: number | null = null;
  private nextBeatAt = 0;
  private beat = 0;
  private activeVoices = 0;
  private readonly maxVoices = 36;
  private readonly musicLevel = 0.28;
  private lastCue = new Map<string, number>();
  private variations = new Map<string, { index: number; at: number; streak: number }>();
  private variationCount = 0;
  private subGateUntil = 0;
  private maxObservedDistance = 0;
  private initCostMs = 0;
  private irBuildCostMs = 0;
  private adaptive = { tension: 0, intensity: 0, staggered: false };
  muted = false;
  phase = 1;

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const audioWindow = window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
    const AC = window.AudioContext || audioWindow.webkitAudioContext;
    if (!AC) return;
    const initStartedAt = performance.now();

    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.78;

    // A limiter is essential in phase three, where projectiles, impacts, drums,
    // and heartbeat can all land in the same few frames on a phone speaker.
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -14;
    this.limiter.knee.value = 16;
    this.limiter.ratio.value = 5;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.18;
    this.peakLimiter = this.ctx.createWaveShaper();
    this.peakLimiter.curve = this.buildLimiterCurve(Math.pow(10, -1 / 20));
    this.peakLimiter.oversample = '2x';
    this.master.connect(this.limiter).connect(this.peakLimiter).connect(this.ctx.destination);

    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = 0.92;
    this.sfx.connect(this.master);

    this.music = this.ctx.createGain();
    this.music.gain.value = this.musicLevel;
    this.music.connect(this.master);

    // Keep the procedural bed alive while the MP3 downloads/decodes. Once the
    // soundtrack is ready, crossfade rather than introducing a silent start.
    this.proceduralMusic = this.ctx.createGain();
    this.proceduralMusic.gain.value = 1;
    this.proceduralMusic.connect(this.music);
    this.droneMusic = this.ctx.createGain();
    this.droneMusic.gain.value = 1;
    this.droneMusic.connect(this.proceduralMusic);
    this.drumsMusic = this.ctx.createGain();
    this.drumsMusic.gain.value = 1;
    this.drumsMusic.connect(this.proceduralMusic);
    this.tensionMusic = this.ctx.createGain();
    this.tensionMusic.gain.value = 0.0001;
    this.tensionMusic.connect(this.proceduralMusic);
    this.soundtrackMusic = this.ctx.createGain();
    this.soundtrackMusic.gain.value = 0.0001;
    this.soundtrackMusic.connect(this.music);
    this.soundtrackFilter = this.ctx.createBiquadFilter();
    this.soundtrackFilter.type = 'lowpass';
    this.soundtrackFilter.frequency.value = 11500;
    this.soundtrackFilter.Q.value = 0.45;
    this.soundtrackFilter.connect(this.soundtrackMusic);

    this.noiseBuffer = this.buildNoiseBuffer(2.5);
    this.reverb = this.ctx.createConvolver();
    const irStartedAt = performance.now();
    this.reverb.buffer = this.buildArenaImpulse(1.9);
    this.irBuildCostMs = performance.now() - irStartedAt;
    this.reverbWet = this.ctx.createGain();
    this.reverbWet.gain.value = 0.19;
    this.reverb.connect(this.reverbWet).connect(this.master);
    this.initCostMs = performance.now() - initStartedAt;

    this.startDrone();
    void this.loadSoundtrack(this.ctx);
  }

  destroy() {
    if (this.schedulerTimer !== null) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    for (const node of this.musicNodes) {
      try {
        const stoppable = node as AudioNode & { stop?: () => void };
        stoppable.stop?.();
        node.disconnect();
      } catch { /* already stopped or disconnected */ }
    }
    this.soundtrackLoadToken++;
    this.soundtrackSource = null;
    this.soundtrackState = 'idle';
    this.musicNodes = [];
    this.lastCue.clear();
    this.variations.clear();
    this.variationCount = 0;
    this.subGateUntil = 0;
    this.maxObservedDistance = 0;
    this.initCostMs = 0;
    this.irBuildCostMs = 0;
    this.adaptive = { tension: 0, intensity: 0, staggered: false };
    const ctx = this.ctx;
    this.ctx = null;
    this.noiseBuffer = null;
    this.activeVoices = 0;
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => {});
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.78, this.ctx.currentTime, 0.035);
  }

  debugState() {
    return {
      initialized: this.ctx !== null,
      contextState: this.ctx?.state ?? 'closed',
      hasLimiter: Boolean(this.limiter),
      hasPeakLimiter: Boolean(this.peakLimiter?.curve),
      hasReusableNoise: Boolean(this.noiseBuffer),
      arenaIrDuration: this.reverb?.buffer?.duration ?? 0,
      activeVoices: this.activeVoices,
      maxVoices: this.maxVoices,
      variationCount: this.variationCount,
      variationKinds: this.variations.size,
      maxObservedDistance: this.maxObservedDistance,
      initCostMs: this.initCostMs,
      irBuildCostMs: this.irBuildCostMs,
      adaptive: { ...this.adaptive },
      phase: this.phase,
      soundtrackState: this.soundtrackState,
    };
  }

  private now() { return this.ctx ? this.ctx.currentTime : 0; }
  private clampPan(pan = 0) { return Math.max(-1, Math.min(1, pan)); }

  private buildLimiterCurve(ceiling: number) {
    const curve = new Float32Array(4096);
    const knee = ceiling * 0.78;
    const shape = 0.95;
    const shapeScale = 1 - Math.exp(-shape);
    for (let i = 0; i < curve.length; i++) {
      const x = i / (curve.length - 1) * 2 - 1;
      const magnitude = Math.abs(x);
      if (magnitude <= knee) {
        curve[i] = x;
        continue;
      }
      const normalized = Math.min(1, (magnitude - knee) / (1 - knee));
      const softened = knee + (ceiling - knee) * (1 - Math.exp(-shape * normalized)) / shapeScale;
      curve[i] = Math.sign(x) * softened;
    }
    return curve;
  }

  private buildDistortionCurve(drive: number) {
    const curve = new Float32Array(2048);
    const norm = Math.tanh(drive);
    for (let i = 0; i < curve.length; i++) {
      const x = i / (curve.length - 1) * 2 - 1;
      curve[i] = Math.tanh(x * drive) / norm;
    }
    return curve;
  }

  private resolveSpatial(input: SpatialInput = 0): SpatialAudio {
    if (typeof input === 'number') return { pan: this.clampPan(input), distance: 0 };
    return {
      pan: this.clampPan(input.pan),
      distance: Math.max(0, input.distance),
    };
  }

  private vary(key: string, strength = 1, maskRepeats = false): VoiceVariation {
    const presets = [
      { pitch: 0.965, filter: 0.9, gain: 0.92, duration: 1.06, delay: 0.003 },
      { pitch: 1.035, filter: 1.08, gain: 1.06, duration: 0.94, delay: 0.012 },
      { pitch: 0.99, filter: 1.13, gain: 0.98, duration: 1.03, delay: 0.019 },
      { pitch: 1.055, filter: 0.95, gain: 1.1, duration: 0.97, delay: 0.007 },
    ];
    const now = this.now();
    const previous = this.variations.get(key) ?? { index: -1, at: -Infinity, streak: 0 };
    const index = (previous.index + 1 + Math.floor(Math.random() * (presets.length - 1))) % presets.length;
    const streak = now - previous.at < 0.3 ? previous.streak + 1 : 0;
    const preset = presets[index];
    const repeatGain = maskRepeats ? Math.pow(10, -Math.min(6, streak * 2) / 20) : 1;
    const mix = (value: number) => 1 + (value - 1) * strength;
    this.variations.set(key, { index, at: now, streak });
    this.variationCount++;
    return {
      pitch: mix(preset.pitch) * (1 + (Math.random() - 0.5) * 0.012 * strength),
      filter: mix(preset.filter) * (1 + (Math.random() - 0.5) * 0.018 * strength),
      gain: mix(preset.gain) * repeatGain * (1 + (Math.random() - 0.5) * 0.018 * strength),
      duration: mix(preset.duration) * (1 + (Math.random() - 0.5) * 0.012 * strength),
      delay: preset.delay * strength,
    };
  }

  private buildNoiseBuffer(seconds: number) {
    const ctx = this.ctx!;
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      brown = (brown + 0.025 * white) / 1.025;
      data[i] = white * 0.72 + brown * 0.8;
    }
    return buf;
  }

  private buildArenaImpulse(seconds: number) {
    const ctx = this.ctx!;
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const impulse = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < impulse.numberOfChannels; ch++) {
      const data = impulse.getChannelData(ch);
      let low = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        low = low * 0.965 + white * 0.035;
        const stoneMid = white * 0.32 + (white - low) * 0.68;
        const decay = Math.pow(1 - i / len, 3.25);
        data[i] = stoneMid * decay * (ch === 0 ? 0.92 : 0.87);
      }
    }
    return impulse;
  }

  private allowCue(key: string, gap: number) {
    if (!this.ctx || this.muted) return false;
    const now = this.ctx.currentTime;
    const last = this.lastCue.get(key) ?? -Infinity;
    if (now - last < gap) return false;
    this.lastCue.set(key, now);
    return true;
  }

  private reserveVoice(priority: VoicePriority) {
    if (this.activeVoices >= this.maxVoices) return false;
    if (priority !== 'critical' && this.activeVoices >= this.maxVoices - 6) return false;
    this.activeVoices++;
    return true;
  }

  private routeVoice(source: AudioNode, dest: AudioNode, spatialInput: SpatialInput, reverb: number) {
    const ctx = this.ctx!;
    const nodes: AudioNode[] = [];
    const spatial = this.resolveSpatial(spatialInput);
    this.maxObservedDistance = Math.max(this.maxObservedDistance, spatial.distance);
    const distanceFilter = ctx.createBiquadFilter();
    distanceFilter.type = 'lowpass';
    distanceFilter.frequency.value = Math.max(1200, 20000 / (1 + spatial.distance / 300));
    distanceFilter.Q.value = 0.35;
    const distanceGain = ctx.createGain();
    distanceGain.gain.value = 1 / (1 + Math.pow(spatial.distance / 260, 2));
    const panner = ctx.createStereoPanner();
    panner.pan.value = spatial.pan;
    source.connect(distanceFilter).connect(distanceGain).connect(panner);
    panner.connect(dest);
    nodes.push(distanceFilter, distanceGain, panner);
    if (reverb > 0) {
      const send = ctx.createGain();
      const distanceWet = 1 + Math.min(1, spatial.distance / 600) * 0.9;
      send.gain.value = reverb * distanceWet;
      panner.connect(send).connect(this.reverb);
      nodes.push(send);
    }
    return nodes;
  }

  // ---- primitives ------------------------------------------------------
  private tone(opts: ToneOptions) {
    if (!this.ctx || this.muted || !this.reserveVoice(opts.priority ?? 'normal')) return;
    const ctx = this.ctx;
    const variation = opts.variation;
    const pitch = variation?.pitch ?? 1;
    const t0 = Math.max(this.now(), opts.when ?? this.now()) + (variation?.delay ?? 0);
    const dur = Math.max(0.004, opts.dur * (variation?.duration ?? 1));
    const attack = Math.min(opts.attack ?? 0.005, dur * 0.75);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(Math.max(1, opts.freq * pitch), t0);
    if (opts.freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.freqEnd * pitch), t0 + dur);
    }
    if (opts.detune) osc.detune.value = opts.detune;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime((opts.gain ?? 0.3) * (variation?.gain ?? 1), t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    const routed = this.routeVoice(gain, opts.dest ?? this.sfx, opts.spatial ?? 0, opts.reverb ?? 0);
    osc.onended = () => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
      for (const node of [osc, gain, ...routed]) {
        try { node.disconnect(); } catch { /* already disconnected */ }
      }
    };
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  private noise(opts: NoiseOptions) {
    if (!this.ctx || !this.noiseBuffer || this.muted || !this.reserveVoice(opts.priority ?? 'normal')) return;
    const ctx = this.ctx;
    const variation = opts.variation;
    const filterVariation = variation?.filter ?? 1;
    const t0 = Math.max(this.now(), opts.when ?? this.now()) + (variation?.delay ?? 0);
    const dur = Math.min(this.noiseBuffer.duration, Math.max(0.004, opts.dur * (variation?.duration ?? 1)));
    const attack = Math.min(opts.attack ?? 0.006, dur * 0.75);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.type ?? 'bandpass';
    filter.frequency.setValueAtTime(Math.max(10, (opts.freq ?? 1200) * filterVariation), t0);
    if (opts.freqEnd !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(10, opts.freqEnd * filterVariation), t0 + dur);
    }
    filter.Q.value = opts.q ?? 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime((opts.gain ?? 0.25) * (variation?.gain ?? 1), t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(gain);
    const routed = this.routeVoice(gain, opts.dest ?? this.sfx, opts.spatial ?? 0, opts.reverb ?? 0);
    src.onended = () => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
      for (const node of [src, filter, gain, ...routed]) {
        try { node.disconnect(); } catch { /* already disconnected */ }
      }
    };
    const maxOffset = Math.max(0, this.noiseBuffer.duration - dur);
    src.start(t0, Math.random() * maxOffset, dur);
  }

  private duckMusic(amount = 0.45, duration = 0.32) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const gain = this.music.gain;
    gain.cancelScheduledValues(t0);
    gain.setValueAtTime(Math.max(0.0001, Math.min(this.musicLevel, gain.value)), t0);
    gain.exponentialRampToValueAtTime(Math.max(0.0001, this.musicLevel * amount), t0 + 0.015);
    gain.exponentialRampToValueAtTime(this.musicLevel, t0 + duration);
  }

  // ---- player and impact SFX ------------------------------------------
  private metalResonance(base: number, heavy: boolean, spatial: SpatialInput, variation: VoiceVariation) {
    const ratios = [1, 2.76, 5.4, 8.9, 13.3];
    const durations = heavy ? [0.5, 0.37, 0.27, 0.18, 0.11] : [0.34, 0.25, 0.18, 0.12, 0.075];
    ratios.forEach((ratio, index) => this.tone({
      freq: base * ratio,
      dur: durations[index],
      type: index < 2 ? 'sine' : 'triangle',
      gain: (heavy ? 0.052 : 0.036) / (1 + index * 0.34),
      spatial,
      reverb: heavy ? 0.3 : 0.22,
      variation,
      priority: index < 2 && heavy ? 'critical' : 'normal',
    }));
  }

  private organicGrowl(big: boolean, spatial: SpatialInput) {
    if (!this.ctx || this.muted || !this.reserveVoice('critical')) return;
    const ctx = this.ctx;
    const inhale = big ? 0.36 : 0;
    if (big) {
      this.noise({ dur: inhale, gain: 0.12, type: 'bandpass', freq: 240, freqEnd: 1800, q: 1.2, attack: 0.28, spatial, reverb: 0.28, priority: 'critical' });
    }
    const t0 = ctx.currentTime + inhale;
    const dur = big ? 1.82 : 0.98;
    const base = big ? 46 : 68;
    const carrier = ctx.createOscillator();
    carrier.type = 'sawtooth';
    carrier.frequency.setValueAtTime(base, t0);
    carrier.frequency.exponentialRampToValueAtTime(base * (big ? 0.58 : 0.7), t0 + dur);
    const sub = ctx.createOscillator();
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(base * 0.51, t0);
    sub.frequency.exponentialRampToValueAtTime(base * 0.34, t0 + dur);
    const subGain = ctx.createGain();
    subGain.gain.value = big ? 0.28 : 0.19;
    const mod = ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.value = base * 0.48;
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(18, t0);
    modGain.gain.exponentialRampToValueAtTime(big ? 430 : 260, t0 + dur * 0.28);
    modGain.gain.exponentialRampToValueAtTime(big ? 82 : 58, t0 + dur);
    mod.connect(modGain).connect(carrier.frequency);

    const voiceSum = ctx.createGain();
    carrier.connect(voiceSum);
    sub.connect(subGain).connect(voiceSum);
    const distortion = ctx.createWaveShaper();
    distortion.curve = this.buildDistortionCurve(big ? 3.8 : 2.35);
    distortion.oversample = '2x';
    voiceSum.connect(distortion);

    const vocalMix = ctx.createGain();
    const body = ctx.createBiquadFilter();
    body.type = 'lowpass';
    body.frequency.setValueAtTime(big ? 2200 : 2800, t0);
    body.frequency.exponentialRampToValueAtTime(big ? 720 : 1050, t0 + dur);
    const bodyGain = ctx.createGain();
    bodyGain.gain.value = 0.48;
    distortion.connect(body).connect(bodyGain).connect(vocalMix);

    const formant1 = ctx.createBiquadFilter();
    formant1.type = 'bandpass'; formant1.Q.value = 4.2;
    formant1.frequency.setValueAtTime(big ? 580 : 720, t0);
    formant1.frequency.exponentialRampToValueAtTime(big ? 330 : 470, t0 + dur);
    const formant1Gain = ctx.createGain(); formant1Gain.gain.value = big ? 0.58 : 0.46;
    const formant2 = ctx.createBiquadFilter();
    formant2.type = 'bandpass'; formant2.Q.value = 4.6;
    formant2.frequency.setValueAtTime(big ? 1380 : 1580, t0);
    formant2.frequency.exponentialRampToValueAtTime(big ? 760 : 980, t0 + dur);
    const formant2Gain = ctx.createGain(); formant2Gain.gain.value = big ? 0.43 : 0.35;
    distortion.connect(formant1).connect(formant1Gain).connect(vocalMix);
    distortion.connect(formant2).connect(formant2Gain).connect(vocalMix);

    const flutter = ctx.createOscillator();
    flutter.type = 'sine';
    flutter.frequency.setValueAtTime((big ? 13 : 16) + Math.random() * 1.8, t0);
    flutter.frequency.linearRampToValueAtTime((big ? 16 : 13) + Math.random() * 1.8, t0 + dur);
    const flutterAmount = ctx.createGain();
    flutterAmount.gain.value = big ? 0.23 : 0.17;
    const flutterStage = ctx.createGain();
    flutterStage.gain.value = 0.72;
    flutter.connect(flutterAmount).connect(flutterStage.gain);
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, t0);
    envelope.gain.exponentialRampToValueAtTime(big ? 0.56 : 0.41, t0 + 0.035);
    envelope.gain.setTargetAtTime(big ? 0.43 : 0.32, t0 + dur * 0.3, 0.13);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    vocalMix.connect(flutterStage).connect(envelope);
    const routed = this.routeVoice(envelope, this.sfx, spatial, big ? 0.38 : 0.3);

    const nodes: AudioNode[] = [carrier, sub, subGain, mod, modGain, voiceSum, distortion, body, bodyGain, formant1, formant1Gain, formant2, formant2Gain, vocalMix, flutter, flutterAmount, flutterStage, envelope, ...routed];
    carrier.onended = () => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
      for (const node of nodes) { try { node.disconnect(); } catch { /* already disconnected */ } }
    };
    for (const osc of [carrier, sub, mod, flutter]) { osc.start(t0); osc.stop(t0 + dur + 0.03); }
  }

  ui() {
    if (!this.allowCue('ui', 0.045)) return;
    this.tone({ freq: 420, freqEnd: 560, dur: 0.11, type: 'triangle', gain: 0.07, reverb: 0.025 });
  }

  swing(comboStep = 0, spatial: SpatialInput = 0) {
    if (!this.allowCue('swing', 0.035)) return;
    const lift = Math.max(0, Math.min(2, comboStep));
    const variation = this.vary(`swing-${lift}`, 0.8);
    this.noise({ dur: 0.14 + lift * 0.018, gain: 0.15 + lift * 0.015, freq: 2800 + lift * 350, freqEnd: 520 + lift * 90, q: 1.5, spatial, reverb: 0.035, variation });
    this.tone({ freq: 280 + lift * 38, freqEnd: 150 + lift * 24, dur: 0.11, type: 'triangle', gain: 0.045, spatial, variation });
  }

  swingHeavy(spatial: SpatialInput = 0) {
    if (!this.allowCue('swing-heavy', 0.055)) return;
    const variation = this.vary('swing-heavy', 0.72);
    this.noise({ dur: 0.31, gain: 0.23, freq: 1650, freqEnd: 210, q: 1.15, spatial, reverb: 0.08, variation });
    this.tone({ freq: 180, freqEnd: 62, dur: 0.25, type: 'triangle', gain: 0.11, spatial, variation });
  }

  hit(heavy = false, spatial: SpatialInput = 0, variant = 0) {
    const key = heavy ? 'hit-heavy' : 'hit';
    if (!this.allowCue(key, 0.035)) return;
    const variation = this.vary(`${key}-${variant % 3}`, 0.7, true);
    this.noise({ dur: heavy ? 0.009 : 0.006, gain: heavy ? 0.34 : 0.25, type: 'highpass', freq: heavy ? 7600 : 9200, freqEnd: 5200, q: 0.55, spatial, reverb: 0.08, variation, priority: heavy ? 'critical' : 'normal' });
    this.noise({ dur: heavy ? 0.19 : 0.11, gain: heavy ? 0.3 : 0.22, type: 'bandpass', freq: heavy ? 620 : 880, freqEnd: heavy ? 190 : 310, q: 0.9, spatial, reverb: heavy ? 0.16 : 0.08, variation, priority: heavy ? 'critical' : 'normal' });
    const now = this.now();
    const subDur = heavy ? 0.38 : 0.19;
    if (now >= this.subGateUntil) {
      this.subGateUntil = now + subDur * 0.92;
      this.tone({ freq: heavy ? 92 : 118, freqEnd: heavy ? 30 : 46, dur: subDur, type: 'sine', gain: heavy ? 0.43 : 0.24, spatial, reverb: heavy ? 0.14 : 0.04, variation, priority: heavy ? 'critical' : 'normal' });
    }
    this.metalResonance(heavy ? 122 : 164, heavy, spatial, variation);
    if (heavy) this.duckMusic(0.5, 0.34);
  }

  dodge(spatial: SpatialInput = 0) {
    if (!this.allowCue('dodge', 0.08)) return;
    const variation = this.vary('dodge', 0.55);
    this.noise({ dur: 0.24, gain: 0.14, type: 'lowpass', freq: 3400, freqEnd: 260, q: 0.55, spatial, reverb: 0.035, variation });
    this.tone({ freq: 150, freqEnd: 82, dur: 0.16, type: 'sine', gain: 0.045, spatial, variation });
  }

  playerHurt(spatial: SpatialInput = 0) {
    const variation = this.vary('player-hurt', 0.52, true);
    this.duckMusic(0.28, 0.46);
    this.noise({ dur: 0.007, gain: 0.2, type: 'highpass', freq: 7200, freqEnd: 4300, spatial, reverb: 0.035, variation, priority: 'critical' });
    this.noise({ dur: 0.075, gain: 0.31, type: 'bandpass', freq: 1050, freqEnd: 680, q: 2.1, spatial, reverb: 0.08, variation, priority: 'critical' });
    this.tone({ freq: 218, freqEnd: 74, dur: 0.27, type: 'square', gain: 0.15, spatial, reverb: 0.07, variation, priority: 'critical' });
    this.tone({ freq: 72, freqEnd: 42, dur: 0.32, type: 'sine', gain: 0.22, spatial, variation, priority: 'critical' });
  }

  flask() {
    if (!this.allowCue('flask', 0.2)) return;
    const variation = this.vary('flask', 0.25);
    this.noise({ dur: 0.08, gain: 0.12, type: 'highpass', freq: 4200, freqEnd: 2600, q: 2.4, reverb: 0.12, variation });
    this.tone({ freq: 540, freqEnd: 780, dur: 0.5, type: 'sine', gain: 0.12, attack: 0.07, reverb: 0.1, variation });
    this.tone({ freq: 820, freqEnd: 1280, dur: 0.62, type: 'triangle', gain: 0.075, attack: 0.11, reverb: 0.12, variation });
  }

  roar(big = false, spatial: SpatialInput = 0) {
    this.duckMusic(big ? 0.2 : 0.43, big ? 1.35 : 0.72);
    this.organicGrowl(big, spatial);
  }

  slam(spatial: SpatialInput = 0) {
    if (!this.allowCue('slam-impact', 0.07)) return;
    const variation = this.vary('slam-impact', 0.38);
    this.duckMusic(0.2, 0.58);
    this.noise({ dur: 0.008, gain: 0.44, type: 'highpass', freq: 8400, freqEnd: 4200, q: 0.5, spatial, reverb: 0.16, variation, priority: 'critical' });
    this.tone({ freq: 96, freqEnd: 24, dur: 0.68, type: 'sine', gain: 0.55, spatial, reverb: 0.23, variation, priority: 'critical' });
    this.noise({ dur: 0.48, gain: 0.27, type: 'lowpass', freq: 620, freqEnd: 52, spatial, reverb: 0.36, variation });
  }

  ring(spatial: SpatialInput = 0) {
    if (!this.allowCue('ring-release', 0.1)) return;
    this.duckMusic(0.46, 0.38);
    this.tone({ freq: 330, freqEnd: 72, dur: 0.72, type: 'sine', gain: 0.2, spatial, reverb: 0.38 });
    this.tone({ freq: 690, freqEnd: 155, dur: 0.56, type: 'triangle', gain: 0.1, detune: -9, spatial, reverb: 0.36 });
    this.noise({ dur: 0.42, gain: 0.1, type: 'bandpass', freq: 1800, freqEnd: 340, q: 1.8, spatial, reverb: 0.32 });
  }

  projectile(spatial: SpatialInput = 0) {
    if (!this.allowCue('projectile', 0.045)) return;
    const variation = this.vary('projectile', 0.52, true);
    this.tone({ freq: 920, freqEnd: 190, dur: 0.22, type: 'sawtooth', gain: 0.085, spatial, reverb: 0.07, variation });
    this.noise({ dur: 0.13, gain: 0.09, freq: 2800, freqEnd: 820, spatial, reverb: 0.05, variation });
  }

  meteorWarning(spatial: SpatialInput = 0) {
    if (!this.allowCue('meteor-warning', 0.11)) return;
    this.tone({ freq: 1180, freqEnd: 170, dur: 0.78, type: 'sawtooth', gain: 0.075, spatial, reverb: 0.34 });
    this.noise({ dur: 0.62, gain: 0.07, type: 'bandpass', freq: 3400, freqEnd: 480, q: 2.2, spatial, reverb: 0.3 });
  }

  meteor(spatial: SpatialInput = 0) {
    if (!this.allowCue('meteor-impact', 0.06)) return;
    const variation = this.vary('meteor-impact', 0.35);
    this.duckMusic(0.22, 0.55);
    this.noise({ dur: 0.009, gain: 0.4, type: 'highpass', freq: 9000, freqEnd: 4800, spatial, reverb: 0.18, variation, priority: 'critical' });
    this.tone({ freq: 64, freqEnd: 22, dur: 0.76, type: 'sine', gain: 0.5, spatial, reverb: 0.26, variation, priority: 'critical' });
    this.noise({ dur: 0.55, gain: 0.24, type: 'lowpass', freq: 920, freqEnd: 65, spatial, reverb: 0.38, variation });
  }

  bossStep(spatial: SpatialInput = 0, intensity = 1) {
    if (!this.allowCue('boss-step', 0.16)) return;
    const variation = this.vary('boss-step', 0.7);
    this.noise({ dur: 0.018, gain: 0.055 * intensity, type: 'highpass', freq: 5400, freqEnd: 2600, q: 1.6, spatial, reverb: 0.18, variation });
    this.tone({ freq: 196, freqEnd: 142, dur: 0.13, type: 'triangle', gain: 0.035 * intensity, spatial, reverb: 0.23, variation });
    this.tone({ freq: 532, freqEnd: 410, dur: 0.08, type: 'sine', gain: 0.018 * intensity, spatial, reverb: 0.24, variation });
  }

  chargeScrape(spatial: SpatialInput = 0) {
    if (!this.allowCue('charge-scrape', 0.075)) return;
    const variation = this.vary('charge-scrape', 0.75, true);
    this.noise({ dur: 0.13, gain: 0.085, type: 'bandpass', freq: 920, freqEnd: 310, q: 1.7, spatial, reverb: 0.16, variation });
    this.tone({ freq: 114, freqEnd: 58, dur: 0.12, type: 'sawtooth', gain: 0.032, spatial, reverb: 0.12, variation });
  }

  stagger(spatial: SpatialInput = 0) {
    this.duckMusic(0.34, 0.52);
    this.tone({ freq: 590, freqEnd: 1080, dur: 0.48, type: 'triangle', gain: 0.17, spatial, reverb: 0.34, priority: 'critical' });
    this.tone({ freq: 884, freqEnd: 1320, dur: 0.62, type: 'sine', gain: 0.075, spatial, reverb: 0.42, priority: 'critical' });
    this.noise({ dur: 0.15, gain: 0.2, type: 'highpass', freq: 4600, freqEnd: 1500, spatial, reverb: 0.28 });
  }

  telegraph(cue: BossAudioCue = 'ui', spatial: SpatialInput = 0) {
    if (cue === 'ui') { this.ui(); return; }
    if (!this.allowCue(`telegraph-${cue}`, 0.06)) return;
    switch (cue) {
      case 'swipe':
        this.noise({ dur: 0.22, gain: 0.09, type: 'bandpass', freq: 1900, freqEnd: 3300, q: 2.4, spatial, reverb: 0.09 });
        this.tone({ freq: 410, freqEnd: 680, dur: 0.19, type: 'triangle', gain: 0.065, spatial });
        break;
      case 'slam':
        this.tone({ freq: 170, freqEnd: 82, dur: 0.5, type: 'triangle', gain: 0.13, spatial, reverb: 0.14 });
        this.tone({ freq: 470, freqEnd: 270, dur: 0.32, type: 'sine', gain: 0.055, spatial });
        break;
      case 'charge':
        this.tone({ freq: 72, freqEnd: 210, dur: 0.62, type: 'sawtooth', gain: 0.13, spatial, reverb: 0.12 });
        this.noise({ dur: 0.58, gain: 0.1, type: 'lowpass', freq: 280, freqEnd: 1500, q: 0.7, spatial, reverb: 0.12 });
        break;
      case 'volley':
        this.tone({ freq: 720, freqEnd: 1220, dur: 0.36, type: 'triangle', gain: 0.08, spatial, reverb: 0.2 });
        this.tone({ freq: 930, freqEnd: 1580, dur: 0.3, type: 'sine', gain: 0.05, detune: 8, spatial, reverb: 0.22 });
        break;
      case 'meteor':
        this.tone({ freq: 390, freqEnd: 120, dur: 0.52, type: 'sawtooth', gain: 0.1, spatial, reverb: 0.26 });
        this.noise({ dur: 0.44, gain: 0.09, type: 'lowpass', freq: 1300, freqEnd: 180, spatial, reverb: 0.22 });
        break;
      case 'ring':
        this.tone({ freq: 240, freqEnd: 540, dur: 0.48, type: 'sine', gain: 0.11, spatial, reverb: 0.3 });
        this.tone({ freq: 365, freqEnd: 790, dur: 0.42, type: 'triangle', gain: 0.05, detune: -11, spatial, reverb: 0.26 });
        break;
      case 'spiral':
        this.tone({ freq: 155, freqEnd: 760, dur: 0.58, type: 'sawtooth', gain: 0.095, spatial, reverb: 0.24 });
        this.tone({ freq: 740, freqEnd: 690, dur: 0.58, type: 'triangle', gain: 0.055, detune: 13, spatial, reverb: 0.28 });
        break;
    }
  }

  deathSting() {
    this.duckMusic(0.12, 1.9);
    this.tone({ freq: 110, freqEnd: 52, dur: 2.35, type: 'sawtooth', gain: 0.28, attack: 0.02, reverb: 0.32, priority: 'critical' });
    this.tone({ freq: 116.5, freqEnd: 56, dur: 2.35, type: 'sawtooth', gain: 0.21, attack: 0.02, detune: -5, reverb: 0.34 });
    this.noise({ dur: 1.8, gain: 0.11, type: 'lowpass', freq: 420, freqEnd: 55, attack: 0.1, reverb: 0.35 });
  }

  victoryChord() {
    if (!this.ctx) return;
    this.duckMusic(0.18, 1.2);
    const t0 = this.ctx.currentTime + 0.025;
    const notes = [220, 277.2, 329.6, 440, 554.4];
    notes.forEach((freq, i) => this.tone({ freq, dur: 2.7, type: 'triangle', gain: 0.12, attack: 0.05, when: t0 + i * 0.09, reverb: 0.38, priority: 'critical' }));
    this.tone({ freq: 110, dur: 3.15, type: 'sine', gain: 0.18, attack: 0.1, when: t0, reverb: 0.34, priority: 'critical' });
  }

  heartbeat() {
    if (!this.ctx || !this.allowCue('heartbeat', 0.25)) return;
    const t0 = this.ctx.currentTime;
    this.tone({ freq: 58, freqEnd: 39, dur: 0.16, type: 'sine', gain: 0.29, when: t0, priority: 'critical' });
    this.tone({ freq: 52, freqEnd: 35, dur: 0.14, type: 'sine', gain: 0.2, when: t0 + 0.14, priority: 'critical' });
  }

  parrySpark(spatial: SpatialInput = 0) {
    this.duckMusic(0.16, 0.42);
    const t0 = this.now();
    this.noise({ dur: 0.045, gain: 0.25, type: 'highpass', freq: 6200, freqEnd: 3600, q: 2.4, when: t0, spatial, reverb: 0.24, priority: 'critical' });
    this.tone({ freq: 1380, freqEnd: 2140, dur: 0.16, type: 'triangle', gain: 0.17, when: t0 + 0.025, spatial, reverb: 0.32, priority: 'critical' });
    this.tone({ freq: 690, freqEnd: 980, dur: 0.2, type: 'sine', gain: 0.09, when: t0 + 0.035, spatial, reverb: 0.28 });
  }

  // ---- ambient music --------------------------------------------------
  private async loadSoundtrack(ctx: AudioContext) {
    const token = ++this.soundtrackLoadToken;
    this.soundtrackState = 'loading';
    try {
      const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
      const response = await fetch(`${base}audio/gracefell-sovereigns-fall.mp3`, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`soundtrack request failed (${response.status})`);
      const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
      if (this.ctx !== ctx || token !== this.soundtrackLoadToken) return;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(this.soundtrackFilter);
      source.onended = () => {
        if (this.ctx !== ctx || this.soundtrackSource !== source) return;
        this.soundtrackSource = null;
        this.soundtrackState = 'fallback';
        const now = ctx.currentTime;
        this.proceduralMusic.gain.cancelScheduledValues(now);
        this.proceduralMusic.gain.setTargetAtTime(1, now, 0.3);
      };
      source.start(ctx.currentTime + 0.04);
      this.soundtrackSource = source;
      this.musicNodes.push(source);
      this.soundtrackState = 'playing';

      const now = ctx.currentTime;
      this.soundtrackMusic.gain.cancelScheduledValues(now);
      this.soundtrackMusic.gain.setValueAtTime(0.0001, now);
      this.soundtrackMusic.gain.exponentialRampToValueAtTime(0.62, now + 1.8);
      this.proceduralMusic.gain.cancelScheduledValues(now);
      this.proceduralMusic.gain.setValueAtTime(Math.max(0.0001, this.proceduralMusic.gain.value), now);
      this.proceduralMusic.gain.exponentialRampToValueAtTime(0.18, now + 1.8);
    } catch {
      if (this.ctx === ctx && token === this.soundtrackLoadToken) this.soundtrackState = 'fallback';
    }
  }

  private startDrone() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    filter.Q.value = 2.2;
    filter.connect(this.droneMusic);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
    const freqs = [55, 55.35, 82.4, 110.2];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i < 2 ? 'sawtooth' : 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.value = i < 2 ? 0.045 : 0.038;
      osc.connect(gain).connect(filter);
      osc.start();
      this.musicNodes.push(osc, gain);
    });
    this.musicNodes.push(lfo, lfoGain, filter);
    this.startTensionLayer();
    this.startDrumScheduler();
  }

  private startTensionLayer() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1250;
    filter.Q.value = 1.8;
    filter.connect(this.tensionMusic);
    const chorus = ctx.createOscillator();
    chorus.frequency.value = 0.17;
    const chorusDepth = ctx.createGain();
    chorusDepth.gain.value = 18;
    chorus.connect(chorusDepth).connect(filter.detune);
    chorus.start();
    const freqs = [146.8, 155.6, 220];
    freqs.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      osc.type = index === 2 ? 'triangle' : 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = index === 1 ? 7 : index === 2 ? -5 : 0;
      const gain = ctx.createGain();
      gain.gain.value = index === 2 ? 0.025 : 0.036;
      osc.connect(gain).connect(filter);
      osc.start();
      this.musicNodes.push(osc, gain);
    });
    this.musicNodes.push(chorus, chorusDepth, filter);
  }

  private startDrumScheduler() {
    if (!this.ctx) return;
    if (this.schedulerTimer !== null) window.clearInterval(this.schedulerTimer);
    this.beat = 0;
    this.nextBeatAt = this.ctx.currentTime + 0.08;
    this.schedulerTimer = window.setInterval(() => this.scheduleAhead(), 50);
    this.scheduleAhead();
  }

  private scheduleAhead() {
    if (!this.ctx) return;
    const horizon = this.ctx.currentTime + 0.18;
    while (this.nextBeatAt < horizon) {
      this.scheduleBeat(this.beat++ % 8, this.nextBeatAt);
      this.nextBeatAt += 0.64;
    }
  }

  private scheduleBeat(beat: number, when: number) {
    if (!this.ctx || this.muted) return;
    if (this.phase === 1) {
      if (beat === 0) this.tone({ freq: 68, freqEnd: 34, dur: 0.8, type: 'sine', gain: 0.34, dest: this.drumsMusic, when });
    } else if (this.phase === 2) {
      if (beat === 0 || beat === 3 || beat === 5) this.tone({ freq: 72, freqEnd: 32, dur: 0.7, type: 'sine', gain: 0.42, dest: this.drumsMusic, when });
      if (beat === 6) this.noise({ dur: 0.3, gain: 0.1, type: 'lowpass', freq: 1200, freqEnd: 200, dest: this.drumsMusic, when });
    } else {
      if (beat % 2 === 0) this.tone({ freq: 76, freqEnd: 30, dur: 0.55, type: 'sine', gain: 0.44, dest: this.drumsMusic, when });
      if (beat === 1 || beat === 5) this.noise({ dur: 0.22, gain: 0.12, type: 'lowpass', freq: 1600, freqEnd: 260, dest: this.drumsMusic, when });
      if (beat === 7) this.tone({ freq: 164.8, freqEnd: 155.6, dur: 0.5, type: 'triangle', gain: 0.06, dest: this.drumsMusic, when });
    }
  }

  updateCombatState(playerHpFraction: number, bossHpFraction: number, staggered: boolean) {
    if (!this.ctx) return;
    const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
    const tension = clamp01((0.35 - playerHpFraction) / 0.25);
    const intensity = clamp01((0.3 - bossHpFraction) / 0.25);
    if (
      Math.abs(tension - this.adaptive.tension) < 0.015
      && Math.abs(intensity - this.adaptive.intensity) < 0.015
      && staggered === this.adaptive.staggered
    ) return;
    this.adaptive = { tension, intensity, staggered };
    const now = this.ctx.currentTime;
    const tensionLevel = Math.max(0.0001, tension * 0.82);
    const drumLevel = staggered ? 0.08 : 1 + intensity * 0.3;
    const droneLevel = 0.94 + tension * 0.06;
    const soundtrackLevel = staggered ? 0.42 : 0.62 + intensity * 0.065 - tension * 0.025;
    const soundtrackCutoff = staggered ? 6200 : 11000 + intensity * 7600 + tension * 900;
    this.tensionMusic.gain.setTargetAtTime(tensionLevel, now, 0.2);
    this.drumsMusic.gain.setTargetAtTime(drumLevel, now, staggered ? 0.055 : 0.16);
    this.droneMusic.gain.setTargetAtTime(droneLevel, now, 0.22);
    this.soundtrackFilter.frequency.setTargetAtTime(soundtrackCutoff, now, 0.2);
    if (this.soundtrackState === 'playing') {
      this.soundtrackMusic.gain.setTargetAtTime(Math.max(0.0001, soundtrackLevel), now, staggered ? 0.07 : 0.2);
    }
  }

  setPhase(phase: number) {
    this.phase = phase;
  }
}
