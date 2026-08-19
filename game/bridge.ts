import type { GardenState, WaterResult } from "@/lib/types";

// Thin, framework-free bridge between React (state, network) and the Phaser scene.
export interface SceneApi {
  setGarden(s: GardenState): void;
  requestWater(): void; // walk to pond + pour
  applyOutcome(r: WaterResult): void;
}

export class GameBridge {
  private sceneApi: SceneApi | null = null;
  private pendingState: GardenState | null = null;

  /** React sets these */
  onPourStart: (() => void) | null = null; // scene began pouring -> React fires the RPC
  onNearPond: ((near: boolean) => void) | null = null;

  /** Scene calls this once it's ready */
  ready(api: SceneApi) {
    this.sceneApi = api;
    if (this.pendingState) api.setGarden(this.pendingState);
  }

  detach() {
    this.sceneApi = null;
  }

  setGarden(s: GardenState) {
    this.pendingState = s;
    this.sceneApi?.setGarden(s);
  }

  water() {
    this.sceneApi?.requestWater();
  }

  applyOutcome(r: WaterResult) {
    this.sceneApi?.applyOutcome(r);
  }
}
