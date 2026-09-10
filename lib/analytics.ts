// Funnel events.
//
// The landing page has been rebuilt several times — the day-90 garden, the
// plant picker, the seasonal banner, the order of the sections — and not one
// of those changes was measurable, because nothing counted a visitor. This is
// the thinnest thing that fixes that.
//
// Vercel Web Analytics is cookieless and needs no consent banner, and it stays
// that way only if nothing here ever carries personal data. **Never pass an
// email, a display name, a user id, or anything a person could be picked out
// by.** Every payload below is a bounded set of literals chosen in advance:
// which section, which species key, which season. That rule is the reason this
// file exists instead of `track()` being called ad hoc from twelve components.
//
// Calling any of these is always safe: events sent before the beacon exists
// are buffered (see below), and outside production Vercel only logs them.

import { track } from "@vercel/analytics";

type Payload = Record<string, string | number | boolean>;

/**
 * Buffer until the beacon exists.
 *
 * `track()` hands the event to `window.va`, which the <Analytics> component
 * installs from its own effect — and effects run parent-last, so the FIRST
 * section on the page marks itself before the beacon is there and the event is
 * dropped on the floor with no error. That silently lost the hero view, which
 * every single visitor triggers, and would have made the top of the funnel
 * look emptier than the sections below it — the one shape that makes a funnel
 * useless.
 *
 * So: queue anything sent too early and flush it once `window.va` appears.
 * Four seconds, then give up rather than leak a growing array.
 */
const pending: Array<[string, Payload]> = [];
let polling = false;

function beacon(): boolean {
  return typeof window !== "undefined" && typeof (window as { va?: unknown }).va === "function";
}

function flushSoon(tries = 0) {
  polling = true;
  setTimeout(() => {
    if (beacon()) {
      polling = false;
      for (const [name, data] of pending.splice(0)) track(name, data);
    } else if (tries < 40) {
      flushSoon(tries + 1);
    } else {
      polling = false;
      pending.length = 0;
    }
  }, 100);
}

function send(name: string, data: Payload) {
  if (typeof window === "undefined") return;
  if (beacon()) { track(name, data); return; }
  pending.push([name, data]);
  if (!polling) flushSoon();
}

/** Every section of the landing page, in the order a visitor meets them. */
export type Section =
  | "hero"
  | "journey"
  | "how"
  | "plants"
  | "seasons"
  | "showcase"
  | "week"
  | "faq";

/**
 * How far down the page somebody actually got.
 *
 * Scroll depth is the only way to tell whether a section is doing anything: a
 * section nobody reaches cannot be the reason they signed up, and a section
 * everybody reaches and then leaves at is the one to fix.
 */
export function seenSection(section: Section) {
  send("section_seen", { section });
}

/** The bottom of the funnel. Mode only — never the address that was typed. */
export function authSubmit(mode: "signin" | "signup") {
  send("auth_submit", { mode });
}

export function authResult(mode: "signin" | "signup", ok: boolean) {
  send("auth_result", { mode, ok });
}

/** Which plant a visitor was curious enough to open a guide for. */
export function plantOpened(species: string) {
  send("plant_opened", { species });
}

/** Whether anybody drives the seasonal banner, or just watches it. */
export function seasonPicked(phase: string) {
  send("season_picked", { phase });
}

/**
 * Somebody walked into another player's garden.
 *
 * `source` is the LIST they came from, and it is a closed set of four
 * literals — never the host's name, id or friend code. Which route actually
 * produces visits is the whole question: friend codes have produced zero in
 * the game's lifetime, and this is how we find out whether the showcase and
 * the Hall of Fame do any better.
 */
export function gardenVisited(source: "friend" | "showcase" | "hof" | "daily") {
  send("garden_visited", { source });
}

/** And whether looking turned into helping. */
export function gardenRescued(source: "friend" | "showcase" | "hof" | "daily") {
  send("garden_rescued", { source });
}
