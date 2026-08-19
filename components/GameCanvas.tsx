"use client";

import { useEffect, useRef, useState } from "react";
import type { GameBridge } from "@/game/bridge";

export default function GameCanvas({ bridge }: { bridge: GameBridge }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    let destroyed = false;
    let game: import("phaser").Game | null = null;

    (async () => {
      const Phaser = await import("phaser");
      const { GardenScene } = await import("@/game/GardenScene");
      if (destroyed || !hostRef.current) return;

      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: hostRef.current,
        width: 960,
        height: 600,
        backgroundColor: "#bfe7f2",
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        render: { antialias: true, roundPixels: false },
        scene: [new GardenScene(bridge)],
      });
      setBooted(true);
    })();

    return () => {
      destroyed = true;
      bridge.detach();
      game?.destroy(true);
    };
  }, [bridge]);

  return (
    <>
      <div ref={hostRef} className="game-host" />
      {!booted && (
        <div className="game-loading">
          <div className="loading-drop" />
          watering the pixels…
        </div>
      )}
    </>
  );
}
