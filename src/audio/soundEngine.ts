import type { SirenMode } from '../game/types';

export type RadioCommsKind = 'contact' | 'evac' | 'lz' | 'siege' | 'casualty';

type AudioAssetKey =
  | 'explosion'
  | 'pistol'
  | 'gunshot'
  | 'machine_gun'
  | 'distant_gunshots'
  | 'girl_scream'
  | 'shock_scream'
  | 'man_scream_04'
  | 'man_scream'
  | 'zombie_moan'
  | 'zombie_choking'
  | 'zombie_sound'
  | 'zombie_dying';

const AUDIO_ASSET_URLS: Record<AudioAssetKey, string> = {
  explosion: '/assets/aistudio/dragon-studio-loud-explosion-sound-425458_9c4742ca.mp3',
  pistol: '/assets/aistudio/universfield-pistol-shot-278821_1a547a9c.mp3',
  gunshot: '/assets/aistudio/universfield-gunshot-352466_abda9887.mp3',
  machine_gun: '/assets/aistudio/dragon-studio-machine-gun-sfx-631486_353e9571.mp3',
  distant_gunshots: '/assets/aistudio/dragon-studio-distant-gunshots-631485_346c1b13.mp3',
  girl_scream: '/assets/aistudio/freesound_community-girl_scream-6465_c34166f1.mp3',
  shock_scream: '/assets/aistudio/universfield-shock-scream-277572_ed7824f6.mp3',
  man_scream_04: '/assets/aistudio/universfield-man-scream-04-252034_417db859.mp3',
  man_scream: '/assets/aistudio/universfield-man-scream-259682_a3b156e2.mp3',
  zombie_moan: '/assets/aistudio/freesound_community-zombie-moan-44932_e396f275.mp3',
  zombie_choking: '/assets/aistudio/freesound_community-zombie-choking-44937_6ef7c1d5.mp3',
  zombie_sound: '/assets/aistudio/dragon-studio-zombie-sound-357975_be74d581.mp3',
  zombie_dying: '/assets/aistudio/dragon-studio-zombie-dying-sound-357974_e9928886.mp3',
};

export interface SpatialBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface SpatialParams {
  gain: number;
  pan: number;
  cutoffHz: number;
}

interface ScreamProfile {
  baseHz: number;
  peakHz: number;
  endHz: number;
  formant1: number;
  formant2: number;
  dur: number;
  vibratoHz: number;
}

const FEMALE_SCREAM_PROFILES: ScreamProfile[] = [
  { baseHz: 620, peakHz: 940, endHz: 510, formant1: 1150, formant2: 2450, dur: 0.44, vibratoHz: 22 },
  { baseHz: 710, peakHz: 1020, endHz: 590, formant1: 1320, formant2: 2700, dur: 0.38, vibratoHz: 28 },
  { baseHz: 560, peakHz: 850, endHz: 420, formant1: 1040, formant2: 2250, dur: 0.52, vibratoHz: 19 },
  { baseHz: 670, peakHz: 980, endHz: 470, formant1: 1220, formant2: 2580, dur: 0.48, vibratoHz: 25 },
];

const MALE_SCREAM_PROFILES: ScreamProfile[] = [
  { baseHz: 255, peakHz: 410, endHz: 175, formant1: 720, formant2: 1620, dur: 0.46, vibratoHz: 16 },
  { baseHz: 215, peakHz: 350, endHz: 140, formant1: 640, formant2: 1480, dur: 0.52, vibratoHz: 14 },
  { baseHz: 295, peakHz: 455, endHz: 195, formant1: 780, formant2: 1750, dur: 0.4, vibratoHz: 18 },
  { baseHz: 235, peakHz: 380, endHz: 155, formant1: 690, formant2: 1550, dur: 0.49, vibratoHz: 15 },
];

const FEMALE_DEATH_PROFILES: ScreamProfile[] = [
  { baseHz: 790, peakHz: 1080, endHz: 260, formant1: 1250, formant2: 2620, dur: 0.82, vibratoHz: 26 },
  { baseHz: 680, peakHz: 920, endHz: 210, formant1: 1120, formant2: 2380, dur: 0.94, vibratoHz: 21 },
  { baseHz: 840, peakHz: 1150, endHz: 310, formant1: 1380, formant2: 2820, dur: 0.74, vibratoHz: 30 },
  { baseHz: 615, peakHz: 860, endHz: 185, formant1: 1020, formant2: 2210, dur: 0.98, vibratoHz: 18 },
  { baseHz: 745, peakHz: 990, endHz: 245, formant1: 1190, formant2: 2510, dur: 0.86, vibratoHz: 24 },
  { baseHz: 890, peakHz: 1210, endHz: 285, formant1: 1420, formant2: 2900, dur: 0.7, vibratoHz: 28 },
];

const MALE_DEATH_PROFILES: ScreamProfile[] = [
  { baseHz: 285, peakHz: 445, endHz: 92, formant1: 740, formant2: 1680, dur: 0.88, vibratoHz: 17 },
  { baseHz: 235, peakHz: 375, endHz: 76, formant1: 650, formant2: 1490, dur: 0.96, vibratoHz: 14 },
  { baseHz: 325, peakHz: 495, endHz: 108, formant1: 810, formant2: 1820, dur: 0.76, vibratoHz: 20 },
  { baseHz: 205, peakHz: 330, endHz: 68, formant1: 590, formant2: 1360, dur: 1.04, vibratoHz: 12 },
  { baseHz: 265, peakHz: 420, endHz: 86, formant1: 705, formant2: 1590, dur: 0.92, vibratoHz: 16 },
  { baseHz: 345, peakHz: 520, endHz: 115, formant1: 845, formant2: 1880, dur: 0.72, vibratoHz: 22 },
];

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  // Camera Listener State for Zoom, Viewport Bounds & Proximity Spatial Audio
  private camX = 0;
  private camY = 0;
  private camPpm = 2.0;
  private viewHalfW = 400;
  private viewHalfH = 300;
  private viewBounds: SpatialBounds = { minX: -400, maxX: 400, minY: -300, maxY: 300 };

  // Per-category polyphony & anti-clutter timestamps (ms via performance.now)
  private lastShotMs = 0;
  private lastZombieDownMs = 0;
  private lastZombieVocalMs = 0;
  private lastScreamMs = 0;
  private lastDeathScreamMs = 0;
  private lastInfectionMs = 0;
  private lastVomitMs = 0;
  private lastRadioMs = 0;
  private lastExplosionMs = 0;
  private femaleVariantIdx = 0;
  private maleVariantIdx = 0;
  private lastFemaleDeathIdx = -1;
  private lastMaleDeathIdx = -1;

  // Continuous helicopter rotor loop
  private heliRunning = false;
  private heliMasterGain: GainNode | null = null;
  private heliNoiseNode: AudioBufferSourceNode | null = null;
  private heliLfoOsc: OscillatorNode | null = null;
  private heliSubOsc: OscillatorNode | null = null;

  // Continuous multi-harmonic vehicle siren loop with 3 modes
  private sirenMode: SirenMode = 'wail';
  private sirenRunning = false;
  private sirenOscPrimary: OscillatorNode | null = null;
  private sirenOscHarmonic: OscillatorNode | null = null;
  private sirenLfo: OscillatorNode | null = null;
  private sirenLfoDepth: GainNode | null = null;
  private sirenFilter: BiquadFilterNode | null = null;
  private sirenPanner: StereoPannerNode | null = null;
  private sirenGain: GainNode | null = null;
  private sirenPeakGain = 0.068;

  // Cached synth + real MP3 audio buffers
  private gunshotNoiseBuf: AudioBuffer | null = null;
  private longNoiseBuf: AudioBuffer | null = null;
  private sirenCurve: Float32Array<ArrayBuffer> | null = null;
  private decodedBuffers = new Map<AudioAssetKey, AudioBuffer>();
  private loadingAssetsStarted = false;
  private activeVoices = new Map<string, number>();

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) {
      this.stopHelicopterLoop();
      this.stopSirenLoop();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public getListenerPosition(): { x: number; y: number } {
    return { x: this.camX, y: this.camY };
  }

  public getSirenMode(): SirenMode {
    return this.sirenMode;
  }

  /**
   * Updates the 2D tactical camera listener & visible viewport bounds so audio plays only inside the active view.
   */
  public updateListener(
    camX: number,
    camY: number,
    ppm: number,
    viewBoundsOrHalfW: number | SpatialBounds = 400
  ) {
    this.camX = camX;
    this.camY = camY;
    this.camPpm = Math.max(0.05, ppm);
    if (typeof viewBoundsOrHalfW === 'number') {
      const hw = Math.max(45, viewBoundsOrHalfW);
      const hh = hw * 0.72;
      this.viewHalfW = hw;
      this.viewHalfH = hh;
      this.viewBounds = {
        minX: camX - hw,
        maxX: camX + hw,
        minY: camY - hh,
        maxY: camY + hh,
      };
    } else {
      this.viewBounds = viewBoundsOrHalfW;
      this.viewHalfW = Math.max(45, (viewBoundsOrHalfW.maxX - viewBoundsOrHalfW.minX) * 0.5);
      this.viewHalfH = Math.max(40, (viewBoundsOrHalfW.maxY - viewBoundsOrHalfW.minY) * 0.5);
    }
  }

  public isWithinAudioViewport(wx: number, wy: number, maxHearMeters = 320): boolean {
    const edgePad = Math.min(14, this.viewHalfW * 0.05);
    const inViewport =
      wx >= this.viewBounds.minX - edgePad &&
      wx <= this.viewBounds.maxX + edgePad &&
      wy >= this.viewBounds.minY - edgePad &&
      wy <= this.viewBounds.maxY + edgePad;
    const dist = Math.hypot(wx - this.camX, wy - this.camY);
    const screenDiagRadius = Math.hypot(this.viewHalfW, this.viewHalfH) * 0.94;
    const proximityHorizon = Math.min(maxHearMeters, Math.max(85, screenDiagRadius));
    return inViewport && dist <= proximityHorizon;
  }

  /**
   * Computes zoom-weighted viewport & camera-center proximity attenuation.
   * Sounds outside the current visible viewport or proximity radius return gain 0 and are culled.
   */
  public computeSpatial(wx?: number, wy?: number, maxHearMeters = 320): SpatialParams {
    // Zoom factor: ultra-quiet when zoomed far out at sector overview, ramping smoothly to 1.0 on street zoom
    const zoomAtten = Math.max(0, Math.min(1, (this.camPpm - 0.14) / 0.68));

    if (wx === undefined || wy === undefined) {
      return { gain: Math.max(0.05, zoomAtten), pan: 0, cutoffHz: 4200 };
    }

    if (zoomAtten <= 0.02) {
      return { gain: 0, pan: 0, cutoffHz: 600 };
    }

    const edgePad = Math.min(14, this.viewHalfW * 0.05);
    const inViewport =
      wx >= this.viewBounds.minX - edgePad &&
      wx <= this.viewBounds.maxX + edgePad &&
      wy >= this.viewBounds.minY - edgePad &&
      wy <= this.viewBounds.maxY + edgePad;

    const dx = wx - this.camX;
    const dy = wy - this.camY;
    const dist = Math.hypot(dx, dy);

    const screenDiagRadius = Math.hypot(this.viewHalfW, this.viewHalfH) * 0.94;
    const proximityHorizon = Math.min(maxHearMeters, Math.max(85, screenDiagRadius));

    if (!inViewport || dist >= proximityHorizon) {
      return { gain: 0, pan: 0, cutoffHz: 600 };
    }

    const norm = 1 - dist / proximityHorizon;
    const distAtten = Math.pow(norm, 1.45);
    const gain = distAtten * zoomAtten;
    const pan = Math.max(-0.92, Math.min(0.92, dx / Math.max(45, this.viewHalfW)));
    const cutoffHz = 750 + norm * 3800;
    return { gain, pan, cutoffHz };
  }

  private nowMs(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  public preloadAssets() {
    const ctx = this.getContext();
    if (ctx && !this.loadingAssetsStarted) {
      this.startAssetPreload(ctx);
    }
  }

  private startAssetPreload(ctx: AudioContext) {
    if (this.loadingAssetsStarted || typeof fetch === 'undefined') return;
    this.loadingAssetsStarted = true;
    (Object.keys(AUDIO_ASSET_URLS) as AudioAssetKey[]).forEach((key) => {
      const url = AUDIO_ASSET_URLS[key];
      fetch(url)
        .then((res) => (res.ok ? res.arrayBuffer() : null))
        .then((arr) => (arr ? ctx.decodeAudioData(arr) : null))
        .then((decoded) => {
          if (decoded) this.decodedBuffers.set(key, decoded);
        })
        .catch(() => {});
    });
  }

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (!this.loadingAssetsStarted) {
      this.startAssetPreload(this.ctx);
    }
    return this.ctx;
  }

  private playDecodedClip(
    ctx: AudioContext,
    key: AudioAssetKey,
    opts: {
      category: string;
      maxConcurrent: number;
      gain: number;
      pan: number;
      cutoffHz: number;
      dur?: number;
      offsetMin?: number;
      offsetMax?: number;
      playbackRate?: number;
      fadeInSec?: number;
      fadeOutFrac?: number;
    }
  ): boolean {
    const buf = this.decodedBuffers.get(key);
    if (!buf) return false;

    const currentVoices = this.activeVoices.get(opts.category) ?? 0;
    if (currentVoices >= opts.maxConcurrent) return true;

    const now = ctx.currentTime;
    const rate = Math.max(0.4, opts.playbackRate ?? 1);
    const minTail = Math.min(0.28, buf.duration * 0.5);
    const maxSafeOff = Math.max(0, buf.duration - minTail);
    const oMin = Math.min(maxSafeOff, Math.max(0, opts.offsetMin ?? 0));
    const oMax = Math.min(maxSafeOff, Math.max(oMin, opts.offsetMax ?? oMin));
    const offset = oMin + Math.random() * (oMax - oMin);
    const avail = Math.max(0.08, buf.duration - offset);
    const segDur = Math.min(avail, opts.dur ?? avail);
    const realDur = segDur / rate;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.setValueAtTime(rate, now);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.max(450, Math.min(18000, opts.cutoffHz)), now);

    const g = ctx.createGain();
    const fadeIn = Math.min(realDur * 0.25, opts.fadeInSec ?? 0.01);
    const fadeOutStart = realDur * (1 - Math.min(0.65, opts.fadeOutFrac ?? 0.28));
    const peak = Math.max(0.002, Math.min(0.85, opts.gain));

    g.gain.setValueAtTime(0.0005, now);
    g.gain.linearRampToValueAtTime(peak, now + Math.max(0.004, fadeIn));
    if (fadeOutStart > fadeIn + 0.01) {
      g.gain.setValueAtTime(peak, now + fadeOutStart);
    }
    g.gain.exponentialRampToValueAtTime(0.0005, now + Math.max(0.04, realDur));

    src.connect(lp);
    lp.connect(g);
    this.connectOutput(ctx, g, opts.pan);

    this.activeVoices.set(opts.category, currentVoices + 1);
    src.onended = () => {
      const cur = this.activeVoices.get(opts.category) ?? 1;
      this.activeVoices.set(opts.category, Math.max(0, cur - 1));
    };

    src.start(now, offset, segDur);
    src.stop(now + realDur + 0.03);
    return true;
  }

  private createNoiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
    if (seconds === 2 && this.longNoiseBuf) return this.longNoiseBuf;
    const sampleRate = ctx.sampleRate;
    const len = Math.floor(sampleRate * seconds);
    const buffer = ctx.createBuffer(1, len, sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.06 * white) / 1.06;
      data[i] = lastOut * 3.2;
    }
    if (seconds === 2) this.longNoiseBuf = buffer;
    return buffer;
  }

  private getGunshotNoise(ctx: AudioContext): AudioBuffer {
    if (this.gunshotNoiseBuf) return this.gunshotNoiseBuf;
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * 0.45);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const env = Math.exp(-i / (sr * 0.042));
      d[i] = (Math.random() * 2 - 1) * env;
    }
    this.gunshotNoiseBuf = buf;
    return buf;
  }

  private connectOutput(ctx: AudioContext, node: AudioNode, panValue: number) {
    if (typeof ctx.createStereoPanner === 'function' && Math.abs(panValue) > 0.04) {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(panValue, ctx.currentTime);
      node.connect(panner);
      panner.connect(ctx.destination);
    } else {
      node.connect(ctx.destination);
    }
  }

  /**
   * Realistic multi-layered ballistic weapon sounds with camera-zoom & proximity attenuation.
   * Each weapon class (pistol, smg, rifle, heavy, sniper) has a distinct acoustic transient & mechanical cycle.
   */
  public playRealisticShot(
    weapon: 'pistol' | 'smg' | 'rifle' | 'heavy' | 'sniper',
    wx?: number,
    wy?: number
  ) {
    const tMs = this.nowMs();
    const minInterval = weapon === 'smg' ? 32 : weapon === 'heavy' ? 42 : 48;
    if (tMs - this.lastShotMs < minInterval) return;

    const spatial = this.computeSpatial(wx, wy, weapon === 'sniper' ? 380 : weapon === 'heavy' ? 300 : 230);
    if (spatial.gain < 0.035) return;

    const ctx = this.getContext();
    if (!ctx) return;
    this.lastShotMs = tMs;

    // Prefer uploaded realistic MP3 gunfire samples (spatialized, zoomed & polyphony-capped)
    const distantShot = spatial.gain < 0.34;
    if (distantShot) {
      if (
        this.playDecodedClip(ctx, 'distant_gunshots', {
          category: 'shot',
          maxConcurrent: 5,
          gain: Math.min(0.32, spatial.gain * 0.72),
          pan: spatial.pan,
          cutoffHz: spatial.cutoffHz * 1.15,
          dur: 0.45 + Math.random() * 0.35,
          offsetMin: 0.04,
          offsetMax: 1.8,
          playbackRate: 0.94 + Math.random() * 0.12,
          fadeInSec: 0.015,
          fadeOutFrac: 0.4,
        })
      ) {
        return;
      }
    } else {
      const mp3Key: AudioAssetKey =
        weapon === 'pistol'
          ? 'pistol'
          : weapon === 'smg' || weapon === 'heavy'
            ? 'machine_gun'
            : 'gunshot';
      const dur =
        weapon === 'smg'
          ? 0.22
          : weapon === 'heavy'
            ? 0.38
            : weapon === 'sniper'
              ? 0.95
              : weapon === 'rifle'
                ? 0.65
                : 0.52;
      const rate =
        weapon === 'sniper'
          ? 0.78 + Math.random() * 0.06
          : weapon === 'heavy'
            ? 0.85 + Math.random() * 0.07
            : weapon === 'smg'
              ? 1.06 + Math.random() * 0.08
              : 0.95 + Math.random() * 0.1;
      const baseGain =
        weapon === 'sniper'
          ? 0.44
          : weapon === 'heavy'
            ? 0.36
            : weapon === 'rifle'
              ? 0.32
              : weapon === 'smg'
                ? 0.24
                : 0.3;
      const maxOffset = weapon === 'smg' ? 2.2 : weapon === 'heavy' ? 1.8 : 0.02;

      if (
        this.playDecodedClip(ctx, mp3Key, {
          category: 'shot',
          maxConcurrent: 5,
          gain: baseGain * spatial.gain,
          pan: spatial.pan,
          cutoffHz: Math.min(14000, spatial.cutoffHz * 2.2),
          dur,
          offsetMin: 0.01,
          offsetMax: maxOffset,
          playbackRate: rate,
          fadeInSec: 0.006,
          fadeOutFrac: 0.35,
        })
      ) {
        return;
      }
    }

    const now = ctx.currentTime;

    const profiles = {
      pistol: { crackHz: 2350, endHz: 420, punchStart: 220, punchEnd: 66, dur: 0.125, gain: 0.13, q: 1.15, pitchMod: 1.08, boltHz: 3200 },
      smg: { crackHz: 3150, endHz: 680, punchStart: 245, punchEnd: 82, dur: 0.088, gain: 0.105, q: 1.35, pitchMod: 1.18, boltHz: 3900 },
      rifle: { crackHz: 1950, endHz: 260, punchStart: 168, punchEnd: 46, dur: 0.195, gain: 0.15, q: 0.82, pitchMod: 0.96, boltHz: 2700 },
      heavy: { crackHz: 1180, endHz: 145, punchStart: 122, punchEnd: 32, dur: 0.25, gain: 0.175, q: 0.68, pitchMod: 0.78, boltHz: 1850 },
      sniper: { crackHz: 1620, endHz: 190, punchStart: 240, punchEnd: 28, dur: 0.44, gain: 0.23, q: 0.72, pitchMod: 0.86, boltHz: 2250 },
    };
    const p = profiles[weapon];
    const scaledGain = p.gain * spatial.gain;

    // Layer 1: Supersonic propellant crack + air-absorption filter
    const noise = ctx.createBufferSource();
    noise.buffer = this.getGunshotNoise(ctx);
    noise.playbackRate.setValueAtTime(p.pitchMod * (0.95 + Math.random() * 0.1), now);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(p.q, now);
    bp.frequency.setValueAtTime(Math.min(p.crackHz, spatial.cutoffHz), now);
    bp.frequency.exponentialRampToValueAtTime(p.endHz, now + p.dur);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(scaledGain, now);
    nGain.gain.exponentialRampToValueAtTime(0.0006, now + p.dur);

    noise.connect(bp);
    bp.connect(nGain);
    this.connectOutput(ctx, nGain, spatial.pan);
    noise.start(now);
    noise.stop(now + p.dur + 0.02);

    // Layer 2: Chamber bass thump (distinct caliber body resonance)
    const punch = ctx.createOscillator();
    punch.type = weapon === 'heavy' || weapon === 'sniper' ? 'sawtooth' : 'triangle';
    punch.frequency.setValueAtTime(p.punchStart, now);
    punch.frequency.exponentialRampToValueAtTime(p.punchEnd, now + (weapon === 'sniper' ? 0.11 : 0.068));

    const punchLP = ctx.createBiquadFilter();
    punchLP.type = 'lowpass';
    punchLP.frequency.setValueAtTime(weapon === 'heavy' ? 420 : 880, now);

    const pGain = ctx.createGain();
    pGain.gain.setValueAtTime(scaledGain * (weapon === 'heavy' ? 0.92 : 0.76), now);
    pGain.gain.exponentialRampToValueAtTime(0.0008, now + (weapon === 'sniper' ? 0.12 : 0.078));

    punch.connect(punchLP);
    punchLP.connect(pGain);
    this.connectOutput(ctx, pGain, spatial.pan);
    punch.start(now);
    punch.stop(now + 0.13);

    // Layer 3: Crisp mechanical bolt / slide transient snap (high-frequency close-up detail)
    if (spatial.gain > 0.28) {
      const clk = ctx.createOscillator();
      clk.type = 'square';
      clk.frequency.setValueAtTime(p.boltHz, now);
      clk.frequency.exponentialRampToValueAtTime(p.boltHz * 0.45, now + 0.018);
      const clkG = ctx.createGain();
      clkG.gain.setValueAtTime(scaledGain * 0.22, now);
      clkG.gain.exponentialRampToValueAtTime(0.0008, now + 0.022);
      clk.connect(clkG);
      this.connectOutput(ctx, clkG, spatial.pan);
      clk.start(now);
      clk.stop(now + 0.026);
    }

    // Layer 4: Delayed distant urban echo slap for high-caliber sniper/rifle fire
    if ((weapon === 'sniper' || weapon === 'heavy') && spatial.gain > 0.15) {
      const echo = ctx.createBufferSource();
      echo.buffer = this.getGunshotNoise(ctx);
      echo.playbackRate.setValueAtTime(0.68, now + 0.09);
      const echoLp = ctx.createBiquadFilter();
      echoLp.type = 'lowpass';
      echoLp.frequency.setValueAtTime(640, now + 0.09);
      const echoG = ctx.createGain();
      echoG.gain.setValueAtTime(scaledGain * 0.28, now + 0.09);
      echoG.gain.exponentialRampToValueAtTime(0.0006, now + 0.42);
      echo.connect(echoLp);
      echoLp.connect(echoG);
      this.connectOutput(ctx, echoG, -spatial.pan * 0.4);
      echo.start(now + 0.09);
      echo.stop(now + 0.44);
    }
  }

  public playPlacementInvalid() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.setValueAtTime(165, now + 0.07);
    g.gain.setValueAtTime(0.06, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  /**
   * Guttural multi-formant Zombie Growl / Snarl (only heard near zoomed sector).
   */
  public playZombieVocal(wx?: number, wy?: number, aggressive = false) {
    const tMs = this.nowMs();
    if (tMs - this.lastZombieVocalMs < 460) return;

    const spatial = this.computeSpatial(wx, wy, 190);
    if (spatial.gain < 0.045) return;

    const ctx = this.getContext();
    if (!ctx) return;
    this.lastZombieVocalMs = tMs;

    const clipKey: AudioAssetKey = aggressive
      ? Math.random() < 0.55
        ? 'zombie_sound'
        : 'zombie_choking'
      : 'zombie_moan';
    const maxOffset = clipKey === 'zombie_sound' ? 4.8 : 2.1;
    if (
      this.playDecodedClip(ctx, clipKey, {
        category: 'zombie_vocal',
        maxConcurrent: 3,
        gain: (aggressive ? 0.3 : 0.23) * spatial.gain,
        pan: spatial.pan,
        cutoffHz: spatial.cutoffHz * 1.4,
        dur: aggressive ? 0.95 + Math.random() * 0.45 : 1.15 + Math.random() * 0.55,
        offsetMin: 0.08,
        offsetMax: maxOffset,
        playbackRate: 0.92 + Math.random() * 0.16,
        fadeInSec: 0.05,
        fadeOutFrac: 0.32,
      })
    ) {
      return;
    }

    const now = ctx.currentTime;
    const dur = aggressive ? 0.36 : 0.48;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const baseF = aggressive ? 98 + Math.random() * 28 : 76 + Math.random() * 24;
    osc.frequency.setValueAtTime(baseF, now);
    osc.frequency.linearRampToValueAtTime(baseF * 0.74, now + dur);

    // Throat rasp FM wobble
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(24 + Math.random() * 14, now);
    const lfoG = ctx.createGain();
    lfoG.gain.setValueAtTime(16, now);
    lfo.connect(lfoG);
    lfoG.connect(osc.frequency);

    const formant = ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.Q.setValueAtTime(3.2, now);
    formant.frequency.setValueAtTime(Math.min(540, spatial.cutoffHz), now);
    formant.frequency.linearRampToValueAtTime(310, now + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.095 * spatial.gain, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(formant);
    formant.connect(gain);
    this.connectOutput(ctx, gain, spatial.pan);
    osc.start(now);
    lfo.start(now);
    osc.stop(now + dur + 0.02);
    lfo.stop(now + dur + 0.02);
  }

  /**
   * 8 Distinct Synthesized Vocal Screams (4 Female + 4 Male) for civilian panic & casualties.
   * Strictly localized by zoom & distance so map overview never sounds cluttered.
   */
  public playCivilianScream(gender: 'male' | 'female', wx?: number, wy?: number) {
    const tMs = this.nowMs();
    if (tMs - this.lastScreamMs < 380) return;

    const spatial = this.computeSpatial(wx, wy, 220);
    if (spatial.gain < 0.04) return;

    const ctx = this.getContext();
    if (!ctx) return;
    this.lastScreamMs = tMs;

    const screamPool: AudioAssetKey[] =
      gender === 'female' ? ['girl_scream', 'shock_scream'] : ['man_scream_04', 'man_scream'];
    const screamPick =
      screamPool[(gender === 'female' ? this.femaleVariantIdx++ : this.maleVariantIdx++) % screamPool.length];
    if (
      this.playDecodedClip(ctx, screamPick, {
        category: 'scream',
        maxConcurrent: 4,
        gain: 0.34 * spatial.gain,
        pan: spatial.pan,
        cutoffHz: spatial.cutoffHz * 1.8,
        dur: 1.05,
        offsetMin: 0,
        offsetMax: 0.08,
        playbackRate: 0.93 + Math.random() * 0.14,
        fadeInSec: 0.02,
        fadeOutFrac: 0.28,
      })
    ) {
      return;
    }

    const now = ctx.currentTime;

    let profile: ScreamProfile;
    if (gender === 'female') {
      profile = FEMALE_SCREAM_PROFILES[this.femaleVariantIdx % FEMALE_SCREAM_PROFILES.length];
      this.femaleVariantIdx++;
    } else {
      profile = MALE_SCREAM_PROFILES[this.maleVariantIdx % MALE_SCREAM_PROFILES.length];
      this.maleVariantIdx++;
    }

    const dur = profile.dur;
    const voice = ctx.createOscillator();
    voice.type = 'sawtooth';
    voice.frequency.setValueAtTime(profile.baseHz, now);
    voice.frequency.linearRampToValueAtTime(profile.peakHz, now + dur * 0.24);
    voice.frequency.exponentialRampToValueAtTime(profile.endHz, now + dur);

    // Vocal cord distress vibrato
    const vib = ctx.createOscillator();
    vib.type = 'sine';
    vib.frequency.setValueAtTime(profile.vibratoHz, now);
    const vibG = ctx.createGain();
    vibG.gain.setValueAtTime(gender === 'female' ? 28 : 15, now);
    vib.connect(vibG);
    vibG.connect(voice.frequency);

    // Parallel vocal tract formant filters (F1 + F2)
    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.Q.setValueAtTime(3.6, now);
    f1.frequency.setValueAtTime(Math.min(profile.formant1, spatial.cutoffHz), now);

    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.Q.setValueAtTime(4.2, now);
    f2.frequency.setValueAtTime(Math.min(profile.formant2, spatial.cutoffHz), now);

    // Aspirated breath layer
    const breath = ctx.createBufferSource();
    breath.buffer = this.createNoiseBuffer(ctx, 2);
    const breathBp = ctx.createBiquadFilter();
    breathBp.type = 'bandpass';
    breathBp.frequency.setValueAtTime(Math.min(profile.formant2, spatial.cutoffHz), now);
    breathBp.Q.setValueAtTime(1.8, now);

    const masterG = ctx.createGain();
    const peakGain = 0.085 * spatial.gain;
    masterG.gain.setValueAtTime(0.001, now);
    masterG.gain.linearRampToValueAtTime(peakGain, now + 0.04);
    masterG.gain.setValueAtTime(peakGain * 0.88, now + dur * 0.45);
    masterG.gain.exponentialRampToValueAtTime(0.0008, now + dur);

    const breathG = ctx.createGain();
    breathG.gain.setValueAtTime(peakGain * 0.35, now);
    breathG.gain.exponentialRampToValueAtTime(0.0008, now + dur);

    voice.connect(f1);
    voice.connect(f2);
    f1.connect(masterG);
    f2.connect(masterG);
    breath.connect(breathBp);
    breathBp.connect(breathG);

    this.connectOutput(ctx, masterG, spatial.pan);
    this.connectOutput(ctx, breathG, spatial.pan);

    voice.start(now);
    vib.start(now);
    breath.start(now);
    voice.stop(now + dur + 0.03);
    vib.stop(now + dur + 0.03);
    breath.stop(now + dur + 0.03);
  }

  /**
   * 12 Distinct Randomized Agony/Collapse Death Screams (6 Female + 6 Male)
   * with decaying vocal-cord drop, choke tremor, and gasp — strictly gated to active camera viewport.
   */
  public playDeathScream(gender: 'male' | 'female', wx?: number, wy?: number) {
    const tMs = this.nowMs();
    if (tMs - this.lastDeathScreamMs < 260) return;

    const spatial = this.computeSpatial(wx, wy, 240);
    if (spatial.gain < 0.035) return;

    const ctx = this.getContext();
    if (!ctx) return;
    this.lastDeathScreamMs = tMs;

    const deathClips: AudioAssetKey[] =
      gender === 'female' ? ['girl_scream', 'shock_scream'] : ['man_scream', 'man_scream_04'];
    const deathKey = deathClips[Math.floor(Math.random() * deathClips.length)];
    if (
      this.playDecodedClip(ctx, deathKey, {
        category: 'scream',
        maxConcurrent: 4,
        gain: 0.38 * spatial.gain,
        pan: spatial.pan,
        cutoffHz: spatial.cutoffHz * 1.8,
        dur: 1.35,
        offsetMin: 0,
        offsetMax: 0.04,
        playbackRate: 0.9 + Math.random() * 0.14,
        fadeInSec: 0.015,
        fadeOutFrac: 0.3,
      })
    ) {
      return;
    }

    const now = ctx.currentTime;

    const pool = gender === 'female' ? FEMALE_DEATH_PROFILES : MALE_DEATH_PROFILES;
    const prevIdx = gender === 'female' ? this.lastFemaleDeathIdx : this.lastMaleDeathIdx;
    let pick = Math.floor(Math.random() * pool.length);
    if (pick === prevIdx) {
      pick = (pick + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length;
    }
    if (gender === 'female') this.lastFemaleDeathIdx = pick;
    else this.lastMaleDeathIdx = pick;

    const profile = pool[pick];
    const pitchJitter = 0.94 + Math.random() * 0.12;
    const dur = profile.dur * (0.92 + Math.random() * 0.16);

    const voice = ctx.createOscillator();
    voice.type = 'sawtooth';
    voice.frequency.setValueAtTime(profile.baseHz * pitchJitter, now);
    voice.frequency.linearRampToValueAtTime(profile.peakHz * pitchJitter, now + dur * 0.14);
    voice.frequency.exponentialRampToValueAtTime(profile.endHz * pitchJitter, now + dur);

    // Distress rasp vibrato + choke tremor
    const vib = ctx.createOscillator();
    vib.type = 'triangle';
    vib.frequency.setValueAtTime(profile.vibratoHz, now);
    const vibG = ctx.createGain();
    vibG.gain.setValueAtTime(gender === 'female' ? 34 : 18, now);
    vib.connect(vibG);
    vibG.connect(voice.frequency);

    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.Q.setValueAtTime(3.2, now);
    f1.frequency.setValueAtTime(Math.min(profile.formant1, spatial.cutoffHz), now);
    f1.frequency.exponentialRampToValueAtTime(Math.max(280, profile.formant1 * 0.58), now + dur);

    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.Q.setValueAtTime(3.8, now);
    f2.frequency.setValueAtTime(Math.min(profile.formant2, spatial.cutoffHz), now);
    f2.frequency.exponentialRampToValueAtTime(Math.max(700, profile.formant2 * 0.62), now + dur);

    const breath = ctx.createBufferSource();
    breath.buffer = this.createNoiseBuffer(ctx, 2);
    const breathBp = ctx.createBiquadFilter();
    breathBp.type = 'bandpass';
    breathBp.frequency.setValueAtTime(Math.min(profile.formant2 * 0.85, spatial.cutoffHz), now);
    breathBp.Q.setValueAtTime(1.5, now);

    const masterG = ctx.createGain();
    const peakGain = 0.098 * spatial.gain;
    masterG.gain.setValueAtTime(0.001, now);
    masterG.gain.linearRampToValueAtTime(peakGain, now + 0.035);
    masterG.gain.setValueAtTime(peakGain * 0.78, now + dur * 0.42);
    masterG.gain.exponentialRampToValueAtTime(0.0007, now + dur);

    const breathG = ctx.createGain();
    breathG.gain.setValueAtTime(peakGain * 0.48, now);
    breathG.gain.exponentialRampToValueAtTime(0.0007, now + dur);

    voice.connect(f1);
    voice.connect(f2);
    f1.connect(masterG);
    f2.connect(masterG);
    breath.connect(breathBp);
    breathBp.connect(breathG);

    this.connectOutput(ctx, masterG, spatial.pan);
    this.connectOutput(ctx, breathG, spatial.pan);

    voice.start(now);
    vib.start(now);
    breath.start(now);
    voice.stop(now + dur + 0.04);
    vib.stop(now + dur + 0.04);
    breath.stop(now + dur + 0.04);
  }

  /**
   * Tactical Walkie-Talkie ("Telsiz") Comms & Strategic Point Alert Tone.
   */
  public playRadioComms(kind: RadioCommsKind, wx?: number, wy?: number) {
    const tMs = this.nowMs();
    if (tMs - this.lastRadioMs < 1800) return;

    const ctx = this.getContext();
    if (!ctx) return;
    this.lastRadioMs = tMs;
    const now = ctx.currentTime;

    const spatial = this.computeSpatial(wx, wy, 1200);
    const pan = spatial.pan * 0.65;

    // 1. Short PTT radio static burst
    const sqNoise = ctx.createBufferSource();
    sqNoise.buffer = this.createNoiseBuffer(ctx, 2);
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(2200, now);
    hp.Q.setValueAtTime(1.4, now);
    const sqGain = ctx.createGain();
    sqGain.gain.setValueAtTime(0.045, now);
    sqGain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    sqNoise.connect(hp);
    hp.connect(sqGain);
    this.connectOutput(ctx, sqGain, pan);
    sqNoise.start(now);
    sqNoise.stop(now + 0.08);

    // 2. Tactical VHF Telemetry Cadence
    const sequences: Record<RadioCommsKind, number[]> = {
      contact: [880, 1175],
      evac: [659, 880, 1046],
      lz: [587, 784, 587],
      siege: [523, 440, 523],
      casualty: [466, 370],
    };
    const freqs = sequences[kind];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = kind === 'siege' || kind === 'casualty' ? 'triangle' : 'sine';
      const t0 = now + 0.055 + idx * 0.075;
      osc.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(0.052, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.07);
      osc.connect(g);
      this.connectOutput(ctx, g, pan);
      osc.start(t0);
      osc.stop(t0 + 0.075);
    });

    // 3. Closing roger squelch click
    const endT = now + 0.075 + freqs.length * 0.075;
    const endClk = ctx.createOscillator();
    const endG = ctx.createGain();
    endClk.type = 'sine';
    endClk.frequency.setValueAtTime(1450, endT);
    endG.gain.setValueAtTime(0.032, endT);
    endG.gain.exponentialRampToValueAtTime(0.001, endT + 0.035);
    endClk.connect(endG);
    this.connectOutput(ctx, endG, pan);
    endClk.start(endT);
    endClk.stop(endT + 0.04);
  }

  private getSirenSaturationCurve(): Float32Array<ArrayBuffer> {
    if (this.sirenCurve) return this.sirenCurve;
    const samples = 256;
    const curve = new Float32Array(new ArrayBuffer(samples * 4));
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + 10) * x * 20 * (Math.PI / 180)) / (Math.PI + 10 * Math.abs(x));
    }
    this.sirenCurve = curve;
    return curve;
  }

  private applySirenProfile(ctx: AudioContext, now: number) {
    if (!this.sirenOscPrimary || !this.sirenOscHarmonic || !this.sirenLfo || !this.sirenLfoDepth || !this.sirenFilter) {
      return;
    }
    if (this.sirenMode === 'wail') {
      // Classic slow emergency Wail (sweeps ~560 Hz .. 1220 Hz)
      this.sirenOscPrimary.frequency.setTargetAtTime(890, now, 0.04);
      this.sirenOscHarmonic.frequency.setTargetAtTime(895, now, 0.04);
      this.sirenLfo.type = 'triangle';
      this.sirenLfo.frequency.setTargetAtTime(0.36, now, 0.04);
      this.sirenLfoDepth.gain.setTargetAtTime(325, now, 0.04);
      this.sirenFilter.frequency.setTargetAtTime(1650, now, 0.05);
      this.sirenFilter.Q.setTargetAtTime(1.5, now, 0.05);
    } else if (this.sirenMode === 'yelp') {
      // Rapid tactical pursuit Yelp (sweeps ~620 Hz .. 1320 Hz at 3.2 Hz)
      this.sirenOscPrimary.frequency.setTargetAtTime(970, now, 0.03);
      this.sirenOscHarmonic.frequency.setTargetAtTime(976, now, 0.03);
      this.sirenLfo.type = 'triangle';
      this.sirenLfo.frequency.setTargetAtTime(3.2, now, 0.03);
      this.sirenLfoDepth.gain.setTargetAtTime(350, now, 0.03);
      this.sirenFilter.frequency.setTargetAtTime(1950, now, 0.05);
      this.sirenFilter.Q.setTargetAtTime(1.75, now, 0.05);
    } else {
      // Hi-Lo European Two-Tone emergency horn (520 Hz <-> 760 Hz stepped relay)
      this.sirenOscPrimary.frequency.setTargetAtTime(640, now, 0.03);
      this.sirenOscHarmonic.frequency.setTargetAtTime(644, now, 0.03);
      this.sirenLfo.type = 'square';
      this.sirenLfo.frequency.setTargetAtTime(1.55, now, 0.03);
      this.sirenLfoDepth.gain.setTargetAtTime(120, now, 0.03);
      this.sirenFilter.frequency.setTargetAtTime(1420, now, 0.05);
      this.sirenFilter.Q.setTargetAtTime(1.3, now, 0.05);
    }
  }

  public setSirenMode(mode: SirenMode) {
    this.sirenMode = mode;
    if (this.sirenRunning && this.ctx) {
      this.applySirenProfile(this.ctx, this.ctx.currentTime);
    }
  }

  public setSirenActive(active: boolean) {
    if (this.muted || !active) {
      if (this.sirenRunning) this.stopSirenLoop();
      return;
    }
    if (this.sirenRunning) return;

    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const oscPrimary = ctx.createOscillator();
    oscPrimary.type = 'sawtooth';
    oscPrimary.frequency.setValueAtTime(890, now);

    const oscHarmonic = ctx.createOscillator();
    oscHarmonic.type = 'triangle';
    oscHarmonic.frequency.setValueAtTime(895, now);

    const harmonicMix = ctx.createGain();
    harmonicMix.gain.setValueAtTime(0.45, now);

    const lfo = ctx.createOscillator();
    lfo.type = 'triangle';
    lfo.frequency.setValueAtTime(0.36, now);

    // Smooth square edges slightly via LFO smoothing filter for relay-switched Hi-Lo mode
    const lfoSmooth = ctx.createBiquadFilter();
    lfoSmooth.type = 'lowpass';
    lfoSmooth.frequency.setValueAtTime(42, now);

    const lfoDepth = ctx.createGain();
    lfoDepth.gain.setValueAtTime(325, now);

    lfo.connect(lfoSmooth);
    lfoSmooth.connect(lfoDepth);
    lfoDepth.connect(oscPrimary.frequency);
    lfoDepth.connect(oscHarmonic.frequency);

    // Emergency roof-bar PA horn enclosure waveshaper + resonant bandpass/lowpass
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.getSirenSaturationCurve();

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1650, now);
    filter.Q.setValueAtTime(1.5, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0005, now);
    gain.gain.linearRampToValueAtTime(this.sirenPeakGain, now + 0.18);

    oscPrimary.connect(shaper);
    oscHarmonic.connect(harmonicMix);
    harmonicMix.connect(shaper);
    shaper.connect(filter);
    filter.connect(gain);

    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(0, now);
      gain.connect(panner);
      panner.connect(ctx.destination);
      this.sirenPanner = panner;
    } else {
      gain.connect(ctx.destination);
      this.sirenPanner = null;
    }

    this.sirenOscPrimary = oscPrimary;
    this.sirenOscHarmonic = oscHarmonic;
    this.sirenLfo = lfo;
    this.sirenLfoDepth = lfoDepth;
    this.sirenFilter = filter;
    this.sirenGain = gain;
    this.sirenRunning = true;

    this.applySirenProfile(ctx, now);

    oscPrimary.start(now);
    oscHarmonic.start(now);
    lfo.start(now);
  }

  /**
   * Smoothly attenuates running vehicle siren volume & stereo pan based on nearest siren coordinates.
   */
  public updateSirenSpatial(wx?: number, wy?: number) {
    if (!this.sirenRunning || !this.ctx || !this.sirenGain) return;
    const now = this.ctx.currentTime;
    const spatial = this.computeSpatial(wx, wy, 480);
    const targetGain = spatial.gain > 0.02 ? this.sirenPeakGain * spatial.gain : 0.0001;
    this.sirenGain.gain.setTargetAtTime(targetGain, now, 0.08);
    if (this.sirenPanner) {
      this.sirenPanner.pan.setTargetAtTime(spatial.pan, now, 0.08);
    }
  }

  public stopSirenLoop() {
    if (!this.sirenRunning || !this.ctx) return;
    const now = this.ctx.currentTime;
    try {
      if (this.sirenGain) {
        this.sirenGain.gain.cancelScheduledValues(now);
        this.sirenGain.gain.setValueAtTime(Math.max(0.0002, this.sirenGain.gain.value || 0.04), now);
        this.sirenGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      }
      const o1 = this.sirenOscPrimary;
      const o2 = this.sirenOscHarmonic;
      const l = this.sirenLfo;
      window.setTimeout(() => {
        try {
          o1?.stop();
          o2?.stop();
          l?.stop();
        } catch {
          // ignore
        }
      }, 190);
    } catch {
      // ignore
    }
    this.sirenRunning = false;
    this.sirenOscPrimary = null;
    this.sirenOscHarmonic = null;
    this.sirenLfo = null;
    this.sirenLfoDepth = null;
    this.sirenFilter = null;
    this.sirenPanner = null;
    this.sirenGain = null;
  }

  public setHelicopterFlying(flying: boolean) {
    if (this.muted || !flying) {
      if (this.heliRunning) this.stopHelicopterLoop();
      return;
    }
    if (this.heliRunning) return;

    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.001, now);
    masterGain.gain.linearRampToValueAtTime(0.11, now + 0.35);

    const noise = ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(ctx, 2);
    noise.loop = true;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'lowpass';
    bandpass.frequency.setValueAtTime(220, now);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(14.5, now);

    const lfoDepth = ctx.createGain();
    lfoDepth.gain.setValueAtTime(135, now);
    lfo.connect(lfoDepth);
    lfoDepth.connect(bandpass.frequency);

    const subOsc = ctx.createOscillator();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(29, now);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.16, now);

    noise.connect(bandpass);
    bandpass.connect(masterGain);
    subOsc.connect(subGain);
    subGain.connect(masterGain);
    masterGain.connect(ctx.destination);

    noise.start(now);
    lfo.start(now);
    subOsc.start(now);

    this.heliMasterGain = masterGain;
    this.heliNoiseNode = noise;
    this.heliLfoOsc = lfo;
    this.heliSubOsc = subOsc;
    this.heliRunning = true;
  }

  public stopHelicopterLoop() {
    if (!this.heliRunning || !this.ctx) return;
    const now = this.ctx.currentTime;
    try {
      if (this.heliMasterGain) {
        this.heliMasterGain.gain.cancelScheduledValues(now);
        this.heliMasterGain.gain.setValueAtTime(this.heliMasterGain.gain.value || 0.1, now);
        this.heliMasterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      }
      const noise = this.heliNoiseNode;
      const lfo = this.heliLfoOsc;
      const sub = this.heliSubOsc;
      window.setTimeout(() => {
        try {
          noise?.stop();
          lfo?.stop();
          sub?.stop();
        } catch {
          // ignore
        }
      }, 280);
    } catch {
      // ignore
    }
    this.heliRunning = false;
    this.heliMasterGain = null;
    this.heliNoiseNode = null;
    this.heliLfoOsc = null;
    this.heliSubOsc = null;
  }

  public playA10Flyby(wx?: number, wy?: number) {
    const spatial = this.computeSpatial(wx, wy, 900);
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const gainScale = Math.max(0.25, spatial.gain);

    const noise = ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(ctx, 3.2);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(1.8, now);
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.exponentialRampToValueAtTime(920, now + 1.1);
    filter.frequency.exponentialRampToValueAtTime(210, now + 2.8);

    const whine = ctx.createOscillator();
    whine.type = 'sawtooth';
    whine.frequency.setValueAtTime(520, now);
    whine.frequency.exponentialRampToValueAtTime(260, now + 2.6);
    const whineGain = ctx.createGain();
    whineGain.gain.setValueAtTime(0.001, now);
    whineGain.gain.linearRampToValueAtTime(0.032 * gainScale, now + 0.9);
    whineGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.7);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22 * gainScale, now + 0.95);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.9);

    noise.connect(filter);
    filter.connect(gain);
    whine.connect(whineGain);
    this.connectOutput(ctx, whineGain, spatial.pan);
    this.connectOutput(ctx, gain, spatial.pan);

    noise.start(now);
    noise.stop(now + 2.95);
    whine.start(now);
    whine.stop(now + 2.8);
  }

  public playGau8Burst(wx?: number, wy?: number) {
    const spatial = this.computeSpatial(wx, wy, 650);
    if (spatial.gain < 0.04) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Layer real rapid cannon burst with sub-bass A-10 GAU-8 rotary buzz
    this.playDecodedClip(ctx, 'machine_gun', {
      category: 'gau8',
      maxConcurrent: 2,
      gain: 0.44 * spatial.gain,
      pan: spatial.pan,
      cutoffHz: Math.min(6200, spatial.cutoffHz * 1.6),
      dur: 0.78,
      offsetMin: 0.25,
      offsetMax: 1.6,
      playbackRate: 0.74,
      fadeInSec: 0.02,
      fadeOutFrac: 0.3,
    });

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(68, now);
    osc.frequency.linearRampToValueAtTime(62, now + 0.52);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(540, spatial.cutoffHz), now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.16 * spatial.gain, now + 0.04);
    gain.gain.setValueAtTime(0.15 * spatial.gain, now + 0.42);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.56);

    osc.connect(filter);
    filter.connect(gain);
    this.connectOutput(ctx, gain, spatial.pan);

    osc.start(now);
    osc.stop(now + 0.58);
  }

  public playExplosion(wx?: number, wy?: number) {
    const tMs = this.nowMs();
    if (tMs - this.lastExplosionMs < 90) return;

    const spatial = this.computeSpatial(wx, wy, 700);
    if (wx !== undefined && wy !== undefined && spatial.gain < 0.025) return;
    const scale = Math.max(0.15, spatial.gain);
    const ctx = this.getContext();
    if (!ctx) return;
    this.lastExplosionMs = tMs;

    if (
      this.playDecodedClip(ctx, 'explosion', {
        category: 'explosion',
        maxConcurrent: 4,
        gain: Math.min(0.68, 0.58 * scale),
        pan: spatial.pan,
        cutoffHz: Math.min(12000, spatial.cutoffHz * 2.1),
        dur: 2.2,
        offsetMin: 0,
        offsetMax: 0.04,
        playbackRate: 0.94 + Math.random() * 0.12,
        fadeInSec: 0.005,
        fadeOutFrac: 0.34,
      })
    ) {
      return;
    }

    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(ctx, 1.4);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(680, spatial.cutoffHz), now);
    filter.frequency.exponentialRampToValueAtTime(75, now + 1.15);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.32 * scale, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.25);

    const boom = ctx.createOscillator();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(110, now);
    boom.frequency.exponentialRampToValueAtTime(28, now + 0.55);
    const boomGain = ctx.createGain();
    boomGain.gain.setValueAtTime(0.28 * scale, now);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    noise.connect(filter);
    filter.connect(gain);
    this.connectOutput(ctx, gain, spatial.pan);
    boom.connect(boomGain);
    this.connectOutput(ctx, boomGain, spatial.pan);

    noise.start(now);
    noise.stop(now + 1.3);
    boom.start(now);
    boom.stop(now + 0.62);
  }

  public playRifleShot(wx?: number, wy?: number) {
    this.playRealisticShot('rifle', wx, wy);
  }

  public playSniperShot(wx?: number, wy?: number) {
    this.playRealisticShot('sniper', wx, wy);
  }

  public playHeavyShot(wx?: number, wy?: number) {
    this.playRealisticShot('heavy', wx, wy);
  }

  public playPistolShot(wx?: number, wy?: number) {
    this.playRealisticShot('pistol', wx, wy);
  }

  public playSmgShot(wx?: number, wy?: number) {
    this.playRealisticShot('smg', wx, wy);
  }

  public playParachuteDrop(wx?: number, wy?: number) {
    const spatial = this.computeSpatial(wx, wy, 480);
    if (spatial.gain < 0.03) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.2);
    gain.gain.setValueAtTime(0.07 * spatial.gain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    this.connectOutput(ctx, gain, spatial.pan);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  public playBarricadeBuild() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.setValueAtTime(185, now + 0.05);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playZombieDown(wx?: number, wy?: number) {
    const tMs = this.nowMs();
    if (tMs - this.lastZombieDownMs < 180) return;

    const spatial = this.computeSpatial(wx, wy, 200);
    if (spatial.gain < 0.04) return;
    const ctx = this.getContext();
    if (!ctx) return;
    this.lastZombieDownMs = tMs;

    if (
      this.playDecodedClip(ctx, 'zombie_dying', {
        category: 'zombie_dying',
        maxConcurrent: 3,
        gain: 0.28 * spatial.gain,
        pan: spatial.pan,
        cutoffHz: spatial.cutoffHz * 1.4,
        dur: 1.25 + Math.random() * 0.5,
        offsetMin: 0.1,
        offsetMax: 4.8,
        playbackRate: 0.92 + Math.random() * 0.16,
        fadeInSec: 0.03,
        fadeOutFrac: 0.35,
      })
    ) {
      return;
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.12);
    gain.gain.setValueAtTime(0.065 * spatial.gain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    this.connectOutput(ctx, gain, spatial.pan);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playCommand() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.setValueAtTime(780, now + 0.035);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playHeliDispatch() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [392, 523.25, 659.25].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.06;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.075, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.16);
    });
  }

  public playBoarded(wx?: number, wy?: number) {
    const spatial = this.computeSpatial(wx, wy, 420);
    if (spatial.gain < 0.03) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1174, now + 0.08);
    gain.gain.setValueAtTime(0.05 * spatial.gain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    this.connectOutput(ctx, gain, spatial.pan);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playBloodVomit(wx?: number, wy?: number) {
    const tMs = this.nowMs();
    if (tMs - this.lastVomitMs < 320) return;

    const spatial = this.computeSpatial(wx, wy, 180);
    if (spatial.gain < 0.045) return;
    const ctx = this.getContext();
    if (!ctx) return;
    this.lastVomitMs = tMs;

    this.playDecodedClip(ctx, 'zombie_choking', {
      category: 'vomit',
      maxConcurrent: 3,
      gain: 0.2 * spatial.gain,
      pan: spatial.pan,
      cutoffHz: Math.min(1800, spatial.cutoffHz),
      dur: 0.65,
      offsetMin: 0.15,
      offsetMax: 2.0,
      playbackRate: 0.88 + Math.random() * 0.12,
      fadeInSec: 0.04,
      fadeOutFrac: 0.4,
    });

    const now = ctx.currentTime;

    // Wet guttural retching & splatter synthesis
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.linearRampToValueAtTime(112, now + 0.14);
    osc.frequency.exponentialRampToValueAtTime(68, now + 0.34);

    const noise = ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(ctx, 2);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(2.6, now);
    bp.frequency.setValueAtTime(Math.min(720, spatial.cutoffHz), now);
    bp.frequency.exponentialRampToValueAtTime(340, now + 0.32);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.078 * spatial.gain, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 0.35);

    osc.connect(bp);
    noise.connect(bp);
    bp.connect(g);
    this.connectOutput(ctx, g, spatial.pan);

    osc.start(now);
    noise.start(now);
    osc.stop(now + 0.36);
    noise.stop(now + 0.36);
  }

  public playInfection(wx?: number, wy?: number) {
    const tMs = this.nowMs();
    if (tMs - this.lastInfectionMs < 180) return;

    const spatial = this.computeSpatial(wx, wy, 230);
    if (spatial.gain < 0.04) return;
    const ctx = this.getContext();
    if (!ctx) return;
    this.lastInfectionMs = tMs;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.linearRampToValueAtTime(95, now + 0.18);
    gain.gain.setValueAtTime(0.075 * spatial.gain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    this.connectOutput(ctx, gain, spatial.pan);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  public playVictory() {
    this.stopHelicopterLoop();
    this.stopSirenLoop();
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.09;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  public playDefeat() {
    this.stopHelicopterLoop();
    this.stopSirenLoop();
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [330, 293.66, 246.94, 196].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + idx * 0.11;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }
}

export const soundEngine = new SoundEngine();
