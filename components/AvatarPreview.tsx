"use client";

import { useEffect, useRef } from "react";
import {
  type Avatar,
  paintGardener,
  FRAME_W,
  FRAME_H,
  BODY_CX,
} from "@/game/avatar";

/**
 * Renders the gardener with the very same painter the Phaser scene uses,
 * so the preview can never drift from what appears in the garden.
 */
export default function AvatarPreview({
  avatar,
  size = 132,
  pose = "idle",
}: {
  avatar: Avatar;
  size?: number;
  pose?: "idle" | "pour";
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 3);
    // The body occupies the left ~80 logical units of the frame; crop to it
    // so the (empty, can-reserved) right margin doesn't off-centre the art.
    const cropW = 84;
    const cropH = FRAME_H;
    const scale = (size / cropW) * dpr;

    canvas.width = Math.round(cropW * scale);
    canvas.height = Math.round(cropH * scale);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${(size * cropH) / cropW}px`;

    const c = canvas.getContext("2d");
    if (!c) return;
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.save();
    c.scale(scale, scale);
    c.translate(cropW / 2 - BODY_CX, 0);
    paintGardener(
      c,
      pose === "pour"
        ? { legL: -0.08, legR: 0.12, armL: 0.3, armR: -1.85, can: { x: 74, y: 34, tilt: 0.6 } }
        : { legL: 0, legR: 0, armL: 0.12, armR: -0.12 },
      avatar
    );
    c.restore();
  }, [avatar, size, pose]);

  return <canvas ref={ref} className="avatar-canvas" aria-label="Your gardener" />;
}

export const AVATAR_FRAME = { FRAME_W, FRAME_H };
