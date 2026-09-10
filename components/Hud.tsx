"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Skull, Leaf, Trophy, Droplets, BookOpen, Palette, CircleHelp, Volume2, VolumeX, LogOut, Music, Music2,
  ChartNoAxesColumn, Bell,
} from "lucide-react";
import type { GardenState } from "@/lib/types";

/**
 * The scoreboard and the toolbar, in the vocabulary phone games actually use.
 *
 * Both halves used to whisper. The stats were pale pills of tinted text; the
 * toolbar was seven identical grey circles whose meaning lived in a `title`
 * attribute — which is a HOVER tooltip, so on the primary target platform they
 * were unlabelled buttons and the only way to learn what one did was to press
 * it. One of them signed you out.
 *
 * So, borrowed from the genre and applied on purpose:
 *
 * - **Icon plus number, never a word.** A coin and `450`, not "Dewdrops: 450".
 * - **Colour is the index, and it is rationed.** The three destinations get a
 *   hue each (league gold, almanac green, gardener violet); the utilities stay
 *   stone. Colouring all seven would be noise, not emphasis — the reason those
 *   games read at a glance is that only a few things are loud.
 * - **Every button says what it is, at rest.** Nothing informative in `title`.
 * - **Controls look pressable**: 2px rim, a top-down gradient, a shadow under.
 *
 * What is deliberately NOT borrowed: the urgency. No countdowns, no red badges
 * inventing work, no "buy" anything. Legibility is the thing worth taking.
 */
export default function Hud({
  state,
  muted,
  onJournal,
  onStudio,
  onLeague,
  onHelp,
  onToggleMute,
  onToggleMusic,
  musicOn,
  musicName,
  onSignOut,
  onNotices,
  unread = 0,
  dewPulse,
  isAdmin,
}: {
  state: GardenState;
  muted: boolean;
  onJournal: () => void;
  onStudio: () => void;
  onLeague: () => void;
  onHelp: () => void;
  onToggleMute: () => void;
  onToggleMusic: () => void;
  musicOn: boolean;
  musicName: string;
  onSignOut: () => void;
  onNotices?: () => void;
  /**
   * How many unread. The bell is NOT `hud-desk`: a visit notification is the
   * one piece of news that arrives while you are not looking, and phones are
   * where nearly everybody plays — hiding it there would mean the person it
   * is about never sees it.
   */
  unread?: number;
  /** Bumped when a reward lands, so the counter can flash. */
  dewPulse?: number;
  /**
   * Whether to offer the analytics link at all. This is presentation only —
   * the page itself is gated by the RPC refusing a non-admin, so a stale or
   * spoofed `false` hides a link and a spoofed `true` buys a 404.
   */
  isAdmin?: boolean;
}) {
  const live = state.plots.filter((p) => p.plant && !p.plant.dead).length;
  // Each dead plant costs 15 points, which is why the trophy can go negative.
  // A bare "-60" with no stated cause reads as a broken counter.
  const lost = state.plots.filter((p) => p.plant?.dead).length;
  const todo = state.plots.filter(
    (p) => p.plant && p.plant.thirsty && !p.plant.isBloomed && !p.plant.dead
  ).length;

  /**
   * Sign-out asks twice.
   *
   * It sat in a row of same-looking buttons where the only label was a hover
   * tooltip, so on a phone the cost of guessing wrong was your session. One
   * press arms it, the next one means it, and it disarms itself after four
   * seconds so it can never sit armed waiting for a stray thumb.
   */
  const [armed, setArmed] = useState(false);
  const disarm = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (disarm.current) clearTimeout(disarm.current); }, []);
  const pressOut = () => {
    if (armed) {
      if (disarm.current) clearTimeout(disarm.current);
      onSignOut();
      return;
    }
    setArmed(true);
    if (disarm.current) clearTimeout(disarm.current);
    disarm.current = setTimeout(() => setArmed(false), 4000);
  };

  return (
    <div className="hud-top">
      <div className="hud-card">
        <div className="hud-day"><Leaf size={19} strokeWidth={2.4} aria-hidden /> {state.gardenName}</div>
        <div className="hud-stage">
          {state.displayName ?? "Gardener"} · {live}/{state.plotCount} plots growing
        </div>
        <div className="hud-statrow">
          <button className="stat score tappable" onClick={onLeague}>
            <Trophy size={19} strokeWidth={2.8} aria-hidden />
            <b>{state.gardenScore}</b>
          </button>
          <span className={`stat dew${dewPulse ? " banked" : ""}`} key={`dew-${dewPulse ?? 0}`}>
            <Droplets size={19} strokeWidth={2.8} aria-hidden />
            <b>{state.dewdrops}</b>
          </span>
          {todo > 0 && (
            <span className="stat todo">
              <Droplets size={17} strokeWidth={2.8} aria-hidden />
              <b>{todo}</b> need care
            </span>
          )}
          {lost > 0 && (
            <span className="stat lost" title={`${lost} lost plant${lost === 1 ? "" : "s"} cost ${lost * 15} points`}>
              <Skull size={17} strokeWidth={2.8} aria-hidden />
              <b>{lost}</b> lost
            </span>
          )}
        </div>
      </div>

      <div className="hud-buttons">
        <button className="hud-icon-btn b-league hud-desk" onClick={onLeague}>
          <Trophy size={20} strokeWidth={2.6} aria-hidden /><i>League</i>
        </button>
        <button className="hud-icon-btn b-almanac hud-desk" onClick={onJournal}>
          <BookOpen size={20} strokeWidth={2.6} aria-hidden /><i>Almanac</i>
        </button>
        <button className="hud-icon-btn b-studio hud-desk" onClick={onStudio}>
          <Palette size={20} strokeWidth={2.6} aria-hidden /><i>Gardener</i>
        </button>
        {onNotices && (
          /* Stone, like the other utilities — the BADGE carries the colour, in
             the same orange as "needs care", so the one loud thing on the
             button is the part that is actually asking for you. Colouring the
             whole button would spend the rationed hues on a sixth thing. */
          <button className="hud-icon-btn b-news" onClick={onNotices}>
            <span className="bell-wrap">
              <Bell size={20} strokeWidth={2.6} aria-hidden />
              {unread > 0 && (
                <span className="bell-badge" aria-hidden>{unread > 9 ? "9+" : unread}</span>
              )}
            </span>
            <i>News</i>
            {unread > 0 && <span className="sr-only">{unread} unread</span>}
          </button>
        )}
        <button className="hud-icon-btn" onClick={onHelp}>
          <CircleHelp size={20} strokeWidth={2.6} aria-hidden /><i>Help</i>
        </button>
        <button
          className={`hud-icon-btn${musicOn ? "" : " off"}`}
          onClick={onToggleMusic}
          /* The record's NAME is extra, so it may live in a tooltip. What the
             button does may not — that is the label underneath. */
          title={musicOn ? `Playing "${musicName}" — press for the next record` : undefined}
        >
          {musicOn ? <Music size={20} strokeWidth={2.6} aria-hidden /> : <Music2 size={20} strokeWidth={2.6} aria-hidden />}
          <i>{musicOn ? "Music" : "Silent"}</i>
        </button>
        <button className={`hud-icon-btn${muted ? " off" : ""}`} onClick={onToggleMute}>
          {muted ? <VolumeX size={20} strokeWidth={2.6} aria-hidden /> : <Volume2 size={20} strokeWidth={2.6} aria-hidden />}
          <i>{muted ? "Muted" : "Sound"}</i>
        </button>
        {isAdmin && (
          /* hud-desk: nobody reads a funnel on a phone. */
          <Link href="/admin/analytics" className="hud-icon-btn b-admin hud-desk">
            <ChartNoAxesColumn size={20} strokeWidth={2.6} aria-hidden /><i>Funnel</i>
          </Link>
        )}
        <button
          className={`hud-icon-btn b-out hud-desk${armed ? " armed" : ""}`}
          onClick={pressOut}
          aria-live="polite"
        >
          <LogOut size={20} strokeWidth={2.6} aria-hidden />
          <i>{armed ? "Sure?" : "Sign out"}</i>
        </button>
      </div>
    </div>
  );
}
