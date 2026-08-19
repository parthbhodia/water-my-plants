"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/utils/supabase/client";
import { GameBridge } from "@/game/bridge";
import { sfx } from "@/game/audio";
import type { CompletedLily, GardenState, WaterResult } from "@/lib/types";
import { welcomeMessage, waterMessage } from "@/lib/messages";
import Hud from "./Hud";
import Journal from "./Journal";

const GameCanvas = dynamic(() => import("./GameCanvas"), { ssr: false });

export default function GardenApp({ userEmail }: { userEmail: string }) {
  const supabase = useMemo(() => createClient(), []);
  const bridge = useMemo(() => new GameBridge(), []);
  const [state, setState] = useState<GardenState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [completed, setCompleted] = useState<CompletedLily[] | null>(null);
  const [muted, setMuted] = useState(false);
  const [nearPond, setNearPond] = useState(false);
  const [replanting, setReplanting] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watering = useRef(false);

  const showToast = useCallback((msg: string, ms = 5200) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }, []);

  // Initial load
  useEffect(() => {
    sfx.init();
    setMuted(sfx.muted);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    supabase
      .rpc("get_garden_state", { p_timezone: timezone })
      .then(({ data, error }) => {
        if (error) {
          setError(error.message);
          return;
        }
        const s = data as GardenState;
        setState(s);
        bridge.setGarden(s);
        showToast(welcomeMessage(s), 6500);
      });
  }, [supabase, bridge, showToast]);

  // Scene → React wiring
  useEffect(() => {
    bridge.onNearPond = setNearPond;
    bridge.onPourStart = async () => {
      if (watering.current) return;
      watering.current = true;
      sfx.pour();
      try {
        const { data, error } = await supabase.rpc("water_lily");
        if (error) throw new Error(error.message);
        const result = data as WaterResult;
        // Let the pour animation breathe before the payoff
        setTimeout(() => {
          bridge.applyOutcome(result);
          if (result.state) {
            setState(result.state);
          }
          if (result.status === "watered") {
            sfx.splash();
            if (result.bloomedNow) sfx.bloom();
            else if (result.grew) sfx.grow();
          } else {
            sfx.wiggle();
          }
          showToast(
            waterMessage(result.status, result.grew, result.bloomedNow, result.wasWilted),
            6000
          );
          watering.current = false;
        }, 900);
      } catch (e) {
        bridge.applyOutcome({ status: "error" });
        showToast("Hmm, the watering can sprang a leak (network error). Try again!");
        watering.current = false;
        void e;
      }
    };
    return () => {
      bridge.onNearPond = null;
      bridge.onPourStart = null;
    };
  }, [bridge, supabase, showToast]);

  const openJournal = useCallback(async () => {
    sfx.click();
    setJournalOpen(true);
    const { data } = await supabase
      .from("completed_lilies")
      .select("id, days_taken, waters, perfect, completed_at")
      .order("completed_at", { ascending: false });
    setCompleted((data as CompletedLily[]) ?? []);
  }, [supabase]);

  const replant = useCallback(async () => {
    if (replanting) return;
    setReplanting(true);
    sfx.click();
    const { data, error } = await supabase.rpc("replant");
    setReplanting(false);
    if (error) {
      showToast("Couldn't replant just now — try again!");
      return;
    }
    const result = data as WaterResult;
    if (result.state) {
      setState(result.state);
      bridge.setGarden(result.state);
    }
    showToast("A brand-new seed settles into the pond. Day 1 begins again! 🫘", 6000);
  }, [supabase, bridge, showToast, replanting]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  }, [supabase]);

  const toggleMute = useCallback(() => {
    const next = !sfx.muted;
    sfx.setMuted(next);
    setMuted(next);
    if (!next) sfx.click();
  }, []);

  if (error) {
    return (
      <main className="garden-wrap">
        <div className="error-box">
          <h2>🥀 Oh dear</h2>
          <p>The garden gate is stuck: {error}</p>
          <button className="btn" onClick={() => window.location.reload()}>Try again</button>
        </div>
      </main>
    );
  }

  const canWater = !!state && !state.wateredToday && !state.isBloomed;

  return (
    <main className="garden-wrap">
      <div className="game-frame">
        <GameCanvas bridge={bridge} />

        {state && (
          <Hud
            state={state}
            muted={muted}
            onJournal={openJournal}
            onToggleMute={toggleMute}
            onSignOut={signOut}
          />
        )}

        {!state && (
          <div className="game-loading">
            <div className="loading-drop" />
            finding your pond…
          </div>
        )}

        {toast && <div className="toast">{toast}</div>}

        {state?.isBloomed && (
          <div className="bloom-banner">
            <h3>🌸 Full Bloom!</h3>
            <p>
              Grown in {state.dayNumber} day{state.dayNumber === 1 ? "" : "s"} with{" "}
              {state.waters} waterings{state.missedDays === 0 ? " — a perfect streak! ✨" : "."}
              <br />
              Your lily will be pressed into the journal when you replant.
            </p>
            <button className="btn pink" onClick={replant} disabled={replanting}>
              {replanting ? "…" : "🫘 Plant a new seed"}
            </button>
          </div>
        )}

        <div className="hud-bottom">
          {state && !state.isBloomed && (
            <button
              className={`btn blue water-btn ${canWater ? "" : "done"}`}
              onClick={() => {
                if (canWater) bridge.water();
                else showToast("Already watered today! Come back tomorrow 🌙");
              }}
            >
              {canWater ? "💧 Water the lily" : "✓ Watered today"}
            </button>
          )}
          <div className="key-hints">
            ← → / A D walk · E or Space to water{nearPond ? " · you're by the pond!" : ""}
          </div>
        </div>
      </div>

      {journalOpen && state && (
        <Journal state={state} completed={completed} onClose={() => setJournalOpen(false)} />
      )}
      <span style={{ display: "none" }} data-user={userEmail} />
    </main>
  );
}
