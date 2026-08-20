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

  bloom() {
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.35, "triangle", 0.12, i * 0.12));
    this.tone(262, 1.2, "sine", 0.08, 0.2);
  }
}

export const sfx = new Sfx();

// ============================================================
// Ambient garden music — generated, like everything else.
// A slow pad drifts through a four-chord loop while a pentatonic
// music box answers overhead; a feedback delay gives it air.
// ============================================================

// C major pentatonic across two octaves — no wrong notes
const PLUCK_NOTES = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.7, 1318.5];
// Cmaj7 → Am7 → Fmaj7 → G6, roots an octave down
const CHORDS: number[][] = [
  [130.81, 196.0, 246.94, 329.63],
  [110.0, 164.81, 220.0, 261.63],
  [87.31, 174.61, 220.0, 261.63],
  [98.0, 146.83, 246.94, 293.66],
];

class Music {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private delay: DelayNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextChordAt = 0;
  private nextPluckAt = 0;
  private chordIdx = 0;
  on = true;

  init() {
    if (typeof window === "undefined") return;
    this.on = window.localStorage.getItem("lily-music") !== "0";
  }

  setOn(on: boolean) {
    this.on = on;
    try { window.localStorage.setItem("lily-music", on ? "1" : "0"); } catch {}
    if (on) this.start();
    else this.stop();
  }

  /** Call from any user gesture; autoplay rules need one. */
  start() {
    if (!this.on || sfx.muted || typeof window === "undefined" || this.timer) return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!this.ctx) this.ctx = new AC();
    if (this.ctx.state === "suspended") void this.ctx.resume();
    const ctx = this.ctx;

    if (!this.out) {
      const master = ctx.createGain();
      master.gain.value = 0.055;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2400;
      const delay = ctx.createDelay(1.2);
      delay.delayTime.value = 0.42;
      const fb = ctx.createGain();
      fb.gain.value = 0.32;
      delay.connect(fb).connect(delay);
      lp.connect(master);
      delay.connect(master);
      master.connect(ctx.destination);
      // stash the dry input as `out` and keep the echo line reachable
      this.out = lp as unknown as GainNode;
      this.delay = delay;
    }

    this.nextChordAt = ctx.currentTime + 0.2;
    this.nextPluckAt = ctx.currentTime + 2;
    this.timer = setInterval(() => this.schedule(), 250);
  }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.out || sfx.muted) return;
    const horizon = ctx.currentTime + 1;

    while (this.nextChordAt < horizon) {
      this.pad(CHORDS[this.chordIdx % CHORDS.length], this.nextChordAt);
      this.chordIdx++;
      this.nextChordAt += 8;
    }
    while (this.nextPluckAt < horizon) {
      if (Math.random() < 0.8) {
        const f = PLUCK_NOTES[Math.floor(Math.random() * PLUCK_NOTES.length)];
        this.pluck(f, this.nextPluckAt);
      }
      this.nextPluckAt += 1.6 + Math.random() * 2.4;
    }
  }

  /** Four soft detuned voices swelling in and out over ~9s. */
  private pad(freqs: number[], t0: number) {
    const ctx = this.ctx!;
    for (const f of freqs) {
      for (const det of [-3, 3]) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = f;
        osc.detune.value = det;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.16 / freqs.length, t0 + 3.2);
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
