import * as Phaser from "phaser";
import type { GameBridge, SceneApi } from "./bridge";
import type { GardenState, WaterResult } from "@/lib/types";

// ---------- palette ----------
const C = {
  grassTop: 0x9fd98a,
  grassBot: 0x6cbf6e,
  grassDark: 0x4da35b,
  pondRim: 0xd9c38a,
  pondDeep: 0x3f9bc4,
  pond: 0x7fc8e8,
  pondLight: 0xa5dcf2,
  leaf: 0x58b368,
  leafDark: 0x3e8e52,
  leafLight: 0x8ed69b,
  wiltLeaf: 0x9aa96b,
  wiltDark: 0x7c8a55,
  petal: 0xf7a8c4,
  petalMid: 0xf492b6,
  petalDeep: 0xee7fa9,
  wiltPetal: 0xd8a8b4,
  sun: 0xffd76e,
  sunDeep: 0xffb63e,
  skin: 0xffd9b3,
  cheek: 0xf7a8a0,
  hair: 0x6b4a2f,
  hat: 0xe8c268,
  hatBand: 0xc98d4b,
  shirt: 0xe58f65,
  overalls: 0x6f8ab3,
  overallsDark: 0x5a7299,
  boot: 0x8a5a3b,
  can: 0x9ec9dd,
  canDark: 0x7fb0c9,
  wallCream: 0xf4e3c2,
  roof: 0xd96c5f,
  roofDark: 0xc25a4e,
  door: 0x8a5a3b,
  fence: 0xe8dcc0,
  fenceDark: 0xcbbd9c,
  trunk: 0x8a6543,
  canopy: 0x5cb46a,
  canopyDark: 0x479a58,
  path: 0xe5d5a8,
  seed: 0x8b693e,
  seedLight: 0xc9a86a,
  drop: 0xcfeafa,
  night: 0x101d3f,
};

const W = 960;
const H = 600;
const POND_X = 480;
const POND_Y = 468;
const POND_RX = 175;
const POND_RY = 58;
const FEET_Y = 546;

// sky keyframes across the day: hour, top color, bottom color, night factor
const SKY_STOPS: Array<[number, number, number, number]> = [
  [0, 0x0e1f42, 0x27406b, 1],
  [4.5, 0x0e1f42, 0x27406b, 1],
  [6.5, 0xffa07e, 0xffdfae, 0.25],
  [9, 0x8fd0ee, 0xc9ecf7, 0],
  [16.5, 0x8fd0ee, 0xc9ecf7, 0],
  [18.75, 0xff9068, 0xffc98a, 0.15],
  [20.5, 0x1b2c55, 0x3a5382, 0.9],
  [24, 0x0e1f42, 0x27406b, 1],
];

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  );
}

type Pose = {
  legL: number; legR: number; armL: number; armR: number;
  blink?: boolean; can?: boolean; canTilt?: number;
};

export class GardenScene extends Phaser.Scene implements SceneApi {
  private bridge: GameBridge;
  private garden: GardenState | null = null;

  private skyG!: Phaser.GameObjects.Graphics;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private starC!: Phaser.GameObjects.Container;
  private sunC!: Phaser.GameObjects.Container;
  private moonC!: Phaser.GameObjects.Container;
  private windowGlows: Phaser.GameObjects.Rectangle[] = [];
  private rippleG!: Phaser.GameObjects.Graphics;
  private lilyC!: Phaser.GameObjects.Container;
  private lilyG!: Phaser.GameObjects.Graphics;
  private hintDrop!: Phaser.GameObjects.Image;
  private player!: Phaser.GameObjects.Sprite;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private sparkles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private confetti!: Phaser.GameObjects.Particles.ParticleEmitter;
  private droplets!: Phaser.GameObjects.Particles.ParticleEmitter;
  private butterflies: Array<{ s: Phaser.GameObjects.Sprite; tx: number; ty: number; seed: number }> = [];
  private fireflies: Array<{ s: Phaser.GameObjects.Image; a: number; seed: number }> = [];
  private dragonfly!: Phaser.GameObjects.Image;
  private shimmer: Array<{ x: number; y: number; w: number }> = [];
  private burstRipples: Array<{ t0: number }> = [];

  private autoTarget: number | null = null;
  private pendingPour = false;
  private pouring = false;
  private nearPond = false;
  private nightF = 0;
  private pourSafety: Phaser.Time.TimerEvent | null = null;

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

    // input
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

    this.applyTimeOfDay();
    this.time.addEvent({ delay: 60000, loop: true, callback: () => this.applyTimeOfDay() });

    // occasional bird
    const spawnBird = () => {
      this.launchBird();
      this.time.delayedCall(Phaser.Math.Between(16000, 38000), spawnBird);
    };
    this.time.delayedCall(Phaser.Math.Between(4000, 9000), spawnBird);

    this.bridge.ready(this);
  }

  update(time: number) {
    this.updatePlayer();
    this.updatePond(time);
    this.updateCritters(time);
    this.updateHint();
  }

  // ================= bridge api =================

  setGarden(s: GardenState) {
    const prev = this.garden;
    this.garden = s;
    if (!prev || prev.plantId !== s.plantId || prev.stage !== s.stage || prev.wilted !== s.wilted) {
      this.redrawLily();
    }
  }

  requestWater() {
    if (this.pouring) return;
    const side = this.player.x < POND_X ? POND_X - 182 : POND_X + 182;
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
        if (grew && r.state.stage !== prevStage) {
          this.stagePop();
        }
        if (r.bloomedNow) this.celebrateBloom();
        this.happyWiggle();
      } else {
        this.happyWiggle();
      }
    }
  }

  // ================= textures =================

  private makeTextures() {
    const g = this.add.graphics();
    g.setVisible(false);

    // --- gardener frames ---
    const poses: Array<[string, Pose]> = [
      ["g_idle_0", { legL: 0, legR: 0, armL: 0.12, armR: -0.12 }],
      ["g_idle_1", { legL: 0, legR: 0, armL: 0.12, armR: -0.12, blink: true }],
      ["g_walk_0", { legL: -0.5, legR: 0.5, armL: 0.55, armR: -0.4 }],
      ["g_walk_1", { legL: -0.18, legR: 0.18, armL: 0.2, armR: -0.15 }],
      ["g_walk_2", { legL: 0.5, legR: -0.5, armL: -0.4, armR: 0.55 }],
      ["g_walk_3", { legL: 0.18, legR: -0.18, armL: -0.15, armR: 0.2 }],
      ["g_pour_0", { legL: -0.08, legR: 0.12, armL: 0.9, armR: 1.0, can: true, canTilt: -0.15 }],
      ["g_pour_1", { legL: -0.08, legR: 0.12, armL: 1.05, armR: 1.15, can: true, canTilt: -0.75 }],
    ];
    for (const [key, pose] of poses) {
      g.clear();
      this.paintGardener(g, pose);
      g.generateTexture(key, 96, 104);
    }

    // --- cloud ---
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(80, 42, 110, 44);
    g.fillEllipse(45, 32, 62, 40);
    g.fillEllipse(115, 30, 70, 42);
    g.fillEllipse(80, 24, 56, 36);
    g.generateTexture("cloud", 160, 64);

    // --- canopy (tree top) ---
    g.clear();
    g.fillStyle(C.canopyDark, 1);
    g.fillCircle(60, 70, 42);
    g.fillCircle(30, 84, 30);
    g.fillCircle(92, 84, 32);
    g.fillStyle(C.canopy, 1);
    g.fillCircle(56, 62, 38);
    g.fillCircle(30, 76, 26);
    g.fillCircle(88, 76, 28);
    g.fillStyle(0x86cf8e, 1);
    g.fillCircle(48, 54, 18);
    g.generateTexture("canopy", 120, 120);

    // --- grass tuft ---
    g.clear();
    g.fillStyle(C.grassDark, 1);
    g.fillTriangle(2, 24, 8, 24, 4, 4);
    g.fillTriangle(9, 24, 16, 24, 13, 0);
    g.fillTriangle(17, 24, 23, 24, 21, 6);
    g.fillStyle(C.grassBot, 1);
    g.fillTriangle(5, 24, 11, 24, 8, 7);
    g.fillTriangle(13, 24, 19, 24, 16, 3);
    g.generateTexture("tuft", 26, 25);

    // --- flowers (three colorways) ---
    const flowerCols = [C.petal, C.sun, 0xc9a7e8];
    flowerCols.forEach((col, i) => {
      g.clear();
      g.lineStyle(3, C.leafDark, 1);
      g.beginPath(); g.moveTo(10, 30); g.lineTo(10, 14); g.strokePath();
      g.fillStyle(C.leaf, 1);
      g.fillEllipse(6, 24, 8, 4);
      g.fillStyle(col, 1);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        g.fillCircle(10 + Math.cos(a) * 5.5, 10 + Math.sin(a) * 5.5, 4);
      }
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(10, 10, 3.2);
      g.generateTexture("flower_" + i, 20, 32);
    });

    // --- spark (4-point star) ---
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

    // --- droplet ---
    g.clear();
    g.fillStyle(C.drop, 1);
    g.fillCircle(4, 5, 3.4);
    g.fillTriangle(0.8, 4.4, 7.2, 4.4, 4, 0);
    g.generateTexture("drop", 8, 9);

    // --- petal confetti ---
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(0, 0, 10, 6, 3);
    g.generateTexture("petalbit", 10, 6);

    // --- butterfly frames ---
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

    // --- dragonfly ---
    g.clear();
    g.fillStyle(0x63c6c9, 1);
    g.fillEllipse(16, 6, 18, 3.4);
    g.fillCircle(25, 6, 3);
    g.fillStyle(0xffffff, 0.55);
    g.fillEllipse(12, 2.5, 12, 3);
    g.fillEllipse(16, 9.5, 12, 3);
    g.generateTexture("dragonfly", 30, 12);

    // --- bird frames ---
    g.clear();
    g.lineStyle(3, 0x3d4a5c, 1);
    g.beginPath(); g.moveTo(0, 8); g.lineTo(9, 2); g.lineTo(18, 8); g.strokePath();
    g.generateTexture("bird_0", 18, 10);
    g.clear();
    g.lineStyle(3, 0x3d4a5c, 1);
    g.beginPath(); g.moveTo(0, 2); g.lineTo(9, 7); g.lineTo(18, 2); g.strokePath();
    g.generateTexture("bird_1", 18, 10);

    // --- firefly glow ---
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
    this.anims.create({
      key: "pour",
      frames: [{ key: "g_pour_0" }, { key: "g_pour_1" }],
      frameRate: 3,
      repeat: -1,
    });
    this.anims.create({
      key: "flutter",
      frames: [{ key: "bfly_0" }, { key: "bfly_1" }],
      frameRate: 10,
      repeat: -1,
    });
    this.anims.create({
      key: "flap",
      frames: [{ key: "bird_0" }, { key: "bird_1" }],
      frameRate: 7,
      repeat: -1,
    });
  }

  /** draws the gardener into a 96x104 frame, feet at (48, 100) */
  private paintGardener(g: Phaser.GameObjects.Graphics, p: Pose) {
    const cx = 48;
    // legs
    const leg = (hipX: number, ang: number) => {
      g.save();
      g.translateCanvas(hipX, 66);
      g.rotateCanvas(ang);
      g.fillStyle(C.overalls, 1);
      g.fillRoundedRect(-5.5, 0, 11, 28, 5);
      g.fillStyle(C.boot, 1);
      g.fillRoundedRect(-6.5, 24, 15, 9, 4);
      g.restore();
    };
    leg(cx - 8, p.legL);
    leg(cx + 8, p.legR);

    // body (overalls + shirt sides)
    g.fillStyle(C.shirt, 1);
    g.fillRoundedRect(cx - 19, 36, 38, 22, 9);
    g.fillStyle(C.overalls, 1);
    g.fillRoundedRect(cx - 17, 44, 34, 28, 8);
    g.fillStyle(C.overallsDark, 1);
    g.fillRect(cx - 12, 36, 6, 12);
    g.fillRect(cx + 6, 36, 6, 12);
    g.fillStyle(0xf7d774, 1);
    g.fillCircle(cx - 9, 46, 2);
    g.fillCircle(cx + 9, 46, 2);
    // pocket
    g.fillStyle(C.overallsDark, 1);
    g.fillRoundedRect(cx - 7, 52, 14, 10, 4);

    // arms
    const arm = (shX: number, ang: number, front: boolean) => {
      g.save();
      g.translateCanvas(shX, 42);
      g.rotateCanvas(ang);
      g.fillStyle(front ? C.shirt : 0xd57f58, 1);
      g.fillRoundedRect(-4.5, 0, 9, 24, 4.5);
      g.fillStyle(C.skin, 1);
      g.fillCircle(0, 24, 4.5);
      g.restore();
    };
    arm(cx - 16, p.armL, false);
    arm(cx + 16, p.armR, true);

    // watering can, held out to the right
    if (p.can) {
      g.save();
      g.translateCanvas(cx + 27, 62);
      g.rotateCanvas(p.canTilt ?? 0);
      g.fillStyle(C.can, 1);
      g.fillRoundedRect(-2, -9, 22, 17, 5);
      g.fillStyle(C.canDark, 1);
      g.fillRoundedRect(-2, -9, 22, 5, { tl: 5, tr: 5, bl: 0, br: 0 });
      // spout
      g.fillStyle(C.can, 1);
      g.fillTriangle(19, -4, 30, -13, 24, 1);
      g.fillStyle(C.canDark, 1);
      g.fillEllipse(29, -13, 7, 4);
      // handle
      g.lineStyle(3, C.canDark, 1);
      g.beginPath();
      g.arc(8, -10, 7, Math.PI, 0, false);
      g.strokePath();
      g.restore();
    }

    // head
    g.fillStyle(C.hair, 1);
    g.fillCircle(cx, 22, 15.5);
    g.fillStyle(C.skin, 1);
    g.fillCircle(cx, 24, 14);
    // cheeks
    g.fillStyle(C.cheek, 0.7);
    g.fillCircle(cx - 8.5, 28, 3);
    g.fillCircle(cx + 8.5, 28, 3);
    // eyes
    if (p.blink) {
      g.lineStyle(2, 0x2f2a26, 1);
      g.beginPath(); g.moveTo(cx - 8, 24); g.lineTo(cx - 3, 24); g.strokePath();
      g.beginPath(); g.moveTo(cx + 3, 24); g.lineTo(cx + 8, 24); g.strokePath();
    } else {
      g.fillStyle(0x2f2a26, 1);
      g.fillCircle(cx - 5.5, 24, 2.2);
      g.fillCircle(cx + 5.5, 24, 2.2);
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(cx - 4.8, 23.2, 0.8);
      g.fillCircle(cx + 6.2, 23.2, 0.8);
    }
    // smile
    g.lineStyle(2, 0x9c5b4a, 1);
    g.beginPath();
    g.arc(cx, 27.5, 5, 0.35, Math.PI - 0.35, false);
    g.strokePath();
    // straw hat
    g.fillStyle(C.hat, 1);
    g.fillEllipse(cx, 13, 42, 11);
    g.fillEllipse(cx, 8, 24, 14);
    g.fillStyle(C.hatBand, 1);
    g.fillRect(cx - 12, 8, 24, 4);
  }

  // ================= world building =================

  private buildSky() {
    this.skyG = this.add.graphics().setDepth(0);

    // stars
    this.starC = this.add.container(0, 0).setDepth(1);
    for (let i = 0; i < 42; i++) {
      const s = this.add.circle(
        Phaser.Math.Between(8, W - 8),
        Phaser.Math.Between(8, 330),
        Phaser.Math.FloatBetween(0.8, 1.9),
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

    // sun
    this.sunC = this.add.container(0, 0).setDepth(2);
    const glow1 = this.add.circle(0, 0, 46, C.sun, 0.18);
    const glow2 = this.add.circle(0, 0, 34, C.sun, 0.3);
    const core = this.add.circle(0, 0, 26, C.sun, 1);
    const core2 = this.add.circle(-6, -6, 10, 0xfff2bf, 0.8);
    this.sunC.add([glow1, glow2, core, core2]);
    this.tweens.add({ targets: [glow1, glow2], scale: 1.12, duration: 2600, yoyo: true, repeat: -1 });

    // moon
    this.moonC = this.add.container(0, 0).setDepth(2);
    const mglow = this.add.circle(0, 0, 34, 0xdfe8ff, 0.15);
    const moon = this.add.circle(0, 0, 22, 0xf2f0dc, 1);
    const crater1 = this.add.circle(-6, 2, 4.5, 0xd9d6bd, 1);
    const crater2 = this.add.circle(7, -6, 3, 0xd9d6bd, 1);
    const crater3 = this.add.circle(4, 9, 2.4, 0xd9d6bd, 1);
    this.moonC.add([mglow, moon, crater1, crater2, crater3]);

    // clouds
    for (let i = 0; i < 4; i++) {
      const c = this.add
        .image(Phaser.Math.Between(0, W), 50 + i * 62 + Phaser.Math.Between(-14, 14), "cloud")
        .setDepth(3)
        .setAlpha(0.86 - i * 0.13)
        .setScale(1.15 - i * 0.2);
      c.setData("vx", 9 - i * 1.7);
    }
    this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        this.children.list.forEach((obj) => {
          const img = obj as Phaser.GameObjects.Image;
          if (img.texture && img.texture.key === "cloud") {
            img.x += (img.getData("vx") as number) * 0.05;
            if (img.x > W + 110) img.x = -110;
          }
        });
      },
    });

    // night tint above everything scenic
    this.nightOverlay = this.add
      .rectangle(W / 2, H / 2, W, H, C.night, 0)
      .setDepth(60);
  }

  private buildScenery() {
    const g = this.add.graphics().setDepth(4);

    // ground
    g.fillGradientStyle(C.grassTop, C.grassTop, C.grassBot, C.grassBot, 1);
    g.fillRect(0, 372, W, H - 372);
    // horizon fringe
    g.fillStyle(C.grassDark, 0.35);
    for (let x = 0; x < W; x += 18) {
      g.fillEllipse(x + 9, 374, 22, 8);
    }

    // dirt path house -> pond
    g.fillStyle(C.path, 0.85);
    const px = [200, 250, 300, 348, 392];
    const py = [420, 438, 456, 470, 482];
    for (let i = 0; i < px.length; i++) {
      g.fillEllipse(px[i], py[i], 64 - i * 6, 22 - i * 2);
    }

    // house
    const hg = this.add.graphics().setDepth(5);
    const hx = 128, hy = 372; // door base
    hg.fillStyle(C.wallCream, 1);
    hg.fillRoundedRect(hx - 80, hy - 110, 160, 112, { tl: 6, tr: 6, bl: 0, br: 0 });
    hg.fillStyle(C.roof, 1);
    hg.fillTriangle(hx - 96, hy - 104, hx + 96, hy - 104, hx, hy - 168);
    hg.fillStyle(C.roofDark, 1);
    hg.fillRect(hx - 96, hy - 108, 192, 8);
    // chimney
    hg.fillStyle(C.roofDark, 1);
    hg.fillRect(hx + 38, hy - 156, 18, 34);
    hg.fillStyle(0xb5544a, 1);
    hg.fillRect(hx + 35, hy - 160, 24, 8);
    // door
    hg.fillStyle(C.door, 1);
    hg.fillRoundedRect(hx - 18, hy - 54, 36, 56, { tl: 14, tr: 14, bl: 0, br: 0 });
    hg.fillStyle(0xf7d774, 1);
    hg.fillCircle(hx + 9, hy - 26, 3);
    // windows
    const winAt = (wx: number) => {
      hg.fillStyle(0xffffff, 1);
      hg.fillRoundedRect(wx - 15, hy - 92, 30, 28, 5);
      const glow = this.add
        .rectangle(wx, hy - 78, 26, 24, C.sun, 0.12)
        .setDepth(5);
      this.windowGlows.push(glow);
      hg.lineStyle(3, 0xd9c38a, 1);
      hg.strokeRoundedRect(wx - 15, hy - 92, 30, 28, 5);
      hg.lineBetween(wx, hy - 92, wx, hy - 64);
      hg.lineBetween(wx - 15, hy - 78, wx + 15, hy - 78);
    };
    winAt(hx - 44);
    winAt(hx + 44);
    // flower boxes under windows
    hg.fillStyle(C.roofDark, 1);
    hg.fillRect(hx - 61, hy - 62, 34, 7);
    hg.fillRect(hx + 27, hy - 62, 34, 7);

    // fence across the yard
    const fg = this.add.graphics().setDepth(6);
    for (let x = 6; x < W; x += 30) {
      if (x > hx - 92 && x < hx + 92) continue; // skip behind house
      fg.fillStyle(C.fence, 1);
      fg.fillRoundedRect(x, 344, 10, 40, 3);
      fg.fillTriangle(x, 346, x + 10, 346, x + 5, 336);
    }
    fg.fillStyle(C.fenceDark, 1);
    fg.fillRect(0, 352, W, 5);
    fg.fillRect(0, 368, W, 5);

    // trees (trunk static, canopy sways)
    const tree = (tx: number, scale: number) => {
      const tg = this.add.graphics().setDepth(7);
      tg.fillStyle(C.trunk, 1);
      tg.fillRoundedRect(tx - 9 * scale, 330, 18 * scale, 62 * scale, 6);
      tg.fillStyle(0x6d4e33, 1);
      tg.fillRect(tx - 2, 340, 4 * scale, 30 * scale);
      const canopy = this.add
        .image(tx, 336, "canopy")
        .setOrigin(0.5, 0.82)
        .setScale(scale * 1.15)
        .setDepth(7);
      this.tweens.add({
        targets: canopy,
        angle: { from: -1.6, to: 1.6 },
        duration: Phaser.Math.Between(2600, 3400),
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    };
    tree(852, 1.25);
    tree(936, 0.85);
    tree(288, 0.7);

    // scattered flowers + swaying grass tufts
    const spots: Array<[number, number]> = [];
    let guard = 0;
    while (spots.length < 26 && guard++ < 300) {
      const x = Phaser.Math.Between(16, W - 16);
      const y = Phaser.Math.Between(392, 584);
      const dx = (x - POND_X) / (POND_RX + 46);
      const dy = (y - POND_Y) / (POND_RY + 34);
      if (dx * dx + dy * dy < 1) continue; // keep off the pond
      if (x > hx - 90 && x < hx + 90 && y < 402) continue;
      spots.push([x, y]);
    }
    spots.forEach(([x, y], i) => {
      const isFlower = i % 3 === 0;
      const texKey = isFlower ? "flower_" + ((((i / 3) | 0)) % 3) : "tuft";
      const img = this.add
        .image(x, y, texKey)
        .setOrigin(0.5, 1)
        .setDepth(y > 500 ? 13 : 6.5)
        .setScale(Phaser.Math.FloatBetween(0.85, 1.3));
      this.tweens.add({
        targets: img,
        angle: { from: -4, to: 4 },
        duration: Phaser.Math.Between(1500, 2600),
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
        delay: Phaser.Math.Between(0, 1200),
      });
    });
  }

  private buildPond() {
    const g = this.add.graphics().setDepth(8);
    // sandy rim
    g.fillStyle(C.pondRim, 1);
    g.fillEllipse(POND_X, POND_Y + 2, POND_RX * 2 + 26, POND_RY * 2 + 22);
    g.fillStyle(0xc4ad74, 1);
    g.fillEllipse(POND_X, POND_Y + 4, POND_RX * 2 + 14, POND_RY * 2 + 12);
    // water
    g.fillStyle(C.pondDeep, 1);
    g.fillEllipse(POND_X, POND_Y, POND_RX * 2, POND_RY * 2);
    g.fillStyle(C.pond, 1);
    g.fillEllipse(POND_X, POND_Y - 3, POND_RX * 2 - 22, POND_RY * 2 - 16);
    g.fillStyle(C.pondLight, 0.55);
    g.fillEllipse(POND_X - 34, POND_Y - 12, POND_RX * 1.05, POND_RY * 0.9);

    // a couple of resting pads at the edges
    g.fillStyle(C.leafDark, 0.9);
    g.fillEllipse(POND_X - 118, POND_Y + 18, 44, 16);
    g.fillEllipse(POND_X + 128, POND_Y - 14, 36, 13);
    g.fillStyle(C.leaf, 0.9);
    g.fillEllipse(POND_X - 120, POND_Y + 16, 38, 13);
    g.fillEllipse(POND_X + 126, POND_Y - 16, 30, 10);

    // cattails on the right bank
    g.lineStyle(3, C.leafDark, 1);
    g.beginPath(); g.moveTo(POND_X + 168, POND_Y + 34); g.lineTo(POND_X + 176, POND_Y - 16); g.strokePath();
    g.beginPath(); g.moveTo(POND_X + 184, POND_Y + 36); g.lineTo(POND_X + 188, POND_Y - 4); g.strokePath();
    g.fillStyle(0x9c6b45, 1);
    g.fillRoundedRect(POND_X + 172, POND_Y - 34, 8, 20, 4);
    g.fillRoundedRect(POND_X + 184, POND_Y - 20, 7, 17, 3.5);

    this.rippleG = this.add.graphics().setDepth(9);

    // fixed shimmer dashes
    for (let i = 0; i < 6; i++) {
      this.shimmer.push({
        x: POND_X + Phaser.Math.Between(-120, 120),
        y: POND_Y + Phaser.Math.Between(-24, 26),
        w: Phaser.Math.Between(14, 34),
      });
    }
  }

  private buildLily() {
    this.lilyC = this.add.container(POND_X, POND_Y).setDepth(10);
    this.lilyG = this.add.graphics();
    this.lilyC.add(this.lilyG);
    this.tweens.add({
      targets: this.lilyC,
      y: POND_Y - 4,
      duration: 2100,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.hintDrop = this.add
      .image(POND_X, POND_Y - 92, "drop")
      .setScale(2.6)
      .setDepth(10)
      .setAlpha(0);
    this.tweens.add({
      targets: this.hintDrop,
      y: POND_Y - 102,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.redrawLily();
  }

  private buildGardener() {
    this.player = this.add
      .sprite(200, FEET_Y, "g_idle_0")
      .setOrigin(0.5, 0.96)
      .setDepth(12);
    this.player.play("idle");

    // occasional blink
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
    // butterflies
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

    // dragonfly darting near the pond
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

    // fireflies (night only)
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

    this.droplets = this.add.particles(0, 0, "drop", {
      speedX: { min: 12, max: 46 },
      speedY: { min: 30, max: 80 },
      gravityY: 420,
      lifespan: 620,
      quantity: 2,
      frequency: 34,
      scale: { min: 0.7, max: 1.15 },
      alpha: { start: 0.95, end: 0.25 },
      emitting: false,
    }).setDepth(14);
  }

  // ================= lily drawing =================

  private redrawLily() {
    const g = this.lilyG;
    g.clear();
    const s = this.garden?.stage ?? 0;
    const wilted = this.garden?.wilted ?? false;

    const leaf = wilted ? C.wiltLeaf : C.leaf;
    const leafDark = wilted ? C.wiltDark : C.leafDark;
    const leafLight = wilted ? 0xb5bd8a : C.leafLight;
    const petal = wilted ? C.wiltPetal : C.petal;
    const petalMid = wilted ? 0xcf9aab : C.petalMid;
    const petalDeep = wilted ? 0xc08c9d : C.petalDeep;
    const droop = wilted ? 0.35 : 0;

    const pad = (x: number, y: number, r: number) => {
      g.fillStyle(leafDark, 1);
      g.fillEllipse(x, y, r * 2, r * 0.76);
      g.fillStyle(leaf, 1);
      g.fillEllipse(x, y - 1.5, r * 2 - 6, r * 0.76 - 4);
      // notch
      g.fillStyle(wilted ? 0x8fa06a : C.pond, 1);
      g.fillTriangle(x, y - 1, x - r + 2, y - r * 0.3, x - r + 2, y + r * 0.26);
      g.fillStyle(leafLight, 0.5);
      g.fillEllipse(x + r * 0.25, y - 3, r * 0.8, r * 0.24);
    };

    const stemTo = (topY: number, lean: number) => {
      g.lineStyle(5, leafDark, 1);
      g.beginPath();
      g.moveTo(0, 4);
      g.lineTo(lean, topY);
      g.strokePath();
    };

    const sideLeaves = (y: number) => {
      g.save();
      g.translateCanvas(-7, y);
      g.rotateCanvas(-0.5 - droop);
      g.fillStyle(leaf, 1);
      g.fillEllipse(-8, 0, 22, 9);
      g.restore();
      g.save();
      g.translateCanvas(7, y);
      g.rotateCanvas(0.5 + droop);
      g.fillStyle(leafLight, 1);
      g.fillEllipse(8, 0, 22, 9);
      g.restore();
    };

    if (s === 0) {
      // seed resting in the shallows
      g.fillStyle(0x6d5731, 0.4);
      g.fillEllipse(0, 6, 26, 9);
      g.fillStyle(C.seed, 1);
      g.fillEllipse(0, 1, 15, 12);
      g.fillStyle(C.seedLight, 1);
      g.fillEllipse(-3.4, -2.2, 5, 3.4);
    } else if (s === 1) {
      stemTo(-24 + droop * 14, wilted ? 7 : 0);
      sideLeaves(-20 + droop * 12);
    } else if (s === 2) {
      pad(0, 2, 26);
      g.save();
      g.translateCanvas(9, 0);
      g.rotateCanvas(0.24 + droop);
      g.lineStyle(4, leafDark, 1);
      g.beginPath(); g.moveTo(0, 0); g.lineTo(3, -20); g.strokePath();
      g.fillStyle(leafLight, 1);
      g.fillEllipse(6, -22, 15, 7);
      g.restore();
    } else if (s === 3) {
      pad(-4, 2, 37);
      pad(34, 8, 17);
      g.fillStyle(leafLight, 0.6);
      g.fillEllipse(-10, -1, 30, 6);
    } else if (s === 4) {
      pad(-8, 3, 36);
      pad(32, 9, 16);
      stemTo(-40 + droop * 20, wilted ? 10 : 3);
      g.save();
      g.translateCanvas(wilted ? 10 : 3, -46 + droop * 22);
      g.rotateCanvas(droop);
      g.fillStyle(leaf, 1);
      g.fillEllipse(0, 0, 15, 24);
      g.fillStyle(leafLight, 1);
      g.fillEllipse(0, -2, 8, 15);
      g.restore();
    } else if (s === 5) {
      pad(-10, 3, 38);
      pad(34, 9, 17);
      stemTo(-48 + droop * 22, wilted ? 11 : 2);
      g.save();
      g.translateCanvas(wilted ? 12 : 2, -54 + droop * 24);
      g.rotateCanvas(droop);
      // sepals
      g.fillStyle(leaf, 1);
      g.fillEllipse(-6, 3, 10, 20);
      g.fillEllipse(6, 3, 10, 20);
      // blushing bud
      g.fillStyle(petal, 1);
      g.fillEllipse(0, -2, 16, 24);
      g.fillStyle(petalDeep, 1);
      g.fillEllipse(0, -6, 8, 15);
      g.restore();
    } else {
      // FULL BLOOM
      pad(0, 5, 42);
      pad(44, 12, 18);
      pad(-46, 12, 15);
      stemTo(-44, 0);
      g.save();
      g.translateCanvas(0, -52);
      // outer petals
      for (let k = 0; k < 8; k++) {
        g.save();
        g.rotateCanvas((k * Math.PI) / 4 + 0.39);
        g.fillStyle(k % 2 === 0 ? petal : petalMid, 1);
        g.fillEllipse(0, -15, 13, 30);
        g.restore();
      }
      // inner petals
      for (let k = 0; k < 4; k++) {
        g.save();
        g.rotateCanvas((k * Math.PI) / 2);
        g.fillStyle(petalDeep, 1);
        g.fillEllipse(0, -10, 11, 21);
        g.restore();
      }
      // golden heart
      g.fillStyle(C.sun, 1);
      g.fillCircle(0, 0, 8);
      g.fillStyle(C.sunDeep, 1);
      g.fillCircle(0, 0, 4.5);
      g.restore();
    }

    this.lilyC.setAngle(wilted ? 3 : 0);
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

    // action keys
    if (this.keys && (Phaser.Input.Keyboard.JustDown(this.keys.E) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE))) {
      this.requestWater();
    }

    // near-pond notification
    const near = Math.abs(this.player.x - POND_X) < 215;
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
      this.droplets.setPosition(this.player.x + dir * 34, this.player.y - 42);
      this.droplets.start();
    });

    // tell React to fire the RPC
    this.bridge.onPourStart?.();

    // safety: never stay stuck pouring
    this.pourSafety?.remove();
    this.pourSafety = this.time.delayedCall(8000, () => this.endPour());
  }

  private endPour() {
    if (!this.pouring) return;
    this.pouring = false;
    this.pourSafety?.remove();
    this.pourSafety = null;
    this.droplets.stop();
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

  private updatePond(time: number) {
    const g = this.rippleG;
    g.clear();

    // looping idle ripples
    for (let i = 0; i < 3; i++) {
      const p = ((time / 3400) + i / 3) % 1;
      const a = 0.3 * (1 - p) * (this.nightF > 0.6 ? 0.5 : 1);
      g.lineStyle(2, 0xffffff, a);
      g.strokeEllipse(POND_X, POND_Y, (36 + 250 * p), (36 + 250 * p) * 0.34);
    }

    // watering burst ripples
    this.burstRipples = this.burstRipples.filter((r) => {
      const t = (time - r.t0) / 1100;
      if (t >= 1) return false;
      g.lineStyle(3, 0xffffff, 0.55 * (1 - t));
      g.strokeEllipse(POND_X, POND_Y, 20 + 200 * t, (20 + 200 * t) * 0.34);
      return true;
    });

    // shimmer
    for (let i = 0; i < this.shimmer.length; i++) {
      const sh = this.shimmer[i];
      const a = 0.14 + 0.12 * Math.sin(time / 640 + i * 1.7);
      g.fillStyle(0xffffff, Math.max(0, a));
      g.fillRect(sh.x - sh.w / 2, sh.y, sh.w, 2);
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

    // fireflies wander at night
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
    const h = now.getHours() + now.getMinutes() / 60;

    let top = SKY_STOPS[0][1];
    let bot = SKY_STOPS[0][2];
    let n = SKY_STOPS[0][3];
    for (let i = 0; i < SKY_STOPS.length - 1; i++) {
      const a = SKY_STOPS[i];
      const b = SKY_STOPS[i + 1];
      if (h >= a[0] && h <= b[0]) {
        const t = (h - a[0]) / (b[0] - a[0] || 1);
        top = lerpColor(a[1], b[1], t);
        bot = lerpColor(a[2], b[2], t);
        n = a[3] + (b[3] - a[3]) * t;
        break;
      }
    }
    this.nightF = n;

    this.skyG.clear();
    this.skyG.fillGradientStyle(top, top, bot, bot, 1);
    this.skyG.fillRect(0, 0, W, 384);

    // sun arc (5:30 → 19:30)
    const dayT = (h - 5.5) / 14;
    if (dayT > 0 && dayT < 1) {
      this.sunC.setVisible(true);
      this.sunC.setPosition(70 + dayT * (W - 140), 330 - Math.sin(dayT * Math.PI) * 240);
    } else {
      this.sunC.setVisible(false);
    }

    // moon arc (19:30 → 5:30)
    const hh = h < 12 ? h + 24 : h;
    const nightT = (hh - 19.5) / 10;
    if (nightT > 0 && nightT < 1) {
      this.moonC.setVisible(true);
      this.moonC.setPosition(70 + nightT * (W - 140), 320 - Math.sin(nightT * Math.PI) * 230);
    } else {
      this.moonC.setVisible(false);
    }

    this.starC.setAlpha(n);
    this.nightOverlay.setFillStyle(C.night, 0.34 * n);
    for (const w of this.windowGlows) {
      w.setFillStyle(C.sun, 0.12 + 0.72 * n);
    }
  }
}
