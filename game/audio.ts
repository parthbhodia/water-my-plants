// Tiny WebAudio synth — every sound is generated, no audio files.
class Sfx {
  private ctx: AudioContext | null = null;
  muted = false;

  init() {
    if (typeof window === "undefined") return;
    this.muted = window.localStorage.getItem("lily-muted") === "1";
  }

  setMuted(m: boolean) {
    this.muted = m;
    try {
      window.localStorage.setItem("lily-muted", m ? "1" : "0");
    } catch {}
  }

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0, glide = 0) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(glide, 1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  /**
   * A short burst of filtered noise. Earth does not have a pitch, and every
   * other sound in here is an oscillator — soil, roots and a rake need this
   * or they come out sounding like a xylophone.
   */
  private noise(dur: number, gain: number, hz: number, delay = 0, q = 0.9, sweepTo = 0) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      // brown-ish, like the rain loop: white noise reads as static, not dirt
      const w = Math.random() * 2 - 1;
      last = (last + 0.06 * w) / 1.06;
      d[i] = last * 3.2;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(hz, t0);
    if (sweepTo) bp.frequency.exponentialRampToValueAtTime(Math.max(sweepTo, 40), t0 + dur);
    bp.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp).connect(g).connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  click() { this.tone(660, 0.08, "triangle", 0.12); }

  pour() {
    // burbling descending bloops
    for (let i = 0; i < 6; i++) {
      this.tone(520 - i * 40 + Math.random() * 60, 0.12, "sine", 0.1, i * 0.13, 220);
    }
  }

  splash() {
    this.tone(300, 0.2, "sine", 0.12, 0, 120);
    this.tone(900, 0.08, "triangle", 0.06, 0.02);
  }

  grow() {
    // rising sparkle arpeggio
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, "triangle", 0.11, i * 0.09));
  }

  wiggle() { this.tone(392, 0.1, "triangle", 0.09); this.tone(494, 0.1, "triangle", 0.09, 0.09); }

  /** The splash again, but a whole step brighter for each plant in the round. */
  comboSplash(n: number) {
    const step = Math.pow(2, Math.min(n, 8) / 12);
    this.tone(300 * step, 0.2, "sine", 0.12, 0, 120 * step);
    this.tone(900 * step, 0.08, "triangle", 0.06, 0.02);
    if (n >= 2) this.tone(1320 * step, 0.14, "triangle", 0.07, 0.06);
  }

  /** A gardener level: a warm fanfare that lands, unlike the bloom's climb. */
  levelUp() {
    [523, 659, 784].forEach((f, i) => this.tone(f, 0.3, "triangle", 0.13, i * 0.08));
    this.tone(1047, 0.7, "triangle", 0.14, 0.26);
    this.tone(1568, 0.5, "sine", 0.07, 0.34);
    this.tone(262, 1.1, "sine", 0.09, 0.1);
  }

  // ---- the hands-on rituals ----
  //
  // Clearing a bed descends: 196 -> 131/98 -> 88 -> 58 Hz. That is the exact
  // inverse of comboSplash, which climbs a semitone per plant in a watering
  // round. Every other cue in the game is major-key and rising, and playing
  // any of them over a plant being pulled out of the ground would
  // congratulate the player for a loss.

  /** Taking hold. One dry tap, and the top of the ladder. */
  take() { this.tone(196, 0.09, "triangle", 0.09); this.noise(0.07, 0.05, 900); }

  /** Roots letting go — two low notes under a tearing rustle. */
  uproot() {
    this.tone(131, 0.22, "sine", 0.1, 0, 104);
    this.tone(98, 0.3, "triangle", 0.07, 0.06, 82);
    this.noise(0.34, 0.055, 1400, 0.02, 0.6, 420);
  }

  /** The break: the last root gives. Shortest beat, lowest note. */
  snap() { this.tone(88, 0.16, "square", 0.07, 0, 62); this.noise(0.09, 0.07, 2200, 0, 1.4, 700); }

  /** Levelling the bed. Barely a pitch at all — just a long, low sweep. */
  rake() { this.noise(0.42, 0.06, 620, 0, 0.5, 180); this.tone(58, 0.4, "sine", 0.05, 0.04); }

  /** A seed pressed into the soil. */
  press() { this.tone(262, 0.08, "triangle", 0.08); this.noise(0.06, 0.045, 700); }

  /** Two pats to firm the earth over it. */
  pat() { this.noise(0.05, 0.06, 480); this.noise(0.05, 0.05, 420, 0.12); }

  /** It is in. Two rising notes and no more — the bloom fanfare is six. */
  sprout() { this.tone(392, 0.16, "triangle", 0.1); this.tone(523, 0.3, "triangle", 0.11, 0.11); }

  /** Snipping a bloom free: metal on stem, twice. */
  snip() {
    this.tone(1320, 0.05, "square", 0.05);
    this.tone(1568, 0.06, "square", 0.05, 0.07);
    this.noise(0.05, 0.03, 3000, 0.01, 2);
  }

  bloom() {
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.35, "triangle", 0.12, i * 0.12));
    this.tone(262, 1.2, "sine", 0.08, 0.2);
  }
}

export const sfx = new Sfx();

// ============================================================
// Ambient garden music — generated, like everything else.
// Three records on Granny's shelf: a sunny meadow, a twilight
// pond, and a rainy afternoon. Pads drift through a chord loop,
// a pentatonic music box answers, a feedback delay gives it air.
// ============================================================

export type MusicMode =
  | "meadow" | "twilight" | "rain" | "dawn" | "night" | "snow";

export const MUSIC_MODES: Array<{ key: MusicMode; name: string; blurb: string }> = [
  { key: "meadow",   name: "Sunny Meadow",  blurb: "Bright and open. Midday in the long grass." },
  { key: "dawn",     name: "Dawn Chorus",   blurb: "First light. Everything waking up at once." },
  { key: "twilight", name: "Twilight Pond", blurb: "Slower and darker, the way evenings go." },
  { key: "night",    name: "Night Garden",  blurb: "Sparse and low. Crickets and not much else." },
  { key: "rain",     name: "Gentle Rain",   blurb: "Soft rain on leaves, and plinks like drops." },
  { key: "snow",     name: "Winter Hush",   blurb: "Wide, slow and very quiet. Nothing hurries." },
];

type MoodDef = {
  chords: number[][];
  notes: number[];
  chordEvery: number;
  pluckChance: number;
  filterHz: number;
  padGain: number;
  rain: boolean;
};

const MOODS: Record<MusicMode, MoodDef> = {
  meadow: {
    // Cmaj7 → Am7 → Fmaj7 → G6 under C major pentatonic
    chords: [
      [130.81, 196.0, 246.94, 329.63],
      [110.0, 164.81, 220.0, 261.63],
      [87.31, 174.61, 220.0, 261.63],
      [98.0, 146.83, 246.94, 293.66],
    ],
    notes: [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.7, 1318.5],
    chordEvery: 8, pluckChance: 0.8, filterHz: 2400, padGain: 0.16, rain: false,
  },
  twilight: {
    // Am9 → Fmaj7 → Dm7 → Em7 under A minor pentatonic, slower and darker
    chords: [
      [110.0, 164.81, 220.0, 246.94],
      [87.31, 130.81, 174.61, 220.0],
      [73.42, 146.83, 174.61, 220.0],
      [82.41, 123.47, 164.81, 196.0],
    ],
    notes: [440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5],
    chordEvery: 11, pluckChance: 0.55, filterHz: 1500, padGain: 0.14, rain: false,
  },
  dawn: {
    // G6 -> Em7 -> Cmaj9 -> D — bright and busy, the light coming up
    chords: [
      [98.0, 146.83, 196.0, 246.94],
      [82.41, 123.47, 164.81, 196.0],
      [130.81, 196.0, 246.94, 293.66],
      [146.83, 220.0, 293.66, 369.99],
    ],
    notes: [587.33, 659.25, 783.99, 880.0, 987.77, 1174.7, 1318.5, 1567.98],
    chordEvery: 7, pluckChance: 0.9, filterHz: 3000, padGain: 0.17, rain: false,
  },
  night: {
    // Dm(add9) -> Bb -> Gm7 -> A, very sparse and an octave down
    chords: [
      [73.42, 110.0, 146.83, 164.81],
      [58.27, 116.54, 146.83, 174.61],
      [49.0, 116.54, 146.83, 174.61],
      [55.0, 110.0, 164.81, 207.65],
    ],
    notes: [293.66, 349.23, 392.0, 440.0, 587.33, 698.46],
    chordEvery: 15, pluckChance: 0.32, filterHz: 1100, padGain: 0.15, rain: false,
  },
  snow: {
    // Ebmaj7 -> Bbmaj7, two chords and a lot of air between them
    chords: [
      [77.78, 155.56, 196.0, 233.08],
      [58.27, 116.54, 174.61, 233.08],
    ],
    notes: [622.25, 698.46, 783.99, 932.33, 1046.5, 1244.5, 1396.9],
    chordEvery: 18, pluckChance: 0.28, filterHz: 2600, padGain: 0.13, rain: false,
  },
  rain: {
    // sparse Fmaj7 / Cmaj7 under soft rain, plinks like drops on a leaf
    chords: [
      [87.31, 174.61, 220.0, 261.63],
      [130.81, 196.0, 246.94, 329.63],
    ],
    notes: [659.25, 783.99, 880.0, 1046.5, 1318.5, 1568.0],
    chordEvery: 13, pluckChance: 0.45, filterHz: 1800, padGain: 0.1, rain: true,
  },
};

class Music {
  private ctx: AudioContext | null = null;
  private out: BiquadFilterNode | null = null;
  private master: GainNode | null = null;
  private delay: DelayNode | null = null;
  private rainSrc: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextChordAt = 0;
  private nextPluckAt = 0;
  private chordIdx = 0;
  on = true;
  mode: MusicMode = "meadow";

  init() {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("lily-music-mode");
    if (stored === "off") this.on = false;
    else if (stored && MUSIC_MODES.some((m) => m.key === stored)) {
      this.on = true;
      this.mode = stored as MusicMode;
    }
  }

  setOn(on: boolean) {
    this.on = on;
    try { window.localStorage.setItem("lily-music-mode", on ? this.mode : "off"); } catch {}
    if (on) this.start();
    else this.stop();
  }

  setMode(mode: MusicMode) {
    this.mode = mode;
    this.on = true;
    try { window.localStorage.setItem("lily-music-mode", mode); } catch {}
    this.stop();
    this.start();
  }

  /** True only when audio is genuinely coming out right now. */
  get playing() {
    return !!this.timer && this.ctx?.state === "running";
  }

  /**
   * Call from any user gesture; autoplay rules need one. Safe to call
   * repeatedly — iOS suspends the context whenever the tab is backgrounded
   * or the phone locks, and never resumes it on its own, so the only way
   * music survives a pocket is to keep asking.
   */
  start() {
    if (!this.on || sfx.muted || typeof window === "undefined") return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!this.ctx) this.ctx = new AC();
    if (this.ctx.state === "suspended") {
      // resume() is async: anchoring the schedule now would stamp every
      // event into a currentTime that is still frozen at the moment of
      // suspension, and the loop would sit silent waiting for the clock to
      // catch up. Re-enter once the context is actually running instead.
      void this.ctx.resume().then(() => this.start()).catch(() => {});
      return;
    }
    if (this.timer) return;
    const ctx = this.ctx;

    if (!this.out) {
      const master = ctx.createGain();
      // 0.055 was effectively silent on a phone speaker — the loop was
      // running the whole time and nobody could hear a note of it.
      master.gain.value = 0.16;
      this.master = master;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      const delay = ctx.createDelay(1.2);
      delay.delayTime.value = 0.42;
      const fb = ctx.createGain();
      fb.gain.value = 0.32;
      delay.connect(fb).connect(delay);
      lp.connect(master);
      delay.connect(master);
      master.connect(ctx.destination);
      this.out = lp;
      this.delay = delay;
    }
    this.out.frequency.value = MOODS[this.mode].filterHz;

    if (MOODS[this.mode].rain) this.startRain();
    else this.stopRain();

    this.nextChordAt = ctx.currentTime + 0.2;
    this.nextPluckAt = ctx.currentTime + 2;
    this.timer = setInterval(() => this.schedule(), 250);
  }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.stopRain();
  }

  /** A loop of softly filtered noise — the rain itself. */
  private startRain() {
    const ctx = this.ctx;
    if (!ctx || this.rainSrc) return;
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      // brown-ish noise reads as rain, white reads as static
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900;
    bp.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 2.5);
    src.connect(bp).connect(g).connect(ctx.destination);
    src.start();
    this.rainSrc = src;
    this.rainGain = g;
  }

  private stopRain() {
    if (!this.rainSrc || !this.ctx) return;
    const src = this.rainSrc;
    this.rainGain?.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.8);
    setTimeout(() => { try { src.stop(); } catch {} }, 900);
    this.rainSrc = null;
    this.rainGain = null;
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.out || sfx.muted) return;
    const mood = MOODS[this.mode];
    const horizon = ctx.currentTime + 1;

    while (this.nextChordAt < horizon) {
      this.pad(mood.chords[this.chordIdx % mood.chords.length], this.nextChordAt, mood.padGain);
      this.chordIdx++;
      this.nextChordAt += mood.chordEvery;
    }
    while (this.nextPluckAt < horizon) {
      if (Math.random() < mood.pluckChance) {
        const f = mood.notes[Math.floor(Math.random() * mood.notes.length)];
        this.pluck(f, this.nextPluckAt);
      }
      this.nextPluckAt += 1.6 + Math.random() * 2.4;
    }
  }

  /** Soft detuned voices swelling in and out over ~9s. */
  private pad(freqs: number[], t0: number, gain: number) {
    const ctx = this.ctx!;
    for (const f of freqs) {
      for (const det of [-3, 3]) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = f;
        osc.detune.value = det;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(gain / freqs.length, t0 + 3.2);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 9);
        osc.connect(g).connect(this.out!);
        osc.start(t0);
        osc.stop(t0 + 9.2);
      }
    }
  }

  /** A single music-box note, echoed by the delay line. */
  private pluck(freq: number, t0: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
    osc.connect(g);
    g.connect(this.out!);
    if (this.delay) g.connect(this.delay);
    osc.start(t0);
    osc.stop(t0 + 1.5);
  }
}

export const music = new Music();