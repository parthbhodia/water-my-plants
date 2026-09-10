"use client";
// Mobile audit fixture: mounts every panel the real garden uses, with mock
// state, so the audit script can walk them without a login.
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { GameBridge } from "@/game/bridge";
import { DEFAULT_AVATAR } from "@/game/avatar";
import type { GardenState, GardenView, NoticeState, PlantState, PlotState } from "@/lib/types";
import { canWaterNow } from "@/lib/species";
import Hud from "@/components/Hud";
import TabBar, { type PanelTab } from "@/components/TabBar";
import PlotBar from "@/components/PlotBar";
import PlantCard from "@/components/PlantCard";
import RestorePanel from "@/components/RestorePanel";
import ExpandPanel from "@/components/ExpandPanel";
import NextStep from "@/components/NextStep";
import WaterFab from "@/components/WaterFab";
import ProfilePanel from "@/components/ProfilePanel";
import SeedPicker from "@/components/SeedPicker";
import Journal from "@/components/Journal";
import Tutorial from "@/components/Tutorial";
import NoticePanel from "@/components/NoticePanel";
import VisitOverlay from "@/components/VisitOverlay";
import VisitPanel from "@/components/VisitPanel";
const GameCanvas = dynamic(() => import("@/components/GameCanvas"), { ssr: false });

const KINDS: PlotState["kind"][] = ["water","sun","shade","sun","water","shade","sun","water","shade","sun","sun","shade"];
const mk = (species: string, idx: number, stage: number, variant: string | null = null): PlantState => ({
  id: species+idx, plotIdx: idx, species, stage, growth: stage, watersNeeded: 7,
  feedsDone: 0, prunesDone: 0, plantedOn: "2026-08-13", lastCareOn: null, dayNumber: stage+1,
  overdueDays: 0, thirsty: true, wilted: false, health: 1, dead: false, isBloomed: false, variant, streak: 3,
});
const STATE = {
  gardenId:"g", gardenName:"My Garden", plotCount:6, displayName:"SunnyBud12", friendCode:"LILY-42AB",
  avatar: DEFAULT_AVATAR, dewdrops:450, level:3, nameChanged:false, inventory:{ tonic: 1 }, decor:{},
  today:"2026-08-20", hour:13, timezone:"Asia/Kolkata", tutorialDone:true,
  zones: [
    { key:"glade", name:"The Old Glade", blurb:"A mossed-over corner by the willows.", minLevel:3, unlocked:true,
      fixtures:[
        { key:"fountain", name:"Stone Fountain", blurb:"Choked with ivy and dry as a bone.", cost:450, restored:false },
        { key:"swing", name:"Willow Swing", blurb:"Two frayed ropes and a cracked seat.", cost:700, restored:true },
      ]},
    { key:"meadow", name:"The Far Meadow", blurb:"Waist-high grass past the fence.", minLevel:6, unlocked:false, fixtures:[] },
  ],
  unlockedSpecies:["lily","sunflower","fern","cactus"], gardenScore:68, completedCount:2,
  lifetimeEarned: 520, levelFloor: 360, nextLevelAt: 640,
  nextPlot: { idx:6, cost:600, minLevel:3, kind:"sun" as const,
              levelOk:true, dewOk:false, dewToGo:150, levelAt:160 },
  plots: KINDS.map((kind, idx) => ({ idx, kind, unlocked: idx<6,
    plant: idx===0 ? mk("lily",0,4,"dewkissed") : idx===1 ? mk("sunflower",1,5,"golden")
         : idx===2 ? mk("fern",2,3) : idx===3 ? mk("cactus",3,2,"variegated") : null })),
} as GardenState;

/**
 * Somebody else's garden, and the bell. Both mount here so the audit walks
 * them: they are the two surfaces a real login would be needed to reach, and
 * the sandbox blocks browser->Supabase.
 *
 * The view is deliberately built from the SAME shape the owner document has,
 * with the private half blanked exactly as `garden_view_json` blanks it —
 * a fixture that fed a richer object than the server sends would hide the
 * very bugs it exists to catch.
 */
const VIEW = {
  ...STATE,
  hostUid: "11111111-2222-3333-4444-555555555555",
  gardenName: "Rowan's Garden",
  displayName: "Rowan",
  dewdrops: 0,
  inventory: {},
  unlockedSpecies: [],
  nextPlot: null,
  friendCode: null,
  lifetimeEarned: null,
  levelFloor: null,
  nextLevelAt: null,
  plots: KINDS.map((kind, idx) => ({
    idx, kind, unlocked: idx < 6,
    plant: idx === 0 ? { ...mk("lily", 0, 4), overdueDays: 4 }
         : idx === 1 ? { ...mk("sunflower", 1, 5), overdueDays: 0, thirsty: false }
         : idx === 2 ? { ...mk("fern", 2, 3), overdueDays: 2 }
         : null,
  })),
  viewer: { canRescue: true, rescuedToday: false, needsHelp: 2 },
} as unknown as GardenView;

const NOTICES: NoticeState = {
  unread: 2,
  items: [
    { id: "care-dying-2", kind: "care", title: "Water the Lady Fern — today or never",
      body: "One more dry day and she is gone for good.", actorName: null,
      actorAvatar: null, actorUid: null, plotIdx: 2,
      createdAt: new Date().toISOString(), read: true },
    { id: "n2", kind: "rescue", title: "Rowan rescued your Lady Fern",
      body: "Plot 3 was 2 days past its drink. It will hold now — but it still needs you to grow.",
      actorName: "Rowan", actorAvatar: DEFAULT_AVATAR,
      actorUid: "11111111-2222-3333-4444-555555555555", plotIdx: 2,
      createdAt: new Date(Date.now() - 3600_000).toISOString(), read: false },
    { id: "n1", kind: "visit", title: "Wren looked in on your garden",
      body: "They had a wander round. Nothing was touched.", actorName: "Wren",
      actorAvatar: DEFAULT_AVATAR, actorUid: null, plotIdx: null,
      createdAt: new Date(Date.now() - 86400_000).toISOString(), read: false },
  ],
};

export default function DevMobile() {
  const bridge = useMemo(() => new GameBridge(), []);
  const [tab, setTab] = useState<PanelTab>("garden");
  const [modal, setModal] = useState<null | "seed" | "journal" | "tutorial" | "notices">(null);
  const [visiting, setVisiting] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sel, setSel] = useState(0);
  useEffect(() => {
    bridge.setAvatar(DEFAULT_AVATAR);
    bridge.setGarden(STATE);
    const measure = () => {
      const el = document.querySelector(".panel-wrap") as HTMLElement | null;
      if (!el || getComputedStyle(el).position !== "fixed") return bridge.setBottomInset(0);
      const handle = el.querySelector(".sheet-handle") as HTMLElement | null;
      bridge.setBottomInset(handle?.offsetHeight ?? 46);
    };
    measure();
    const t = setTimeout(measure, 350);
    window.addEventListener("resize", measure);

    const w = window as unknown as Record<string, unknown>;
    w.__tab = (x: PanelTab) => setTab(x);
    w.__modal = (m: string | null) => setModal(m as never);
    w.__sheet = (o: boolean) => setSheetOpen(o);
    w.__visit = (on: boolean) => {
      setVisiting(on);
      bridge.setVisiting(on);
      bridge.setGarden(on ? (VIEW as unknown as GardenState) : STATE);
    };
    w.__tapped = null;
    w.__poured = null;
    // mirrors GardenApp: a tap on a plant that can drink waters it
    bridge.onPlotTapped = (i) => {
      w.__tapped = i;
      setSel(i);
      const pl = STATE.plots[i]?.plant;
      if (canWaterNow(pl, STATE.hour)) bridge.tend(i, "water");
    };
    bridge.onPourStart = (plotIdx, action) => {
      w.__poured = { plotIdx, action };
      setTimeout(() => {
        bridge.applyOutcome({
          status: "watered", grew: true, dewEarned: 4, plotIdx,
          species: STATE.plots[plotIdx]?.plant?.species ?? "lily",
        });
      }, 700);
    };

    return () => { clearTimeout(t); window.removeEventListener("resize", measure); };
  }, [bridge, sheetOpen]);
  return (
    <main className="garden-wrap">
      <div className="garden-shell"><div className="garden-main">
        <div className="game-frame">
          <GameCanvas bridge={bridge} />
          {!visiting && <WaterFab state={STATE} selected={sel} busy={false} roundLeft={0}
            onWater={(i)=>{ setSel(i); bridge.select(i); bridge.tend(i,"water"); }}
            onWaterAll={()=>{ const due = STATE.plots.filter(p=>p.unlocked && p.plant && p.plant.thirsty).map(p=>p.idx);
              (window as unknown as Record<string, unknown>).__round = due; bridge.setCombo(1); bridge.tend(due[0],"water"); }} />}
          {!visiting && (
            <Hud state={STATE} muted={false} musicOn musicName="Sunny Meadow"
              onJournal={()=>setModal("journal")} onStudio={()=>setTab("profile")} onLeague={()=>setTab("league")}
              onHelp={()=>setModal("tutorial")} onToggleMute={()=>{}} onToggleMusic={()=>{}} onSignOut={()=>{}}
              onNotices={()=>setModal("notices")} unread={NOTICES.unread} />
          )}
          {visiting && (
            <VisitOverlay view={VIEW} selected={sel} busy={false}
              onLeave={()=>{ setVisiting(false); bridge.setVisiting(false); bridge.setGarden(STATE); }}
              onRescue={()=>{}} />
          )}
        </div>
        <div className={`panel-wrap${sheetOpen ? " sheet-open" : ""}`}>
          <button className="sheet-handle" onClick={()=>setSheetOpen(o=>!o)}><span /></button>
          {!visiting && <TabBar active={tab} onChange={setTab} badge={{ garden: 2 }} />}
          <div className="panel-body">
            {visiting && (
              <VisitPanel view={VIEW} selected={sel} busy={false}
                onSelect={(i)=>setSel(i)} onRescue={()=>{}} />
            )}
            {!visiting && tab === "garden" && (
              <>
                <NextStep state={STATE} onGo={(_i, plant) => plant && setModal("seed")} />
                <PlotBar state={STATE} selected={sel} busy={false}
                  onSelect={(i)=>setSel(i)} onTend={(i,a)=>bridge.tend(i,a)} onPlant={()=>setModal("seed")} onClear={()=>{}} onRevive={()=>{}} />
                {/* the tend buttons now live on the card, not the chip row */}
                <PlantCard state={STATE} selected={sel} busy={false}
                  onTend={(i,a)=>bridge.tend(i,a)} onPlant={()=>setModal("seed")} onClear={()=>{}} onRevive={()=>{}} onShop={()=>{}} onReminders={()=>{}} />
                <ExpandPanel state={STATE} busy={false} onBreakGround={()=>{}} />
                <RestorePanel state={STATE} onState={()=>{}} showToast={()=>{}} />
              </>
            )}
            {!visiting && tab === "profile" && (
              <ProfilePanel state={STATE} avatar={DEFAULT_AVATAR}
                onPreview={()=>{}} onSave={async()=>{}} onState={()=>{}} showToast={()=>{}} />
            )}
            {!visiting && tab === "shop" && <p className="gallery-empty">Shop needs the network; skipped in fixture.</p>}
            {!visiting && tab === "league" && <p className="gallery-empty">League needs the network; skipped in fixture.</p>}
          </div>
        </div>
      </div></div>
      {modal === "seed" && (
        <SeedPicker plot={STATE.plots[2]} unlocked={STATE.unlockedSpecies} dewdrops={STATE.dewdrops} phase="autumn"
          busy={false} onPlant={()=>setModal(null)} onClose={()=>setModal(null)} />
      )}
      {modal === "journal" && <Journal state={STATE} completed={[]} onClose={()=>setModal(null)} />}
      {modal === "tutorial" && <Tutorial avatar={DEFAULT_AVATAR} onDone={()=>setModal(null)} />}
      {modal === "notices" && (
        <NoticePanel notices={NOTICES} onClose={()=>setModal(null)} onGo={()=>setModal(null)} onVisitBack={()=>setModal(null)} />
      )}
    </main>
  );
}
