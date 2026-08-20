"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/utils/supabase/client";
import { GameBridge } from "@/game/bridge";
import { sfx } from "@/game/audio";
import { type Avatar, DEFAULT_AVATAR, safeAvatar } from "@/game/avatar";
import type { CompletedLily, GardenState, PlotState, TendAction, TendResult } from "@/lib/types";
import { welcomeMessage, tendMessage } from "@/lib/messages";
import Hud from "./Hud";
import PlotBar from "./PlotBar";
import Journal from "./Journal";
import SeedPicker from "./SeedPicker";
import Leaderboard from "./Leaderboard";
import ShopPanel from "./ShopPanel";
import ProfilePanel from "./ProfilePanel";
import TabBar, { type PanelTab } from "./TabBar";
import TodayBrief from "./TodayBrief";
import DecorBar from "./DecorBar";

const GameCanvas = dynamic(() => import("./GameCanvas"), { ssr: false });

export default function GardenApp({ userEmail }: { userEmail: string }) {
  const supabase = useMemo(() => createClient(), []);
  const bridge = useMemo(() => new GameBridge(), []);
  const [state, setState] = useState<GardenState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [tab, setTab] = useState<PanelTab>("garden");
  const [seedFor, setSeedFor] = useState<PlotState | null>(null);
  const [completed, setCompleted] = useState<CompletedLily[] | null>(null);
  const [muted, setMuted] = useState(false);
  const [avatar, setAvatar] = useState<Avatar>(DEFAULT_AVATAR);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [briefKey, setBriefKey] = useState(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acting = useRef(false);

  const showToast = useCallback((msg: string, ms = 5600) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }, []);

  const applyState = useCallback(
    (s: GardenState) => {
      setState(s);
      bridge.setGarden(s);
      setBriefKey((k) => k + 1);
    },
    [bridge]
  );

  // ---- initial load ----
  useEffect(() => {
    sfx.init();
    setMuted(sfx.muted);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    supabase.rpc("get_garden_state", { p_timezone: timezone }).then(({ data, error }) => {
      if (error) {
        setError(error.message);
        return;
      }
      const s = data as GardenState;
      const av = safeAvatar(s.avatar);
      setAvatar(av);
      bridge.setAvatar(av);
      applyState(s);
      const firstInteresting = s.plots.findIndex(
        (p) => p.unlocked && p.plant && p.plant.thirsty && !p.plant.isBloomed
      );
      const fallback = s.plots.findIndex((p) => p.unlocked && p.plant);
      const pick = firstInteresting >= 0 ? firstInteresting : fallback >= 0 ? fallback : 0;
      setSelected(pick);
      bridge.select(pick);
      showToast(welcomeMessage(s), 7000);
    });
  }, [supabase, bridge, applyState, showToast]);

  // ---- scene -> React ----
  useEffect(() => {
    bridge.onPlotTapped = (i) => setSelected(i);
    bridge.onPourStart = async (plotIdx, action) => {
      if (acting.current) return;
      acting.current = true;
      setBusy(true);
      sfx.pour();
      try {
        const { data, error } = await supabase.rpc("tend_plant", {
          p_plot_idx: plotIdx,
          p_action: action,
        });
        if (error) throw new Error(error.message);
        const result = data as TendResult;
        setTimeout(() => {
          bridge.applyOutcome(result);
          if (result.state) setState(result.state);
          if (result.status === "watered" || result.status === "fed" || result.status === "pruned") {
            sfx.splash();
            if (result.bloomedNow) sfx.bloom();
            else if (result.grew) sfx.grow();
          } else {
            sfx.wiggle();
          }
          showToast(tendMessage(result));
          acting.current = false;
          setBusy(false);
        }, 850);
      } catch (e) {
        bridge.applyOutcome({ status: "error" });
        showToast("The watering can sprang a leak (network error). Try again!");
        acting.current = false;
        setBusy(false);
        void e;
      }
    };
    return () => {
      bridge.onPourStart = null;
      bridge.onPlotTapped = null;
    };
  }, [bridge, supabase, showToast]);

  // ---- actions ----
  const selectPlot = useCallback(
    (i: number) => {
      sfx.click();
      setSelected(i);
      bridge.select(i);
    },
    [bridge]
  );

  const tend = useCallback(
    (i: number, a: TendAction) => {
      if (busy) return;
      bridge.tend(i, a);
    },
    [bridge, busy]
  );

  const plantSeed = useCallback(
    async (key: string) => {
      if (!seedFor) return;
      setBusy(true);
      const { data, error } = await supabase.rpc("plant_seed", {
        p_plot_idx: seedFor.idx,
        p_species: key,
      });
      setBusy(false);
      setSeedFor(null);
      if (error) {
        showToast(error.message);
        return;
      }
      applyState(data as GardenState);
      sfx.grow();
      showToast("Planted! Keep to its schedule and it will thrive. 🌱");
    },
    [supabase, seedFor, applyState, showToast]
  );

  const clearPlot = useCallback(
    async (i: number) => {
      if (busy) return;
      setBusy(true);
      const { data, error } = await supabase.rpc("clear_plot", { p_plot_idx: i });
      setBusy(false);
      if (error) {
        showToast(error.message);
        return;
      }
      applyState(data as GardenState);
      sfx.click();
      showToast("Plot cleared and ready for a new seed. 🌱");
    },
    [supabase, applyState, showToast, busy]
  );

  const revivePlot = useCallback(
    async (i: number) => {
      if (busy) return;
      setBusy(true);
      const { data, error } = await supabase.rpc("revive_plant", { p_plot_idx: i });
      setBusy(false);
      if (error) { showToast(error.message); return; }
      applyState(data as GardenState);
      sfx.grow();
      showToast("The tonic works — it is alive again. Keep to its schedule this time! 🧪");
    },
    [supabase, applyState, showToast, busy]
  );

  const openJournal = useCallback(async () => {
    sfx.click();
    setJournalOpen(true);
    const { data } = await supabase
      .from("completed_lilies")
      .select("id, days_taken, waters, perfect, completed_at, species_id")
      .order("completed_at", { ascending: false });
    setCompleted((data as CompletedLily[]) ?? []);
  }, [supabase]);

  const saveAvatar = useCallback(
    async (a: Avatar) => {
      const { data, error } = await supabase.rpc("set_avatar", { p_avatar: a });
      if (error) {
        showToast("Couldn't save your gardener — try again!");
        bridge.setAvatar(avatar);
        return;
      }
      const saved = safeAvatar(data as Avatar);
      setAvatar(saved);
      bridge.setAvatar(saved);
      sfx.grow();
      showToast("Looking sharp! Your gardener is ready for the day. ✨");
    },
    [supabase, bridge, showToast, avatar]
  );

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

  const needCare = state
    ? state.plots.filter(
        (p) => p.plant && p.plant.thirsty && !p.plant.isBloomed && !p.plant.dead
      ).length
    : 0;

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

  return (
    <main className="garden-wrap">
      <div className="game-frame">
        <GameCanvas bridge={bridge} />

        {state && (
          <Hud
            state={state}
            muted={muted}
            onJournal={openJournal}
            onStudio={() => { sfx.click(); setTab("profile"); }}
            onLeague={() => { sfx.click(); setTab("league"); }}
            onToggleMute={toggleMute}
            onSignOut={signOut}
          />
        )}

        {!state && (
          <div className="game-loading">
            <div className="loading-drop" />
            finding your garden…
          </div>
        )}

        {toast && <div className="toast">{toast}</div>}
      </div>

      {state && (
        <div className="panel-wrap">
          <TabBar
            active={tab}
            onChange={(t) => { sfx.click(); setTab(t); }}
            badge={{ garden: needCare }}
          />
          <div className="panel-body">
            {tab === "garden" && <TodayBrief refreshKey={briefKey} />}
            {tab === "garden" && (
              <PlotBar
                state={state}
                selected={selected}
                busy={busy}
                onSelect={selectPlot}
                onTend={tend}
                onPlant={(p) => { sfx.click(); setSeedFor(p); }}
                onClear={clearPlot}
                onRevive={revivePlot}
              />
            )}
            {tab === "garden" && (
              <DecorBar state={state} onState={applyState} showToast={showToast} />
            )}
            {tab === "shop" && (
              <ShopPanel state={state} onBought={applyState} showToast={showToast} />
            )}
            {tab === "profile" && (
              <ProfilePanel
                state={state}
                avatar={avatar}
                onPreview={(a) => bridge.setAvatar(a)}
                onSave={saveAvatar}
                onState={applyState}
                showToast={showToast}
              />
            )}
            {tab === "league" && <Leaderboard showToast={showToast} />}
          </div>
        </div>
      )}

      {seedFor && state && (
        <SeedPicker
          plot={seedFor}
          unlocked={state.unlockedSpecies}
          dewdrops={state.dewdrops}
          busy={busy}
          onPlant={plantSeed}
          onClose={() => setSeedFor(null)}
        />
      )}

      {journalOpen && state && (
        <Journal state={state} completed={completed} onClose={() => setJournalOpen(false)} />
      )}
      <span style={{ display: "none" }} data-user={userEmail} />
    </main>
  );
}
