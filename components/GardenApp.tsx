"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/utils/supabase/client";
import { GameBridge } from "@/game/bridge";
import { sfx, music, MUSIC_MODES, type MusicMode } from "@/game/audio";
import { type Avatar, DEFAULT_AVATAR, safeAvatar } from "@/game/avatar";
import type { CompletedLily, GardenState, PlotState, TendAction, TendResult } from "@/lib/types";
import { welcomeMessage, welcomeMood, tendMessage, tendMood } from "@/lib/messages";
import type { GuideMood } from "@/game/guide";
import { GUIDE_NAME } from "@/game/guide";
import GuidePortrait from "./GuidePortrait";
import Hud from "./Hud";
import PlotBar from "./PlotBar";
import Journal from "./Journal";
import SeedPicker from "./SeedPicker";
import Leaderboard from "./Leaderboard";
import ShopPanel from "./ShopPanel";
import ProfilePanel from "./ProfilePanel";
import TabBar, { type PanelTab } from "./TabBar";
import LeagueRail from "./LeagueRail";
import TodayBrief from "./TodayBrief";
import DecorBar from "./DecorBar";
import RestorePanel from "./RestorePanel";
import WeeklyGift from "./WeeklyGift";
import Tutorial from "./Tutorial";
import CoachMarks from "./CoachMarks";
import HintRing from "./HintRing";

const GameCanvas = dynamic(() => import("./GameCanvas"), { ssr: false });

export default function GardenApp({ userEmail }: { userEmail: string }) {
  const supabase = useMemo(() => createClient(), []);
  const bridge = useMemo(() => new GameBridge(), []);
  const [state, setState] = useState<GardenState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; mood: GuideMood } | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [tab, setTab] = useState<PanelTab>("garden");
  const [seedFor, setSeedFor] = useState<PlotState | null>(null);
  const [completed, setCompleted] = useState<CompletedLily[] | null>(null);
  const [muted, setMuted] = useState(false);
  const [musicOn, setMusicOn] = useState(true);
  const [musicMode, setMusicMode] = useState<MusicMode>("meadow");
  const [avatar, setAvatar] = useState<Avatar>(DEFAULT_AVATAR);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [briefKey, setBriefKey] = useState(0);
  const [tutorial, setTutorial] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rotateHint, setRotateHint] = useState(true);
  const [coach, setCoach] = useState(false);
  const [guided, setGuided] = useState<null | "water">(null);
  const guidedRef = useRef<null | "water">(null);
  useEffect(() => { guidedRef.current = guided; }, [guided]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acting = useRef(false);

  const showToast = useCallback((msg: string, ms = 5600, mood: GuideMood = "happy") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text: msg, mood });
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
    music.init();
    setMuted(sfx.muted);
    setMusicOn(music.on);
    setMusicMode(music.mode);
    const kick = () => music.start();
    window.addEventListener("pointerdown", kick, { once: true });
    return () => window.removeEventListener("pointerdown", kick);
  }, []);

  useEffect(() => {
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
      if (s.tutorialDone === false) setTutorial(true);
      else showToast(welcomeMessage(s), 7000, welcomeMood(s));
    });
  }, [supabase, bridge, applyState, showToast]);

  // The gardener should not wander behind an open modal.
  useEffect(() => {
    bridge.setFrozen(tutorial || seedFor !== null || journalOpen);
  }, [bridge, tutorial, seedFor, journalOpen]);

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
          if (guidedRef.current === "water" && result.status === "watered") {
            guidedRef.current = null;
            setGuided(null);
            try { window.localStorage.setItem("lily-guided-done", "1"); } catch {}
            showToast("That's the whole ritual — one drink, once a day. She'll be taller tomorrow. 🌱", 9000, "proud");
            setTimeout(() => {
              bridge.releaseFocus();
              // the tour of the interface waits until the close-up is over
              try {
                if (!window.localStorage.getItem("lily-coach-done")) setCoach(true);
              } catch {}
            }, 3200);
          } else {
            showToast(tendMessage(result, state?.displayName), 5600, tendMood(result));
          }
          acting.current = false;
          setBusy(false);
        }, 850);
      } catch (e) {
        bridge.applyOutcome({ status: "error" });
        showToast("The watering can sprang a leak (network error). Try again!", 5600, "worry");
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
      const wasFirstSeed = !state?.plots.some((p) => p.plant);
      applyState(data as GardenState);
      sfx.grow();
      let guide = false;
      try { guide = wasFirstSeed && !window.localStorage.getItem("lily-guided-done"); } catch {}
      if (guide) {
        setSelected(seedFor.idx);
        bridge.select(seedFor.idx);
        bridge.focusPlot(seedFor.idx);
        setGuided("water");
        showToast("There she is! Now the first drink — press Water. 💧", 12000, "cheer");
      } else {
        showToast("Planted! Keep to its schedule and it will thrive. 🌱");
      }
    },
    [supabase, seedFor, applyState, showToast, state, bridge]
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
    if (next) music.stop();
    else { sfx.click(); music.start(); }
  }, []);

  // one button, four states: each press moves to the next record, then off
  const cycleMusic = useCallback(() => {
    sfx.click();
    if (!music.on) {
      music.setMode(MUSIC_MODES[0].key);
      setMusicOn(true);
      setMusicMode(MUSIC_MODES[0].key);
      showToast(`Granny put on "${MUSIC_MODES[0].name}". 🎶`, 3500, "happy");
      return;
    }
    const i = MUSIC_MODES.findIndex((m) => m.key === music.mode);
    if (i < MUSIC_MODES.length - 1) {
      const next = MUSIC_MODES[i + 1];
      music.setMode(next.key);
      setMusicMode(next.key);
      showToast(`Granny put on "${next.name}". 🎶`, 3500, "happy");
    } else {
      music.setOn(false);
      setMusicOn(false);
      showToast("Granny lifted the needle — just the garden now.", 3500, "sleepy");
    }
  }, [showToast]);

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
      <div className="garden-shell">
      <div className="garden-main">
      <div className="game-frame">
        <GameCanvas bridge={bridge} />

        {state && (
          <Hud
            state={state}
            muted={muted}
            onJournal={openJournal}
            onStudio={() => { sfx.click(); setTab("profile"); }}
            onLeague={() => { sfx.click(); setTab("league"); }}
            onHelp={() => { sfx.click(); setTutorial(true); }}
            onToggleMute={toggleMute}
            onToggleMusic={cycleMusic}
            musicOn={musicOn}
            musicName={MUSIC_MODES.find((m) => m.key === musicMode)?.name ?? ""}
            onSignOut={signOut}
          />
        )}

        {!state && (
          <div className="game-loading">
            <div className="loading-drop" />
            finding your garden…
          </div>
        )}

        {state && !tutorial && (
          <div className="key-hints">W A S D / arrows to walk · E to water</div>
        )}

        {state && rotateHint && (
          <button className="rotate-chip" onClick={() => setRotateHint(false)}>
            Rotate for full screen ↻
          </button>
        )}

        {toast && (
          <div className="toast guide-toast">
            <GuidePortrait mood={toast.mood} size={54} />
            <div className="guide-toast-text">
              <span className="guide-name">{GUIDE_NAME}</span>
              {toast.text}
            </div>
          </div>
        )}
      </div>

      {state && (
        <div className={`panel-wrap${sheetOpen ? " sheet-open" : ""}`}>
          <button
            className="sheet-handle"
            onClick={() => setSheetOpen((o) => !o)}
            aria-label={sheetOpen ? "Hide panel" : "Show panel"}
          >
            <span />
          </button>
          <TabBar
            active={tab}
            onChange={(t) => { sfx.click(); setTab(t); }}
            badge={{ garden: needCare }}
          />
          <div className="panel-body">
            {tab === "garden" && <TodayBrief refreshKey={briefKey} />}
            {tab === "garden" && (
              <WeeklyGift refreshKey={briefKey} onState={applyState} showToast={showToast} />
            )}
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
            {tab === "garden" && (
              <RestorePanel state={state} onState={applyState} showToast={showToast} />
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

      </div>

      {state && (
        <LeagueRail refreshKey={briefKey} onOpenFull={() => { sfx.click(); setTab("league"); }} />
      )}
      </div>

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

      {tutorial && state && (
        <Tutorial
          avatar={avatar}
          onDone={(plant) => {
            setTutorial(false);
            setState((s) => (s ? { ...s, tutorialDone: true } : s));
            try {
              // if they chose "plant my first seed", the guided close-up runs
              // first and hands over to the coach afterwards
              if (!plant && !window.localStorage.getItem("lily-coach-done")) setCoach(true);
            } catch { if (!plant) setCoach(true); }
            if (plant) {
              const first =
                state.plots.find((p) => p.unlocked && !p.plant) ??
                state.plots.find((p) => p.unlocked) ??
                null;
              if (first && !first.plant) {
                setSelected(first.idx);
                bridge.select(first.idx);
                setSeedFor(first);
                return;
              }
            }
            showToast(welcomeMessage(state), 7000, welcomeMood(state));
          }}
        />
      )}

      {guided === "water" && <HintRing sel=".plot-buttons .btn.blue" />}

      {coach && state && !seedFor && !guided && (
        <CoachMarks
          onDone={() => {
            setCoach(false);
            try { window.localStorage.setItem("lily-coach-done", "1"); } catch {}
          }}
        />
      )}

      {journalOpen && state && (
        <Journal state={state} completed={completed} onClose={() => setJournalOpen(false)} />
      )}
      <span style={{ display: "none" }} data-user={userEmail} />
    </main>
  );
}
