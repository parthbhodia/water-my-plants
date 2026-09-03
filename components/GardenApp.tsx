"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/utils/supabase/client";
import { GameBridge } from "@/game/bridge";
import { RotateCw, X } from "lucide-react";
import { sfx, music, MUSIC_MODES, type MusicMode } from "@/game/audio";
import { type Avatar, DEFAULT_AVATAR, safeAvatar } from "@/game/avatar";
import type { CompletedLily, GardenState, PlotState, TendAction, TendResult } from "@/lib/types";
import { welcomeMessage, welcomeMood, tendMessage, tendMood } from "@/lib/messages";
import { canWaterNow } from "@/lib/species";
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
import NextStep from "./NextStep";
import MusicPicker from "./MusicPicker";
import LevelBar from "./LevelBar";
import ReminderSettings from "./ReminderSettings";
import PlantCard from "./PlantCard";
import WaterFab from "./WaterFab";
import WeeklyGift from "./WeeklyGift";
import Tutorial from "./Tutorial";
import CoachMarks from "./CoachMarks";
import HintRing from "./HintRing";

const GameCanvas = dynamic(() => import("./GameCanvas"), { ssr: false });

export default function GardenApp({ userEmail }: { userEmail: string }) {
  const supabase = useMemo(() => createClient(), []);
  const bridge = useMemo(() => new GameBridge(), []);
  const [state, setState] = useState<GardenState | null>(null);
  const stateRef = useRef<GardenState | null>(null);
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
  // The landscape nudge is a suggestion, not a gate — once somebody has waved
  // it away it must never come back and pester them again.
  const [rotateHint, setRotateHint] = useState(false);
  const dismissRotate = useCallback(() => {
    setRotateHint(false);
    try { window.localStorage.setItem("lily-rotate-done", "1"); } catch {}
  }, []);
  const [coach, setCoach] = useState(false);
  const [guided, setGuided] = useState<null | "water">(null);
  const guidedRef = useRef<null | "water">(null);
  // queue of plots still to water in a one-tap round
  const [round, setRound] = useState<number[]>([]);
  const roundRef = useRef<number[]>([]);
  useEffect(() => { roundRef.current = round; }, [round]);
  useEffect(() => { guidedRef.current = guided; }, [guided]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // bumped each time a reward finishes its flight into the counter
  const [dewPulse, setDewPulse] = useState(0);
  const acting = useRef(false);
  const actingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /*
   * Granny speaks one line at a time, and she can be waved away.
   *
   * This used to hold a single {text, mood} and a single timer, so a second
   * call within the display window destroyed the first. The level-up line
   * fired from applyState was killed by the tend message milliseconds later
   * every single time — and since watering is the only way a level is ever
   * crossed, that copy was unreachable in production and celebrateLevel's
   * gold badge appeared with nothing said over it.
   *
   * Now: a shallow queue, so a second message waits its turn instead of
   * erasing the first, and `jump` for the rare line that must not wait. The
   * queue stays two deep on purpose — a backlog of stale narration is worse
   * than dropping some of it.
   */
  const toastQueue = useRef<Array<{ text: string; mood: GuideMood; ms: number }>>([]);
  const toastShowing = useRef(false);
  const runNextToast = useRef<() => void>(() => {});

  runNextToast.current = () => {
    const next = toastQueue.current.shift();
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (!next) {
      toastShowing.current = false;
      setToast(null);
      return;
    }
    toastShowing.current = true;
    setToast({ text: next.text, mood: next.mood });
    toastTimer.current = setTimeout(() => runNextToast.current(), next.ms);
  };

  /** Waved away by the cross, or by touching anything else. */
  const dismissToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = null;
    toastShowing.current = false;
    setToast(null);
    // a beat between lines, so a queued one reads as a new remark
    if (toastQueue.current.length) {
      window.setTimeout(() => runNextToast.current(), 320);
    }
  }, []);

  const showToast = useCallback((msg: string, ms = 5600, mood: GuideMood = "happy", jump = false) => {
    const item = { text: msg, mood, ms };
    if (jump) toastQueue.current.unshift(item);
    else toastQueue.current.push(item);
    if (toastQueue.current.length > 2) toastQueue.current.length = 2;
    if (!toastShowing.current) runNextToast.current();
  }, []);

  /**
   * Crossing a gardener level is the slowest reward in the game and it used to
   * happen invisibly — the number in the Hall of Fame simply differed the next
   * time you looked. Every path that lands new state runs through here, so
   * this is the one place that can notice.
   */
  const levelRef = useRef<number | null>(null);

  const applyState = useCallback(
    (s: GardenState) => {
      const prev = levelRef.current;
      levelRef.current = s.level;
      stateRef.current = s;
      setState(s);
      bridge.setGarden(s);
      setBriefKey((k) => k + 1);
      if (prev !== null && s.level > prev) {
        sfx.levelUp();
        bridge.celebrateLevel(s.level);
        // jumps the queue: it is the rarest line in the game and it was the
        // one being destroyed by the tend message that always follows it
        showToast(
          `Level ${s.level}, ${s.displayName?.split(" ")[0] ?? "love"}. All that quiet tending adds up.`,
          7000, "proud", true
        );
      }
    },
    [bridge, showToast]
  );

  // ---- initial load ----
  useEffect(() => {
    sfx.init();
    music.init();
    setMuted(sfx.muted);
    setMusicOn(music.on);
    setMusicMode(music.mode);
    /*
     * Autoplay rules need a gesture, and iOS suspends the context again every
     * time the tab is backgrounded or the phone locks. A single once:true
     * pointerdown listener therefore got exactly one chance and gave up — put
     * the phone down mid-round and the music never came back.
     *
     * So: listen on several gesture types, keep listening until audio is
     * genuinely running, and try again whenever the page becomes visible.
     */
    const kick = () => {
      music.start();
      if (music.playing) detach();
    };
    const events = ["pointerdown", "touchend", "click", "keydown"] as const;
    const detach = () => events.forEach((e) => window.removeEventListener(e, kick));
    events.forEach((e) => window.addEventListener(e, kick, { passive: true }));

    // portrait-only nudge, shown once ever, and it gives up by itself
    try {
      if (!window.localStorage.getItem("lily-rotate-done")) setRotateHint(true);
    } catch { setRotateHint(true); }

    const rotateTimer = setTimeout(() => setRotateHint(false), 12000);

    const onVisible = () => { if (!document.hidden) music.start(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      detach();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      clearTimeout(rotateTimer);
    };
  }, []);

  // Touching anything else waves Granny away. Armed after a short delay so
  // the very tap that produced the message cannot also dismiss it.
  useEffect(() => {
    if (!toast) return;
    let armed = false;
    const arm = window.setTimeout(() => { armed = true; }, 420);
    const away = (e: PointerEvent) => {
      if (!armed) return;
      if ((e.target as HTMLElement)?.closest?.(".guide-toast")) return;
      dismissToast();
    };
    window.addEventListener("pointerdown", away, { passive: true });
    return () => {
      window.clearTimeout(arm);
      window.removeEventListener("pointerdown", away);
    };
  }, [toast, dismissToast]);

  // Tapping anywhere else waves the nudge away too — a hint you cannot get
  // rid of by touching the thing behind it just reads as broken.
  useEffect(() => {
    if (!rotateHint) return;
    const away = (e: PointerEvent) => {
      if ((e.target as HTMLElement)?.closest?.(".rotate-chip")) return;
      dismissRotate();
    };
    window.addEventListener("pointerdown", away, { passive: true });
    return () => window.removeEventListener("pointerdown", away);
  }, [rotateHint, dismissRotate]);

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

  // Tell the scene how much of the screen the pull-up sheet covers, so the
  // plots never sit underneath it.
  useEffect(() => {
    const measure = () => {
      const el = document.querySelector(".panel-wrap") as HTMLElement | null;
      if (!el) return bridge.setBottomInset(0);
      // only the fixed sheet overlaps the stage; the desktop panel does not
      if (getComputedStyle(el).position !== "fixed") return bridge.setBottomInset(0);
      // Reserve only the collapsed grab handle. Pulling the sheet up is a
      // temporary overlay — reflowing the camera for it squeezed the garden
      // into a sliver.
      const handle = el.querySelector(".sheet-handle") as HTMLElement | null;
      bridge.setBottomInset(handle?.offsetHeight ?? 46);
    };
    measure();
    const t = setTimeout(measure, 350); // after the sheet transition
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [bridge, state]);

  // The gardener should not wander behind an open modal.
  useEffect(() => {
    bridge.setFrozen(tutorial || seedFor !== null || journalOpen);
  }, [bridge, tutorial, seedFor, journalOpen]);

  // ---- scene -> React ----
  useEffect(() => {
    bridge.onPlotTapped = (i) => {
      setSelected(i);
      // Tapping a plant that can drink right now waters it. Anything else
      // just selects — a tap must never damage an overwaterable plant.
      const p = stateRef.current?.plots[i];
      if (p && canWaterNow(p.plant, stateRef.current!.hour) && !acting.current) {
        bridge.tend(i, "water");
      }
    };
    bridge.onDewBanked = () => setDewPulse((n) => n + 1);
    bridge.onPourStart = async (plotIdx, action) => {
      if (acting.current) return;
      acting.current = true;
      setBusy(true);
      // A request that never settles must not disable the garden forever.
      if (actingTimer.current) clearTimeout(actingTimer.current);
      actingTimer.current = setTimeout(() => {
        if (!acting.current) return;
        acting.current = false;
        setBusy(false);
        bridge.applyOutcome({ status: "error" });
        showToast("That took too long — the garden lost its connection. Try again.", 6000, "worry");
      }, 15000);
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
          if (result.state) applyState(result.state);
          if (result.status === "watered" || result.status === "fed" || result.status === "pruned") {
            sfx.comboSplash(Math.max(0, roundTotal.current - roundRef.current.length));
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
          if (actingTimer.current) clearTimeout(actingTimer.current);
          acting.current = false;
          setBusy(false);
          // a one-tap round walks on to the next thirsty plant
          const queue = roundRef.current;
          if (queue.length) {
            const [next, ...rest] = queue;
            roundRef.current = rest;
            setRound(rest);
            bridge.setCombo(roundTotal.current - rest.length);
            setSelected(next);
            bridge.select(next);
            setTimeout(() => bridge.tend(next, "water"), 420);
          } else if (roundTotal.current > 1) {
            // the round just finished
            const n = roundTotal.current;
            roundTotal.current = 0;
            bridge.setCombo(0);
            sfx.bloom();
            bridge.celebrateRound(n);
            showToast(
              `${n} plants watered in one go${state?.displayName ? `, ${state.displayName.split(" ")[0]}` : ""} — that is the whole round done. 🌿`,
              7000, "proud"
            );
          } else {
            bridge.setCombo(0);
          }
        }, 850);
      } catch (e) {
        bridge.applyOutcome({ status: "error" });
        showToast("The watering can sprang a leak (network error). Try again!", 5600, "worry");
        if (actingTimer.current) clearTimeout(actingTimer.current);
        acting.current = false;
        setBusy(false);
        void e;
      }
    };
    return () => {
      bridge.onPourStart = null;
      bridge.onDewBanked = null;
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

  /** One tap does the whole daily round, plant by plant. */
  const roundTotal = useRef(0);
  const waterAll = useCallback(() => {
    if (busy || !state) return;
    const due = state.plots
      .filter((p) => p.unlocked && canWaterNow(p.plant, state.hour))
      .map((p) => p.idx);
    if (due.length === 0) return;
    sfx.click();
    const [first, ...rest] = due;
    roundTotal.current = due.length;
    roundRef.current = rest;
    setRound(rest);
    bridge.setCombo(1);
    setSelected(first);
    bridge.select(first);
    bridge.tend(first, "water");
  }, [busy, state, bridge]);

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
  const [musicOpen, setMusicOpen] = useState(false);

  const pickMusic = useCallback((mode: MusicMode | "off") => {
    if (mode === "off") {
      music.setOn(false);
      setMusicOn(false);
      showToast("Granny lifted the needle — just the garden now.", 3500, "sleepy");
    } else {
      // setMode restarts the loop, and this click is the gesture the
      // browser was waiting for, so it starts audible straight away
      music.setMode(mode);
      setMusicOn(true);
      setMusicMode(mode);
      const name = MUSIC_MODES.find((m) => m.key === mode)?.name ?? "";
      showToast(`Granny put on "${name}".`, 3200, "happy");
    }
    setMusicOpen(false);
  }, [showToast]);

  /**
   * "Go see" used to only call setSelected. When the plot it points at is
   * already the selected one — which it always is when every plant is dead
   * and the first dead plot is plot 1 — that is a no-op, and the button
   * looked broken. It also never opened the sheet or scrolled, so even a
   * real change happened below the fold, out of sight.
   */
  const goToPlantCard = useCallback(() => {
    setTab("garden");
    setSheetOpen(true);
    // let the sheet finish expanding before measuring where the card landed
    window.setTimeout(() => {
      const card = document.querySelector(".plant-card-live");
      if (!card) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      card.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      card.classList.remove("just-landed");
      // reflow so the highlight replays even on repeated taps
      void (card as HTMLElement).offsetWidth;
      card.classList.add("just-landed");
    }, 320);
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
            onToggleMusic={() => { sfx.click(); setMusicOpen(true); }}
            musicOn={musicOn}
            musicName={MUSIC_MODES.find((m) => m.key === musicMode)?.name ?? ""}
            onSignOut={signOut}
            dewPulse={dewPulse}
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
          <button
            className="rotate-chip"
            onClick={dismissRotate}
            aria-label="Turn sideways for the full garden — dismiss"
          >
            <RotateCw size={14} strokeWidth={2.6} aria-hidden />
            <span>Turn sideways for the full garden</span>
            <X size={15} strokeWidth={2.8} className="rc-x" aria-hidden />
          </button>
        )}

        {state && !tutorial && !coach && (
          <WaterFab
            state={state}
            selected={selected}
            busy={busy}
            roundLeft={round.length}
            onWater={(i) => { setSelected(i); bridge.select(i); tend(i, "water"); }}
            onWaterAll={waterAll}
          />
        )}

        <MusicPicker
          open={musicOpen}
          current={musicMode}
          isOn={musicOn}
          onPick={pickMusic}
          onClose={() => setMusicOpen(false)}
        />

        {toast && (
          <div className="toast guide-toast" role="status">
            <GuidePortrait mood={toast.mood} size={54} />
            <div className="guide-toast-text">
              <span className="guide-name">{GUIDE_NAME}</span>
              {toast.text}
            </div>
            <button className="toast-close" onClick={dismissToast} aria-label="Dismiss">
              <X size={16} strokeWidth={2.8} aria-hidden />
            </button>
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
            {/*
              Garden is only what you act on right now: today's news, the one
              next thing to do, the plant you have selected, and your plots.
              Decor and Restoration both spend dewdrops on scenery, so they
              live with the Shop — stacking all seven here meant nobody could
              tell which panel was the one that wanted them.
            */}
            {tab === "garden" && (
              <>
                <TodayBrief refreshKey={briefKey} />
                <WeeklyGift refreshKey={briefKey} onState={applyState} showToast={showToast} />
                <NextStep
                  state={state}
                  onGo={(idx, plant) => {
                    sfx.click();
                    setSelected(idx);
                    bridge.select(idx);
                    if (plant) { setSeedFor(state.plots[idx]); return; }
                    goToPlantCard();
                  }}
                />
                <PlantCard
                  state={state}
                  selected={selected}
                  busy={busy}
                  onTend={tend}
                  onPlant={(p) => { sfx.click(); setSeedFor(p); }}
                  onClear={clearPlot}
                  onRevive={revivePlot}
                />
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
              </>
            )}
            {tab === "shop" && (
              <>
                <ShopPanel state={state} onBought={applyState} showToast={showToast} />
                <DecorBar state={state} onState={applyState} showToast={showToast} />
                <RestorePanel state={state} onState={applyState} showToast={showToast} />
              </>
            )}
            {tab === "profile" && (
              <>
                <LevelBar state={state} />
                <ReminderSettings />
                <ProfilePanel
                  state={state}
                  avatar={avatar}
                  onPreview={(a) => bridge.setAvatar(a)}
                  onSave={saveAvatar}
                  onState={applyState}
                  showToast={showToast}
                />
              </>
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
