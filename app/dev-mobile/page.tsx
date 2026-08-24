"use client";
// Mobile audit fixture: mounts every panel the real garden uses, with mock
// state, so the audit script can walk them without a login.
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { GameBridge } from "@/game/bridge";
import { DEFAULT_AVATAR } from "@/game/avatar";
import type { GardenState, PlantState, PlotState } from "@/lib/types";
import Hud from "@/components/Hud";
import TabBar, { type PanelTab } from "@/components/TabBar";
import PlotBar from "@/components/PlotBar";
import RestorePanel from "@/components/RestorePanel";
import NextStep from "@/components/NextStep";
import ProfilePanel from "@/components/ProfilePanel";
import SeedPicker from "@/components/SeedPicker";
import Journal from "@/components/Journal";
import Tutorial from "@/components/Tutorial";
const GameCanvas = dynamic(() => import("@/components/GameCanvas"), { ssr: false });

const KINDS: PlotState["kind"][] = ["water","sun","shade","sun","water","shade","sun","water","shade","sun","sun","shade"];
const mk = (species: string, idx: number, stage: number): PlantState => ({
  id: species+idx, plotIdx: idx, species, stage, growth: stage, watersNeeded: 7,
  feedsDone: 0, prunesDone: 0, plantedOn: "2026-08-13", lastCareOn: null, dayNumber: stage+1,
  overdueDays: 0, thirsty: true, wilted: false, health: 1, dead: false, isBloomed: false, streak: 3,
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
  plots: KINDS.map((kind, idx) => ({ idx, kind, unlocked: idx<6,
    plant: idx===0 ? mk("lily",0,4) : idx===1 ? mk("sunflower",1,5) : null })),
} as GardenState;

export default function DevMobile() {
  const bridge = useMemo(() => new GameBridge(), []);
  const [tab, setTab] = useState<PanelTab>("garden");
  const [modal, setModal] = useState<null | "seed" | "journal" | "tutorial">(null);
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
    w.__tapped = null;
    w.__poured = null;
    bridge.onPlotTapped = (i) => { w.__tapped = i; };
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
          <Hud state={STATE} muted={false} musicOn musicName="Sunny Meadow"
            onJournal={()=>setModal("journal")} onStudio={()=>setTab("profile")} onLeague={()=>setTab("league")}
            onHelp={()=>setModal("tutorial")} onToggleMute={()=>{}} onToggleMusic={()=>{}} onSignOut={()=>{}} />
        </div>
        <div className={`panel-wrap${sheetOpen ? " sheet-open" : ""}`}>
          <button className="sheet-handle" onClick={()=>setSheetOpen(o=>!o)}><span /></button>
          <TabBar active={tab} onChange={setTab} badge={{ garden: 2 }} />
          <div className="panel-body">
            {tab === "garden" && (
              <>
                <NextStep state={STATE} onGo={(_i, plant) => plant && setModal("seed")} />
                <PlotBar state={STATE} selected={sel} busy={false}
                  onSelect={(i)=>setSel(i)} onTend={(i,a)=>bridge.tend(i,a)} onPlant={()=>setModal("seed")} onClear={()=>{}} onRevive={()=>{}} />
                <RestorePanel state={STATE} onState={()=>{}} showToast={()=>{}} />
              </>
            )}
            {tab === "profile" && (
              <ProfilePanel state={STATE} avatar={DEFAULT_AVATAR}
                onPreview={()=>{}} onSave={async()=>{}} onState={()=>{}} showToast={()=>{}} />
            )}
            {tab === "shop" && <p className="gallery-empty">Shop needs the network; skipped in fixture.</p>}
            {tab === "league" && <p className="gallery-empty">League needs the network; skipped in fixture.</p>}
          </div>
        </div>
      </div></div>
      {modal === "seed" && (
        <SeedPicker plot={STATE.plots[2]} unlocked={STATE.unlockedSpecies} dewdrops={STATE.dewdrops}
          busy={false} onPlant={()=>setModal(null)} onClose={()=>setModal(null)} />
      )}
      {modal === "journal" && <Journal state={STATE} completed={[]} onClose={()=>setModal(null)} />}
      {modal === "tutorial" && <Tutorial avatar={DEFAULT_AVATAR} onDone={()=>setModal(null)} />}
    </main>
  );
}
