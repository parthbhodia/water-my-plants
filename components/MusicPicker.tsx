"use client";

import { Music, VolumeX, Check, X } from "lucide-react";
import { music, sfx, MUSIC_MODES, type MusicMode } from "@/game/audio";

/**
 * Granny's record shelf. Six loops, all generated — pick one or turn the
 * whole thing off. Cycling through them on a single HUD button worked when
 * there were three; with six nobody would ever find the one they wanted.
 */
export default function MusicPicker({
  open,
  current,
  isOn,
  onPick,
  onClose,
}: {
  open: boolean;
  current: MusicMode;
  isOn: boolean;
  onPick: (mode: MusicMode | "off") => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Music">
      <div className="music-sheet" onClick={(e) => e.stopPropagation()}>
        <header className="ms-head">
          <h2><Music size={19} strokeWidth={2.4} aria-hidden /> Music</h2>
          <button className="ms-close" onClick={onClose} aria-label="Close">
            <X size={20} strokeWidth={2.6} aria-hidden />
          </button>
        </header>
        <p className="ms-sub">
          Every track is played by the garden itself — no recordings, just a
          little band of oscillators. Pick whatever suits the day.
        </p>

        <ul className="ms-list">
          {MUSIC_MODES.map((m) => {
            const active = isOn && current === m.key;
            return (
              <li key={m.key}>
                <button
                  className={`ms-row${active ? " on" : ""}`}
                  onClick={() => { sfx.click(); onPick(m.key); }}
                  aria-pressed={active}
                >
                  <span className="ms-eq" aria-hidden>
                    <i /><i /><i />
                  </span>
                  <span className="ms-text">
                    <b>{m.name}</b>
                    <em>{m.blurb}</em>
                  </span>
                  {active && <Check size={18} strokeWidth={3} className="ms-tick" aria-hidden />}
                </button>
              </li>
            );
          })}
          <li>
            <button
              className={`ms-row quiet${!isOn ? " on" : ""}`}
              onClick={() => { sfx.click(); onPick("off"); }}
              aria-pressed={!isOn}
            >
              <span className="ms-eq off" aria-hidden><VolumeX size={17} strokeWidth={2.5} /></span>
              <span className="ms-text">
                <b>Silence</b>
                <em>Just the garden. Sound effects stay on.</em>
              </span>
              {!isOn && <Check size={18} strokeWidth={3} className="ms-tick" aria-hidden />}
            </button>
          </li>
        </ul>

        {isOn && !music.playing && (
          <p className="ms-nudge">
            Your phone holds sound until you touch the screen — tap a track and
            it will start.
          </p>
        )}
      </div>
    </div>
  );
}
