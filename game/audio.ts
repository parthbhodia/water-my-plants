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
