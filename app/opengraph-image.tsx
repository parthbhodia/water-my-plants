import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Lily Days — a free daily gardening game";

/**
 * The social card, drawn in code like everything else in this game. Rendered
 * at build time, so it costs nothing at request time and never 404s.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #bfe7f2 0%, #d9f2e4 62%, #cdeccd 100%)",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 190,
            background: "linear-gradient(180deg, #8fd48a 0%, #5faa4e 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 60,
            left: "50%",
            transform: "translateX(-50%)",
            width: 520,
            height: 150,
            borderRadius: 999,
            background: "#7fc8e8",
            border: "10px solid #cbb083",
          }}
        />
        <div style={{ display: "flex", fontSize: 150, marginBottom: 8 }}>🌸</div>
        <div
          style={{
            display: "flex",
            fontSize: 92,
            fontWeight: 900,
            color: "#2f4a3d",
            letterSpacing: -2,
          }}
        >
          Lily Days
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 36,
            color: "#3e8e52",
            fontWeight: 700,
            marginTop: 6,
          }}
        >
          A free daily gardening game
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 26,
            color: "#5b7566",
            marginTop: 18,
            zIndex: 1,
          }}
        >
          One watering a day · 8 species · a weekly league
        </div>
      </div>
    ),
    size
  );
}
