"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { FriendsState } from "@/lib/types";
import AvatarPreview from "./AvatarPreview";

export default function FriendsPanel({ showToast }: { showToast: (m: string) => void }) {
  const [data, setData] = useState<FriendsState | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.rpc("get_friends");
    if (data) setData(data as FriendsState);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    setBusy("add");
    const supabase = createClient();
    const { data: res, error } = await supabase.rpc("add_friend", { p_code: code.trim() });
    setBusy(null);
    if (error) { showToast(error.message); return; }
    setCode("");
    showToast(`${(res as { name: string }).name} is now a neighbour 🌿`);
    void load();
  };

  const visit = async (id: string, name: string) => {
    setBusy(id);
    const supabase = createClient();
    const { data: res, error } = await supabase.rpc("visit_water", { p_host: id });
    setBusy(null);
    if (error) { showToast(error.message); return; }
    const r = res as { status: string; reason?: string; dewEarned?: number };
    showToast(
      r.status === "watered"
        ? `You rescued a plant in ${name}'s garden. +${r.dewEarned} 💧 for you, 4 for them.`
        : r.reason ?? "Nothing to do there."
    );
    void load();
  };

  const copy = async () => {
    if (!data?.friendCode) return;
    try {
      await navigator.clipboard.writeText(data.friendCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { showToast(`Your code is ${data.friendCode}`); }
  };

  if (!data) return <p className="gallery-empty">Looking down the lane…</p>;

  return (
    <div className="friends">
      <div className="friend-code-card">
        <div>
          <span className="fc-label">Your friend code</span>
          <code className="fc-code">{data.friendCode}</code>
        </div>
        <button className="btn ghost small" onClick={copy}>{copied ? "✓ Copied" : "Copy"}</button>
      </div>

      <div className="friend-add">
        <input
          value={code}
          placeholder="Enter a friend's code"
          maxLength={12}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === "Enter" && code.length >= 6) void add(); }}
          aria-label="Friend code"
        />
        <button className="btn small" disabled={code.length < 6 || busy === "add"} onClick={add}>
          {busy === "add" ? "…" : "Add"}
        </button>
      </div>

      <p className="journal-sub">
        Looking in on a neighbour <b>rescues</b> their neediest plant — it stops the rot and
        buys them time, but only they can actually grow it. You both earn dewdrops. Once per
        neighbour per day.
      </p>

      {data.friends.length === 0 ? (
        <p className="gallery-empty">
          No neighbours yet. Swap codes with someone and you can look after each other&apos;s gardens.
        </p>
      ) : (
        <ul className="friend-list">
          {data.friends.map((f) => (
            <li key={f.id} className={`friend-row ${f.needsHelp > 0 ? "needs" : ""}`}>
              <span className="board-av"><AvatarPreview avatar={f.avatar} size={40} /></span>
              <div className="friend-meta">
                <b>{f.name}</b>
                <span>
                  Lv {f.level} · garden worth {f.gardenValue}
                  {f.needsHelp > 0 ? ` · ${f.needsHelp} struggling` : " · all well"}
                </span>
              </div>
              <button
                className={`btn small ${f.needsHelp > 0 ? "blue" : "ghost"}`}
                disabled={f.visitedToday || busy === f.id}
                onClick={() => visit(f.id, f.name)}
              >
                {f.visitedToday ? "✓ Visited" : busy === f.id ? "…" : "💧 Visit"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
