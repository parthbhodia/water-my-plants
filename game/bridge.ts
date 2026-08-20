import type { GardenState, TendAction, TendResult } from "@/lib/types";
import type { Avatar } from "./avatar";

// Thin, framework-free bridge between React (state, network) and the Phaser scene.
export interface SceneApi {
  setGarden(s: GardenState): void;
  setAvatar(a: Avatar): void;
  requestTend(plotIdx: number, action: TendAction): void;
  selectPlot(i: number): void;
  applyOutcome(r: TendResult): void;
  setFrozen(v: boolean): void;
}

export class GameBridge {
  private sceneApi: SceneApi | null = null;
  private pendingState: GardenState | null = null;
  private pendingAvatar: Avatar | null = null;
  private frozen = false;

  /** React sets these */
  onPourStart: ((plotIdx: number, action: TendAction) => void) | null = null;
  onNearPond: ((near: boolean) => void) | null = null;
  onPlotTapped: ((plotIdx: number) => void) | null = null;

  /** Scene calls this once it's ready */
  ready(api: SceneApi) {
    this.sceneApi = api;
    if (this.pendingAvatar) api.setAvatar(this.pendingAvatar);
    if (this.pendingState) api.setGarden(this.pendingState);
    if (this.frozen) api.setFrozen(true);
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

  /** Stops the gardener responding to keys/taps while a modal is open. */
  setFrozen(v: boolean) {
    this.frozen = v;
    this.sceneApi?.setFrozen(v);
  }
}
