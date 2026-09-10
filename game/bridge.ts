import type { GardenState, TendAction, TendResult } from "@/lib/types";
import type { Avatar } from "./avatar";

/**
 * The hands-on beats. All three share one shape — walk over, kneel, work,
 * stand — so the garden reads as one place with one pair of hands in it.
 */
export type RitualKind = "clear" | "harvest" | "sow" | "break";

// Thin, framework-free bridge between React (state, network) and the Phaser scene.
export interface SceneApi {
  setGarden(s: GardenState): void;
  setAvatar(a: Avatar): void;
  requestTend(plotIdx: number, action: TendAction): void;
  selectPlot(i: number): void;
  applyOutcome(r: TendResult): void;
  setFrozen(v: boolean): void;
  focusPlot(i: number, zoomMul?: number): void;
  setBottomInset(px: number): void;
  celebrateRound(count: number): void;
  celebrateLevel(level: number): void;
  ritual(plotIdx: number, kind: RitualKind, done: () => void): void;
  cancelRitual(): void;
  setReducedMotion(v: boolean): void;
  setCombo(n: number): void;
  releaseFocus(): void;
  setVisiting(v: boolean): void;
}

export class GameBridge {
  private sceneApi: SceneApi | null = null;
  private pendingState: GardenState | null = null;
  private pendingAvatar: Avatar | null = null;
  private frozen = false;
  private inset = 0;
  private reduced = false;
  private visiting = false;

  /** React sets these */
  onPourStart: ((plotIdx: number, action: TendAction) => void) | null = null;
  /** Fires when a "+N" reward finishes its flight into the wallet counter. */
  onDewBanked: ((dew: number) => void) | null = null;
  onNearPond: ((near: boolean) => void) | null = null;
  onPlotTapped: ((plotIdx: number) => void) | null = null;
  /** The padlock on the next bed was pressed — show what opens it. */
  onLockedPlotTapped: (() => void) | null = null;

  /** Scene calls this once it's ready */
  ready(api: SceneApi) {
    this.sceneApi = api;
    if (this.pendingAvatar) api.setAvatar(this.pendingAvatar);
    if (this.pendingState) api.setGarden(this.pendingState);
    if (this.frozen) api.setFrozen(true);
    if (this.inset) api.setBottomInset(this.inset);
    if (this.reduced) api.setReducedMotion(true);
    if (this.visiting) api.setVisiting(true);
  }

  detach() {
    this.sceneApi = null;
  }

  setGarden(s: GardenState) {
    this.pendingState = s;
    this.sceneApi?.setGarden(s);
  }

  setAvatar(a: Avatar) {
    this.pendingAvatar = a;
    this.sceneApi?.setAvatar(a);
  }

  tend(plotIdx: number, action: TendAction) {
    this.sceneApi?.requestTend(plotIdx, action);
  }

  select(plotIdx: number) {
    this.sceneApi?.selectPlot(plotIdx);
  }

  applyOutcome(r: TendResult) {
    this.sceneApi?.applyOutcome(r);
  }

  /** How many waterings deep the current round is (drives the flourish). */
  setCombo(n: number) {
    this.sceneApi?.setCombo(n);
  }

  /** The whole round finished — confetti over the garden. */
  celebrateLevel(level: number) {
    this.sceneApi?.celebrateLevel(level);
  }

  celebrateRound(count: number) {
    this.sceneApi?.celebrateRound(count);
  }

  /** Screen pixels of React chrome at the bottom; the camera avoids them. */
  setBottomInset(px: number) {
    this.inset = px;
    this.sceneApi?.setBottomInset(px);
  }

  /** Camera dive into one plot (guided planting) and back out. */
  focusPlot(i: number, zoomMul?: number) {
    this.sceneApi?.focusPlot(i, zoomMul);
  }

  releaseFocus() {
    this.sceneApi?.releaseFocus();
  }

  /**
   * Play the gardener actually doing the thing, and resolve when the beats
   * land. It ALWAYS resolves: the animation decorates a fact the server has
   * already committed, so it may never be the thing that stops a player
   * moving on — no scene, a boot failure or a hung tween all fall through
   * the watchdog instead of leaving the button dead.
   */
  ritual(kind: RitualKind, plotIdx: number): Promise<void> {
    const api = this.sceneApi;
    if (!api) return Promise.resolve();
    return new Promise<void>((resolve) => {
      let settled = false;
      const done = () => { if (!settled) { settled = true; resolve(); } };
      setTimeout(done, 6000);
      try { api.ritual(plotIdx, kind, done); } catch { done(); }
    });
  }

  /** The request failed — put the plant back and drop the beats. */
  cancelRitual() {
    this.sceneApi?.cancelRitual();
  }

  /** Honour the OS "reduce motion" setting: the beats collapse to a fade. */
  setReducedMotion(v: boolean) {
    this.reduced = v;
    this.sceneApi?.setReducedMotion(v);
  }

  /**
   * This garden belongs to somebody else.
   *
   * NOT the same thing as frozen. Frozen stops the gardener entirely, because
   * a modal is covering the yard; visiting leaves him free to WALK — wandering
   * a neighbour's garden is the whole point of being there — and only takes
   * away the things that invite you to act on it: the padlock on their next
   * bed, the seed-packet signs over their empty plots, the "plant here" rings,
   * and tending. The thirsty and dying rings deliberately stay: those are what
   * you came to see.
   */
  setVisiting(v: boolean) {
    this.visiting = v;
    this.sceneApi?.setVisiting(v);
  }

  /** Stops the gardener responding to keys/taps while a modal is open. */
  setFrozen(v: boolean) {
    this.frozen = v;
    this.sceneApi?.setFrozen(v);
  }
}
