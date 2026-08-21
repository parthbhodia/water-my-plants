"use client";

import { useEffect, useRef, useState } from "react";
import type { GameBridge } from "@/game/bridge";

export default function GameCanvas({ bridge }: { bridge: GameBridge }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [booted, setBooted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    let destroyed = false;
    let game: import("phaser").Game | null = null;
    // if nothing appears in 12s, offer a way out instead of an endless spinner
    const slowTimer = setTimeout(() => setSlow(true), 12000);

    (async () => {
      try {
        const Phaser = await import("phaser");
        const { GardenScene } = await import("@/game/GardenScene");
        if (destroyed || !hostRef.current) return;

        game = new Phaser.Game({
          // CANVAS, deliberately: every texture here is a painted canvas, and
          // iOS Safari's WebGL texture-memory ceiling kills the boot on
          // phones. The 2D renderer draws the same pixels without the GPU
          // upload — and without the crash.
          type: Phaser.CANVAS,
          parent: hostRef.current,
          backgroundColor: "#bfe7f2",
          scale: {
            mode: Phaser.Scale.RESIZE,
            autoCenter: Phaser.Scale.CENTER_BOTH,
          },
          render: { antialias: true, roundPixels: false },
          scene: [new GardenScene(bridge)],
        });
        setBooted(true);
        clearTimeout(slowTimer);
      } catch (e) {
        clearTimeout(slowTimer);
        console.error("game boot failed", e);
        setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      destroyed = true;
      clearTimeout(slowTimer);
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
          {error ? (
            <>
              <span className="boot-error">The garden gate is stuck: {error}</span>
              <button className="btn small" onClick={() => window.location.reload()}>
                Try again
              </button>
            </>
          ) : slow ? (
            <>
              watering the pixels…
              <button className="btn small" onClick={() => window.location.reload()}>
                Taking too long — reload
              </button>
            </>
          ) : (
            "watering the pixels…"
          )}
        </div>
      )}
    </>
  );
}
