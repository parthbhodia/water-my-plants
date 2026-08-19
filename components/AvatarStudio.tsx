"use client";

import { useState } from "react";
import { type Avatar, SKINS, HAIRS, HATS, OUTFITS } from "@/game/avatar";
import AvatarPreview from "./AvatarPreview";

type Row = { key: keyof Avatar; label: string; swatches: Array<{ name: string; a: string; b: string }> };

const ROWS: Row[] = [
  { key: "skin", label: "Skin", swatches: SKINS.map((s) => ({ name: s.name, a: s.hi, b: s.lo })) },
  { key: "hair", label: "Hair", swatches: HAIRS.map((h) => ({ name: h.name, a: h.hi, b: h.lo })) },
  { key: "hat", label: "Headwear", swatches: HATS.map((h) => ({ name: h.name, a: h.a || "#e6e2d6", b: h.c || "#b9b3a2" })) },
  { key: "outfit", label: "Outfit", swatches: OUTFITS.map((o) => ({ name: o.name, a: o.shirtMid, b: o.ovMid })) },
];

export default function AvatarStudio({
  initial,
  onPreview,
  onSave,
  onClose,
}: {
  initial: Avatar;
  onPreview: (a: Avatar) => void;
  onSave: (a: Avatar) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Avatar>(initial);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof Avatar, value: number) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    onPreview(next); // live update in the game behind the modal
  };

  const randomize = () => {
    const next: Avatar = {
      skin: Math.floor(Math.random() * SKINS.length),
      hair: Math.floor(Math.random() * HAIRS.length),
      hat: Math.floor(Math.random() * HATS.length),
      outfit: Math.floor(Math.random() * OUTFITS.length),
    };
    setDraft(next);
    onPreview(next);
  };

  const cancel = () => {
    onPreview(initial); // revert the live preview
    onClose();
  };

  const save = async () => {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={cancel}>
      <div className="studio" onClick={(e) => e.stopPropagation()}>
        <div className="journal-head">
          <h2>🎨 Gardener Studio</h2>
          <button className="btn ghost small" onClick={cancel}>✕ close</button>
        </div>
        <p className="journal-sub">
          {SKINS.length * HAIRS.length * HATS.length * OUTFITS.length} combinations — drawn live with
          the same code the game uses.
        </p>

        <div className="studio-body">
          <div className="studio-stage">
            <div className="studio-podium">
              <AvatarPreview avatar={draft} size={150} />
            </div>
            <button className="btn ghost small" onClick={randomize}>🎲 Surprise me</button>
          </div>

          <div className="studio-options">
            {ROWS.map((row) => (
              <div key={row.key} className="opt-row">
                <div className="opt-label">
                  {row.label}
                  <span className="opt-name">{row.swatches[draft[row.key]]?.name ?? ""}</span>
                </div>
                <div className="swatch-row">
                  {row.swatches.map((s, i) => (
                    <button
                      key={s.name}
                      className={`swatch ${draft[row.key] === i ? "sel" : ""}`}
                      style={{ background: `linear-gradient(135deg, ${s.a} 0 50%, ${s.b} 50% 100%)` }}
                      onClick={() => set(row.key, i)}
                      title={s.name}
                      aria-label={`${row.label}: ${s.name}`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="studio-actions">
          <button className="btn ghost" onClick={cancel}>Cancel</button>
          <button className="btn" onClick={save} disabled={saving}>
            {saving ? "…" : "✓ Save gardener"}
          </button>
        </div>
      </div>
    </div>
  );
}
