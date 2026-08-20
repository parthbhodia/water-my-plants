"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { type Avatar, SKINS, HAIRS, HAIRDOS, HATS, OUTFITS } from "@/game/avatar";
import { Dices, Check, Trophy, Droplets, Flower2 } from "lucide-react";
import type { GardenState } from "@/lib/types";
import AvatarPreview from "./AvatarPreview";

type Row = { key: keyof Avatar; label: string; swatches: Array<{ name: string; a: string; b: string }> };

const ROWS: Row[] = [
  { key: "skin", label: "Skin", swatches: SKINS.map((s) => ({ name: s.name, a: s.hi, b: s.lo })) },
  { key: "hair", label: "Hair colour", swatches: HAIRS.map((h) => ({ name: h.name, a: h.hi, b: h.lo })) },
  { key: "hat", label: "Headwear", swatches: HATS.map((h) => ({ name: h.name, a: h.a || "#e6e2d6", b: h.c || "#b9b3a2" })) },
  { key: "outfit", label: "Outfit", swatches: OUTFITS.map((o) => ({ name: o.name, a: o.shirtMid, b: o.ovMid })) },
];

export default function ProfilePanel({
  state,
  avatar,
  onPreview,
  onSave,
  onState,
  showToast,
}: {
  state: GardenState;
  avatar: Avatar;
  onPreview: (a: Avatar) => void;
  onSave: (a: Avatar) => Promise<void>;
  onState: (s: GardenState) => void;
  showToast: (m: string) => void;
}) {
  const [draft, setDraft] = useState<Avatar>(avatar);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(state.displayName ?? "");
  const [renaming, setRenaming] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(avatar);

  const set = (key: keyof Avatar, value: number) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    onPreview(next);
  };

  const randomize = () => {
    const next: Avatar = {
      skin: Math.floor(Math.random() * SKINS.length),
      hair: Math.floor(Math.random() * HAIRS.length),
      hairdo: Math.floor(Math.random() * HAIRDOS.length),
      hat: Math.floor(Math.random() * HATS.length),
      outfit: Math.floor(Math.random() * OUTFITS.length),
    };
    setDraft(next);
    onPreview(next);
  };

  const save = async () => {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
  };

  const rename = async () => {
    setRenaming(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("set_display_name", { p_name: name });
    setRenaming(false);
    if (error) { showToast(error.message); return; }
    onState(data as GardenState);
    showToast("Name changed. That was your one free change!");
  };

  return (
    <div className="profile">
      <div className="profile-top">
        <div className="studio-podium">
          <AvatarPreview avatar={draft} size={132} />
        </div>
        <div className="profile-facts">
          <h3>{state.displayName ?? "Gardener"}</h3>
          <div className="fact-row">
            <span className="fact"><b>Lv {state.level}</b> gardener</span>
            <span className="fact"><Droplets size={15} strokeWidth={2.5} aria-hidden /> <b>{state.dewdrops}</b> dewdrops</span>
            <span className="fact"><Trophy size={15} strokeWidth={2.5} aria-hidden /> <b>{state.gardenScore}</b> score</span>
            <span className="fact"><Flower2 size={15} strokeWidth={2.5} aria-hidden /> <b>{state.completedCount}</b> harvested</span>
          </div>
          <p className="profile-meta">
            Friend code <code>{state.friendCode}</code> · {state.timezone}
            {state.canChangeTimezone === false && state.timezoneChangeableOn
              ? ` · timezone locked until ${state.timezoneChangeableOn}`
              : ""}
          </p>

          {!state.nameChanged && (
            <div className="rename">
              <input
                value={name}
                maxLength={18}
                onChange={(e) => setName(e.target.value)}
                aria-label="Display name"
              />
              <button className="btn ghost small" disabled={renaming || name.length < 3} onClick={rename}>
                {renaming ? "…" : "Rename (once)"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="studio-options">
        <div className="opt-row">
          <div className="opt-label">Hairstyle</div>
          <div className="swatch-row">
            {HAIRDOS.map((h, i) => (
              <button
                key={h.name}
                className={`style-chip ${draft.hairdo === i ? "sel" : ""}`}
                onClick={() => set("hairdo", i)}
              >
                {h.name}
              </button>
            ))}
          </div>
        </div>
        {ROWS.map((row) => (
          <div key={row.key} className="opt-row">
            <div className="opt-label">
              {row.label}
              <span className="opt-name">— {row.swatches[draft[row.key]]?.name ?? ""}</span>
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

      <div className="profile-actions">
        <button className="btn ghost small" onClick={randomize}><Dices size={15} strokeWidth={2.4} aria-hidden /> Surprise me</button>
        <button className="btn small" onClick={save} disabled={!dirty || saving}>
          {saving ? "…" : dirty ? <><Check size={15} strokeWidth={2.8} aria-hidden /> Save gardener</> : "Saved"}
        </button>
      </div>
    </div>
  );
}
