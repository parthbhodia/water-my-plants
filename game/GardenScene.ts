import * as Phaser from "phaser";
import type { GameBridge, SceneApi } from "./bridge";
import type { GardenState, WaterResult } from "@/lib/types";
import { type Ctx, type Stop, lg, rgrad, rr, ell, blob, petalPath } from "./draw";
import {
  type Avatar,
  DEFAULT_AVATAR,
  paintGardener,
  safeAvatar,
  POSES,
  FRAME_W,
  FRAME_H,
  BODY_CX,
  FEET_LY,
  SPOUT_OFFSET,
} from "./avatar";

// ============================================================
// Lily Days — garden scene, "2.5D" rendering pass
// Every texture is painted at runtime with Canvas2D gradients,
// soft shadows and bevels. No asset files.
// ============================================================

const W = 960;
const H = 600;
const GROUND = 372;
const POND_X = 480;
const POND_Y = 468;
const POND_RX = 190;
const POND_RY = 58;
const FEET_Y = 548;
const HX = 152; // house anchor

const POND_WOB = [0.05, -0.03, 0.045, 0.02, -0.045, 0.035, -0.02, 0.05, -0.035, 0.025];

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  );
}
const hx6 = (n: number) => "#" + n.toString(16).padStart(6, "0");

// sky keyframes: hour, top, mid, horizon, night factor, warmth
const SKY_STOPS: Array<[number, number, number, number, number, number]> = [
  [0, 0x0b1836, 0x1c3157, 0x2c4a72, 1, 0],
  [4.5, 0x0b1836, 0x1c3157, 0x2c4a72, 1, 0],
  [6.5, 0xff9d76, 0xffc898, 0xffe9bd, 0.25, 0.55],
  [9, 0x6fb9e8, 0xa5d8f0, 0xddf2e6, 0, 0],
  [16.5, 0x6fb9e8, 0xa5d8f0, 0xddf2e6, 0, 0],
  [18.75, 0xff8f63, 0xffb98c, 0xffe2ae, 0.15, 0.6],
  [20.5, 0x16264d, 0x2b436e, 0x3a577f, 0.9, 0.12],
  [24, 0x0b1836, 0x1c3157, 0x2c4a72, 1, 0],
];

export class GardenScene extends Phaser.Scene implements SceneApi {
  private bridge: GameBridge;
  private garden: GardenState | null = null;

  private skyTex!: Phaser.Textures.CanvasTexture;
  private lilyTex!: Phaser.Textures.CanvasTexture;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private duskOverlay!: Phaser.GameObjects.Rectangle;
  private starC!: Phaser.GameObjects.Container;
  private sunImg!: Phaser.GameObjects.Image;
  private rayImg!: Phaser.GameObjects.Image;
  private moonImg!: Phaser.GameObjects.Image;
  private windowGlows: Phaser.GameObjects.Rectangle[] = [];
  private rippleG!: Phaser.GameObjects.Graphics;
  private lilyC!: Phaser.GameObjects.Container;
  private bloomGlow!: Phaser.GameObjects.Image;
  private hintDrop!: Phaser.GameObjects.Image;
  private player!: Phaser.GameObjects.Sprite;
  private playerShadow!: Phaser.GameObjects.Image;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private sparkles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private confetti!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dropletsR!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dropletsL!: Phaser.GameObjects.Particles.ParticleEmitter;
  private splashG!: Phaser.GameObjects.Graphics;
  private pourSplashes: Array<{ x: number; y: number; t0: number }> = [];
  private avatar: Avatar = DEFAULT_AVATAR;
  private butterflies: Array<{ s: Phaser.GameObjects.Sprite; tx: number; ty: number; seed: number }> = [];
  private fireflies: Array<{ s: Phaser.GameObjects.Image; a: number; seed: number }> = [];
  private dragonfly!: Phaser.GameObjects.Image;
  private shimmer: Array<{ x: number; y: number; w: number }> = [];
  // wind: every swaying object samples one shared field, phase-shifted by its
  // x position, so gusts visibly travel across the yard instead of wobbling in place.
  private swayers: Array<{
    o: Phaser.GameObjects.Image;
    amp: number;
    base: number;
    phase: number;
    lag: number;
  }> = [];
  private gusts: Array<{ t0: number; x0: number; power: number; dur: number }> = [];
  private windDir = 1;
  private windStreaks: Array<{ x: number; y: number; t0: number; len: number }> = [];
  private streakG!: Phaser.GameObjects.Graphics;
  private burstRipples: Array<{ t0: number }> = [];

  private autoTarget: number | null = null;
  private pendingPour = false;
  private pouring = false;
  private nearPond = false;
  private nightF = 0;
  private pourSafety: Phaser.Time.TimerEvent | null = null;
  private pourSplashTimer: Phaser.Time.TimerEvent | null = null;
  private hourOverride: number | null = null;

  constructor(bridge: GameBridge) {
    super({ key: "garden" });
    this.bridge = bridge;
  }

  // ================= lifecycle =================

  create() {
    this.makeTextures();
    this.buildSky();
    this.buildScenery();
    this.buildPond();
    this.buildLily();
    this.buildGardener();
    this.buildCritters();
    this.buildParticles();
    this.buildPost();

    const kb = this.input.keyboard;
    if (kb) {
      this.cursors = kb.createCursorKeys();
      this.keys = kb.addKeys("A,D,E,SPACE") as Record<string, Phaser.Input.Keyboard.Key>;
    }
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      const dx = (p.worldX - POND_X) / (POND_RX + 40);
      const dy = (p.worldY - POND_Y) / (POND_RY + 60);
      if (dx * dx + dy * dy < 1.15 || Math.abs(p.worldX - POND_X) < 90) {
        this.requestWater();
      } else {
        this.autoTarget = Phaser.Math.Clamp(p.worldX, 40, W - 40);
        this.pendingPour = false;
      }
    });

    // dev hook: dispatch `new CustomEvent("lily-hour", {detail: 22})` to preview times of day
    if (typeof window !== "undefined") {
      window.addEventListener("lily-hour", ((e: Event) => {
        const d = (e as CustomEvent).detail;
        this.hourOverride = typeof d === "number" ? d : null;
        this.applyTimeOfDay();
      }) as EventListener);
    }

    this.streakG = this.add.graphics().setDepth(14.5);
    const nextGust = () => {
      this.launchGust();
      this.time.delayedCall(Phaser.Math.Between(5000, 11000), nextGust);
    };
    this.time.delayedCall(Phaser.Math.Between(1200, 3000), nextGust);

    this.applyTimeOfDay();
    this.time.addEvent({ delay: 60000, loop: true, callback: () => this.applyTimeOfDay() });

    const spawnBird = () => {
      this.launchBird();
      this.time.delayedCall(Phaser.Math.Between(16000, 38000), spawnBird);
    };
    this.time.delayedCall(Phaser.Math.Between(4000, 9000), spawnBird);

    this.bridge.ready(this);
  }

  update(time: number) {
    this.updatePlayer();
    this.updateWind(time);
    this.updatePond(time);
    this.updateSplashes(time);
    this.updateCritters(time);
    this.updateHint();
  }

  // ================= bridge api =================

  setAvatar(a: Avatar) {
    this.avatar = safeAvatar(a);
    this.paintGardenerFrames();
  }

  setGarden(s: GardenState) {
    const prev = this.garden;
    this.garden = s;
    if (!prev || prev.plantId !== s.plantId || prev.stage !== s.stage || prev.wilted !== s.wilted) {
      this.redrawLily();
    }
  }

  requestWater() {
    if (this.pouring) return;
    const side = this.player.x < POND_X ? POND_X - 196 : POND_X + 196;
    if (Math.abs(this.player.x - side) < 8) {
      this.startPour();
    } else {
      this.autoTarget = side;
      this.pendingPour = true;
    }
  }

  applyOutcome(r: WaterResult) {
    this.endPour();
    if (r.state) {
      const grew = !!r.grew && r.status === "watered";
      const prevStage = this.garden?.stage ?? 0;
      this.garden = r.state;
      if (r.status === "watered") {
        this.splash();
        if (grew && r.state.stage !== prevStage) this.stagePop();
        if (r.bloomedNow) this.celebrateBloom();
        this.happyWiggle();
      } else {
        this.happyWiggle();
      }
    }
  }

  // ================= canvas texture helper =================

  private ctex(key: string, w: number, h: number, draw: (c: Ctx) => void): Phaser.Textures.CanvasTexture {
    let t: Phaser.Textures.CanvasTexture;
    if (this.textures.exists(key)) {
      t = this.textures.get(key) as Phaser.Textures.CanvasTexture;
    } else {
      t = this.textures.createCanvas(key, w, h)!;
    }
    const c = t.getContext();
    c.clearRect(0, 0, w, h);
    c.save();
    draw(c);
    c.restore();
    t.refresh();
    return t;
  }

  // ================= textures =================

  private makeTextures() {
    // ---- soft blob shadow ----
    this.ctex("shadow", 128, 64, (c) => {
      c.fillStyle = rgrad(c, 64, 32, 60, [[0, "rgba(18,42,32,0.55)"], [0.7, "rgba(18,42,32,0.22)"], [1, "rgba(18,42,32,0)"]]);
      c.save(); c.translate(64, 32); c.scale(1, 0.5); c.translate(-64, -32);
      c.fillRect(0, -32, 128, 128);
      c.restore();
    });

    // ---- clouds (3 fluffy variants) ----
    const puff = (c: Ctx, x: number, y: number, r: number) => {
      c.fillStyle = rgrad(c, x - r * 0.3, y - r * 0.4, r * 1.5, [
        [0, "rgba(255,255,255,0.98)"], [0.55, "rgba(250,252,255,0.9)"],
        [0.85, "rgba(226,236,248,0.45)"], [1, "rgba(226,236,248,0)"]]);
      ell(c, x, y, r * 1.15, r); c.fill();
    };
    this.ctex("cloud_0", 340, 130, (c) => {
      puff(c, 170, 88, 46); puff(c, 96, 92, 34); puff(c, 250, 90, 36); puff(c, 140, 62, 34); puff(c, 205, 58, 30);
    });
    this.ctex("cloud_1", 260, 100, (c) => {
      puff(c, 130, 66, 36); puff(c, 70, 70, 26); puff(c, 190, 68, 28); puff(c, 130, 44, 26);
    });
    this.ctex("cloud_2", 190, 80, (c) => {
      puff(c, 95, 52, 26); puff(c, 50, 56, 19); puff(c, 140, 54, 20); puff(c, 98, 36, 18);
    });

    // ---- rolling hills (parallax, atmospheric haze) ----
    this.ctex("hill_far", W, 130, (c) => {
      c.beginPath();
      c.moveTo(0, 70);
      c.quadraticCurveTo(150, 18, 330, 56);
      c.quadraticCurveTo(500, 92, 660, 42);
      c.quadraticCurveTo(810, 8, 960, 52);
      c.lineTo(960, 130); c.lineTo(0, 130); c.closePath();
      c.fillStyle = lg(c, 0, 0, 0, 130, [[0, "#cfe8d4"], [1, "#aed3bc"]]);
      c.fill();
    });
    this.ctex("hill_near", W, 120, (c) => {
      c.beginPath();
      c.moveTo(0, 46);
      c.quadraticCurveTo(190, 96, 380, 52);
      c.quadraticCurveTo(560, 12, 730, 58);
      c.quadraticCurveTo(860, 92, 960, 60);
      c.lineTo(960, 120); c.lineTo(0, 120); c.closePath();
      c.fillStyle = lg(c, 0, 0, 0, 120, [[0, "#a9d6a4"], [1, "#84bd88"]]);
      c.fill();
      // sparse distant trees
      c.fillStyle = "rgba(94,160,110,0.55)";
      for (const [tx, ty, r] of [[120, 58, 14], [300, 66, 11], [640, 52, 13], [880, 70, 10]] as const) {
        ell(c, tx, ty, r, r * 1.15); c.fill();
      }
    });

    // ---- ground with grain + light patches ----
    this.ctex("ground", W, H - GROUND, (c) => {
      const h = H - GROUND;
      c.fillStyle = lg(c, 0, 0, 0, h, [[0, "#94d387"], [0.45, "#6fbc71"], [1, "#4f9e5c"]]);
      c.fillRect(0, 0, W, h);
      // sun patches
      for (const [px, py, pr] of [[180, 60, 120], [700, 90, 150], [430, 180, 170]] as const) {
        c.fillStyle = rgrad(c, px, py, pr, [[0, "rgba(255,250,200,0.16)"], [1, "rgba(255,250,200,0)"]]);
        c.fillRect(px - pr, py - pr, pr * 2, pr * 2);
      }
      // grass grain
      for (let i = 0; i < 420; i++) {
        const gx = Math.random() * W;
        const gy = Math.random() * h;
        const l = 3 + Math.random() * 5 + gy * 0.02;
        c.strokeStyle = Math.random() < 0.5 ? "rgba(37,102,58,0.20)" : "rgba(214,255,205,0.20)";
        c.lineWidth = 1.6;
        c.beginPath();
        c.moveTo(gx, gy);
        c.quadraticCurveTo(gx + 1.5, gy - l * 0.6, gx + 3, gy - l);
        c.stroke();
      }
      // horizon fringe
      c.fillStyle = "rgba(47,116,66,0.5)";
      for (let x = 0; x < W; x += 16) { ell(c, x + 8, 2, 12, 5); c.fill(); }
      // foreground shade
      c.fillStyle = lg(c, 0, h - 60, 0, h, [[0, "rgba(20,60,35,0)"], [1, "rgba(20,60,35,0.22)"]]);
      c.fillRect(0, h - 60, W, 60);
    });

    // ---- fence with shaded pickets ----
    this.ctex("fence", W, 64, (c) => {
      for (let x = 4; x < W; x += 30) {
        c.fillStyle = "rgba(60,80,60,0.18)";
        rr(c, x + 2.5, 12, 11, 48, 3); c.fill(); // picket shadow
        c.fillStyle = lg(c, x, 0, x + 11, 0, [[0, "#f6ecd2"], [0.55, "#e9dcba"], [1, "#cdbc95"]]);
        rr(c, x, 10, 11, 48, 3); c.fill();
        c.beginPath(); c.moveTo(x, 12); c.lineTo(x + 11, 12); c.lineTo(x + 5.5, 1); c.closePath(); c.fill();
        c.fillStyle = "rgba(255,255,255,0.45)";
        c.fillRect(x + 1.5, 10, 2.4, 44);
      }
      for (const ry of [20, 40]) {
        c.fillStyle = "rgba(60,80,60,0.2)"; c.fillRect(0, ry + 5, W, 3);
        c.fillStyle = lg(c, 0, ry, 0, ry + 6, [[0, "#eee0bd"], [1, "#c9b78d"]]);
        c.fillRect(0, ry, W, 6);
      }
    });

    // ---- stepping-stone path ----
    this.ctex("path", 300, 150, (c) => {
      const stones: Array<[number, number, number, number]> = [
        [40, 18, 17, 7], [78, 36, 15, 6.5], [116, 55, 16, 7], [152, 74, 14, 6],
        [186, 92, 15, 6.5], [220, 110, 13, 5.5], [252, 127, 12, 5],
      ];
      for (const [sx, sy, srx, sry] of stones) {
        c.fillStyle = "rgba(30,60,40,0.3)";
        ell(c, sx + 1.5, sy + 2.5, srx, sry); c.fill();
        c.fillStyle = rgrad(c, sx - srx * 0.3, sy - sry * 0.5, srx * 1.6, [
          [0, "#e0d1a8"], [0.6, "#c4b183"], [1, "#a08a5e"]]);
        ell(c, sx, sy, srx, sry); c.fill();
        c.fillStyle = "rgba(255,255,255,0.3)";
        ell(c, sx - srx * 0.25, sy - sry * 0.35, srx * 0.45, sry * 0.4); c.fill();
      }
    });

    // ---- 2.5D house (drawn 2x) ----
    this.ctex("house", 600, 440, (c) => {
      c.scale(2, 2);
      const S = (fn: () => void) => { c.save(); fn(); c.restore(); };
      // ground shadow
      c.fillStyle = rgrad(c, 140, 212, 150, [[0, "rgba(18,42,32,0.35)"], [1, "rgba(18,42,32,0)"]]);
      c.save(); c.translate(140, 212); c.scale(1, 0.22); c.translate(-140, -212); ell(c, 140, 212, 150, 150); c.fill(); c.restore();
      // side face (right, darker — pseudo perspective)
      S(() => {
        c.beginPath(); c.moveTo(196, 88); c.lineTo(252, 104); c.lineTo(252, 214); c.lineTo(196, 214); c.closePath();
        c.fillStyle = lg(c, 196, 0, 252, 0, [[0, "#e6d2ab"], [1, "#c9b088"]]);
        c.fill();
        // side window
        c.fillStyle = lg(c, 212, 136, 238, 162, [[0, "#b6d9e8"], [1, "#7fb2c9"]]);
        rr(c, 212, 136, 26, 26, 4); c.fill();
        c.strokeStyle = "#c9b183"; c.lineWidth = 3; rr(c, 212, 136, 26, 26, 4); c.stroke();
      });
      // front face
      S(() => {
        c.fillStyle = lg(c, 0, 84, 0, 214, [[0, "#fbf0d8"], [0.7, "#f3e2bd"], [1, "#e6d0a4"]]);
        c.fillRect(12, 84, 184, 130);
        // plinth
        c.fillStyle = lg(c, 0, 204, 0, 214, [[0, "#d9c49b"], [1, "#bda87c"]]);
        c.fillRect(12, 204, 184, 10);
      });
      // roof: side slope first
      S(() => {
        c.beginPath(); c.moveTo(104, 12); c.lineTo(160, 28); c.lineTo(262, 104); c.lineTo(208, 88); c.closePath();
        c.fillStyle = lg(c, 150, 20, 240, 110, [[0, "#b25246"], [1, "#8f4038"]]);
        c.fill();
      });
      // roof: front gable
      S(() => {
        c.beginPath(); c.moveTo(0, 92); c.lineTo(208, 92); c.lineTo(104, 12); c.closePath();
        c.fillStyle = lg(c, 0, 12, 0, 92, [[0, "#ec7c66"], [0.6, "#d9604f"], [1, "#c14e42"]]);
        c.fill();
        // ridge highlight
        c.strokeStyle = "rgba(255,235,220,0.5)"; c.lineWidth = 3;
        c.beginPath(); c.moveTo(8, 90); c.lineTo(104, 16); c.stroke();
        // eave board + shadow onto wall
        c.fillStyle = "#a8443a"; c.fillRect(0, 90, 208, 7);
        c.fillStyle = lg(c, 0, 97, 0, 112, [[0, "rgba(90,50,30,0.35)"], [1, "rgba(90,50,30,0)"]]);
        c.fillRect(12, 97, 184, 15);
      });
      // chimney
      S(() => {
        c.fillStyle = lg(c, 168, 0, 188, 0, [[0, "#c2584a"], [1, "#9c4238"]]);
        c.fillRect(168, 26, 20, 40);
        c.fillStyle = "#8f3d34"; rr(c, 164, 18, 28, 10, 3); c.fill();
        c.fillStyle = "rgba(255,255,255,0.25)"; c.fillRect(170, 26, 4, 38);
      });
      // door (recessed arch)
      S(() => {
        c.fillStyle = "rgba(80,50,30,0.45)";
        rr(c, 82, 152, 44, 62, 16); c.fill();
        c.fillStyle = lg(c, 86, 156, 122, 156, [[0, "#9a6a43"], [0.5, "#835633"], [1, "#6d4628"]]);
        rr(c, 86, 156, 36, 58, 13); c.fill();
        // panels + knob
        c.strokeStyle = "rgba(255,230,190,0.25)"; c.lineWidth = 2;
        rr(c, 92, 166, 24, 20, 5); c.stroke(); rr(c, 92, 192, 24, 16, 5); c.stroke();
        c.fillStyle = rgrad(c, 116, 186, 5, [[0, "#ffe9a8"], [1, "#d9a83e"]]);
        ell(c, 116, 186, 3.5, 3.5); c.fill();
        // step
        c.fillStyle = "#cbb489"; rr(c, 80, 212, 48, 6, 3); c.fill();
      });
      // front windows
      const win = (wx: number) => S(() => {
        c.fillStyle = "rgba(90,60,30,0.3)";
        rr(c, wx - 2, 108, 42, 38, 7); c.fill();
        c.fillStyle = lg(c, wx, 110, wx + 38, 144, [[0, "#d6ecf5"], [0.5, "#a9d3e5"], [1, "#7fb2c9"]]);
        rr(c, wx, 110, 38, 34, 6); c.fill();
        // diagonal glare
        c.save(); rr(c, wx, 110, 38, 34, 6); c.clip();
        c.fillStyle = "rgba(255,255,255,0.4)";
        c.beginPath(); c.moveTo(wx + 2, 144); c.lineTo(wx + 16, 110); c.lineTo(wx + 24, 110); c.lineTo(wx + 8, 144); c.closePath(); c.fill();
        c.restore();
        // frame
        c.strokeStyle = "#e8d5a8"; c.lineWidth = 3.6;
        rr(c, wx, 110, 38, 34, 6); c.stroke();
        c.beginPath(); c.moveTo(wx + 19, 110); c.lineTo(wx + 19, 144); c.stroke();
        c.beginPath(); c.moveTo(wx, 127); c.lineTo(wx + 38, 127); c.stroke();
        // sill + flower box
        c.fillStyle = "#d9c49b"; rr(c, wx - 4, 144, 46, 6, 3); c.fill();
        c.fillStyle = lg(c, 0, 150, 0, 162, [[0, "#b25246"], [1, "#8f4038"]]);
        rr(c, wx - 2, 150, 42, 11, 3); c.fill();
        for (let f = 0; f < 4; f++) {
          c.fillStyle = ["#f7a8c4", "#ffd76e", "#f38fb0", "#ffc9dd"][f];
          ell(c, wx + 6 + f * 9, 148, 3.4, 3.4); c.fill();
        }
      });
      win(30); win(134);
    });

    // ---- tree trunk + canopy (2x) ----
    this.ctex("trunk", 72, 150, (c) => {
      c.scale(2, 2);
      c.fillStyle = lg(c, 8, 0, 30, 0, [[0, "#9b7350"], [0.5, "#82593a"], [1, "#63422a"]]);
      c.beginPath();
      c.moveTo(12, 0); c.lineTo(24, 0);
      c.quadraticCurveTo(23, 40, 30, 68); c.quadraticCurveTo(33, 74, 36, 75);
      c.lineTo(0, 75); c.quadraticCurveTo(3, 74, 6, 68);
      c.quadraticCurveTo(13, 40, 12, 0);
      c.closePath(); c.fill();
      c.strokeStyle = "rgba(50,30,15,0.35)"; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(17, 8); c.quadraticCurveTo(16, 40, 20, 66); c.stroke();
    });
    this.ctex("canopy", 300, 280, (c) => {
      c.scale(2, 2);
      const orb = (x: number, y: number, r: number, l = 0) => {
        c.fillStyle = rgrad(c, x - r * 0.35, y - r * 0.4, r * 1.5, [
          [0, l ? "#a6dfa0" : "#8ed489"], [0.55, l ? "#74c47c" : "#5cb46a"], [1, l ? "#4c9c5c" : "#3c8a4e"]]);
        ell(c, x, y, r, r); c.fill();
      };
      c.fillStyle = "rgba(30,80,45,0.25)"; ell(c, 76, 92, 62, 48); c.fill();
      orb(46, 90, 34); orb(106, 90, 36); orb(75, 56, 40, 1); orb(42, 62, 26, 1); orb(110, 60, 27);
      // dapples
      c.fillStyle = "rgba(230,255,220,0.35)";
      for (const [dx, dy, dr] of [[62, 44, 7], [86, 38, 5], [40, 76, 5], [116, 76, 6], [76, 70, 4]] as const) {
        ell(c, dx, dy, dr, dr); c.fill();
      }
    });

    // ---- bush + rock ----
    this.ctex("bush", 220, 110, (c) => {
      c.scale(2, 2);
      const orb = (x: number, y: number, r: number, l = 0) => {
        c.fillStyle = rgrad(c, x - r * 0.3, y - r * 0.45, r * 1.5, [
          [0, l ? "#9ed898" : "#7cc97e"], [0.6, "#54ab62"], [1, "#3d8a4e"]]);
        ell(c, x, y, r, r * 0.9); c.fill();
      };
      orb(28, 38, 20); orb(82, 40, 22); orb(55, 28, 22, 1);
      c.fillStyle = "rgba(235,255,230,0.4)";
      ell(c, 48, 20, 5, 4); c.fill(); ell(c, 66, 26, 4, 3); c.fill();
    });
    this.ctex("rock", 100, 64, (c) => {
      c.scale(2, 2);
      c.fillStyle = rgrad(c, 18, 10, 34, [[0, "#cfd6cd"], [0.6, "#a4ada6"], [1, "#7c867f"]]);
      blob(c, 25, 18, 22, 12, [0.05, -0.06, 0.08, -0.03, 0.05, -0.05, 0.04, -0.04]);
      c.fill();
      c.fillStyle = "rgba(255,255,255,0.4)"; ell(c, 17, 11, 8, 4.5); c.fill();
    });

    // ---- pond (2x): stone rim, bevel, deep water, bank shadow ----
    this.ctex("pond", 928, 336, (c) => {
      const cx = 464, cy = 158, rx = 380, ry = 112;
      // outer stone rim
      c.fillStyle = "rgba(20,50,35,0.28)";
      blob(c, cx, cy + 10, rx, ry, POND_WOB, 1.13); c.fill();
      c.fillStyle = lg(c, 0, cy - ry, 0, cy + ry + 30, [[0, "#f0e2b8"], [0.55, "#d9c493"], [1, "#b2996c"]]);
      blob(c, cx, cy, rx, ry, POND_WOB, 1.12); c.fill();
      // wet inner bank
      c.fillStyle = lg(c, 0, cy - ry, 0, cy + ry, [[0, "#8f7a52"], [1, "#b39d72"]]);
      blob(c, cx, cy, rx, ry, POND_WOB, 1.045); c.fill();
      // water body
      c.fillStyle = rgrad(c, cx, cy - 14, rx * 1.02, [
        [0, "#1f6a94"], [0.45, "#3390bd"], [0.75, "#5cb3d8"], [1, "#83cde8"]]);
      blob(c, cx, cy, rx, ry, POND_WOB, 1); c.fill();
      // bank shadow (top inner)
      c.save();
      blob(c, cx, cy, rx, ry, POND_WOB, 1); c.clip();
      c.fillStyle = lg(c, 0, cy - ry, 0, cy - ry * 0.25, [[0, "rgba(8,40,62,0.5)"], [1, "rgba(8,40,62,0)"]]);
      c.fillRect(0, 0, 928, cy);
      // sky sheen
      c.fillStyle = "rgba(230,248,255,0.16)";
      ell(c, cx - 120, cy - 26, 210, 46); c.fill();
      c.fillStyle = "rgba(230,248,255,0.1)";
      ell(c, cx + 130, cy + 22, 150, 30); c.fill();
      // bottom inner glow
      c.fillStyle = lg(c, 0, cy + ry * 0.4, 0, cy + ry, [[0, "rgba(190,240,255,0)"], [1, "rgba(190,240,255,0.22)"]]);
      c.fillRect(0, cy, 928, ry);
      c.restore();
      // pebbles on rim
      for (const [px, py, pr] of [[120, 236, 9], [214, 272, 7], [700, 268, 8], [806, 226, 10], [420, 292, 7]] as const) {
        c.fillStyle = rgrad(c, px - 2, py - 3, pr * 1.8, [[0, "#e8e3d2"], [0.7, "#b9b09a"], [1, "#8f876f"]]);
        ell(c, px, py, pr, pr * 0.7); c.fill();
      }
      // side lily pads
      const sidePad = (px: number, py: number, pr: number) => {
        c.fillStyle = "rgba(15,60,40,0.3)"; ell(c, px + 2, py + 4, pr, pr * 0.36); c.fill();
        c.fillStyle = rgrad(c, px - pr * 0.3, py - pr * 0.25, pr * 1.5, [[0, "#79ca82"], [0.7, "#4b9e5c"], [1, "#3a8a4e"]]);
        ell(c, px, py, pr, pr * 0.36); c.fill();
        c.fillStyle = "#2f7fa6";
        c.beginPath(); c.moveTo(px, py); c.lineTo(px - pr, py - pr * 0.14); c.lineTo(px - pr, py + pr * 0.14); c.closePath(); c.fill();
      };
      sidePad(230, 196, 46); sidePad(724, 122, 38);
      // cattails right bank
      c.strokeStyle = "#3e8e52"; c.lineWidth = 5; c.lineCap = "round";
      c.beginPath(); c.moveTo(836, 210); c.quadraticCurveTo(846, 150, 842, 96); c.stroke();
      c.beginPath(); c.moveTo(862, 216); c.quadraticCurveTo(868, 170, 866, 130); c.stroke();
      const tail = (px: number, py: number, tw: number, th: number) => {
        c.fillStyle = lg(c, px - tw, 0, px + tw, 0, [[0, "#a8744c"], [1, "#7c5231"]]);
        rr(c, px - tw, py, tw * 2, th, tw); c.fill();
      };
      tail(842, 62, 8, 40); tail(866, 104, 7, 32);
    });

    // ---- flowers (3 colorways, 2x) ----
    const flowerCols: Array<[string, string]> = [["#ffc9dd", "#ee7fa9"], ["#ffe9a8", "#f5b93e"], ["#dcc9f5", "#9b7fd4"]];
    flowerCols.forEach(([lo, hi], i) => {
      this.ctex("flower_" + i, 48, 78, (c) => {
        c.scale(2, 2);
        c.strokeStyle = lg(c, 0, 12, 0, 39, [[0, "#57ab62"], [1, "#3c7a46"]]);
        c.lineWidth = 2.6; c.lineCap = "round";
        c.beginPath(); c.moveTo(12, 38); c.quadraticCurveTo(11, 26, 12, 15); c.stroke();
        c.fillStyle = "#57ab62";
        c.save(); c.translate(9, 30); c.rotate(-0.7); ell(c, -4, 0, 6, 2.6); c.fill(); c.restore();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          c.fillStyle = rgrad(c, 12 + Math.cos(a) * 4, 11 + Math.sin(a) * 4, 6, [[0, lo], [1, hi]]);
          ell(c, 12 + Math.cos(a) * 5.5, 11 + Math.sin(a) * 5.5, 4.2, 4.2); c.fill();
        }
        c.fillStyle = rgrad(c, 11, 10, 5, [[0, "#fff6d9"], [1, "#f2c94c"]]);
        ell(c, 12, 11, 3.6, 3.6); c.fill();
      });
    });

    // ---- foreground grass blades (2x, 3 silhouettes) ----
    for (let v = 0; v < 3; v++) {
      this.ctex("blade_" + v, 76, 116, (c) => {
        c.scale(2, 2);
        const n = 5 + v;
        for (let k = 0; k < n; k++) {
          const bx = 6 + k * (26 / n) + (v % 2) * 2;
          const tip = 30 + ((k * 7 + v * 11) % 22);
          const lean = -5 + ((k * 5 + v * 3) % 11);
          const dark = (k + v) % 2 === 0;
          c.fillStyle = lg(c, 0, 56, 0, 56 - tip, [
            [0, dark ? "#2f7a45" : "#3c8a4e"],
            [0.55, dark ? "#4f9e5c" : "#5cb46a"],
            [1, dark ? "#8ed48a" : "#a6e09b"],
          ]);
          c.beginPath();
          c.moveTo(bx - 2.6, 56);
          c.quadraticCurveTo(bx + lean * 0.35, 56 - tip * 0.55, bx + lean, 56 - tip);
          c.quadraticCurveTo(bx + lean * 0.5, 56 - tip * 0.5, bx + 2.6, 56);
          c.closePath();
          c.fill();
        }
      });
    }

    // ---- grass tuft (2x) ----
    this.ctex("tuft", 60, 56, (c) => {
      c.scale(2, 2);
      const blade = (bx: number, tip: number, lean: number, col0: string, col1: string) => {
        c.fillStyle = lg(c, 0, 28, 0, 28 - tip, [[0, col1], [1, col0]]);
        c.beginPath();
        c.moveTo(bx - 2.4, 28);
        c.quadraticCurveTo(bx + lean * 0.4, 28 - tip * 0.6, bx + lean, 28 - tip);
        c.quadraticCurveTo(bx + lean * 0.55, 28 - tip * 0.55, bx + 2.4, 28);
        c.closePath(); c.fill();
      };
      blade(6, 18, -3, "#8fd48a", "#3f8a4e");
      blade(13, 26, 1, "#a6e09b", "#4d9e5c");
      blade(21, 20, 4, "#8fd48a", "#3f8a4e");
      blade(26, 14, 6, "#79c47a", "#3c8a4e");
    });

    // ---- glossy hint droplet (2x) ----
    this.ctex("hint", 44, 56, (c) => {
      c.scale(2, 2);
      c.fillStyle = "rgba(20,60,90,0.25)"; ell(c, 11, 25.5, 8, 2.4); c.fill();
      const g = rgrad(c, 8, 13, 14, [[0, "#bfeaff"], [0.5, "#5fb9e6"], [1, "#2e86b8"]]);
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(11, 1);
      c.bezierCurveTo(15, 9, 19, 13, 19, 18);
      c.bezierCurveTo(19, 23, 15.4, 26, 11, 26);
      c.bezierCurveTo(6.6, 26, 3, 23, 3, 18);
      c.bezierCurveTo(3, 13, 7, 9, 11, 1);
      c.closePath(); c.fill();
      c.fillStyle = "rgba(255,255,255,0.75)";
      ell(c, 7.6, 15, 2.2, 4); c.fill();
    });

    // ---- sun / moon / rays / vignette ----
    this.ctex("sunglow", 260, 260, (c) => {
      c.fillStyle = rgrad(c, 130, 130, 128, [
        [0, "rgba(255,250,225,1)"], [0.18, "rgba(255,230,150,0.95)"],
        [0.32, "rgba(255,210,110,0.5)"], [0.6, "rgba(255,200,110,0.16)"], [1, "rgba(255,200,110,0)"]]);
      c.fillRect(0, 0, 260, 260);
    });
    this.ctex("moonglow", 220, 220, (c) => {
      c.fillStyle = rgrad(c, 110, 110, 108, [
        [0, "rgba(240,240,225,0)"], [0.2, "rgba(226,232,255,0.28)"], [0.5, "rgba(210,222,255,0.1)"], [1, "rgba(210,222,255,0)"]]);
      c.fillRect(0, 0, 220, 220);
      c.fillStyle = rgrad(c, 102, 100, 30, [[0, "#fbf8e8"], [0.8, "#ece7cc"], [1, "#d9d4b4"]]);
      ell(c, 110, 110, 26, 26); c.fill();
      c.fillStyle = "rgba(190,186,160,0.7)";
      ell(c, 102, 112, 5.5, 5.5); c.fill(); ell(c, 119, 102, 4, 4); c.fill(); ell(c, 114, 122, 3, 3); c.fill();
    });
    this.ctex("ray", 480, 480, (c) => {
      c.translate(240, 240);
      for (let k = 0; k < 7; k++) {
        c.save();
        c.rotate((k / 7) * Math.PI * 2);
        const g = lg(c, 0, 0, 0, -230, [[0, "rgba(255,240,190,0.5)"], [1, "rgba(255,240,190,0)"]]);
        c.fillStyle = g;
        c.beginPath(); c.moveTo(0, 0); c.lineTo(-26, -230); c.lineTo(26, -230); c.closePath(); c.fill();
        c.restore();
      }
    });
    this.ctex("vignette", 480, 300, (c) => {
      const g = c.createRadialGradient(240, 140, 90, 240, 150, 300);
      g.addColorStop(0, "rgba(15,35,45,0)");
      g.addColorStop(0.75, "rgba(15,35,45,0)");
      g.addColorStop(1, "rgba(12,30,40,0.4)");
      c.fillStyle = g;
      c.fillRect(0, 0, 480, 300);
    });

    // ---- gardener frames (2x, palette-driven) ----
    this.paintGardenerFrames();

    // ---- small graphics-based sprites (particles + critters) ----
    const g = this.add.graphics().setVisible(false);
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillPoints(
      [
        new Phaser.Geom.Point(8, 0), new Phaser.Geom.Point(10.2, 5.8),
        new Phaser.Geom.Point(16, 8), new Phaser.Geom.Point(10.2, 10.2),
        new Phaser.Geom.Point(8, 16), new Phaser.Geom.Point(5.8, 10.2),
        new Phaser.Geom.Point(0, 8), new Phaser.Geom.Point(5.8, 5.8),
      ],
      true
    );
    g.generateTexture("spark", 16, 16);
    g.clear();
    g.fillStyle(0xcfeafa, 1);
    g.fillCircle(4, 5, 3.4);
    g.fillTriangle(0.8, 4.4, 7.2, 4.4, 4, 0);
    g.generateTexture("drop", 8, 9);
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(0, 0, 10, 6, 3);
    g.generateTexture("petalbit", 10, 6);
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(5, 4, 8, 7);
    g.fillEllipse(13, 4, 8, 7);
    g.fillStyle(0x5a4632, 1);
    g.fillEllipse(9, 6, 3, 8);
    g.generateTexture("bfly_0", 18, 12);
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(6.5, 5, 5, 8);
    g.fillEllipse(11.5, 5, 5, 8);
    g.fillStyle(0x5a4632, 1);
    g.fillEllipse(9, 6, 3, 8);
    g.generateTexture("bfly_1", 18, 12);
    g.clear();
    g.fillStyle(0x63c6c9, 1);
    g.fillEllipse(16, 6, 18, 3.4);
    g.fillCircle(25, 6, 3);
    g.fillStyle(0xffffff, 0.55);
    g.fillEllipse(12, 2.5, 12, 3);
    g.fillEllipse(16, 9.5, 12, 3);
    g.generateTexture("dragonfly", 30, 12);
    g.clear();
    g.lineStyle(3, 0x3d4a5c, 1);
    g.beginPath(); g.moveTo(0, 8); g.lineTo(9, 2); g.lineTo(18, 8); g.strokePath();
    g.generateTexture("bird_0", 18, 10);
    g.clear();
    g.lineStyle(3, 0x3d4a5c, 1);
    g.beginPath(); g.moveTo(0, 2); g.lineTo(9, 7); g.lineTo(18, 2); g.strokePath();
    g.generateTexture("bird_1", 18, 10);
    g.clear();
    g.fillStyle(0xffe9a0, 0.25); g.fillCircle(7, 7, 7);
    g.fillStyle(0xffe9a0, 0.55); g.fillCircle(7, 7, 4);
    g.fillStyle(0xfff6cf, 1); g.fillCircle(7, 7, 1.8);
    g.generateTexture("glow", 14, 14);
    g.destroy();

    // animations
    this.anims.create({ key: "idle", frames: [{ key: "g_idle_0" }], frameRate: 1, repeat: -1 });
    this.anims.create({
      key: "walk",
      frames: [{ key: "g_walk_0" }, { key: "g_walk_1" }, { key: "g_walk_2" }, { key: "g_walk_3" }],
      frameRate: 9,
      repeat: -1,
    });
    this.anims.create({ key: "pour", frames: [{ key: "g_pour_0" }, { key: "g_pour_1" }], frameRate: 3, repeat: -1 });
    this.anims.create({ key: "flutter", frames: [{ key: "bfly_0" }, { key: "bfly_1" }], frameRate: 10, repeat: -1 });
    this.anims.create({ key: "flap", frames: [{ key: "bird_0" }, { key: "bird_1" }], frameRate: 7, repeat: -1 });
  }

  /** (Re)paints every gardener frame with the current avatar palette. */
  private paintGardenerFrames() {
    for (const [key, pose] of POSES) {
      this.ctex(key, FRAME_W * 2, FRAME_H * 2, (c) => {
        c.scale(2, 2);
        paintGardener(c, pose, this.avatar);
      });
    }
  }

  // ================= world building =================

  private buildSky() {
    this.skyTex = this.ctex("sky", W, 390, (c) => {
      c.fillStyle = lg(c, 0, 0, 0, 390, [[0, "#6fb9e8"], [0.55, "#a5d8f0"], [1, "#ddf2e6"]]);
      c.fillRect(0, 0, W, 390);
    });
    this.add.image(0, 0, "sky").setOrigin(0).setDepth(0);

    // stars
    this.starC = this.add.container(0, 0).setDepth(1);
    for (let i = 0; i < 46; i++) {
      const s = this.add.circle(
        Phaser.Math.Between(8, W - 8),
        Phaser.Math.Between(8, 320),
        Phaser.Math.FloatBetween(0.7, 1.8),
        0xfff7d6
      );
      this.starC.add(s);
      this.tweens.add({
        targets: s,
        alpha: { from: 1, to: 0.25 },
        duration: Phaser.Math.Between(900, 2400),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 2000),
      });
    }

    this.rayImg = this.add.image(0, 0, "ray").setDepth(2).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.tweens.add({ targets: this.rayImg, angle: 360, duration: 140000, repeat: -1 });
    this.sunImg = this.add.image(0, 0, "sunglow").setDepth(2).setBlendMode(Phaser.BlendModes.SCREEN);
    this.tweens.add({ targets: this.sunImg, scale: { from: 1, to: 1.08 }, duration: 2800, yoyo: true, repeat: -1 });
    this.moonImg = this.add.image(0, 0, "moonglow").setDepth(2);

    // clouds
    const cloudKeys = ["cloud_0", "cloud_1", "cloud_2", "cloud_1"];
    for (let i = 0; i < 4; i++) {
      const c = this.add
        .image(Phaser.Math.Between(0, W), 46 + i * 58 + Phaser.Math.Between(-12, 12), cloudKeys[i])
        .setDepth(3)
        .setAlpha(0.92 - i * 0.14)
        .setScale(1.05 - i * 0.16);
      c.setData("vx", 9 - i * 1.7);
      c.setData("cloud", true);
    }
    this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        this.children.list.forEach((obj) => {
          const img = obj as Phaser.GameObjects.Image;
          if (img.getData && img.getData("cloud")) {
            img.x += (img.getData("vx") as number) * 0.05;
            if (img.x > W + 200) img.x = -200;
          }
        });
      },
    });

    this.duskOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0xff8a5c, 0).setDepth(59).setBlendMode(Phaser.BlendModes.SCREEN);
    this.nightOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0x101d3f, 0).setDepth(60);
  }

  private buildScenery() {
    // parallax hills behind the fence
    this.add.image(0, GROUND + 2, "hill_far").setOrigin(0, 1).setDepth(3.5).setAlpha(0.9);
    this.add.image(0, GROUND + 4, "hill_near").setOrigin(0, 1).setDepth(3.7);

    // ground + path
    this.add.image(0, GROUND, "ground").setOrigin(0).setDepth(4);
    this.add.image(58, 394, "path").setOrigin(0, 0).setDepth(4.5);

    // fence
    this.add.image(0, 330, "fence").setOrigin(0, 0).setDepth(6);

    // house
    this.add.image(HX, 378, "house").setOrigin(0.5, 1).setScale(0.5).setDepth(5.5);
    const glow1 = this.add.rectangle(HX - 101, 292, 18, 16, 0xffd76e, 0.12).setDepth(5.6);
    const glow2 = this.add.rectangle(HX - 49, 292, 18, 16, 0xffd76e, 0.12).setDepth(5.6);
    this.windowGlows = [glow1, glow2];

    // bushes along the fence
    for (const [bx, bs] of [[352, 0.55], [742, 0.5], [918, 0.62]] as const) {
      this.add.image(bx, 388, "bush").setOrigin(0.5, 1).setScale(bs).setDepth(6.4);
    }

    // trees: trunk static, canopy sways
    const tree = (tx: number, baseY: number, scale: number, depth: number) => {
      this.add.image(tx, baseY + 4, "shadow").setScale(scale * 1.5, scale * 0.6).setAlpha(0.5).setDepth(depth - 0.1);
      this.add.image(tx, baseY, "trunk").setOrigin(0.5, 1).setScale(scale * 0.5).setDepth(depth);
      const canopy = this.add
        .image(tx, baseY - 68 * scale, "canopy")
        .setOrigin(0.5, 0.72)
        .setScale(scale * 0.55)
        .setDepth(depth + 0.1);
      this.addSwayer(canopy, 2.4, 0, 0.55);
    };
    tree(850, 402, 1.05, 7);
    tree(938, 394, 0.7, 6.8);
    tree(305, 392, 0.55, 6.9);

    // rocks near the pond
    this.add.image(742, 514, "rock").setOrigin(0.5, 1).setScale(0.5).setDepth(11);

    // scattered flowers + swaying grass
    const spots: Array<[number, number]> = [];
    let guard = 0;
    while (spots.length < 30 && guard++ < 400) {
      const x = Phaser.Math.Between(16, W - 16);
      const y = Phaser.Math.Between(392, 586);
      const dx = (x - POND_X) / (POND_RX + 52);
      const dy = (y - POND_Y) / (POND_RY + 42);
      if (dx * dx + dy * dy < 1) continue;
      if (x > HX - 155 && x < HX + 155 && y < 404) continue;
      spots.push([x, y]);
    }
    spots.forEach(([x, y], i) => {
      const isFlower = i % 3 === 0;
      const texKey = isFlower ? "flower_" + ((((i / 3) | 0)) % 3) : "tuft";
      const img = this.add
        .image(x, y, texKey)
        .setOrigin(0.5, 1)
        .setScale(Phaser.Math.FloatBetween(0.3, 0.44) * (y > 500 ? 1.18 : 1))
        .setDepth(y > 500 ? 13 : 6.5);
      this.addSwayer(img, isFlower ? 5.5 : 7, 0, 1);
    });

    this.buildGrassField();
  }

  /** Registers an object to sway with the wind field. `lag` slows heavy things (trees). */
  private addSwayer(o: Phaser.GameObjects.Image, amp: number, base = 0, lag = 1) {
    this.swayers.push({ o, amp, base, phase: o.x * 0.014, lag });
  }

  /** Dense foreground grass band — the phase offset makes gusts ripple across it. */
  private buildGrassField() {
    for (let i = 0; i < 46; i++) {
      const x = -20 + i * (W + 40) / 45 + Phaser.Math.Between(-9, 9);
      const y = 592 + Phaser.Math.Between(0, 18);
      const g = this.add
        .image(x, y, "blade_" + (i % 3))
        .setOrigin(0.5, 1)
        .setScale(Phaser.Math.FloatBetween(0.42, 0.7))
        .setDepth(15 + (y - 592) / 100);
      this.addSwayer(g, 9, 0, 1);
    }
  }

  /** Wind = slow breeze + travelling gusts. Returns -1..1-ish at a given x. */
  private windAt(x: number, time: number, phase: number): number {
    const breeze = 0.42 * Math.sin(time / 1450 + phase) + 0.18 * Math.sin(time / 640 + phase * 2.3);
    let gust = 0;
    for (const g of this.gusts) {
      const age = (time - g.t0) / g.dur;
      if (age < 0 || age > 1) continue;
      // gust front sweeps across the yard at a fixed speed
      const front = g.x0 + this.windDir * age * (W + 500);
      const d = Math.abs(x - front);
      if (d < 320) {
        const falloff = Math.cos((d / 320) * Math.PI * 0.5);
        const envelope = Math.sin(age * Math.PI);
        gust += g.power * falloff * falloff * envelope;
      }
    }
    return breeze + gust;
  }

  private updateWind(time: number) {
    this.gusts = this.gusts.filter((g) => time - g.t0 < g.dur);
    for (const s of this.swayers) {
      const w = this.windAt(s.o.x, time * s.lag, s.phase);
      s.o.setAngle(s.base + w * s.amp * this.windDir);
    }

    // faint streaks riding the strongest gusts
    const g2 = this.streakG;
    g2.clear();
    this.windStreaks = this.windStreaks.filter((st) => {
      const t = (time - st.t0) / 1150;
      if (t >= 1) return false;
      const x = st.x + this.windDir * t * (W * 0.75);
      const a = Math.sin(t * Math.PI) * 0.24;
      g2.lineStyle(2, 0xffffff, a);
      g2.beginPath();
      g2.moveTo(x, st.y);
      g2.lineTo(x + this.windDir * st.len, st.y - 5);
      g2.strokePath();
      return true;
    });
  }

  private launchGust() {
    this.windDir = Math.random() < 0.72 ? 1 : -1;
    const power = Phaser.Math.FloatBetween(0.8, 1.9);
    this.gusts.push({
      t0: this.time.now,
      x0: this.windDir === 1 ? -260 : W + 260,
      power,
      dur: Phaser.Math.Between(2600, 4200),
    });

    const n = Math.round(power * 3);
    for (let i = 0; i < n; i++) {
      this.windStreaks.push({
        x: this.windDir === 1 ? Phaser.Math.Between(-120, 120) : Phaser.Math.Between(W - 120, W + 120),
        y: Phaser.Math.Between(330, 560),
        t0: this.time.now + i * 90,
        len: Phaser.Math.Between(30, 80),
      });
    }
    // leaves and petals torn loose by the stronger gusts
    if (power > 1.15) this.spawnLeaves(Math.round(power * 3));
  }

  private spawnLeaves(n: number) {
    const tints = [0x8ed69b, 0x6cc17b, 0xffd76e, 0xf7a8c4];
    for (let i = 0; i < n; i++) {
      const fromX = this.windDir === 1 ? -30 : W + 30;
      const leaf = this.add
        .image(fromX, Phaser.Math.Between(300, 520), "petalbit")
        .setTint(Phaser.Utils.Array.GetRandom(tints))
        .setScale(Phaser.Math.FloatBetween(0.8, 1.5))
        .setDepth(13.5);
      const dur = Phaser.Math.Between(3400, 5600);
      this.tweens.add({
        targets: leaf,
        x: this.windDir === 1 ? W + 40 : -40,
        duration: dur,
        ease: "Sine.easeInOut",
        onComplete: () => leaf.destroy(),
      });
      this.tweens.add({
        targets: leaf,
        y: leaf.y + Phaser.Math.Between(-60, 90),
        duration: dur / 2,
        yoyo: true,
        repeat: 1,
        ease: "Sine.easeInOut",
      });
      this.tweens.add({
        targets: leaf,
        angle: Phaser.Math.Between(220, 900) * this.windDir,
        duration: dur,
      });
    }
  }

  private buildPond() {
    this.add.image(POND_X, POND_Y + 6, "pond").setScale(0.5).setDepth(8);
    this.rippleG = this.add.graphics().setDepth(9);
    for (let i = 0; i < 6; i++) {
      this.shimmer.push({
        x: POND_X + Phaser.Math.Between(-130, 130),
        y: POND_Y + Phaser.Math.Between(-22, 26),
        w: Phaser.Math.Between(14, 36),
      });
    }
  }

  private buildLily() {
    this.lilyTex = this.textures.createCanvas("lily", 600, 520)!;

    this.lilyC = this.add.container(POND_X, POND_Y).setDepth(10);

    // watery reflection
    const refl = this.add.image(0, 30, "lily")
      .setScale(0.5, 0.26)
      .setFlipY(true)
      .setOrigin(0.5, 0.28)
      .setAlpha(0.18)
      .setTint(0x9fd4ea);
    this.lilyC.add(refl);

    this.bloomGlow = this.add.image(0, -26, "sunglow")
      .setScale(0.9)
      .setBlendMode(Phaser.BlendModes.SCREEN)
      .setAlpha(0)
      .setTint(0xffd0e4);
    this.lilyC.add(this.bloomGlow);
    this.tweens.add({ targets: this.bloomGlow, scale: { from: 0.85, to: 1 }, duration: 2200, yoyo: true, repeat: -1 });

    const lilyImg = this.add.image(0, 0, "lily").setScale(0.5).setOrigin(0.5, 0.77);
    this.lilyC.add(lilyImg);

    this.tweens.add({
      targets: this.lilyC,
      y: POND_Y - 4,
      duration: 2100,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.hintDrop = this.add
      .image(POND_X, POND_Y - 66, "hint")
      .setScale(0.85)
      .setDepth(10.5)
      .setAlpha(0);
    this.tweens.add({
      targets: this.hintDrop,
      y: POND_Y - 76,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.redrawLily();
  }

  /** paints the lily's current stage into the shared canvas texture (2x, anchor at (150,200) logical) */
  private redrawLily() {
    const s = this.garden?.stage ?? 0;
    const wilted = this.garden?.wilted ?? false;

    const c = this.lilyTex.getContext();
    c.clearRect(0, 0, 600, 520);
    c.save();
    c.scale(2, 2);
    c.translate(150, 200); // anchor: pad waterline

    // palettes
    const leafHi = wilted ? "#b7bd8d" : "#8ed69b";
    const leafMid = wilted ? "#9aa96b" : "#58b368";
    const leafLo = wilted ? "#7c8a55" : "#3a8a4e";
    const petHi = wilted ? "#e3c3cd" : "#ffd3e2";
    const petMid = wilted ? "#d0a4b2" : "#f7a8c4";
    const petLo = wilted ? "#b98c9d" : "#ee7fa9";
    const droop = wilted ? 0.35 : 0;

    const pad = (x: number, y: number, r: number) => {
      c.save(); c.translate(x, y);
      c.fillStyle = "rgba(10,50,70,0.35)";
      ell(c, 2, 3.5, r, r * 0.38); c.fill();
      c.fillStyle = rgrad(c, -r * 0.35, -r * 0.2, r * 1.6, [[0, leafHi], [0.55, leafMid], [1, leafLo]]);
      ell(c, 0, 0, r, r * 0.38); c.fill();
      // vein highlights
      c.strokeStyle = "rgba(255,255,255,0.28)"; c.lineWidth = 1.4;
      for (const a of [-0.5, 0.15, 0.8, 1.9, 2.6]) {
        c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.32); c.stroke();
      }
      // notch showing water
      c.fillStyle = "#3d95bd";
      c.beginPath(); c.moveTo(0, 0); c.lineTo(-r, -r * 0.15); c.lineTo(-r, r * 0.15); c.closePath(); c.fill();
      // rim light
      c.strokeStyle = "rgba(235,255,235,0.4)"; c.lineWidth = 1.6;
      c.beginPath(); c.ellipse(0, -0.8, r * 0.96, r * 0.34, 0, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
      c.restore();
    };

    const stem = (topX: number, topY: number, w = 3.2) => {
      c.strokeStyle = lg(c, 0, topY, 0, 4, [[0, leafMid], [1, leafLo]]);
      c.lineWidth = w; c.lineCap = "round";
      c.beginPath(); c.moveTo(0, 4); c.quadraticCurveTo(topX * 0.3, topY * 0.55, topX, topY); c.stroke();
    };

    if (s === 0) {
      // seed in the shallows
      c.fillStyle = "rgba(30,60,40,0.4)"; ell(c, 0, 4, 14, 5); c.fill();
      c.fillStyle = rgrad(c, -3, -3, 12, [[0, "#c9a86a"], [0.5, "#9c7a4a"], [1, "#6d5232"]]);
      ell(c, 0, 0, 8, 6.5); c.fill();
      c.fillStyle = "rgba(255,240,210,0.7)"; ell(c, -2.8, -2.4, 2.6, 1.8); c.fill();
    } else if (s === 1) {
      stem(wilted ? 8 : 0, -26 + droop * 16);
      const leafS = (sx: number, rot: number, len: number, hi: string) => {
        c.save(); c.translate(sx, -20 + droop * 12); c.rotate(rot + (sx < 0 ? -droop : droop));
        c.fillStyle = lg(c, 0, 0, len, 0, [[0, leafLo], [1, hi]]);
        ell(c, len / 2, 0, len / 2, 4.4); c.fill();
        c.restore();
      };
      leafS(-2, Math.PI - 0.5, 20, leafMid);
      leafS(2, 0.42, 22, leafHi);
    } else if (s === 2) {
      pad(0, 2, 27);
      c.save(); c.translate(9, 0); c.rotate(0.22 + droop);
      stem(3, -20, 2.6);
      c.fillStyle = lg(c, 0, -26, 12, -18, [[0, leafLo], [1, leafHi]]);
      ell(c, 6, -22, 8, 3.6); c.fill();
      c.restore();
    } else if (s === 3) {
      pad(-4, 2, 38);
      pad(35, 8, 18);
      c.fillStyle = "rgba(255,255,255,0.2)";
      ell(c, -10, -1, 16, 3.4); c.fill();
    } else if (s === 4) {
      pad(-8, 3, 37);
      pad(33, 9, 17);
      stem(wilted ? 10 : 3, -42 + droop * 20);
      c.save(); c.translate(wilted ? 10 : 3, -46 + droop * 22); c.rotate(droop);
      c.fillStyle = rgrad(c, -2, -4, 14, [[0, leafHi], [0.7, leafMid], [1, leafLo]]);
      ell(c, 0, 0, 7.5, 12); c.fill();
      c.strokeStyle = "rgba(255,255,255,0.3)"; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(0, 8); c.lineTo(0, -8); c.stroke();
      c.restore();
    } else if (s === 5) {
      pad(-10, 3, 39);
      pad(34, 9, 18);
      stem(wilted ? 11 : 2, -50 + droop * 22);
      c.save(); c.translate(wilted ? 12 : 2, -54 + droop * 24); c.rotate(droop);
      // sepals
      for (const sd of [-1, 1]) {
        c.save(); c.rotate(sd * 0.42);
        c.fillStyle = lg(c, 0, 0, 0, -20, [[0, leafLo], [1, leafMid]]);
        petalPath(c, 9, 20); c.fill();
        c.restore();
      }
      // blushing bud
      c.fillStyle = lg(c, 0, 2, 0, -24, [[0, petLo], [0.55, petMid], [1, petHi]]);
      petalPath(c, 12, 25); c.fill();
      c.fillStyle = "rgba(255,255,255,0.35)";
      ell(c, -2.5, -14, 2.6, 6); c.fill();
      c.restore();
    } else {
      // FULL BLOOM
      pad(0, 5, 44);
      pad(46, 12, 19);
      pad(-48, 12, 16);
      stem(0, -40, 3.6);
      c.save(); c.translate(0, -52);
      // soft shadow under flower
      c.fillStyle = "rgba(120,40,80,0.16)"; ell(c, 0, 46, 26, 7); c.fill();
      // outer ring
      for (let k = 0; k < 8; k++) {
        c.save(); c.rotate((k * Math.PI) / 4 + 0.39);
        c.fillStyle = lg(c, 0, 0, 0, -30, [[0, petLo], [0.6, petMid], [1, petHi]]);
        petalPath(c, 12.5, 30); c.fill();
        c.strokeStyle = "rgba(255,255,255,0.35)"; c.lineWidth = 1;
        petalPath(c, 12.5, 30); c.stroke();
        c.restore();
      }
      // mid ring
      for (let k = 0; k < 6; k++) {
        c.save(); c.rotate((k * Math.PI) / 3);
        c.fillStyle = lg(c, 0, 0, 0, -24, [[0, petLo], [0.5, petMid], [1, "#ffe3ee"]]);
        petalPath(c, 11, 24); c.fill();
        c.restore();
      }
      // inner ring
      for (let k = 0; k < 4; k++) {
        c.save(); c.rotate((k * Math.PI) / 2 + 0.7);
        c.fillStyle = lg(c, 0, 0, 0, -16, [[0, "#e56f9e"], [1, petMid]]);
        petalPath(c, 9, 16); c.fill();
        c.restore();
      }
      // golden heart + stamens
      c.fillStyle = rgrad(c, -1.5, -1.5, 9, [[0, "#fff2bf"], [0.55, "#ffd76e"], [1, "#eaa93e"]]);
      ell(c, 0, 0, 8, 8); c.fill();
      c.fillStyle = "#f5b93e";
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        ell(c, Math.cos(a) * 5.5, Math.sin(a) * 5.5, 1.5, 1.5); c.fill();
      }
      c.restore();
    }

    c.restore();
    this.lilyTex.refresh();

    this.lilyC.setAngle(wilted ? 3 : 0);
    this.bloomGlow.setAlpha(s >= 6 && !wilted ? 0.5 : 0);
  }

  private buildGardener() {
    this.playerShadow = this.add.image(200, FEET_Y + 2, "shadow").setScale(0.62, 0.42).setAlpha(0.4).setDepth(11.9);
    this.player = this.add
      .sprite(200, FEET_Y, "g_idle_0")
      .setScale(0.5)
      .setOrigin(BODY_CX / FRAME_W, FEET_LY / FRAME_H)
      .setDepth(12);
    this.player.play("idle");

    this.time.addEvent({
      delay: 3200,
      loop: true,
      callback: () => {
        if (this.pouring || this.isWalking()) return;
        this.player.setTexture("g_idle_1");
        this.time.delayedCall(140, () => {
          if (!this.pouring && !this.isWalking()) this.player.setTexture("g_idle_0");
        });
      },
    });
  }

  private buildCritters() {
    const tints = [0xffc9dd, 0xcdb4f5];
    for (let i = 0; i < 2; i++) {
      const s = this.add
        .sprite(Phaser.Math.Between(100, 860), Phaser.Math.Between(300, 480), "bfly_0")
        .setDepth(13)
        .setTint(tints[i]);
      s.play({ key: "flutter", delay: i * 60 });
      const b = { s, tx: s.x, ty: s.y, seed: Math.random() * 100 };
      this.butterflies.push(b);
      this.time.addEvent({
        delay: Phaser.Math.Between(2400, 3800),
        loop: true,
        callback: () => {
          b.tx = Phaser.Math.Between(60, W - 60);
          b.ty = Phaser.Math.Between(280, 520);
        },
      });
    }

    this.dragonfly = this.add.image(POND_X + 80, POND_Y - 60, "dragonfly").setDepth(13);
    const dart = () => {
      const nx = POND_X + Phaser.Math.Between(-190, 190);
      const ny = POND_Y + Phaser.Math.Between(-80, -20);
      this.dragonfly.setFlipX(nx < this.dragonfly.x);
      this.tweens.add({
        targets: this.dragonfly,
        x: nx,
        y: ny,
        duration: Phaser.Math.Between(700, 1300),
        ease: "Sine.easeInOut",
        onComplete: () => this.time.delayedCall(Phaser.Math.Between(600, 2200), dart),
      });
    };
    dart();

    for (let i = 0; i < 7; i++) {
      const s = this.add
        .image(Phaser.Math.Between(60, W - 60), Phaser.Math.Between(400, 570), "glow")
        .setDepth(61)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0);
      this.fireflies.push({ s, a: Math.random() * Math.PI * 2, seed: Math.random() * 100 });
    }
  }

  private buildParticles() {
    this.sparkles = this.add.particles(0, 0, "spark", {
      speed: { min: 40, max: 150 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 800,
      gravityY: -30,
      rotate: { min: 0, max: 180 },
      tint: [0xffd76e, 0xfff2bf, 0xaef0c0, 0xf7a8c4],
      emitting: false,
    }).setDepth(70);

    this.confetti = this.add.particles(0, 0, "petalbit", {
      speed: { min: 60, max: 240 },
      angle: { min: 230, max: 310 },
      scale: { min: 0.7, max: 1.3 },
      alpha: { start: 1, end: 0.2 },
      lifespan: { min: 1400, max: 2200 },
      gravityY: 220,
      rotate: { min: 0, max: 360 },
      tint: [0xf7a8c4, 0xee7fa9, 0xffd76e, 0x8ed69b, 0xa5dcf2],
      emitting: false,
    }).setDepth(70);

    // One emitter per facing direction: the stream must arc *toward* the pond,
    // so speedX is mirrored rather than always-positive.
    const dropletCfg = (dir: 1 | -1) => ({
      speedX: { min: Math.min(dir * 95, dir * 150), max: Math.max(dir * 95, dir * 150) },
      speedY: { min: -10, max: 30 },
      gravityY: 760,
      lifespan: 330,
      quantity: 2,
      frequency: 22,
      scale: { min: 0.7, max: 1.15 },
      alpha: { start: 0.95, end: 0.3 },
      emitting: false,
    });
    this.dropletsR = this.add.particles(0, 0, "drop", dropletCfg(1)).setDepth(14);
    this.dropletsL = this.add.particles(0, 0, "drop", dropletCfg(-1)).setDepth(14);
    this.splashG = this.add.graphics().setDepth(9.5);
  }

  private buildPost() {
    this.add.image(W / 2, H / 2, "vignette").setDisplaySize(W, H).setDepth(65);
  }

  // ================= behaviors =================

  private isWalking(): boolean {
    return this.player.anims.currentAnim?.key === "walk" && this.player.anims.isPlaying;
  }

  private updatePlayer() {
    if (!this.player || this.pouring) return;

    let vx = 0;
    const left = this.cursors?.left?.isDown || this.keys?.A?.isDown;
    const right = this.cursors?.right?.isDown || this.keys?.D?.isDown;

    if (left || right) {
      this.autoTarget = null;
      this.pendingPour = false;
      vx = left ? -1 : 1;
    } else if (this.autoTarget !== null) {
      const d = this.autoTarget - this.player.x;
      if (Math.abs(d) < 5) {
        this.player.x = this.autoTarget;
        this.autoTarget = null;
        if (this.pendingPour) {
          this.pendingPour = false;
          this.startPour();
        }
      } else {
        vx = Math.sign(d);
      }
    }

    if (vx !== 0) {
      const dt = this.game.loop.delta / 1000;
      this.player.x = Phaser.Math.Clamp(this.player.x + vx * 215 * dt, 40, W - 40);
      this.player.setFlipX(vx < 0);
      if (!this.isWalking()) this.player.play("walk");
    } else if (this.isWalking()) {
      this.player.play("idle");
      this.player.setTexture("g_idle_0");
    }
    this.playerShadow.setPosition(this.player.x, FEET_Y + 2);

    if (this.keys && (Phaser.Input.Keyboard.JustDown(this.keys.E) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE))) {
      this.requestWater();
    }

    const near = Math.abs(this.player.x - POND_X) < 230;
    if (near !== this.nearPond) {
      this.nearPond = near;
      this.bridge.onNearPond?.(near);
    }
  }

  private startPour() {
    if (this.pouring) return;
    this.pouring = true;
    this.autoTarget = null;
    this.player.setFlipX(this.player.x > POND_X);
    this.player.play("pour");

    this.time.delayedCall(300, () => {
      if (!this.pouring) return;
      const dir = this.player.flipX ? -1 : 1;
      const em = dir === 1 ? this.dropletsR : this.dropletsL;
      // spout tip of the tilted can, mirrored with the sprite
      em.setPosition(this.player.x + dir * SPOUT_OFFSET.x, this.player.y + SPOUT_OFFSET.y);
      em.start();
      this.pourSplashTimer = this.time.addEvent({
        delay: 130,
        loop: true,
        callback: () => {
          this.pourSplashes.push({
            x: this.player.x + dir * (SPOUT_OFFSET.x + Phaser.Math.Between(24, 48)),
            y: POND_Y + Phaser.Math.Between(4, 22),
            t0: this.time.now,
          });
        },
      });
    });

    this.bridge.onPourStart?.();

    this.pourSafety?.remove();
    this.pourSafety = this.time.delayedCall(8000, () => this.endPour());
  }

  private endPour() {
    if (!this.pouring) return;
    this.pouring = false;
    this.pourSafety?.remove();
    this.pourSafety = null;
    this.pourSplashTimer?.remove();
    this.pourSplashTimer = null;
    this.dropletsR.stop();
    this.dropletsL.stop();
    this.player.play("idle");
    this.player.setTexture("g_idle_0");
  }

  private splash() {
    this.burstRipples.push({ t0: this.time.now });
    this.time.delayedCall(160, () => this.burstRipples.push({ t0: this.time.now }));
    this.sparkles.explode(16, POND_X, POND_Y - 40);
  }

  private happyWiggle() {
    this.tweens.add({
      targets: this.lilyC,
      angle: { from: -5, to: 5 },
      duration: 110,
      yoyo: true,
      repeat: 3,
      onComplete: () => this.lilyC.setAngle(this.garden?.wilted ? 3 : 0),
    });
  }

  private stagePop() {
    this.redrawLily();
    this.lilyC.setScale(0.55);
    this.tweens.add({
      targets: this.lilyC,
      scale: 1,
      duration: 520,
      ease: "Back.easeOut",
    });
    this.sparkles.explode(26, POND_X, POND_Y - 50);
  }

  private celebrateBloom() {
    this.confetti.explode(90, POND_X, POND_Y - 140);
    this.time.delayedCall(280, () => this.sparkles.explode(30, POND_X, POND_Y - 60));
    this.time.delayedCall(600, () => this.confetti.explode(50, POND_X, POND_Y - 160));
  }

  private updateSplashes(time: number) {
    const g = this.splashG;
    g.clear();
    this.pourSplashes = this.pourSplashes.filter((s) => {
      const t = (time - s.t0) / 520;
      if (t >= 1) return false;
      g.lineStyle(2, 0xffffff, 0.5 * (1 - t));
      g.strokeEllipse(s.x, s.y, 6 + 34 * t, (6 + 34 * t) * 0.34);
      return true;
    });
  }

  private updatePond(time: number) {
    const g = this.rippleG;
    g.clear();

    for (let i = 0; i < 3; i++) {
      const p = ((time / 3400) + i / 3) % 1;
      const a = 0.26 * (1 - p) * (this.nightF > 0.6 ? 0.5 : 1);
      g.lineStyle(2, 0xffffff, a);
      g.strokeEllipse(POND_X, POND_Y, (36 + 260 * p), (36 + 260 * p) * 0.3);
    }

    this.burstRipples = this.burstRipples.filter((r) => {
      const t = (time - r.t0) / 1100;
      if (t >= 1) return false;
      g.lineStyle(3, 0xffffff, 0.55 * (1 - t));
      g.strokeEllipse(POND_X, POND_Y, 20 + 210 * t, (20 + 210 * t) * 0.3);
      return true;
    });

    for (let i = 0; i < this.shimmer.length; i++) {
      const sh = this.shimmer[i];
      const w = this.windAt(sh.x, time, i * 0.9);
      const a = 0.12 + 0.1 * Math.sin(time / 640 + i * 1.7) + Math.max(0, w) * 0.06;
      g.fillStyle(0xffffff, Math.max(0, a));
      g.fillRect(sh.x - sh.w / 2 + w * 5, sh.y, sh.w + Math.abs(w) * 8, 2);
    }
  }

  private updateCritters(time: number) {
    for (const b of this.butterflies) {
      const dx = b.tx - b.s.x;
      const dy = b.ty - b.s.y;
      b.s.x += dx * 0.012;
      b.s.y += dy * 0.012 + Math.sin(time / 260 + b.seed) * 0.45;
      if (Math.abs(dx) > 2) b.s.setFlipX(dx < 0);
    }

    const on = this.nightF > 0.45;
    for (const f of this.fireflies) {
      if (!on) {
        f.s.setAlpha(0);
        continue;
      }
      f.a += (Math.random() - 0.5) * 0.3;
      f.s.x += Math.cos(f.a) * 0.4;
      f.s.y += Math.sin(f.a) * 0.25;
      f.s.x = Phaser.Math.Clamp(f.s.x, 30, W - 30);
      f.s.y = Phaser.Math.Clamp(f.s.y, 390, 580);
      f.s.setAlpha((0.5 + 0.5 * Math.sin(time / 480 + f.seed)) * Math.min(1, (this.nightF - 0.45) * 3));
    }
  }

  private updateHint() {
    const canWater = !!this.garden && !this.garden.wateredToday && !this.garden.isBloomed;
    const target = canWater && !this.pouring ? 0.95 : 0;
    this.hintDrop.setAlpha(Phaser.Math.Linear(this.hintDrop.alpha, target, 0.08));
  }

  private launchBird() {
    const y = Phaser.Math.Between(56, 168);
    const fromLeft = Math.random() < 0.5;
    const b = this.add
      .sprite(fromLeft ? -30 : W + 30, y, "bird_0")
      .setDepth(3)
      .setScale(Phaser.Math.FloatBetween(0.8, 1.3))
      .setFlipX(!fromLeft);
    b.play("flap");
    this.tweens.add({
      targets: b,
      x: fromLeft ? W + 40 : -40,
      y: y + Phaser.Math.Between(-30, 30),
      duration: Phaser.Math.Between(8000, 12000),
      onComplete: () => b.destroy(),
    });
  }

  // ================= day/night =================

  private applyTimeOfDay() {
    const now = new Date();
    const h = this.hourOverride ?? now.getHours() + now.getMinutes() / 60;

    let top = SKY_STOPS[0][1];
    let mid = SKY_STOPS[0][2];
    let hor = SKY_STOPS[0][3];
    let n = SKY_STOPS[0][4];
    let warm = SKY_STOPS[0][5];
    for (let i = 0; i < SKY_STOPS.length - 1; i++) {
      const a = SKY_STOPS[i];
      const b = SKY_STOPS[i + 1];
      if (h >= a[0] && h <= b[0]) {
        const t = (h - a[0]) / (b[0] - a[0] || 1);
        top = lerpColor(a[1], b[1], t);
        mid = lerpColor(a[2], b[2], t);
        hor = lerpColor(a[3], b[3], t);
        n = a[4] + (b[4] - a[4]) * t;
        warm = a[5] + (b[5] - a[5]) * t;
        break;
      }
    }
    this.nightF = n;

    const topS = hx6(top), midS = hx6(mid), horS = hx6(hor);
    const c = this.skyTex.getContext();
    c.clearRect(0, 0, W, 390);
    c.fillStyle = lg(c, 0, 0, 0, 390, [[0, topS], [0.55, midS], [1, horS]]);
    c.fillRect(0, 0, W, 390);
    if (warm > 0.05) {
      c.fillStyle = lg(c, 0, 250, 0, 390, [[0, "rgba(255,170,110,0)"], [1, `rgba(255,170,110,${0.45 * warm})`]]);
      c.fillRect(0, 250, W, 140);
    }
    this.skyTex.refresh();

    const dayT = (h - 5.5) / 14;
    if (dayT > 0 && dayT < 1) {
      const sx = 70 + dayT * (W - 140);
      const sy = 330 - Math.sin(dayT * Math.PI) * 240;
      this.sunImg.setVisible(true).setPosition(sx, sy).setAlpha(1 - n * 0.6);
      this.rayImg.setPosition(sx, sy).setAlpha(0.12 * (1 - n) * Math.sin(dayT * Math.PI));
    } else {
      this.sunImg.setVisible(false);
      this.rayImg.setAlpha(0);
    }

    const hh = h < 12 ? h + 24 : h;
    const nightT = (hh - 19.5) / 10;
    if (nightT > 0 && nightT < 1) {
      this.moonImg.setVisible(true);
      this.moonImg.setPosition(70 + nightT * (W - 140), 320 - Math.sin(nightT * Math.PI) * 230);
    } else {
      this.moonImg.setVisible(false);
    }

    this.starC.setAlpha(n);
    this.duskOverlay.setFillStyle(0xff8a5c, 0.16 * warm);
    this.nightOverlay.setFillStyle(0x101d3f, 0.36 * n);
    for (const w of this.windowGlows) {
      w.setFillStyle(0xffd76e, 0.12 + 0.72 * n);
    }
  }
}
