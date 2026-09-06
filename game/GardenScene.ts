import * as Phaser from "phaser";
import type { GameBridge, RitualKind, SceneApi } from "./bridge";
import type { GardenState, PlotState, TendAction, TendResult } from "@/lib/types";
import { drawPlant, bloomScale, plantHeightPx } from "./plants";
import { SPECIES_BY_KEY } from "@/lib/species";
import { DECOR_SLOTS, drawDecor, drawKoi } from "./decor";
import { FIXTURES, ZONE_FOG, FIX_W, FIX_H, FIX_BX, FIX_BY } from "./fixtures";
import { VARIANT_BY_KEY } from "@/lib/variants";
// The beats are scheduled here, so the sounds are triggered here: routing
// them back through React would put a render between a hand and its noise.
import { sfx } from "./audio";
import { yearPhase, PHASE_PALETTE, type YearPhase, type PhasePalette } from "@/lib/yearphase";
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
// The gardener may roam the grass between the fence and the front hedge.
const WALK_TOP = 432;
const WALK_BOTTOM = 588;
// Depth band for anything standing in the yard: sorting by y makes the
// gardener pass behind far plants and in front of near ones.
const YARD = 100;
// The pour arc: droplets fall under this gravity and are aimed to reach the
// plant in POUR_T seconds, whichever side of the spout it is on.
const DROP_G = 760;
const POUR_T = 0.4;
const HX = 152; // house anchor

/** Plot positions. `kind` mirrors the database's plot_kind(idx) exactly. */
export const PLOTS: Array<{ x: number; y: number; kind: "sun" | "shade" | "water" }> = [
  { x: 480, y: 466, kind: "water" },
  { x: 700, y: 498, kind: "sun" },
  { x: 215, y: 500, kind: "shade" },
  { x: 795, y: 470, kind: "sun" },
  { x: 398, y: 480, kind: "water" },
  { x: 140, y: 468, kind: "shade" },
  { x: 645, y: 538, kind: "sun" },
  { x: 560, y: 474, kind: "water" },
  { x: 285, y: 538, kind: "shade" },
  { x: 862, y: 512, kind: "sun" },
  { x: 745, y: 452, kind: "sun" },
  { x: 120, y: 538, kind: "shade" },
];

// plant sprite canvas: logical box with the plant's base at (PB_X, PB_Y)
const PB_W = 180, PB_H = 190, PB_X = 90, PB_Y = 172;

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
  /**
   * Live variant dressing, one entry per plot. Motes orbit on an ellipse and
   * swap depth as they cross behind the plant — occlusion is what sells depth
   * on a flat canvas, so the orbit is the whole trick.
   */
  /**
   * A dead plot's own idle language. Dying already had a language — red ring,
   * alert pin, a shiver — but every one of those is gated on `lastDay`, which
   * excludes `dead`. So the single state that most needs the player's
   * attention was the only one the scene said nothing about at all.
   *
   * It must not borrow from either neighbour. The red alarm means "save me"
   * and it is too late for that; the celebration particles are gold and pink.
   * Dead is quiet, dull and earthbound — it asks for closure, not rescue.
   */
  private deadFx: Array<{ objs: Phaser.GameObjects.GameObject[] } | null> = [];
  private variantFx: Array<{
    key: string;
    objs: Phaser.GameObjects.GameObject[];
    motes: Array<{ o: Phaser.GameObjects.Image; phase: number; rx: number; ry: number; cy: number; sp: number }>;
    plot: number;
  } | null> = [];
  private plotNodes: Array<{
    tex: Phaser.Textures.CanvasTexture;
    img: Phaser.GameObjects.Image;
    bed?: Phaser.GameObjects.Image;
    lock: Phaser.GameObjects.Container;
    marker: Phaser.GameObjects.Graphics;
    zone: Phaser.GameObjects.Zone;
    ring: Phaser.GameObjects.Graphics;
    alert: Phaser.GameObjects.Image;
    beacon: Phaser.GameObjects.Graphics;
    seedSign: Phaser.GameObjects.Image;
  }> = [];
  private selected = 0;
  private decorNodes: Array<{ tex: Phaser.Textures.CanvasTexture; img: Phaser.GameObjects.Image }> = [];
  private fixtureNodes: Record<string, { tex: Phaser.Textures.CanvasTexture; img: Phaser.GameObjects.Image }> = {};
  private zoneFog: Record<string, Phaser.GameObjects.Container> = {};
  private restoredSeen: Set<string> | null = null;
  private koiG!: Phaser.GameObjects.Graphics;
  private koiTex!: Phaser.Textures.CanvasTexture;
  private hasKoi = false;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private duskOverlay!: Phaser.GameObjects.Rectangle;
  private starC!: Phaser.GameObjects.Container;
  private sunImg!: Phaser.GameObjects.Image;
  private rayImg!: Phaser.GameObjects.Image;
  private moonImg!: Phaser.GameObjects.Image;
  private windowGlows: Phaser.GameObjects.Rectangle[] = [];
  private rippleG!: Phaser.GameObjects.Graphics;
  private player!: Phaser.GameObjects.Sprite;
  private playerShadow!: Phaser.GameObjects.Image;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private sparkles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private confetti!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dropletsR!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dropletsL!: Phaser.GameObjects.Particles.ParticleEmitter;
  private splashBurst!: Phaser.GameObjects.Particles.ParticleEmitter;
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

  private autoTarget: { x: number; y: number } | null = null;
  private pendingPour = false;
  private lastStepMs = 0;
  /** how many waterings deep the current round is */
  comboCount = 0;
  private shivers = new Map<number, Phaser.Tweens.Tween>();
  private userZoom = 1;
  private bottomInset = 0;
  private panActive = false;
  private pinchDist = 0;
  private downAt = { x: 0, y: 0 };
  private pendingAction: TendAction = "water";
  private pendingPlot = 0;
  private celebrating = false;
  /** Set while a modal (e.g. the tutorial) owns the screen. */
  private frozen = false;
  private pipG!: Phaser.GameObjects.Graphics;
  private pouring = false;
  private nearPond = false;
  private nightF = 0;
  private pourSafety: Phaser.Time.TimerEvent | null = null;
  /** A hands-on ritual (clear / harvest / sow) is playing at a plot. */
  private ritualing = false;
  /** The gardener is walking to a ritual — scripted, so a freeze must not eat it. */
  private ritualWalking = false;
  private pendingRitual: (() => void) | null = null;
  private ritualGhost: Phaser.GameObjects.Image | null = null;
  private ritualPlot = -1;
  private ritualDone: (() => void) | null = null;
  private ritualTimers: Phaser.Time.TimerEvent[] = [];
  private reducedMotion = false;
  private crumbs!: Phaser.GameObjects.Particles.ParticleEmitter;
  private pourSplashTimer: Phaser.Time.TimerEvent | null = null;
  private hourOverride: number | null = null;
  /**
   * The turn of the year. It changes what the yard looks like and nothing
   * about what it asks of the player — see lib/yearphase.ts for why that
   * line is drawn where it is.
   */
  private phase: YearPhase = "summer";
  private pal: PhasePalette = PHASE_PALETTE.summer;
  private drifters: Partial<Record<"petal" | "leaf" | "snow", Phaser.GameObjects.Particles.ParticleEmitter>> = {};

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
    this.buildPlots();
    this.buildDecor();
    this.buildZones();
    this.buildGardener();
    this.buildCritters();
    this.buildParticles();
    this.buildPost();

    if (typeof window !== "undefined" && window.location.hostname === "localhost") {
      (window as unknown as Record<string, unknown>).__lilyProbe = () =>
        ({ x: this.player?.x, y: this.player?.y, pouring: this.pouring, target: this.autoTarget });
      (window as unknown as Record<string, unknown>).__camInset = () => this.bottomInset;
      // where a plot sits on the physical screen — lets tests tap it
      (window as unknown as Record<string, unknown>).__plotScreenPos = (i: number) => {
        const pl = PLOTS[i];
        if (!pl) return null;
        const cam = this.cameras.main;
        const canvas = this.game.canvas.getBoundingClientRect();
        const sx = (pl.x - cam.worldView.x) * cam.zoom * (canvas.width / this.scale.width);
        const sy = (pl.y - 20 - cam.worldView.y) * cam.zoom * (canvas.height / this.scale.height);
        return { x: canvas.left + sx, y: canvas.top + sy };
      };
    }
    const kb = this.input.keyboard;
    if (kb) {
      this.cursors = kb.createCursorKeys();
      this.keys = kb.addKeys("W,A,S,D,E,SPACE") as Record<string, Phaser.Input.Keyboard.Key>;
    }
    // ---- camera: the canvas covers its container; the camera covers the world ----
    this.cameras.main.setBounds(0, 0, W, H);
    this.applyCamera(true);
    this.scale.on("resize", () => this.applyCamera(true));
    this.input.addPointer(1); // two touches for pinching

    this.input.on("wheel", (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      const before = this.userZoom;
      this.userZoom = Phaser.Math.Clamp(this.userZoom * (dy > 0 ? 0.9 : 1.11), 1, 2.4);
      if (this.userZoom !== before) {
        this.applyCamera();
        // ease the view toward the cursor so zooming feels aimed
        const cam = this.cameras.main;
        cam.centerOn(
          Phaser.Math.Linear(cam.midPoint.x, p.worldX, 0.35),
          Phaser.Math.Linear(cam.midPoint.y, p.worldY, 0.35)
        );
      }
    });

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.downAt = { x: p.x, y: p.y };
      this.panActive = false;
    });

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      const p2 = this.input.pointer2;
      const cam = this.cameras.main;
      if (p.isDown && p2?.isDown) {
        // pinch: zoom by the change in finger distance, pan by the midpoint
        const d = Phaser.Math.Distance.Between(p.x, p.y, p2.x, p2.y);
        if (this.pinchDist > 0) {
          this.userZoom = Phaser.Math.Clamp(this.userZoom * (d / this.pinchDist), 1, 2.4);
          this.applyCamera();
        }
        this.pinchDist = d;
        this.panActive = true;
        return;
      }
      this.pinchDist = 0;
      if (!p.isDown) return;
      const moved = Phaser.Math.Distance.Between(p.x, p.y, this.downAt.x, this.downAt.y);
      if ((this.panActive || moved > 14) && this.userZoom > 1.02) {
        this.panActive = true;
        cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
        cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
      }
    });

    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      const wasPan = this.panActive || this.input.pointer2?.isDown;
      this.panActive = false;
      this.pinchDist = 0;
      if (wasPan || this.frozen || this.ritualing || this.ritualWalking) return;
      const moved = Phaser.Math.Distance.Between(p.x, p.y, this.downAt.x, this.downAt.y);
      if (moved > 14) return; // a drag, not a tap
      let best = -1;
      let bestD = 78 * 78;
      // The padlocked next bed counts as a target too. It has always been
      // drawn and never been touchable, so the one clear invitation in the
      // scene to make the garden bigger did nothing when you pressed it.
      const nextIdx = this.garden?.plotCount ?? -1;
      PLOTS.forEach((pl, i) => {
        if (!this.plotUnlocked(i) && i !== nextIdx) return;
        const d = (p.worldX - pl.x) ** 2 + (p.worldY - (pl.y - 20)) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best === nextIdx && !this.plotUnlocked(best)) {
        this.bridge.onLockedPlotTapped?.();
      } else if (best >= 0) {
        this.selectPlot(best);
        this.bridge.onPlotTapped?.(best);
      } else {
        this.autoTarget = this.walkable(p.worldX, p.worldY);
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

    this.streakG = this.add.graphics().setDepth(800);
    this.pipG = this.add.graphics().setDepth(950);
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
    this.updatePlotPips(time);
    this.updateKoi(time);
    this.updateCritters(time);
    this.stepVariantFx(time);
  }

  // ================= bridge api =================

  setAvatar(a: Avatar) {
    this.avatar = safeAvatar(a);
    this.paintGardenerFrames();
  }

  setGarden(s: GardenState) {
    const prev = this.garden;
    this.garden = s;
    // `today` is the server's date in the player's own frozen timezone, so
    // the yard turns over when their day does, not when the browser's does.
    // the server ships its own reading; the local rule is only a fallback
    // for a state document that predates it
    this.applyYearPhase(s.yearPhase ?? yearPhase(s.today, s.timezone));
    if (!prev) this.selected = s.plots.findIndex((p) => p.unlocked && p.plant) ?? 0;
    if (this.selected < 0) this.selected = 0;
    for (let i = 0; i < PLOTS.length; i++) this.refreshPlot(i);
    this.refreshDecor();
    this.refreshZones();
    this.refreshMarkers();
  }

  /**
   * Turn the yard over to a new phase of the year: repaint the seasonal
   * textures in place, and hand the weather to the right emitter.
   */
  private applyYearPhase(p: YearPhase) {
    if (p === this.phase && this.textures.exists("sky")) return;
    this.phase = p;
    this.pal = PHASE_PALETTE[p];
    this.paintYearTextures();
    const want = this.pal.drift;
    (["petal", "leaf", "snow"] as const).forEach((k) => {
      const em = this.drifters[k];
      if (!em) return;
      if (k === want) em.start();
      else em.stop();
    });
  }

  /** One interpolator drives zoom AND centre — pan+zoom tweens fight. */
  private glideCamera(cx: number, cy: number, zoomMul: number, ms: number) {
    const cam = this.cameras.main;
    const cover = Math.max(this.scale.width / W, this.scale.height / H);
    const z0 = cam.zoom;
    const c0 = { x: cam.midPoint.x, y: cam.midPoint.y };
    const z1 = cover * zoomMul;
    this.userZoom = zoomMul;
    const proxy = { t: 0 };
    this.tweens.add({
      targets: proxy, t: 1, duration: ms, ease: "Sine.easeInOut",
      onUpdate: () => {
        cam.setZoom(Phaser.Math.Linear(z0, z1, proxy.t));
        cam.centerOn(
          Phaser.Math.Linear(c0.x, cx, proxy.t),
          Phaser.Math.Linear(c0.y, cy, proxy.t)
        );
      },
    });
  }

  /** Glide the camera into one plot and hold there (guided planting). */
  focusPlot(i: number, zoomMul = 1.85) {
    const p = PLOTS[i] ?? PLOTS[0];
    this.glideCamera(p.x, p.y - 46, zoomMul, 950);
  }

  /** Ease back out to the whole garden. */
  releaseFocus() {
    this.glideCamera(W / 2, 480, 1, 850);
  }

  /**
   * How many screen pixels at the bottom are covered by React chrome (the
   * mobile pull-up sheet). The camera renders above it, so the plots can
   * never hide underneath.
   */
  setBottomInset(px: number) {
    this.bottomInset = Math.max(0, px);
    this.applyCamera(true);
  }

  /** Cover-fit the world into the visible strip, then apply the user zoom. */
  private applyCamera(recenter = false) {
    const cam = this.cameras.main;
    const vw = this.scale.width;
    const vh = Math.max(120, this.scale.height - this.bottomInset);
    cam.setViewport(0, 0, vw, vh);
    // fit the world's WIDTH and show as much height as the strip allows —
    // on a wide, short phone screen this keeps the whole yard in frame
    const cover = Math.max(vw / W, Math.min(vh / H, (vw / W) * 1.35));
    cam.setZoom(cover * this.userZoom);
    if (recenter) cam.centerOn(W / 2, 470);
  }

  /** Freezes walking and taps while React shows a full-screen panel. */
  setFrozen(v: boolean) {
    this.frozen = v;
    // A ritual walk is the scene's own, not the player's: clearing it here
    // stranded the gardener halfway to the bed whenever the modal that
    // started the ritual closed a frame later, and only the watchdog
    // noticed.
    if (v && !this.ritualWalking) {
      this.autoTarget = null;
      this.pendingPour = false;
      if (this.isWalking()) this.player?.play("idle");
    }
  }

  /** Walk to a plot, then perform the action there. */
  requestTend(plotIdx: number, action: TendAction) {
    if (this.pouring || this.celebrating || this.frozen || this.ritualing || this.ritualWalking) return;
    if (!this.plotUnlocked(plotIdx)) return;
    this.selected = plotIdx;
    this.pendingAction = action;
    this.refreshMarkers();

    const stand = this.standPointFor(plotIdx);
    if (Math.hypot(this.player.x - stand.x, this.player.y - stand.y) < 12) {
      this.player.setPosition(stand.x, stand.y);
      this.startPour();
    } else {
      this.autoTarget = stand;
      this.pendingPour = true;
    }
  }

  applyOutcome(r: TendResult) {
    this.endPour();
    // the server is authoritative about which plot it acted on; the local
    // pendingPlot is only a fallback if a pour was never started
    const idx = r.plotIdx ?? this.pendingPlot;
    if (r.state) this.setGarden(r.state);

    if (r.status === "watered" || r.status === "fed" || r.status === "pruned") {
      this.splashAt(idx);
      this.drinkGulp(idx);
      this.wetSoil(idx);
      this.celebrateWater(idx, this.comboCount);
      if (r.dewEarned) this.rewardFloat(idx, r.dewEarned);
      if (r.grew) this.stagePop(idx);
      if (r.bloomedNow) this.celebrateBloom(idx, r.variant);
    } else if (r.status === "overwatered") {
      this.sadShake(idx);
    } else {
      this.happyWiggle(idx);
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
    this.paintYearTextures();

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
      // kept name/size; drawn chunkier below
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

    // ---- glossy hint droplet (2x) ----
    // ---- "plant here" sign: a little seed packet on a stake (2x) ----
    this.ctex("plantsign", 96, 112, (c) => {
      c.scale(2, 2);
      // stake
      c.fillStyle = "#8a6138";
      rr(c, 22.5, 30, 3, 22, 1.5); c.fill();
      // packet
      c.fillStyle = lg(c, 0, 6, 0, 34, [[0, "#fffdf2"], [1, "#f0e4c4"]]);
      rr(c, 8, 6, 32, 28, 4); c.fill();
      c.strokeStyle = "#c9a35a"; c.lineWidth = 2;
      rr(c, 8, 6, 32, 28, 4); c.stroke();
      // a sprout drawn on the packet
      c.strokeStyle = "#3e8e52"; c.lineWidth = 2.4; c.lineCap = "round";
      c.beginPath(); c.moveTo(24, 28); c.lineTo(24, 17); c.stroke();
      c.fillStyle = "#5cb46a";
      ell(c, 19.5, 16, 5, 3.4); c.fill();
      ell(c, 28.5, 14, 5, 3.4); c.fill();
      // a couple of seeds at the base
      c.fillStyle = "#8a6a3f";
      ell(c, 20, 30, 2, 1.4); c.fill(); ell(c, 27, 30.5, 2, 1.4); c.fill();
    });

    // ---- distress bubble: shown over a plant on its final day (2x) ----
    this.ctex("distress", 96, 112, (c) => {
      c.scale(2, 2);
      c.fillStyle = "rgba(31,20,15,0.25)";
      ell(c, 24, 46, 10, 3); c.fill();
      c.fillStyle = lg(c, 0, 4, 0, 40, [[0, "#ffffff"], [1, "#ffd9d0"]]);
      ell(c, 24, 22, 19, 19); c.fill();
      c.beginPath(); c.moveTo(18, 38); c.lineTo(24, 48); c.lineTo(30, 38); c.closePath(); c.fill();
      c.strokeStyle = "#d9503c"; c.lineWidth = 2.5;
      ell(c, 24, 22, 19, 19); c.stroke();
      // the exclamation mark
      c.fillStyle = "#d9503c";
      rr(c, 21.4, 10, 5.2, 15, 2.6); c.fill();
      ell(c, 24, 31.5, 3, 3); c.fill();
    });

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
    // Phaser.CANVAS ignores setTint entirely — its batchSprite reads only
    // blendMode and alpha before drawImage, and the canvas renderer contains
    // no reference to tintTopLeft at all. So a "dust brown" leaf made by
    // tinting the white petalbit rendered as WHITE: celebratory confetti
    // falling on a dead plant. Anything that needs a colour needs its own
    // painted texture.
    g.clear();
    g.fillStyle(0x8a7358, 1);
    g.fillRoundedRect(0, 0, 10, 6, 3);
    g.generateTexture("leafdry", 10, 6);
    g.clear();
    g.fillStyle(0xd9c48f, 1);
    g.fillEllipse(4, 4, 7, 5);
    g.generateTexture("seedbit", 8, 8);
    g.clear();
    g.fillStyle(0xbfeaff, 1);
    g.fillCircle(4, 4, 3.6);
    g.generateTexture("mote_dew", 8, 8);
    g.clear();
    g.fillStyle(0xffe9a8, 1);
    g.fillCircle(4, 4, 3.6);
    g.generateTexture("mote_gold", 8, 8);
    g.clear();
    g.fillStyle(0xdfe6ff, 1);
    g.fillCircle(4, 4, 3.6);
    g.generateTexture("mote_moon", 8, 8);
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

    // What falls through the air, one painted texture each. Tinting a single
    // white speck would have been cheaper and would have rendered white in
    // all three cases — CANVAS ignores it.
    this.ctex("drift_petal", 14, 10, (c) => {
      c.fillStyle = "#ffd3e4"; ell(c, 7, 5, 6.4, 4.2); c.fill();
      c.fillStyle = "rgba(255,255,255,0.6)"; ell(c, 5, 4, 2.6, 1.6); c.fill();
      c.fillStyle = "rgba(226,140,178,0.5)"; ell(c, 9.5, 6.5, 3, 1.8); c.fill();
    });
    this.ctex("drift_leaf", 16, 12, (c) => {
      c.fillStyle = "#d08a34";
      c.beginPath(); c.moveTo(1, 6); c.quadraticCurveTo(8, 0, 15, 6);
      c.quadraticCurveTo(8, 12, 1, 6); c.closePath(); c.fill();
      c.strokeStyle = "rgba(120,66,20,0.6)"; c.lineWidth = 1;
      c.beginPath(); c.moveTo(2, 6); c.lineTo(14, 6); c.stroke();
      c.fillStyle = "rgba(255,214,150,0.5)"; ell(c, 6, 4.4, 3, 1.4); c.fill();
    });
    this.ctex("drift_snow", 10, 10, (c) => {
      c.fillStyle = "rgba(255,255,255,0.95)"; ell(c, 5, 5, 3.4, 3.4); c.fill();
      c.fillStyle = "rgba(214,236,248,0.9)"; ell(c, 6.2, 6.2, 1.6, 1.6); c.fill();
    });

    // Soil crumbs, three shapes so a burst does not read as a repeated stamp.
    // Painted, not tinted: Phaser.CANVAS ignores setTint, and gold particles
    // over a plant being pulled out is exactly the wrong sentence.
    const crumbTex = this.ctex("crumbs", 36, 12, (c) => {
      c.fillStyle = "#6b4a30";
      ell(c, 6, 6, 4, 3); c.fill();
      c.fillStyle = "#7d5a3c";
      rr(c, 14, 3, 7, 6, 2.4); c.fill();
      c.fillStyle = "#54402c";
      ell(c, 30, 6, 3, 2.2); c.fill();
      c.fillStyle = "rgba(255,255,255,0.14)";
      ell(c, 5, 5, 1.6, 1.1); c.fill(); ell(c, 16.5, 4.6, 1.6, 1); c.fill();
    });
    for (let k = 0; k < 3; k++) crumbTex.add(`c${k}`, 0, k * 12, 0, 12, 12);

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

  /**
   * Every texture whose colour belongs to the turn of the year, painted from
   * one palette so a phase change is a repaint rather than a rebuild.
   *
   * `ctex` reuses the canvas behind an existing key and calls `refresh()`,
   * and every Image already on screen is pointing at that same texture — so
   * repainting here changes the whole yard in place, with nothing to
   * destroy and no sprite to re-create. (Graphics.generateTexture cannot do
   * this: createCanvas refuses a key that already exists, which is why only
   * ctex-painted textures are seasonal.)
   */
  private paintYearTextures() {
    const P = this.pal;
    /** nudge a hex a little lighter — the "light blade" variants */
    const shade = (hex: string, amt: number) => {
      const n = parseInt(hex.slice(1), 16);
      const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
        Math.max(0, Math.min(255, Math.round(v + 255 * amt)))
      );
      return `rgb(${ch[0]},${ch[1]},${ch[2]})`;
    };
    void shade;

    // ---- flowers (3 colorways, 2x) ----
    // Autumn dries them to seed heads and winter caps them with snow; spring
    // and summer keep the three colourways they were drawn with. Leaving them
    // in full bloom under snow was the one thing that gave the winter yard
    // away as a colour filter rather than a season.
    const flowerCols: Array<[string, string]> = P.flower
      ? [P.flower, P.flower, P.flower]
      : [["#ffc9dd", "#ee7fa9"], ["#ffe9a8", "#f5b93e"], ["#dcc9f5", "#9b7fd4"]];
    flowerCols.forEach(([lo, hi], i) => {
      this.ctex("flower_" + i, 48, 78, (c) => {
        c.scale(2, 2);
        c.strokeStyle = lg(c, 0, 12, 0, 39, [[0, P.blade[1]], [1, P.blade[0]]]);
        c.lineWidth = 2.6; c.lineCap = "round";
        c.beginPath(); c.moveTo(12, 38); c.quadraticCurveTo(11, 26, 12, 15); c.stroke();
        c.fillStyle = P.blade[1];
        c.save(); c.translate(9, 30); c.rotate(-0.7); ell(c, -4, 0, 6, 2.6); c.fill(); c.restore();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          c.fillStyle = rgrad(c, 12 + Math.cos(a) * 4, 11 + Math.sin(a) * 4, 6, [[0, lo], [1, hi]]);
          ell(c, 12 + Math.cos(a) * 5.5, 11 + Math.sin(a) * 5.5, 4.2, 4.2); c.fill();
        }
        c.fillStyle = rgrad(c, 11, 10, 5, P.flower ? [[0, "#fdfbf2"], [1, "#cfc9b4"]] : [[0, "#fff6d9"], [1, "#f2c94c"]]);
        ell(c, 12, 11, 3.6, 3.6); c.fill();
      });
    });

    this.ctex("sky", W, 390, (c) => {
      c.fillStyle = lg(c, 0, 0, 0, 390, [[0, P.sky[0]], [0.55, P.sky[1]], [1, P.sky[2]]]);
      c.fillRect(0, 0, W, 390);
    });

    this.ctex("hill_far", W, 130, (c) => {
      c.beginPath();
      c.moveTo(0, 70);
      c.quadraticCurveTo(150, 18, 330, 56);
      c.quadraticCurveTo(500, 92, 660, 42);
      c.quadraticCurveTo(810, 8, 960, 52);
      c.lineTo(960, 130); c.lineTo(0, 130); c.closePath();
      c.fillStyle = lg(c, 0, 0, 0, 130, [[0, P.hillFar[0]], [1, P.hillFar[1]]]);
      c.fill();
    });
    this.ctex("hill_near", W, 120, (c) => {
      c.beginPath();
      c.moveTo(0, 46);
      c.quadraticCurveTo(190, 96, 380, 52);
      c.quadraticCurveTo(560, 12, 730, 58);
      c.quadraticCurveTo(860, 92, 960, 60);
      c.lineTo(960, 120); c.lineTo(0, 120); c.closePath();
      c.fillStyle = lg(c, 0, 0, 0, 120, [[0, P.hillNear[0]], [1, P.hillNear[1]]]);
      c.fill();
      // sparse distant trees
      c.fillStyle = P.distantTree;
      for (const [tx, ty, r] of [[120, 58, 14], [300, 66, 11], [640, 52, 13], [880, 70, 10]] as const) {
        ell(c, tx, ty, r, r * 1.15); c.fill();
      }
    });

    // ---- ground with grain + light patches ----
    this.ctex("ground", W, H - GROUND, (c) => {
      const h = H - GROUND;
      c.fillStyle = lg(c, 0, 0, 0, h, [[0, P.ground[0]], [0.45, P.ground[1]], [1, P.ground[2]]]);
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
        c.strokeStyle = Math.random() < 0.5 ? P.grain[0] : P.grain[1];
        c.lineWidth = 1.6;
        c.beginPath();
        c.moveTo(gx, gy);
        c.quadraticCurveTo(gx + 1.5, gy - l * 0.6, gx + 3, gy - l);
        c.stroke();
      }
      // horizon fringe
      c.fillStyle = P.fringe;
      for (let x = 0; x < W; x += 16) { ell(c, x + 8, 2, 12, 5); c.fill(); }
      // foreground shade
      c.fillStyle = lg(c, 0, h - 60, 0, h, [[0, "rgba(20,60,35,0)"], [1, "rgba(20,60,35,0.22)"]]);
      c.fillRect(0, h - 60, W, 60);
    });

    this.ctex("canopy", 300, 280, (c) => {
      c.scale(2, 2);
      // chunky leaf clusters, each with its own crescent highlight and
      // shaded underside, so the crown reads as bunches rather than a blob
      const orb = (x: number, y: number, r: number, l = 0) => {
        c.fillStyle = rgrad(c, x - r * 0.35, y - r * 0.4, r * 1.6, [
          [0, l ? P.leafLit[0] : P.leaf[0]], [0.55, l ? P.leafLit[1] : P.leaf[1]], [1, l ? P.leafLit[2] : P.leaf[2]]]);
        ell(c, x, y, r, r); c.fill();
        // underside shade
        c.fillStyle = "rgba(24,70,40,0.28)";
        c.beginPath(); c.ellipse(x, y + r * 0.45, r * 0.85, r * 0.42, 0, 0, Math.PI); c.fill();
        // crescent highlight
        c.fillStyle = "rgba(235,255,220,0.5)";
        c.beginPath();
        c.ellipse(x - r * 0.25, y - r * 0.45, r * 0.5, r * 0.28, -0.5, 0, Math.PI * 2);
        c.fill();
      };
      c.fillStyle = "rgba(30,80,45,0.3)"; ell(c, 76, 96, 64, 46); c.fill();
      orb(34, 92, 26); orb(118, 92, 27); orb(52, 98, 30); orb(100, 100, 31);
      orb(40, 62, 27, 1); orb(112, 60, 27); orb(75, 44, 34, 1); orb(75, 82, 36);
      // Spring hangs blossom in the crown and winter hangs frost; summer
      // gets the plain dapples it was drawn with.
      c.fillStyle = P.fleck ?? "rgba(240,255,225,0.55)";
      for (const [dx, dy, dr] of [[60, 36, 4.5], [92, 32, 3.5], [30, 70, 3.5], [124, 74, 4], [78, 64, 3]] as const) {
        ell(c, dx, dy, dr, dr); c.fill();
      }
    });

    // ---- bush + rock ----
    this.ctex("bush", 220, 110, (c) => {
      c.scale(2, 2);
      const orb = (x: number, y: number, r: number, l = 0) => {
        c.fillStyle = rgrad(c, x - r * 0.3, y - r * 0.45, r * 1.6, [
          [0, l ? P.bush[0] : P.bush[0]], [0.6, P.bush[1]], [1, P.bush[2]]]);
        ell(c, x, y, r, r * 0.9); c.fill();
        c.fillStyle = "rgba(24,70,40,0.25)";
        c.beginPath(); c.ellipse(x, y + r * 0.4, r * 0.8, r * 0.36, 0, 0, Math.PI); c.fill();
        c.fillStyle = "rgba(235,255,225,0.5)";
        c.beginPath(); c.ellipse(x - r * 0.25, y - r * 0.4, r * 0.45, r * 0.24, -0.5, 0, Math.PI * 2); c.fill();
      };
      orb(24, 40, 18); orb(86, 42, 19); orb(44, 44, 21); orb(68, 44, 21); orb(55, 26, 22, 1);
      c.fillStyle = "rgba(240,255,230,0.55)";
      ell(c, 48, 18, 4, 3.2); c.fill(); ell(c, 68, 24, 3.2, 2.6); c.fill();
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
            [0, dark ? P.blade[0] : shade(P.blade[0], 0.08)],
            [0.55, dark ? P.blade[1] : shade(P.blade[1], 0.08)],
            [1, dark ? P.blade[2] : shade(P.blade[2], 0.08)],
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
      blade(6, 18, -3, P.blade[2], P.blade[0]);
      blade(13, 26, 1, shade(P.blade[2], 0.08), P.blade[1]);
      blade(21, 20, 4, P.blade[2], P.blade[0]);
      blade(26, 14, 6, P.blade[1], P.blade[0]);
    });
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
    // the sky texture itself is painted by paintYearTextures(); its colour
    // belongs to the season, not to this builder
    this.skyTex = this.textures.get("sky") as Phaser.Textures.CanvasTexture;
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

    this.duskOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0xff8a5c, 0).setDepth(989).setBlendMode(Phaser.BlendModes.SCREEN);
    this.nightOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0x101d3f, 0).setDepth(990);
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
      // keep the ground decoration clear of every plot
      // a grown plant reaches ~130px above its base, so clear that whole column
      if (PLOTS.some((pl) => Math.abs(pl.x - x) < 66 && y > pl.y - 130 && y < pl.y + 110)) continue;
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
        .setDepth(YARD + y);
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

  private buildPlots() {
    // soil beds so a plot's kind is readable at a glance
    this.ctex("bed_sun", 200, 90, (c) => {
      c.scale(2, 2);
      c.fillStyle = "rgba(30,60,40,0.28)";
      ell(c, 50, 24, 44, 15); c.fill();
      c.fillStyle = rgrad(c, 40, 16, 54, [[0, "#c9a173"], [0.55, "#a87d52"], [1, "#87603b"]]);
      ell(c, 50, 22, 42, 14); c.fill();
      c.strokeStyle = "rgba(60,38,20,0.35)"; c.lineWidth = 1.6;
      for (const o of [-16, 0, 16]) {
        c.beginPath(); c.ellipse(50, 22 + o * 0.18, 34, 4.5, 0, 0, Math.PI * 2); c.stroke();
      }
      c.fillStyle = "rgba(255,225,170,0.22)";
      ell(c, 38, 16, 16, 4); c.fill();
    });
    this.ctex("bed_shade", 200, 90, (c) => {
      c.scale(2, 2);
      c.fillStyle = "rgba(20,45,32,0.34)";
      ell(c, 50, 24, 44, 15); c.fill();
      c.fillStyle = rgrad(c, 40, 16, 54, [[0, "#8d8663"], [0.55, "#6d674c"], [1, "#524d39"]]);
      ell(c, 50, 22, 42, 14); c.fill();
      // moss + pebbles
      c.fillStyle = "rgba(96,140,92,0.55)";
      for (const [mx, my, mr] of [[32, 20, 8], [62, 26, 7], [50, 16, 6], [72, 18, 5]] as const) {
        ell(c, mx, my, mr, mr * 0.5); c.fill();
      }
      c.fillStyle = "rgba(190,190,175,0.6)";
      ell(c, 26, 26, 4, 2.4); c.fill(); ell(c, 74, 24, 3.4, 2); c.fill();
    });

    PLOTS.forEach((pl, i) => {
      const bed =
        pl.kind === "water"
          ? undefined
          : this.add
              .image(pl.x, pl.y + 4, pl.kind === "sun" ? "bed_sun" : "bed_shade")
              .setOrigin(0.5, 0.6)
              .setScale(0.5)
              .setDepth(YARD + pl.y - 0.8)
              .setVisible(false);

      const tex = this.textures.createCanvas("plant_" + i, PB_W * 2, PB_H * 2)!;
      const img = this.add
        .image(pl.x, pl.y, "plant_" + i)
        .setScale(0.5)
        .setOrigin(PB_X / PB_W, PB_Y / PB_H)
        .setDepth(YARD + pl.y)
        .setVisible(false);

      // selection ring + status marker
      const marker = this.add.graphics().setDepth(YARD + pl.y - 0.5);

      // padlock for plots that are not unlocked yet
      // a pond plot's padlock floats above the water, not in it
      const lockY = pl.kind === "water" ? POND_Y - POND_RY - 26 : pl.y - 6;
      const lock = this.add.container(pl.x, lockY).setDepth(YARD + pl.y + 0.2);
      const lg2 = this.add.graphics();
      // shackle first, well above the body, so it reads as a padlock
      lg2.lineStyle(3.4, 0xffffff, 0.55);
      lg2.beginPath(); lg2.arc(0, -11, 6.5, Math.PI, 0); lg2.strokePath();
      lg2.fillStyle(0x1f3d2d, 0.28);
      lg2.fillRoundedRect(-11, -11, 22, 21, 5);
      lg2.lineStyle(2.4, 0xffffff, 0.6);
      lg2.strokeRoundedRect(-11, -11, 22, 21, 5);
      // keyhole
      lg2.fillStyle(0xffffff, 0.6);
      lg2.fillCircle(0, -3, 2.6);
      lg2.fillRoundedRect(-1.2, -3, 2.4, 7, 1.2);
      lock.add(lg2);

      const zone = this.add.zone(pl.x, pl.y - 20, 76, 86).setDepth(30);

      // empty-plot beacon: a breathing ring and a bobbing trowel sign, so a
      // lost player can see at a glance where a seed can go
      const beacon = this.add.graphics().setDepth(YARD + pl.y - 0.45).setVisible(false);
      beacon.lineStyle(3, 0xffd76e, 0.85);
      beacon.strokeEllipse(pl.x, pl.y + 3, 60, 24);
      beacon.lineStyle(2, 0xfff3c4, 0.55);
      beacon.strokeEllipse(pl.x, pl.y + 3, 42, 17);
      this.tweens.add({
        targets: beacon, alpha: { from: 0.95, to: 0.35 },
        scaleX: 1.08, scaleY: 1.08,
        duration: 1100, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
      });
      const seedSign = this.add
        .image(pl.x, pl.y - 60, "plantsign")
        .setScale(0.5)
        .setDepth(YARD + pl.y + 5)
        .setVisible(false);
      this.tweens.add({
        targets: seedSign, y: pl.y - 70,
        duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
      });

      // final-day distress: a pulsing ring on the ground, a big bubble above
      const ring = this.add.graphics().setDepth(YARD + pl.y - 0.4).setVisible(false);
      ring.lineStyle(4, 0xd9503c, 0.75);
      ring.strokeEllipse(pl.x, pl.y + 3, 78, 30);
      ring.lineStyle(2, 0xffb4a4, 0.5);
      ring.strokeEllipse(pl.x, pl.y + 3, 62, 24);
      this.tweens.add({
        targets: ring, alpha: { from: 0.95, to: 0.25 },
        scaleX: 1.06, scaleY: 1.06,
        duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
      });
      const alert = this.add
        .image(pl.x, pl.y - 118, "distress")
        .setScale(0.5)
        .setDepth(YARD + pl.y + 6)
        .setVisible(false);
      this.tweens.add({
        targets: alert, y: pl.y - 128, scale: 0.56,
        duration: 620, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
      });

      this.plotNodes.push({ tex, img, bed, lock, marker, zone, ring, alert, beacon, seedSign });
    });
  }

  private buildDecor() {
    DECOR_SLOTS.forEach((slot, i) => {
      const tex = this.textures.createCanvas("decor_" + i, 200, 200)!;
      const img = this.add
        .image(slot.x, slot.y, "decor_" + i)
        .setOrigin(0.5, 0.78)
        .setScale(0.5)
        // behind the plots when by the fence, in front of everything when near
        .setDepth(slot.back ? 6.6 : YARD + slot.y)
        .setVisible(false);
      this.decorNodes.push({ tex, img });
    });
    // koi live in the pond regardless of which slot they were placed in
    this.koiTex = this.textures.createCanvas("koi", 520, 200)!;
    this.add.image(POND_X, POND_Y, "koi").setDepth(9.2);
    this.koiG = this.add.graphics().setDepth(9.2);
  }

  private refreshDecor() {
    const placed = this.garden?.decor ?? {};
    this.hasKoi = Object.values(placed).includes("decor_koi");
    DECOR_SLOTS.forEach((_, i) => {
      const node = this.decorNodes[i];
      if (!node) return;
      const key = placed[String(i)];
      if (!key || key === "decor_koi") { node.img.setVisible(false); return; }
      const c = node.tex.getContext();
      c.clearRect(0, 0, 200, 200);
      c.save();
      c.scale(2, 2);
      c.translate(50, 78);
      drawDecor(c, key);
      c.restore();
      node.tex.refresh();
      node.img.setVisible(true);
    });
  }

  private updateKoi(time: number) {
    this.koiG.clear();
    if (!this.hasKoi) return;
    const cv = this.koiTex.getContext();
    cv.clearRect(0, 0, 520, 200);
    cv.save();
    cv.translate(260, 100);
    drawKoi(cv, time);
    cv.restore();
    this.koiTex.refresh();
  }

  private plotUnlocked(i: number): boolean {
    return i < (this.garden?.plotCount ?? 0);
  }

  private plotState(i: number): PlotState | undefined {
    return this.garden?.plots?.[i];
  }

  selectPlot(i: number) {
    if (!this.plotUnlocked(i)) return;
    this.selected = i;
    this.refreshMarkers();
    this.autoTarget = this.standPointFor(i);
  }

  /** Repaints one plot's plant into its own canvas texture. */
  private refreshPlot(i: number) {
    const node = this.plotNodes[i];
    const st = this.plotState(i);
    if (!node) return;

    const unlocked = this.plotUnlocked(i);
    // Beds only appear once a plot is yours; a single padlock teases the next one.
    node.bed?.setVisible(unlocked);
    node.lock.setVisible(!unlocked && i === (this.garden?.plotCount ?? 0));

    const plant = st?.plant ?? null;
    const lastDay = !!plant && !plant.dead && !plant.isBloomed && plant.overdueDays >= 3;
    node.ring.setVisible(lastDay);
    node.alert.setVisible(lastDay);
    // an unlocked, empty plot invites a seed
    const inviting = unlocked && !plant;
    node.beacon.setVisible(inviting);
    node.seedSign.setVisible(inviting);
    if (!plant) {
      node.img.setVisible(false);
      this.syncVariantFx(i, null, false);
      this.syncDeadFx(i, false);
      return;
    }
    const sp = SPECIES_BY_KEY[plant.species];
    if (!sp) { node.img.setVisible(false); this.syncVariantFx(i, null, false); this.syncDeadFx(i, false); return; }

    const c = node.tex.getContext();
    c.clearRect(0, 0, PB_W * 2, PB_H * 2);
    c.save();
    c.scale(2, 2);
    c.translate(PB_X, PB_Y);
    drawPlant(c, sp, { stage: plant.stage, wilted: plant.wilted, dead: plant.dead, variant: plant.variant });
    c.restore();
    node.tex.refresh();
    // ...unless a ritual is holding a detached copy of it: a state load
    // landing mid-beat would otherwise put the plant back in the bed while
    // the gardener is carrying it away.
    node.img.setVisible(!(this.ritualGhost && i === this.ritualPlot));
    this.syncVariantFx(i, plant.variant, plant.dead);
    this.syncDeadFx(i, plant.dead);

    // A last-day plant trembles; anything healthier stands still. The tween
    // is tracked per plot — never discovered by walking the tween list, which
    // used to tear down the chained drink animation mid-flight.
    const shivering = this.shivers.get(i);
    if (lastDay && !shivering) {
      this.shivers.set(i, this.tweens.add({
        targets: node.img, angle: { from: -1.6, to: 1.6 },
        duration: 260, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
      }));
    } else if (!lastDay && shivering) {
      shivering.stop();
      this.shivers.delete(i);
      node.img.setAngle(0);
    }
  }

  /**
   * Mark a plot whose plant is gone. Cheap to call repeatedly — it no-ops
   * unless the dead state actually changed.
   */
  private syncDeadFx(i: number, dead: boolean) {
    const have = !!this.deadFx[i];
    if (have === dead) return;
    if (!dead) {
      this.deadFx[i]?.objs.forEach((o) => { this.tweens.killTweensOf(o); o.destroy(); });
      this.deadFx[i] = null;
      const img = this.plotNodes[i]?.img;
      if (img) { this.tweens.killTweensOf(img); img.setAngle(0); }
      return;
    }

    const p = PLOTS[i] ?? PLOTS[0];
    const node = this.plotNodes[i];
    const objs: Phaser.GameObjects.GameObject[] = [];
    const base = YARD + p.y;

    // A dull ring on the soil. Slow and low-contrast on purpose: the red
    // alarm ring next door pulses fast because it is a countdown, and this
    // one is not — it is a standing invitation to clear the bed.
    const ring = this.add.graphics().setDepth(base - 0.5);
    ring.lineStyle(3, 0x8d7a63, 0.55);
    ring.strokeEllipse(p.x, p.y + 4, 62, 22);
    objs.push(ring);
    this.tweens.add({
      targets: ring, alpha: { from: 0.35, to: 0.85 },
      duration: 2400, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
    });

    // Leaves that already fell, resting where they landed.
    const fallen = this.add.graphics().setDepth(base - 0.4);
    fallen.fillStyle(0x8a7358, 0.75);
    fallen.fillEllipse(p.x - 19, p.y + 7, 13, 5);
    fallen.fillStyle(0x9c8465, 0.7);
    fallen.fillEllipse(p.x + 15, p.y + 10, 11, 4);
    fallen.fillStyle(0x7d6950, 0.65);
    fallen.fillEllipse(p.x + 2, p.y + 13, 9, 4);
    objs.push(fallen);

    // One more leaf letting go, now and then. Dust brown, never the gold
    // and pink of the sparkle emitter.
    const drop = this.add.image(p.x + 8, p.y - 34, "leafdry")
      .setScale(0.8).setAlpha(0).setDepth(base + 0.5);
    objs.push(drop);
    this.tweens.add({
      targets: drop,
      y: p.y + 6, x: p.x - 6, angle: 200,
      alpha: { from: 0.9, to: 0 },
      duration: 2600, repeat: -1, repeatDelay: 3400, ease: "Sine.easeIn",
    });

    // The plant lists, and stays listed. Dying shivers — a fast tremble that
    // reads as distress. This is the opposite: one slow lean that settles and
    // does not come back up.
    if (node?.img) {
      this.tweens.killTweensOf(node.img);
      this.tweens.add({
        targets: node.img, angle: 5.5,
        duration: 1800, ease: "Sine.easeOut",
      });
    }

    this.deadFx[i] = { objs };
  }

  // ================= living variants =================

  /**
   * Rebuild a plot's variant dressing. Cheap to call — it no-ops unless the
   * variant actually changed, because repaintPlot runs on every state load.
   */
  private syncVariantFx(i: number, variant: string | null | undefined, dead: boolean) {
    const want = dead ? null : (variant ?? null);
    const cur = this.variantFx[i] ?? null;
    if ((cur?.key ?? null) === want) return;
    if (cur) {
      cur.objs.forEach((o) => { this.tweens.killTweensOf(o); o.destroy(); });
      this.variantFx[i] = null;
    }
    if (!want) return;
    this.variantFx[i] = this.buildVariantFx(i, want);
  }

  private buildVariantFx(i: number, key: string) {
    const p = PLOTS[i] ?? PLOTS[0];
    const objs: Phaser.GameObjects.GameObject[] = [];
    const motes: Array<{ o: Phaser.GameObjects.Image; phase: number; rx: number; ry: number; cy: number; sp: number }> = [];
    const base = YARD + p.y;
    const plant = this.plotState(i)?.plant;
    const form = SPECIES_BY_KEY[plant?.species ?? ""]?.form;
    // The plant's optical centre and its reach. A pad sits almost on the
    // water; a sunflower is three times as tall — a fixed offset would leave
    // the dressing floating in the sky above the short ones.
    const hPx = form ? plantHeightPx(form, plant?.stage ?? 6) : 46;
    const cy = p.y - hPx * 0.52;
    const reach = Math.max(26, hPx * 0.46);

    /** One orbiting speck. Depth is re-evaluated every frame as it travels. */
    // No tint parameter: Phaser.CANVAS cannot tint. Colour comes from the
    // texture the caller picks.
    const mote = (
      tex: string, scale: number, phase: number,
      rx: number, ry: number, sp: number, blend?: Phaser.BlendModes
    ) => {
      const o = this.add.image(p.x, cy, tex).setScale(scale).setDepth(base);
      if (blend !== undefined) o.setBlendMode(blend);
      objs.push(o);
      motes.push({ o, phase, rx, ry, cy, sp });
      return o;
    };

    if (key === "dewkissed") {
      // beads that gather, swell, then let go and fall off the leaf
      for (let k = 0; k < 3; k++) {
        const bead = this.add.image(p.x - reach * 0.4 + k * reach * 0.4, cy - reach * 0.3 + k * reach * 0.22, "hint")
          .setScale(0.2).setAlpha(0).setDepth(base + 0.6);
        objs.push(bead);
        this.tweens.chain({
          targets: bead,
          loop: -1,
          tweens: [
            { alpha: 0.95, scale: 0.34, duration: 900, delay: k * 620, ease: "Sine.easeOut" },
            { y: "+=6", duration: 700, ease: "Sine.easeIn" },
            { y: "+=34", alpha: 0, scale: 0.18, duration: 460, ease: "Quad.easeIn" },
            { y: "-=40", duration: 1 },
            { alpha: 0, duration: 700 },
          ],
        });
      }
      // a wet sheen that travels across the plant
      const sheen = this.add.image(p.x, cy, "sunglow")
        .setScale(reach / 130, reach / 230).setAlpha(0).setTint(0xd8f4ff)
        .setBlendMode(Phaser.BlendModes.SCREEN).setDepth(base + 0.7);
      objs.push(sheen);
      this.tweens.add({
        targets: sheen, x: { from: p.x - reach * 0.85, to: p.x + reach * 0.85 },
        alpha: { from: 0, to: 0.5 }, duration: 1400, yoyo: true,
        repeat: -1, repeatDelay: 1800, ease: "Sine.easeInOut",
      });
      mote("mote_dew", 0.5, 0, reach, reach * 0.38, 0.55, Phaser.BlendModes.ADD);
      mote("spark", 0.36, Math.PI, reach * 0.84, reach * 0.3, 0.55, Phaser.BlendModes.ADD);
    }

    if (key === "variegated") {
      // light moving over a striped leaf — a band sweeping through
      const band = this.add.image(p.x, cy, "sunglow")
        .setScale(reach / 270, reach / 90).setAngle(-24).setAlpha(0)
        .setTint(0xfff3c4).setBlendMode(Phaser.BlendModes.SCREEN)
        .setDepth(base + 0.7);
      objs.push(band);
      this.tweens.add({
        targets: band, x: { from: p.x - reach * 1.15, to: p.x + reach * 1.15 },
        alpha: { from: 0, to: 0.62 }, duration: 1500,
        yoyo: true, repeat: -1, repeatDelay: 2200, ease: "Sine.easeInOut",
      });
      // flecks of cream lifting off the foliage
      for (let k = 0; k < 3; k++) {
        const f = this.add.image(p.x - reach * 0.35 + k * reach * 0.35, cy, "petalbit")
          .setTint(0xfff0bf).setScale(0.7).setAlpha(0).setDepth(base + 0.5);
        objs.push(f);
        this.tweens.add({
          targets: f, y: "-=" + (26 + k * 5), x: (k % 2 ? "+=12" : "-=12"),
          angle: 180, alpha: { from: 0.9, to: 0 },
          duration: 2400, delay: k * 800, repeat: -1, ease: "Sine.easeOut",
        });
      }
      mote("mote_gold", 0.44, 1.1, reach * 0.94, reach * 0.35, 0.4, Phaser.BlendModes.ADD);
    }

    if (key === "moonlit") {
      // a halo that breathes behind the plant
      const halo = this.add.image(p.x, cy, "moonglow")
        .setScale(reach / 58).setAlpha(0.5).setTint(0xcdd6ff)
        .setBlendMode(Phaser.BlendModes.SCREEN).setDepth(base - 0.8);
      objs.push(halo);
      this.tweens.add({
        targets: halo, scale: (reach / 58) * 1.3, alpha: 0.78,
        duration: 2600, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
      });
      // a cool rim light on the plant itself
      const rim = this.add.image(p.x - 9, cy, "sunglow")
        .setScale(reach / 140, reach / 84).setAlpha(0.28).setTint(0xaebdff)
        .setBlendMode(Phaser.BlendModes.SCREEN).setDepth(base + 0.6);
      objs.push(rim);
      this.tweens.add({
        targets: rim, alpha: 0.5, duration: 2100, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
      });
      for (let k = 0; k < 4; k++) {
        mote("mote_moon", 0.42 + (k % 2) * 0.12,
          (k / 4) * Math.PI * 2, reach * 1.05, reach * 0.4, 0.42, Phaser.BlendModes.ADD);
      }
    }

    if (key === "golden") {
      const rays = this.add.image(p.x, cy, "ray")
        .setScale(reach / 140).setAlpha(0.34).setTint(0xffd979)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(base - 0.8);
      objs.push(rays);
      this.tweens.add({ targets: rays, angle: 360, duration: 14000, repeat: -1 });
      this.tweens.add({
        targets: rays, alpha: 0.55, scale: (reach / 140) * 1.2,
        duration: 2200, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
      });
      // the gilt catches the light every few seconds
      const glint = this.add.image(p.x + 6, cy - 6, "spark")
        .setScale(0).setTint(0xfff6d0).setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(base + 0.8);
      objs.push(glint);
      this.tweens.add({
        targets: glint, scale: { from: 0, to: 1.5 }, alpha: { from: 1, to: 0 },
        duration: 620, repeat: -1, repeatDelay: 2600, ease: "Quad.easeOut",
      });
      for (let k = 0; k < 5; k++) {
        mote(k % 2 ? "mote_gold" : "spark", 0.4 + (k % 3) * 0.1,
          (k / 5) * Math.PI * 2, reach * 1.15, reach * 0.45, 0.5, Phaser.BlendModes.ADD);
      }
    }

    return { key, objs, motes, plot: i };
  }

  /**
   * Drive the orbits. Depth flips as a mote crosses behind the plant, and it
   * dims as it goes — occlusion plus aerial perspective is what reads as 3D
   * on a flat canvas.
   */
  private stepVariantFx(now: number) {
    for (const fx of this.variantFx) {
      if (!fx) continue;
      const p = PLOTS[fx.plot] ?? PLOTS[0];
      const base = YARD + p.y;
      for (const m of fx.motes) {
        const a = m.phase + (now / 1000) * m.sp * Math.PI * 2;
        const sin = Math.sin(a);
        m.o.setPosition(p.x + Math.cos(a) * m.rx, m.cy + sin * m.ry * 0.5);
        const near = (sin + 1) / 2;
        m.o.setDepth(base + (sin > 0 ? 0.9 : -0.9));
        m.o.setAlpha(0.3 + near * 0.65);
      }
    }
  }

  private refreshMarkers() {
    PLOTS.forEach((pl, i) => {
      const g = this.plotNodes[i]?.marker;
      if (!g) return;
      g.clear();
      if (!this.plotUnlocked(i)) {
        // only hint at the very next plot, so the yard stays uncluttered
        if (i === (this.garden?.plotCount ?? 0)) {
          g.lineStyle(2, 0xffffff, 0.32);
          g.strokeEllipse(pl.x, pl.y + 2, 60, 23);
        }
        return;
      }
      const st = this.plotState(i);
      const sel = i === this.selected;
      if (sel) {
        g.lineStyle(3, 0xffe07a, 0.9);
        g.strokeEllipse(pl.x, pl.y + 3, 70, 27);
      }
      const plant = st?.plant;
      if (!plant) {
        // empty: dotted "plant here" ring
        g.lineStyle(2, 0xffffff, sel ? 0.7 : 0.4);
        g.strokeEllipse(pl.x, pl.y + 3, 52, 20);
      } else if (plant.dead) {
        g.lineStyle(3, 0x8a5a4a, 0.8);
        g.strokeEllipse(pl.x, pl.y + 3, 58, 22);
      } else if (plant.thirsty) {
        g.lineStyle(3, 0x5fc3e8, 0.85);
        g.strokeEllipse(pl.x, pl.y + 3, 58, 22);
      }
    });
  }

  /** Floating status pips (droplet / feed / prune / skull) above each plot. */
  private updatePlotPips(time: number) {
    if (!this.garden) return;
    const g = this.pipG;
    g.clear();
    PLOTS.forEach((pl, i) => {
      if (!this.plotUnlocked(i)) return;
      const plant = this.plotState(i)?.plant;
      if (!plant) return;
      const bob = Math.sin(time / 420 + i) * 3;
      const y = pl.y - 74 + bob;
      if (plant.dead) {
        g.fillStyle(0x6b4a3a, 0.9);
        g.fillCircle(pl.x, y, 7);
        return;
      }
      if (plant.isBloomed) {
        g.fillStyle(0xffd76e, 0.95);
        g.fillCircle(pl.x, y, 7);
        g.fillStyle(0xffffff, 0.8);
        g.fillCircle(pl.x - 2, y - 2, 2.4);
        return;
      }
      if (plant.thirsty) {
        g.fillStyle(0x5fc3e8, 0.95);
        g.fillCircle(pl.x, y + 2, 6);
        g.fillTriangle(pl.x - 5.4, y + 1, pl.x + 5.4, y + 1, pl.x, y - 8);
        g.fillStyle(0xffffff, 0.65);
        g.fillCircle(pl.x - 2, y + 2, 1.8);
      }
    });
  }


  // ---- restoration zones along the fence line ----

  private buildZones() {
    for (const f of FIXTURES) {
      const tex = this.ctex(`fix_${f.key}`, FIX_W * 2, FIX_H * 2, () => {});
      const img = this.add
        .image(f.x, f.y, `fix_${f.key}`)
        .setOrigin(FIX_BX / FIX_W, FIX_BY / FIX_H)
        .setScale(0.62)
        .setDepth(6.35)
        .setVisible(false);
      this.fixtureNodes[f.key] = { tex, img };
    }

    // soft mist over each locked zone, with a padlock and the level it opens at
    for (const [zoneKey, fog] of Object.entries(ZONE_FOG)) {
      const cont = this.add.container(fog.x, fog.y).setDepth(6.55);
      const g = this.add.graphics();
      for (let i = 4; i >= 1; i--) {
        g.fillStyle(0xe8f2e4, 0.16 + i * 0.05);
        g.fillEllipse(0, 0, fog.rx * 2 * (i / 4), fog.ry * 2 * (i / 4));
      }
      // drifting wisps
      g.fillStyle(0xffffff, 0.22);
      g.fillEllipse(-fog.rx * 0.4, -8, fog.rx * 0.7, 16);
      g.fillEllipse(fog.rx * 0.35, 6, fog.rx * 0.6, 14);
      cont.add(g);

      const lockG = this.add.graphics();
      lockG.fillStyle(0x1f3d2d, 0.3);
      lockG.fillRoundedRect(-12, -8, 24, 19, 5);
      lockG.lineStyle(2.2, 0xffffff, 0.75);
      lockG.strokeRoundedRect(-12, -8, 24, 19, 5);
      lockG.lineStyle(2.6, 0xffffff, 0.75);
      lockG.beginPath(); lockG.arc(0, -8, 6, Math.PI, 0); lockG.strokePath();
      cont.add(lockG);

      const zdef = this.garden?.zones?.find((z) => z.key === zoneKey);
      const label = this.add
        .text(0, 20, zdef ? `Lv ${zdef.minLevel}` : "", {
          fontFamily: "Trebuchet MS, sans-serif",
          fontSize: "11px",
          fontStyle: "bold",
          color: "#2f4a3d",
          backgroundColor: "rgba(255,255,255,0.7)",
          padding: { x: 5, y: 1 },
        })
        .setOrigin(0.5, 0.5)
        .setName("lvl");
      cont.add(label);
      this.zoneFog[zoneKey] = cont;
    }
  }

  private refreshZones() {
    const zones = this.garden?.zones ?? [];
    const firstLoad = this.restoredSeen === null;
    const seen = this.restoredSeen ?? new Set<string>();
    this.restoredSeen = seen;

    for (const z of zones) {
      const fog = this.zoneFog[z.key];
      if (fog) {
        const label = fog.getByName("lvl") as Phaser.GameObjects.Text | null;
        label?.setText(`Lv ${z.minLevel}`);
        if (z.unlocked && fog.visible) {
          if (firstLoad) fog.setVisible(false);
          else {
            // the mist lifts
            this.tweens.add({
              targets: fog, alpha: 0, y: fog.y - 14, duration: 1400, ease: "Sine.easeIn",
              onComplete: () => fog.setVisible(false),
            });
          }
        } else if (!z.unlocked) {
          fog.setVisible(true).setAlpha(1);
        }
      }

      for (const fx of z.fixtures) {
        const node = this.fixtureNodes[fx.key];
        const def = FIXTURES.find((f) => f.key === fx.key);
        if (!node || !def) continue;
        node.img.setVisible(z.unlocked);
        const c = node.tex.getContext();
        c.clearRect(0, 0, FIX_W * 2, FIX_H * 2);
        c.save();
        c.scale(2, 2);
        def.paint(c, fx.restored);
        c.restore();
        node.tex.refresh();

        if (fx.restored && !seen.has(fx.key)) {
          seen.add(fx.key);
          if (!firstLoad) this.celebrateRestore(def.x, def.y);
        }
      }
    }
  }

  /** A little glow-up when a ruin becomes whole again. */
  private celebrateRestore(x: number, y: number) {
    this.sparkles.explode(22, x, y - 26);
    this.time.delayedCall(300, () => this.sparkles.explode(12, x, y - 34));
    const ring = this.add.graphics().setDepth(6.6);
    ring.lineStyle(3, 0xffe07a, 0.9);
    ring.strokeEllipse(x, y - 18, 30, 20);
    this.tweens.add({
      targets: ring, alpha: 0, scaleX: 2.1, scaleY: 2.1, duration: 900, ease: "Sine.easeOut",
      onComplete: () => ring.destroy(),
    });
  }

  private buildGardener() {
    this.playerShadow = this.add.image(200, FEET_Y + 2, "shadow").setAlpha(0.4);
    this.player = this.add
      .sprite(200, FEET_Y, "g_idle_0")
      .setScale(0.5)
      .setOrigin(BODY_CX / FRAME_W, FEET_LY / FRAME_H);
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
        .setDepth(985)
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
    }).setDepth(960);

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
    }).setDepth(960);

    // Blossom, leaf-fall and snow. Three emitters rather than one that
    // swaps texture: they differ in weight and density as much as in
    // colour, and a season change is rare enough that two idle emitters
    // cost nothing. Depth 940 puts them in front of the garden — weather
    // passes between the player and the yard, not behind it.
    const drifter = (key: string, cfg: Partial<Phaser.Types.GameObjects.Particles.ParticleEmitterConfig>) =>
      this.add.particles(0, 0, key, {
        x: { min: -60, max: W + 60 },
        y: { min: 60, max: 240 },
        rotate: { min: 0, max: 360 },
        alpha: { start: 0.95, end: 0.45 },
        quantity: 1,
        emitting: false,
        ...cfg,
      }).setDepth(940);
    this.drifters.petal = drifter("drift_petal", {
      speedY: { min: 16, max: 30 }, speedX: { min: -14, max: 30 },
      lifespan: { min: 8000, max: 13000 }, scale: { min: 0.5, max: 0.95 },
      frequency: 520,
    });
    this.drifters.leaf = drifter("drift_leaf", {
      speedY: { min: 22, max: 40 }, speedX: { min: -20, max: 34 },
      lifespan: { min: 7000, max: 11000 }, scale: { min: 0.6, max: 1.1 },
      frequency: 460,
    });
    this.drifters.snow = drifter("drift_snow", {
      speedY: { min: 12, max: 26 }, speedX: { min: -10, max: 18 },
      lifespan: { min: 10000, max: 16000 }, scale: { min: 0.4, max: 1 },
      frequency: 190,
    });

    // Earth thrown up by hands and a rake. Heavy gravity and a short life:
    // crumbs fall back into the bed, they do not drift like celebration.
    this.crumbs = this.add.particles(0, 0, "crumbs", {
      frame: ["c0", "c1", "c2"],
      speed: { min: 30, max: 110 },
      angle: { min: 210, max: 330 },
      scale: { min: 0.5, max: 1 },
      alpha: { start: 1, end: 0.25 },
      lifespan: { min: 320, max: 620 },
      gravityY: 620,
      rotate: { min: 0, max: 360 },
      emitting: false,
    }).setDepth(960);

    // One emitter per facing direction: the stream must arc *toward* the pond,
    // so speedX is mirrored rather than always-positive.
    // startPour() re-solves speedX and lifespan against the real distance
    // every time; these are only the shape of the stream.
    //
    // Both speeds have to be plain NUMBERS, not {min,max}: EmitterOp.onChange
    // sets `current`, which only a static-value op ever reads back — on a
    // min/max op it is clamped into the old range and then ignored, so the
    // aim silently did nothing and every pour still used the hard-coded
    // throw. The stream gets its life from a small emit zone instead, so
    // droplets leave the spout scattered rather than single file.
    const dropletCfg = (dir: 1 | -1) => ({
      speedX: dir * 120,
      speedY: 10,
      gravityY: DROP_G,
      emitZone: {
        type: "random" as const,
        // a hand-rolled source: Phaser.Geom.Rectangle's own getRandomPoint
        // does not satisfy RandomZoneSourceCallback in the shipped types
        source: {
          getRandomPoint: (point: Phaser.Types.Math.Vector2Like) => {
            point.x = Phaser.Math.Between(-4, 4);
            point.y = Phaser.Math.Between(-5, 5);
          },
        },
      },
      lifespan: 330,
      quantity: 2,
      frequency: 22,
      scale: { min: 0.7, max: 1.15 },
      alpha: { start: 0.95, end: 0.3 },
      emitting: false,
    });
    this.dropletsR = this.add.particles(0, 0, "drop", dropletCfg(1)).setDepth(955);
    this.dropletsL = this.add.particles(0, 0, "drop", dropletCfg(-1)).setDepth(955);
    // the landing splash: droplets kicked up in every direction
    this.splashBurst = this.add.particles(0, 0, "drop", {
      speedX: { min: -120, max: 120 },
      speedY: { min: -180, max: -40 },
      gravityY: 700,
      lifespan: 460,
      scale: { min: 0.5, max: 1 },
      alpha: { start: 0.95, end: 0 },
      emitting: false,
    }).setDepth(956);
    this.splashG = this.add.graphics().setDepth(9.5);
  }

  private buildPost() {
    this.add.image(W / 2, H / 2, "vignette").setDisplaySize(W, H).setDepth(1000);
  }

  // ================= behaviors =================

  private isWalking(): boolean {
    return this.player.anims.currentAnim?.key === "walk" && this.player.anims.isPlaying;
  }

  /** Clamps a point into the grass and out of the pond. */
  private walkable(x: number, y: number): { x: number; y: number } {
    let nx = Phaser.Math.Clamp(x, 34, W - 34);
    let ny = Phaser.Math.Clamp(y, WALK_TOP, WALK_BOTTOM);

    // the gardener does not paddle: push out of the pond along its normal.
    // The bounds sit just OUTSIDE the painted water; below the centre the
    // radius grows further so the walk line clears the whole near bank —
    // otherwise his body overlaps the water and he looks like he's swimming.
    const rx = POND_RX * 1.06;
    const ry = ny > POND_Y ? POND_RY * 1.34 : POND_RY * 1.08;
    const dx = (nx - POND_X) / rx;
    const dy = (ny - POND_Y) / ry;
    const d = Math.hypot(dx, dy);
    if (d < 1 && d > 0.0001) {
      nx = POND_X + (dx / d) * rx;
      ny = Phaser.Math.Clamp(POND_Y + (dy / d) * ry, WALK_TOP, WALK_BOTTOM);
    }
    // the y clamp above can put him back in the water, so finish the job
    // sideways along whichever bank he is nearest
    const ry2 = ny > POND_Y ? POND_RY * 1.34 : POND_RY * 1.08;
    const row = (ny - POND_Y) / ry2;
    if (Math.abs(row) < 1) {
      const half = rx * Math.sqrt(1 - row * row);
      const off = nx - POND_X;
      if (Math.abs(off) < half) nx = POND_X + (off >= 0 ? half : -half);
    }
    return { x: Phaser.Math.Clamp(nx, 34, W - 34), y: ny };
  }

  /**
   * Where to stand to reach a plot: always BESIDE the target, never on top
   * of it, so facing it (and pouring at it) has an unambiguous direction.
   */
  private standPointFor(i: number): { x: number; y: number } {
    const p = PLOTS[i] ?? PLOTS[0];
    if (p.kind === "water") {
      // on the bank, offset outward so the can pours in over the water
      const side = p.x <= POND_X ? -1 : 1;
      return this.walkable(p.x + side * 42, POND_Y + POND_RY * 1.34 + 6);
    }
    // approach from whichever side the gardener is already on
    const side = this.player && this.player.x > p.x ? 1 : -1;
    return this.walkable(p.x + side * 48, p.y + 12);
  }

  private updatePlayer() {
    // `scripted` is the scene walking him to a ritual; the player's own keys
    // and taps are ignored for its duration, and a freeze does not stop it.
    const scripted = this.ritualWalking;
    if (!this.player || this.pouring || this.celebrating || this.ritualing) return;
    if (this.frozen && !scripted) return;

    let vx = 0;
    let vy = 0;
    const left = !scripted && (this.cursors?.left?.isDown || this.keys?.A?.isDown);
    const right = !scripted && (this.cursors?.right?.isDown || this.keys?.D?.isDown);
    const up = !scripted && (this.cursors?.up?.isDown || this.keys?.W?.isDown);
    const down = !scripted && (this.cursors?.down?.isDown || this.keys?.S?.isDown);

    if (left || right || up || down) {
      this.autoTarget = null;
      this.pendingPour = false;
      vx = (left ? -1 : 0) + (right ? 1 : 0);
      vy = (up ? -1 : 0) + (down ? 1 : 0);
    } else if (this.autoTarget) {
      const dx = this.autoTarget.x - this.player.x;
      const dy = this.autoTarget.y - this.player.y;
      if (Math.hypot(dx, dy) < 14) {
        this.player.setPosition(this.autoTarget.x, this.autoTarget.y);
        this.autoTarget = null;
        if (this.pendingPour) {
          this.pendingPour = false;
          this.startPour();
        }
        if (this.pendingRitual) {
          const go = this.pendingRitual;
          this.pendingRitual = null;
          go();
        }
      } else {
        vx = dx;
        vy = dy;
        // If the straight line dives into the pond, walk the bank instead:
        // swap the heading for the ellipse tangent that shortens the trip.
        // Skip on final approach — near a bank-side target the tangent would
        // orbit forever; the position clamp still keeps him dry.
        const closing = Math.hypot(dx, dy) < 64;
        const rx = POND_RX * 1.06;
        const aheadY = this.player.y + (vy / Math.hypot(vx, vy)) * 26 * 0.62;
        const ry = aheadY > POND_Y ? POND_RY * 1.34 : POND_RY * 1.08;
        const step = 26; // look a little ahead so the turn starts early
        const lx = (this.player.x + (vx / Math.hypot(vx, vy)) * step - POND_X) / rx;
        const ly = (this.player.y + (vy / Math.hypot(vx, vy)) * step * 0.62 - POND_Y) / ry;
        if (!closing && lx * lx + ly * ly < 1) {
          const px = (this.player.x - POND_X) / rx;
          const py = (this.player.y - POND_Y) / ry;
          // two ways around; take the one that points toward the target
          const t1 = { x: -py * rx, y: px * ry };
          const t2 = { x: py * rx, y: -px * ry };
          const pick = t1.x * dx + t1.y * dy >= t2.x * dx + t2.y * dy ? t1 : t2;
          vx = pick.x;
          vy = pick.y;
        }
      }
    }

    const len = Math.hypot(vx, vy);
    if (len > 0.0001) {
      // normalise so diagonals are not faster, and slow vertical movement a
      // little because the yard is drawn in perspective
      // real elapsed time, not Phaser's smoothed delta: on a slow device
      // (or a headless test) frames stretch and the smoothed value under-
      // reports, leaving the gardener wading through treacle
      const nowMs = performance.now();
      const dt = Math.min((nowMs - (this.lastStepMs || nowMs)) / 1000, 0.25);
      this.lastStepMs = nowMs;
      // walking to a tapped target is brisker than strolling by key
      const speed = (this.autoTarget ? 290 : 215) * dt;
      const next = this.walkable(
        this.player.x + (vx / len) * speed,
        this.player.y + (vy / len) * speed * 0.62
      );
      this.player.setPosition(next.x, next.y);
      if (Math.abs(vx) > 0.5) this.player.setFlipX(vx < 0);
      if (!this.isWalking()) this.player.play("walk");
    } else {
      this.lastStepMs = 0;
      if (this.isWalking()) {
        this.player.play("idle");
        this.player.setTexture("g_idle_0");
      }
    }

    // sort against everything else standing in the yard, and shrink slightly
    // with distance so walking back feels like walking away
    const t = (this.player.y - WALK_TOP) / (WALK_BOTTOM - WALK_TOP);
    this.player.setDepth(YARD + this.player.y);
    this.player.setScale(0.44 + t * 0.13);
    this.playerShadow
      .setPosition(this.player.x, this.player.y + 2)
      .setDepth(YARD + this.player.y - 0.6)
      .setScale((0.52 + t * 0.16), (0.34 + t * 0.11));

    if (!scripted && this.keys && (Phaser.Input.Keyboard.JustDown(this.keys.E) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE))) {
      this.requestTend(this.selected, "water");
    }

    const sel = PLOTS[this.selected] ?? PLOTS[0];
    const near = Math.hypot(this.player.x - sel.x, this.player.y - sel.y) < 130;
    if (near !== this.nearPond) {
      this.nearPond = near;
      this.bridge.onNearPond?.(near);
    }
  }

  private startPour() {
    if (this.pouring) return;
    const plot = PLOTS[this.selected] ?? PLOTS[0];
    this.pouring = true;
    this.pendingPlot = this.selected;
    this.autoTarget = null;
    this.player.setFlipX(this.player.x > plot.x);
    this.player.play("pour");

    this.time.delayedCall(300, () => {
      if (!this.pouring) return;
      const dir = this.player.flipX ? -1 : 1;
      const em = dir === 1 ? this.dropletsR : this.dropletsL;
      // Spout tip of the tilted can, mirrored AND scaled with the sprite.
      //
      // SPOUT_OFFSET is in LOGICAL frame units, and the frames are painted
      // at 2x — so one logical unit is two texture pixels, and the sprite's
      // own scale then maps texture pixels to world pixels. The conversion
      // is 2 * scale, not scale. Multiplying by the scale alone put the
      // stream at half the reach and half the height: about 30px above his
      // feet, which is his hip. The water came out of his trousers.
      const u = 2 * this.player.scaleX;
      const v = 2 * this.player.scaleY;
      const ex = this.player.x + dir * SPOUT_OFFSET.x * u;
      const ey = this.player.y + SPOUT_OFFSET.y * v;
      em.setPosition(ex, ey);

      // Aim, rather than guess. The old horizontal throw was tuned against
      // the WRONG origin — it only ever landed on the bed because the two
      // errors cancelled — so correcting the spout without correcting the
      // aim threw the stream clean past it.
      //
      // Fix the flight time and solve both speeds for it. Choosing the time
      // rather than deriving it from the fall is what makes a POND plot
      // work: the lily sits further back, which is *higher* on screen than
      // the bank he stands on, and no amount of downward speed will reach
      // something above the spout. A fixed T just asks for an upward toss
      // instead, and the same line covers both.
      const plt = PLOTS[this.pendingPlot] ?? PLOTS[0];
      // A lily is not thirsty — she is floating. What runs low at a pond is
      // the pond, so the can is aimed at the open water in front of the pad
      // rather than at the plant, and the level comes up around her.
      const tgt = plt.kind === "water"
        ? { x: plt.x - dir * 12, y: plt.y + 26 }
        : plt;
      // ops.speedX, not setParticleSpeed(): that helper flips the emitter
      // into radial mode, where the angle op takes over and the stream
      // stops being a stream.
      em.ops.speedX.onChange((tgt.x - ex) / POUR_T);
      em.ops.speedY.onChange(
        (tgt.y - ey - 0.5 * DROP_G * POUR_T * POUR_T) / POUR_T
      );
      em.setParticleLifespan(POUR_T * 1000 + 45);
      em.start();
      this.pourSplashTimer = this.time.addEvent({
        delay: 130,
        loop: true,
        callback: () => {
          const t = PLOTS[this.pendingPlot] ?? PLOTS[0];
          const pond = t.kind === "water";
          this.pourSplashes.push({
            x: t.x + Phaser.Math.Between(-14, 14) - (pond ? dir * 12 : 0),
            y: t.y + Phaser.Math.Between(-4, 10) + (pond ? 24 : 0),
            t0: this.time.now,
          });
        },
      });
    });

    this.bridge.onPourStart?.(this.pendingPlot, this.pendingAction);

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

  /**
   * The pond taking the water: a pale sheen spreading off where the can went
   * in, and the pad lifting a little as the level comes up. No wet-soil
   * patch, no darkening — the surface was already water.
   */
  private pondRise(i: number) {
    const p = PLOTS[i] ?? PLOTS[0];
    const sheen = this.add
      .graphics({ x: p.x, y: p.y + 14 })
      .setDepth(YARD + p.y - 0.7)
      .setAlpha(0);
    sheen.fillStyle(0xcdeaff, 0.3);
    sheen.fillEllipse(0, 0, 54, 18);
    this.tweens.chain({
      targets: sheen,
      tweens: [
        { alpha: 1, scaleX: 1.5, scaleY: 1.3, duration: 420, ease: "Sine.easeOut" },
        { alpha: 0, scaleX: 2.2, scaleY: 1.7, duration: 1400, ease: "Sine.easeIn" },
      ],
      onComplete: () => sheen.destroy(),
    });

    // the pad rides the rising level, then settles
    const img = this.plotNodes[i]?.img;
    if (img && !this.shivers.get(i)) {
      const y0 = img.y;
      this.tweens.chain({
        targets: img,
        tweens: [
          { y: y0 - 5, duration: 420, ease: "Sine.easeOut" },
          { y: y0, duration: 900, ease: "Sine.easeInOut" },
        ],
      });
    }
  }

  private splashAt(i: number) {
    const p = PLOTS[i] ?? PLOTS[0];
    if (p.kind === "water") {
      this.burstRipples.push({ t0: this.time.now });
      this.time.delayedCall(160, () => this.burstRipples.push({ t0: this.time.now }));
    }
    this.splashBurst.explode(14, p.x, p.y - 2);
    this.sparkles.explode(16, p.x, p.y - 34);
    this.time.delayedCall(180, () => this.sparkles.explode(8, p.x, p.y - 48));
  }

  /** A soft punch of the camera — felt more than seen. */
  private cameraPunch(strength = 0.02) {
    const cam = this.cameras.main;
    const z = cam.zoom;
    const proxy = { t: 0 };
    this.tweens.add({
      targets: proxy, t: 1, duration: 320, ease: "Sine.easeOut",
      onUpdate: () => cam.setZoom(z * (1 + Math.sin(proxy.t * Math.PI) * strength)),
      onComplete: () => cam.setZoom(z),
    });
  }

  /** An expanding ring of light where the water landed. */
  private burstRing(x: number, y: number, tint = 0x9fe4ff) {
    const g = this.add.graphics().setDepth(958);
    g.lineStyle(5, tint, 0.9);
    g.strokeCircle(0, 0, 18);
    g.setPosition(x, y);
    this.tweens.add({
      targets: g, scaleX: 3.4, scaleY: 1.5, alpha: 0,
      duration: 620, ease: "Cubic.easeOut",
      onComplete: () => g.destroy(),
    });
  }

  /** Escalating "n in a row" flourish while a watering round runs. */
  private comboFlash(n: number, x: number, y: number) {
    if (n < 2) return;
    const label = this.add
      .text(x, y - 96, `${n} in a row!`, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: `${20 + Math.min(n, 6) * 2}px`,
        fontStyle: "bold",
        color: "#fff6d8",
        stroke: "#c98d1c",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(968)
      .setScale(0.3)
      .setAngle(-6);
    this.tweens.chain({
      targets: label,
      tweens: [
        { scale: 1.15, angle: 3, duration: 240, ease: "Back.easeOut" },
        { scale: 1, angle: 0, duration: 140 },
        { y: label.y - 34, alpha: 0, duration: 700, delay: 340, ease: "Sine.easeIn" },
      ],
      onComplete: () => label.destroy(),
    });
  }

  /** The full watering payoff, louder the deeper into a round you are. */
  celebrateWater(i: number, combo = 0) {
    const p = PLOTS[i] ?? PLOTS[0];
    this.burstRing(p.x, p.y - 6);
    this.time.delayedCall(140, () => this.burstRing(p.x, p.y - 30, 0xffe9a8));
    this.cameraPunch(0.018 + Math.min(combo, 5) * 0.004);
    this.sparkles.explode(18 + Math.min(combo, 6) * 4, p.x, p.y - 40);
    this.comboFlash(combo, p.x, p.y);
  }

  setCombo(n: number) {
    this.comboCount = n;
  }

  /** The whole round is done — the garden says thank you. */
  celebrateRound(count: number) {
    const CX = W / 2;
    const CY = 300;
    this.confetti.explode(60, CX, CY);
    this.time.delayedCall(240, () => this.confetti.explode(40, CX - 160, CY + 40));
    this.time.delayedCall(420, () => this.confetti.explode(40, CX + 160, CY + 40));
    this.cameraPunch(0.035);
    const t = this.add
      .text(CX, CY, `${count} watered — the whole garden!`, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "30px",
        fontStyle: "bold",
        color: "#ffffff",
        stroke: "#3e8e52",
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setDepth(1205)
      .setScale(0.4)
      .setAlpha(0);
    this.tweens.chain({
      targets: t,
      tweens: [
        { alpha: 1, scale: 1.1, duration: 320, ease: "Back.easeOut" },
        { scale: 1, duration: 160 },
        { alpha: 0, y: CY - 40, duration: 700, delay: 900, ease: "Sine.easeIn" },
      ],
      onComplete: () => t.destroy(),
    });
  }

  /** The plant drinks: a squash, a tall happy stretch, then settle. */
  private drinkGulp(i: number) {
    const img = this.plotNodes[i]?.img;
    if (!img) return;
    const shiver = this.shivers.get(i);
    if (shiver) { shiver.stop(); this.shivers.delete(i); }
    this.tweens.killTweensOf(img);
    img.setAngle(0).setScale(1);
    this.tweens.chain({
      targets: img,
      tweens: [
        { scaleX: 1.12, scaleY: 0.86, duration: 110, ease: "Sine.easeOut" },
        { scaleX: 0.94, scaleY: 1.14, duration: 150, ease: "Sine.easeInOut" },
        { scaleX: 1, scaleY: 1, duration: 220, ease: "Back.easeOut" },
        { angle: { from: -4, to: 4 }, duration: 110, yoyo: true, repeat: 2 },
        { angle: 0, duration: 60 },
      ],
    });
  }

  /** A dark, glistening patch soaks into the soil and dries away. */
  private wetSoil(i: number) {
    const p = PLOTS[i] ?? PLOTS[0];
    // There is no soil to darken in a pond, and painting a wet patch on open
    // water was the scene quietly agreeing with the button that said Water.
    // The pond answers differently: the level lifts and the pad rides it.
    if (p.kind === "water") { this.pondRise(i); return; }
    const g = this.add.graphics().setDepth(YARD + p.y - 0.7).setAlpha(0);
    g.fillStyle(0x2e5e8a, 0.32);
    g.fillEllipse(p.x, p.y + 4, 66, 24);
    g.fillStyle(0x9fd4f0, 0.25);
    g.fillEllipse(p.x - 12, p.y + 1, 22, 7);
    this.tweens.chain({
      targets: g,
      tweens: [
        { alpha: 1, duration: 260, ease: "Sine.easeOut" },
        { alpha: 0, duration: 2600, delay: 900, ease: "Sine.easeIn" },
      ],
      onComplete: () => g.destroy(),
    });
  }

  /** "+N" pops out of the plant and floats up to bank itself. */
  private rewardFloat(i: number, dew: number) {
    const p = PLOTS[i] ?? PLOTS[0];
    const label = this.add
      .text(p.x, p.y - 70, `+${dew}`, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "26px",
        fontStyle: "bold",
        color: "#eaf7ff",
        stroke: "#2f7c9e",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(965)
      .setScale(0.2)
      .setAlpha(0);
    const drop = this.add.image(p.x + 26, p.y - 66, "hint")
      .setDepth(965).setScale(0.28).setAlpha(0);
    // where the wallet counter sits on screen, in world terms
    const bank = this.cameras.main.getWorldPoint(64, 26);
    this.tweens.add({
      targets: [label, drop], alpha: 1, scale: { from: 0.2, to: 1 },
      duration: 260, ease: "Back.easeOut",
      onComplete: () => {
        // it does not just fade — it flies to the purse and pulses the count,
        // so earning and balance are visibly the same thing
        this.tweens.add({
          targets: [label, drop],
          x: bank.x, y: bank.y, scale: 0.35, alpha: 0.15,
          duration: 620, delay: 260, ease: "Cubic.easeIn",
          onComplete: () => {
            label.destroy(); drop.destroy();
            this.sparkles.explode(6, bank.x, bank.y);
            this.bridge.onDewBanked?.(dew);
          },
        });
      },
    });
    this.tweens.add({ targets: drop, scale: 0.34, duration: 260, ease: "Back.easeOut" });
  }

  private happyWiggle(i: number) {
    const img = this.plotNodes[i]?.img;
    if (!img) return;
    this.tweens.killTweensOf(img);
    img.setAngle(0);
    this.tweens.add({
      targets: img,
      angle: { from: -5, to: 5 },
      duration: 110,
      yoyo: true,
      repeat: 3,
      onComplete: () => img.setAngle(0),
    });
  }

  private sadShake(i: number) {
    const img = this.plotNodes[i]?.img;
    if (!img) return;
    const x0 = PLOTS[i].x;
    this.tweens.killTweensOf(img);
    this.tweens.add({
      targets: img,
      x: { from: x0 - 4, to: x0 + 4 },
      duration: 60,
      yoyo: true,
      repeat: 5,
      onComplete: () => img.setX(x0),
    });
    // NO sparkle burst here. The emitter's palette is gold and pink, and it
    // fires on blooms, stages and pours — an overwatered cactus arriving in
    // celebration particles is exactly the confusion this whole pass exists
    // to remove. Nothing positive marks a plant being harmed.
  }

  // ================= the hands-on rituals =================
  //
  // Clearing, gathering and sowing all share one shape: walk over, kneel,
  // do the work with your hands, stand up. That is deliberate — it is the
  // same gardener and the same soil every time, so the beats have to rhyme.
  // What differs is the vocabulary. Clearing descends and never sparkles;
  // gathering rises and may; sowing is small, dry and ends on a promise.
  //
  // Every beat is scheduled in wall-clock milliseconds, never frame counts:
  // headless Chromium renders around 8fps, where a single frame is 125ms and
  // a "3-frame hold" becomes a third of a second.

  setReducedMotion(v: boolean) {
    this.reducedMotion = v;
  }

  ritual(i: number, kind: RitualKind, done: () => void) {
    if (!this.player || this.celebrating) { done(); return; }
    // never two at once — the second one wins, the first resolves anyway
    if (this.ritualing || this.ritualDone) this.finishRitual();

    this.ritualDone = done;
    this.ritualPlot = i;
    this.selected = i;
    this.refreshMarkers();

    const begin = () => {
      this.ritualWalking = false;
      this.ritualing = true;
      const p = PLOTS[i] ?? PLOTS[0];
      this.player.setFlipX(this.player.x > p.x);
      this.player.anims.stop();
      if (this.reducedMotion) { this.quietRitual(i, kind); return; }
      if (kind === "clear") this.beatsClear(i);
      else if (kind === "harvest") this.beatsHarvest(i);
      else if (kind === "break") this.beatsBreak(i);
      else this.beatsSow(i);
    };

    const stand = this.standPointFor(i);
    if (Math.hypot(this.player.x - stand.x, this.player.y - stand.y) < 16) {
      this.player.setPosition(stand.x, stand.y);
      begin();
    } else {
      this.autoTarget = stand;
      this.pendingRitual = begin;
      this.ritualWalking = true;
    }
  }

  /** The request failed after all — put the plant back, drop the beats. */
  cancelRitual() {
    const i = this.ritualPlot;
    this.finishRitual();
    if (i >= 0) this.refreshPlot(i);
  }

  /** A ritual timer, tracked so an interruption can take them all down. */
  private rt(ms: number, fn: () => void) {
    this.ritualTimers.push(this.time.delayedCall(ms, fn));
  }

  private finishRitual() {
    this.ritualTimers.forEach((t) => t.remove(false));
    this.ritualTimers = [];
    if (this.ritualGhost) {
      this.tweens.killTweensOf(this.ritualGhost);
      this.ritualGhost.destroy();
      this.ritualGhost = null;
    }
    this.ritualing = false;
    this.ritualWalking = false;
    this.pendingRitual = null;
    this.ritualPlot = -1;
    if (this.player) { this.player.setTexture("g_idle_0"); this.player.play("idle"); }
    const done = this.ritualDone;
    this.ritualDone = null;
    done?.();
  }

  /**
   * A detached copy of the plant, so the beats have something to hold while
   * the real one is repainted out from under them by the arriving state.
   */
  private takeGhost(i: number): Phaser.GameObjects.Image | null {
    const node = this.plotNodes[i];
    const plant = this.plotState(i)?.plant;
    const sp = plant ? SPECIES_BY_KEY[plant.species] : undefined;
    if (!node || !plant || !sp) return null;
    this.ctex("plantghost", PB_W * 2, PB_H * 2, (c) => {
      c.scale(2, 2);
      c.translate(PB_X, PB_Y);
      drawPlant(c, sp, { stage: plant.stage, wilted: plant.wilted, dead: plant.dead, variant: plant.variant });
    });
    const p = PLOTS[i] ?? PLOTS[0];
    const ghost = this.add
      .image(p.x, p.y, "plantghost")
      .setScale(0.5)
      .setOrigin(PB_X / PB_W, PB_Y / PB_H)
      .setDepth(YARD + p.y + 0.3)
      .setAngle(node.img.angle);
    node.img.setVisible(false);
    this.ritualGhost = ghost;
    return ghost;
  }

  /**
   * Loose earth lifting and falling back. Drawn at the origin of a Graphics
   * placed AT the plot, so scaling it spreads the puff instead of flinging
   * it across the yard — a Graphics scales about its own position, and one
   * drawn at absolute world coords travels when you scale it.
   */
  private soilPuff(x: number, y: number, k = 1) {
    const puff = this.add.graphics({ x, y: y + 3 }).setDepth(YARD + y - 0.6);
    puff.fillStyle(0x6b4a30, 0.5);
    puff.fillEllipse(0, 0, 54 * k, 16 * k);
    this.tweens.add({
      targets: puff, scaleX: 1.9, scaleY: 0.5, alpha: 0,
      duration: 620, ease: "Cubic.easeOut", onComplete: () => puff.destroy(),
    });
  }

  /** A ring opening on the soil, in whatever colour the moment earned. */
  private soilRing(x: number, y: number, colour: number, alpha: number, ms: number) {
    const ring = this.add.graphics({ x, y: y + 4 }).setDepth(YARD + y - 0.5);
    ring.lineStyle(2.5, colour, alpha);
    ring.strokeEllipse(0, 0, 40, 15);
    this.tweens.add({
      targets: ring, scaleX: 1.5, scaleY: 1.5, alpha: 0,
      duration: ms, ease: "Sine.easeOut", onComplete: () => ring.destroy(),
    });
  }

  /**
   * Pulling a dead plant out of the ground. Six beats, 1390ms.
   *
   * No camera move and no ghostly silhouette of what it used to be: the
   * mourning is already paid for by the card that sent the player here, and
   * a second helping of grief over the same plant is maudlin. This beat's
   * job is continuity — the thing was there, hands took it away, the bed is
   * level now.
   */
  private beatsClear(i: number) {
    const p = PLOTS[i] ?? PLOTS[0];
    const ghost = this.takeGhost(i);

    // 1. TAKE HOLD (140ms)
    this.player.setTexture("g_kneel_0");
    sfx.take();
    if (ghost) {
      this.tweens.add({ targets: ghost, angle: ghost.angle + 3, duration: 140, ease: "Sine.easeOut" });
    }

    // 2. KNEEL (200ms) — the earth loosens before anything moves
    this.rt(140, () => { this.soilPuff(p.x, p.y, 0.55); this.crumbs.explode(5, p.x, p.y + 2); });

    // 3. DRAW UP (180ms) — the pull, and the roots complaining about it
    this.rt(340, () => {
      this.player.setTexture("g_kneel_1");
      sfx.uproot();
      if (ghost) {
        this.tweens.add({ targets: ghost, y: p.y - 7, scaleY: 0.53, duration: 180, ease: "Sine.easeIn" });
      }
      this.crumbs.explode(7, p.x, p.y + 2);
    });

    // 4. THE BREAK (90ms) — the shortest beat, because it is the loudest
    this.rt(520, () => {
      sfx.snap();
      this.crumbs.explode(14, p.x, p.y);
      this.cameraPunch(0.008);
      if (ghost) this.tweens.add({ targets: ghost, y: p.y - 13, duration: 90, ease: "Quad.easeOut" });
    });

    // 5. LIFT AWAY (260ms) — out of frame sideways, never up into the light
    this.rt(610, () => {
      const away = this.player.flipX ? -1 : 1;
      if (ghost) {
        this.tweens.add({
          targets: ghost,
          y: p.y - 40, x: p.x + away * 30,
          angle: ghost.angle + away * 26,
          scaleX: 0.44, scaleY: 0.44, alpha: 0,
          duration: 260, ease: "Sine.easeIn",
        });
      }
      // the fallen leaves and the dull ring go with it
      this.deadFx[i]?.objs.forEach((o) =>
        this.tweens.add({ targets: o, alpha: 0, duration: 300 })
      );
    });

    // 6. RAKE (240ms) — level the bed
    this.rt(870, () => {
      this.player.setTexture("g_rake_0");
      sfx.rake();
      this.rt(120, () => this.player?.setTexture("g_rake_1"));
      const sweep = this.add.graphics({ x: p.x, y: p.y + 4 }).setDepth(YARD + p.y - 0.55);
      sweep.fillStyle(0x6b4a30, 0.42);
      sweep.fillEllipse(0, 0, 30, 11);
      this.tweens.add({
        targets: sweep, scaleX: 2.1, scaleY: 1.25, alpha: 0,
        duration: 320, ease: "Cubic.easeOut", onComplete: () => sweep.destroy(),
      });
      this.crumbs.explode(6, p.x + 12, p.y + 2);
    });

    // 7. BED READY (440ms) — he stands, the soil settles, and nothing
    // congratulates him. Every other cue in this game is a small fanfare;
    // there is no closing sound here on purpose.
    this.rt(1110, () => {
      this.player.setTexture("g_idle_0");
      this.soilRing(p.x, p.y, 0x9c8465, 0.6, 440);
    });

    this.rt(1390, () => this.finishRitual());
  }

  /**
   * Gathering a bloom. Same hands, same kneel — but this one is a win, so
   * it is allowed to rise and to sparkle, and the flower leaves upward.
   */
  private beatsHarvest(i: number) {
    const p = PLOTS[i] ?? PLOTS[0];
    const ghost = this.takeGhost(i);

    this.player.setTexture("g_kneel_0");
    sfx.take();

    // cup it — the bloom leans into the hand
    this.rt(180, () => {
      if (ghost) {
        this.tweens.add({
          targets: ghost, scaleX: 0.515, scaleY: 0.515, angle: ghost.angle - 2,
          duration: 220, ease: "Sine.easeOut",
        });
      }
    });

    // snip
    this.rt(420, () => {
      this.player.setTexture("g_kneel_1");
      sfx.snip();
      this.sparkles.explode(10, p.x, p.y - 40);
    });

    // lift away, upward, trailing light
    this.rt(560, () => {
      if (ghost) {
        this.tweens.add({
          targets: ghost, y: p.y - 96, scaleX: 0.3, scaleY: 0.3, alpha: 0,
          duration: 420, ease: "Sine.easeOut",
        });
      }
      this.sparkles.explode(18, p.x, p.y - 56);
      this.rt(200, () => this.sparkles.explode(12, p.x, p.y - 86));
    });

    // stand, and leave the bed warm
    this.rt(900, () => {
      this.player.setTexture("g_idle_0");
      this.soilRing(p.x, p.y, 0xffd76e, 0.7, 420);
      sfx.sprout();
    });

    this.rt(1240, () => this.finishRitual());
  }

  /**
   * Sowing. The plant itself arrives with the state a moment later, so the
   * last beat opens a ring over the spot it lands in — the pop-in reads as
   * the seed taking rather than as a sprite appearing.
   */
  private beatsSow(i: number) {
    const p = PLOTS[i] ?? PLOTS[0];

    this.player.setTexture("g_kneel_0");
    sfx.take();

    // dig a hole
    this.rt(170, () => {
      sfx.press();
      this.soilPuff(p.x, p.y, 0.5);
      this.crumbs.explode(9, p.x, p.y + 2);
    });

    // the seed goes in
    this.rt(430, () => {
      const away = this.player.flipX ? -1 : 1;
      const seed = this.add
        .image(p.x + away * 16, p.y - 26, "seedbit")
        .setScale(0.9).setDepth(YARD + p.y + 0.4);
      this.ritualGhost?.destroy();
      sfx.press();
      this.tweens.add({
        targets: seed, x: p.x, y: p.y + 2, scaleX: 0.5, scaleY: 0.5, alpha: 0,
        duration: 240, ease: "Quad.easeIn", onComplete: () => seed.destroy(),
      });
    });

    // pat the earth down over it, twice
    this.rt(660, () => {
      this.player.setTexture("g_kneel_1");
      sfx.pat();
      this.crumbs.explode(4, p.x, p.y + 2);
      this.rt(130, () => { this.player?.setTexture("g_kneel_0"); this.crumbs.explode(4, p.x, p.y + 2); });
    });

    // stand up — the one place an elastic ease belongs in these beats
    this.rt(940, () => {
      this.player.setTexture("g_idle_0");
      sfx.sprout();
      this.soilRing(p.x, p.y, 0x8fe08a, 0.75, 420);
      this.sparkles.explode(10, p.x, p.y - 12);
    });

    this.rt(1250, () => this.finishRitual());
  }

  /**
   * Breaking new ground on a bed that has never been planted. The longest of
   * the four, because it is the largest thing a player can buy: this is not
   * a plant changing state, it is the garden itself getting bigger.
   *
   * It borrows the rake from clearing and the ring from sowing, but the
   * ladder RISES — 131 → 196 → 262 — where clearing's falls. Same hands,
   * opposite direction, which is the whole reason the grammar is shared.
   */
  private beatsBreak(i: number) {
    const p = PLOTS[i] ?? PLOTS[0];

    // the camera comes along: the new bed is somewhere he has never stood
    this.focusPlot(i, 1.5);

    this.player.setTexture("g_kneel_0");
    sfx.take();

    // turning the first sod
    this.rt(160, () => {
      sfx.uproot();
      this.soilPuff(p.x, p.y, 0.7);
      this.crumbs.explode(12, p.x, p.y + 2);
    });
    this.rt(460, () => {
      this.player.setTexture("g_kneel_1");
      this.soilPuff(p.x - 10, p.y, 0.55);
      this.crumbs.explode(10, p.x - 8, p.y + 2);
      this.tone_break(0);
    });
    this.rt(760, () => {
      this.player.setTexture("g_kneel_0");
      this.soilPuff(p.x + 12, p.y, 0.55);
      this.crumbs.explode(10, p.x + 10, p.y + 2);
      this.tone_break(1);
    });

    // rake it level, stand up
    this.rt(1060, () => {
      this.player.setTexture("g_rake_0");
      sfx.rake();
      this.rt(140, () => this.player?.setTexture("g_rake_1"));
      const sweep = this.add.graphics({ x: p.x, y: p.y + 4 }).setDepth(YARD + p.y - 0.55);
      sweep.fillStyle(0x6b4a30, 0.45);
      sweep.fillEllipse(0, 0, 34, 12);
      this.tweens.add({
        targets: sweep, scaleX: 2.3, scaleY: 1.3, alpha: 0,
        duration: 340, ease: "Cubic.easeOut", onComplete: () => sweep.destroy(),
      });
    });

    // the bed is real: a green ring, a burst, and the camera eases back out
    this.rt(1420, () => {
      this.player.setTexture("g_idle_0");
      this.tone_break(2);
      this.soilRing(p.x, p.y, 0x8fe08a, 0.8, 520);
      this.burstRing(p.x, p.y - 2, 0x8fe08a);
      this.sparkles.explode(26, p.x, p.y - 20);
      this.cameraPunch(0.014);
    });
    this.rt(1900, () => this.releaseFocus());
    this.rt(2100, () => this.finishRitual());
  }

  /** The rising ladder, the inverse of clearing's. Three rungs, one per sod. */
  private tone_break(step: number) {
    [sfx.press, sfx.take, sfx.sprout][step]?.call(sfx);
  }

  /**
   * `prefers-reduced-motion`: the fact still has to land, so it is the same
   * event with the travel taken out — one fade, one sound, no kneeling.
   */
  private quietRitual(i: number, kind: RitualKind) {
    const p = PLOTS[i] ?? PLOTS[0];
    if (kind === "sow" || kind === "break") {
      sfx.sprout();
      if (kind === "break") this.soilRing(p.x, p.y, 0x8fe08a, 0.8, 320);
    } else {
      const ghost = this.takeGhost(i);
      if (kind === "clear") sfx.uproot(); else sfx.snip();
      if (ghost) this.tweens.add({ targets: ghost, alpha: 0, duration: 220 });
    }
    this.rt(280, () => this.finishRitual());
  }

  /**
   * A new stage is a week of somebody's life, so it gets a real beat: soil
   * lifts, the plant springs taller than it will settle, a green ring opens
   * from the base and a ribbon names the stage that was just reached.
   */
  private stagePop(i: number) {
    const node = this.plotNodes[i];
    const img = node?.img;
    if (!img) return;
    const p = PLOTS[i] ?? PLOTS[0];

    // soil kicked up at the base
    this.soilPuff(p.x, p.y);

    // the growth spring — overshoot well past the resting size, then settle
    this.tweens.killTweensOf(img);
    img.setScale(0.3, 0.24);
    this.tweens.chain({
      targets: img,
      tweens: [
        { scaleX: 0.44, scaleY: 0.60, duration: 300, ease: "Back.easeOut" },
        { scaleX: 0.55, scaleY: 0.46, duration: 130, ease: "Sine.easeInOut" },
        { scaleX: 0.5, scaleY: 0.5, duration: 260, ease: "Elastic.easeOut" },
      ],
    });

    this.burstRing(p.x, p.y - 2, 0x8fe08a);
    this.sparkles.explode(34, p.x, p.y - 44);
    this.time.delayedCall(220, () => this.sparkles.explode(18, p.x, p.y - 74));
    this.cameraPunch(0.016);

    const stage = this.plotState(i)?.plant?.stage;
    if (stage) this.stageRibbon(p.x, p.y - 104, stage);
  }

  /** "Stage 4 of 7" — the growth you cannot see on the plant itself. */
  private stageRibbon(x: number, y: number, stage: number) {
    const label = this.add
      .text(x, y, `Stage ${stage} of 7`, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "21px",
        fontStyle: "bold",
        color: "#f2fff0",
        stroke: "#3e8e52",
        strokeThickness: 5,
      })
      .setOrigin(0.5).setDepth(966).setScale(0.4).setAlpha(0);
    const pips = this.add.graphics().setDepth(966).setAlpha(0);
    for (let k = 0; k < 7; k++) {
      pips.fillStyle(k < stage ? 0x8fe08a : 0xdfe9dd, 1);
      pips.fillCircle(x - 39 + k * 13, y + 20, k < stage ? 4.4 : 3);
    }
    this.tweens.chain({
      targets: [label, pips],
      tweens: [
        { alpha: 1, scale: 1, duration: 300, ease: "Back.easeOut" },
        { y: "-=26", alpha: 0, duration: 720, delay: 1000, ease: "Sine.easeIn" },
      ],
      onComplete: () => { label.destroy(); pips.destroy(); },
    });
  }

  /**
   * Crossing a gardener level used to happen in total silence — the number in
   * the Hall of Fame simply differed next time you looked. Now it lands.
   */
  celebrateLevel(level: number) {
    const CX = W / 2;
    const CY = 300;
    const rays = this.add.image(CX, CY, "ray")
      .setDepth(1198).setAlpha(0).setScale(1.4)
      .setTint(0xffe9a8).setBlendMode(Phaser.BlendModes.ADD);
    const spin = this.tweens.add({ targets: rays, angle: 360, duration: 7000, repeat: -1 });
    this.tweens.add({ targets: rays, alpha: { from: 0, to: 0.7 }, duration: 420 });

    const badge = this.add.graphics().setDepth(1199);
    badge.fillStyle(0xc9a227, 1); badge.fillCircle(CX, CY, 54);
    badge.fillStyle(0xffe9a8, 1); badge.fillCircle(CX, CY - 4, 46);
    badge.setScale(0.2).setAlpha(0);
    const num = this.add
      .text(CX, CY - 4, `${level}`, {
        fontFamily: "Trebuchet MS, sans-serif", fontSize: "52px",
        fontStyle: "bold", color: "#7a5a06",
      })
      .setOrigin(0.5).setDepth(1200).setScale(0.2).setAlpha(0);
    const cap = this.add
      .text(CX, CY + 84, `Level ${level} gardener`, {
        fontFamily: "Trebuchet MS, sans-serif", fontSize: "30px",
        fontStyle: "bold", color: "#fff8e6",
        stroke: "#a8791f", strokeThickness: 7,
      })
      .setOrigin(0.5).setDepth(1200).setAlpha(0);

    this.tweens.chain({
      targets: [badge, num],
      tweens: [
        { alpha: 1, scale: 1.14, duration: 420, ease: "Back.easeOut" },
        { scale: 1, duration: 200, ease: "Sine.easeOut" },
      ],
    });
    this.tweens.add({ targets: cap, alpha: 1, duration: 360, delay: 300 });
    this.confetti.explode(60, CX, CY);
    this.time.delayedCall(260, () => this.sparkles.explode(40, CX, CY));
    this.time.delayedCall(520, () => this.confetti.explode(40, CX - 150, CY + 30));
    this.time.delayedCall(660, () => this.confetti.explode(40, CX + 150, CY + 30));
    this.cameraPunch(0.03);

    this.time.delayedCall(2400, () => {
      this.tweens.add({
        targets: [badge, num, cap, rays], alpha: 0, duration: 520,
        onComplete: () => {
          spin.remove();
          [badge, num, cap, rays].forEach((o) => o.destroy());
        },
      });
    });
  }

  /**
   * The payoff for a week (or a month) of showing up: the plant lifts out of
   * its plot, fills the screen at full size while the garden dims behind it,
   * then settles back down and play resumes.
   */
  private celebrateBloom(i: number, variant?: string | null) {
    const plot = PLOTS[i] ?? PLOTS[0];
    const node = this.plotNodes[i];
    if (!node || this.celebrating) return;
    this.celebrating = true;
    // the celebration stages the whole world — pull the camera back out
    this.userZoom = 1;
    this.applyCamera(true);

    const sp = SPECIES_BY_KEY[this.plotState(i)?.plant?.species ?? ""];
    const plant = this.plotState(i)?.plant;
    const CX = W / 2;
    const CY = 350;
    const heroScale = sp ? bloomScale(sp.form, 300) : 1.5;
    const heroY = 500;

    const overlay = this.add.rectangle(CX, H / 2, W, H, 0x0c2b23, 0).setDepth(1200);
    const rays = this.add
      .image(CX, CY + 40, "ray")
      .setDepth(1201).setAlpha(0).setScale(1.9)
      .setBlendMode(Phaser.BlendModes.ADD);
    const glow = this.add
      .image(CX, CY + 40, "sunglow")
      .setDepth(1201).setAlpha(0).setScale(2.6)
      .setTint(0xffe0ee)
      .setBlendMode(Phaser.BlendModes.SCREEN);

    // the plant itself, lifted out of the plot
    const big = this.add
      .image(plot.x, plot.y, "plant_" + i)
      .setOrigin(node.img.originX, node.img.originY)
      .setScale(0.5)
      .setDepth(1202);
    node.img.setVisible(false);

    const font = '"Trebuchet MS", Verdana, system-ui, sans-serif';
    const vdef = variant ? VARIANT_BY_KEY[variant] : undefined;
    const title = this.add
      .text(CX, 108, vdef ? `${vdef.name}!` : "Full Bloom!", {
        fontFamily: font, fontSize: "58px", color: "#fff8fb",
        stroke: vdef ? "#a8791f" : "#c9527a", strokeThickness: 9,
      })
      .setOrigin(0.5).setDepth(1203).setAlpha(0).setScale(0.6);
    const sub = this.add
      .text(CX, 164, vdef ? `A ${vdef.rarity.toLowerCase()} ${sp?.name ?? ""}` : (sp?.name ?? ""), {
        fontFamily: font, fontSize: "27px", color: "#ffffff",
        stroke: "#3e8e52", strokeThickness: 6,
      })
      .setOrigin(0.5).setDepth(1203).setAlpha(0);
    const foot = this.add
      .text(CX, H - 46,
        vdef
          ? vdef.blurb
          : plant ? `${plant.dayNumber} days of care · +${sp?.points ?? 0} points` : "",
        { fontFamily: font, fontSize: "21px", color: "#fdf6e3" })
      .setOrigin(0.5).setDepth(1203).setAlpha(0);

    const spin = this.tweens.add({
      targets: rays, angle: 360, duration: 9000, repeat: -1,
    });

    // 1. dim the garden and lift the plant to centre stage
    this.tweens.add({ targets: overlay, fillAlpha: 0.55, duration: 320 });
    this.tweens.add({ targets: [rays, glow], alpha: { from: 0, to: 0.75 }, duration: 500 });
    this.tweens.add({
      targets: big,
      x: CX, y: heroY, scale: heroScale,
      duration: 780, ease: "Back.easeOut",
    });
    this.tweens.add({
      targets: title, alpha: 1, scale: 1, duration: 520, delay: 260,
      ease: "Back.easeOut",
    });
    this.tweens.add({ targets: [sub, foot], alpha: 1, duration: 420, delay: 460 });

    // 2. the fanfare
    this.confetti.explode(70, CX, CY - 40);
    this.time.delayedCall(260, () => this.sparkles.explode(vdef ? 60 : 34, CX, CY + 40));
    if (vdef) {
      this.time.delayedCall(520, () => this.confetti.explode(40, CX, CY));
      this.time.delayedCall(820, () => this.sparkles.explode(40, CX, CY - 30));
    }
    this.time.delayedCall(620, () => this.confetti.explode(60, CX - 180, CY - 20));
    this.time.delayedCall(760, () => this.confetti.explode(60, CX + 180, CY - 20));
    this.time.delayedCall(1150, () => this.sparkles.explode(26, CX, CY + 90));

    // a proud little bob while it is up there
    this.time.delayedCall(800, () => {
      if (!big.active) return;
      this.tweens.add({
        targets: big, y: heroY - 14, duration: 900, yoyo: true, repeat: 1,
        ease: "Sine.easeInOut",
      });
    });

    // 3. settle back into the plot and hand the garden back
    this.time.delayedCall(3000, () => {
      this.tweens.add({ targets: [title, sub, foot], alpha: 0, duration: 320 });
      this.tweens.add({ targets: [rays, glow], alpha: 0, duration: 420 });
      this.tweens.add({ targets: overlay, fillAlpha: 0, duration: 520, delay: 120 });
      this.tweens.add({
        targets: big,
        x: plot.x, y: plot.y, scale: 0.5,
        duration: 700, delay: 120, ease: "Cubic.easeInOut",
        onComplete: () => {
          node.img.setVisible(true);
          spin.remove();
          [overlay, rays, glow, big, title, sub, foot].forEach((o) => o.destroy());
          this.celebrating = false;
          this.happyWiggle(i);
        },
      });
    });
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

    // The sky belongs to BOTH clocks. This function repaints it every
    // minute, so a purely seasonal sky painted once would be gone before
    // anybody saw it — the two have to be mixed, not layered. Daylight
    // carries most of the season; a winter midnight and a summer midnight
    // are the same sky, so the bias fades out with the light.
    const bias = 0.45 * (1 - n);
    const sky = this.pal.sky.map((h) => parseInt(h.slice(1), 16));
    top = lerpColor(top, sky[0], bias);
    mid = lerpColor(mid, sky[1], bias);
    hor = lerpColor(hor, sky[2], bias);

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
