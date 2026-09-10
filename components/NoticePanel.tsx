"use client";

import { Footprints, HandHeart, Droplets, Gift, Trophy, X } from "lucide-react";
import type { Notice, NoticeKind, NoticeState } from "@/lib/types";
import AvatarPreview from "./AvatarPreview";

/**
 * The bell's contents.
 *
 * Two kinds of line live here and they are built completely differently, which
 * is deliberate:
 *
 * - **Social** (`visit`, `rescue`) are rows in `notifications`. Somebody else
 *   caused them, so nothing but a stored row can know they happened, and they
 *   carry a read/unread state.
 * - **Everything else** is DERIVED live from state the game already keeps —
 *   the same reconstruct-rather-than-store choice `care_day_counts()` makes.
 *   No cron, no backfill, nothing to keep in sync: a "your fern is dying"
 *   line simply stops being returned once the fern is watered. That is also
 *   why they cannot be marked read — there is no row to mark.
 *
 * Presentational on purpose: the fetching and the RPCs live in `GardenApp`,
 * so the mobile audit fixture can mount this with a literal.
 */

const ICON: Record<NoticeKind, typeof Footprints> = {
  visit: Footprints,
  rescue: HandHeart,
  care: Droplets,
  gift: Gift,
  season: Trophy,
};

/** "3m", "2h", "Tuesday" — precision nobody wants is just noise. */
function ago(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

export default function NoticePanel({
  notices,
  onClose,
  onGo,
  onVisitBack,
}: {
  notices: NoticeState | null;
  onClose: () => void;
  /** Take me to whatever this is about (a plot, the gift, the league). */
  onGo: (n: Notice) => void;
  /** They came to see you; go and see them. */
  onVisitBack: (uid: string, name: string) => void;
}) {
  const items = notices?.items ?? [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="notices" onClick={(e) => e.stopPropagation()}>
        <div className="journal-head">
          <h2>News</h2>
          {/* NOT `.toast-close` — that one is `position: absolute; top: 50%`,
              built to sit inside a toast, and in a tall modal it floats free
              of the header entirely. The Almanac's ghost button is the
              modal-header pattern. */}
          <button className="btn ghost small" onClick={onClose} aria-label="Close">
            <X size={15} strokeWidth={2.8} aria-hidden /> Close
          </button>
        </div>
        <p className="journal-sub">
          Who has been round, and what the garden wants next.
        </p>

        {!notices ? (
          <p className="gallery-empty">Checking the gate…</p>
        ) : items.length === 0 ? (
          <p className="gallery-empty">
            Nothing new just now. Quiet is a good sign in a garden.
          </p>
        ) : (
          <ul className="notice-list">
            {items.map((n) => {
              const Icon = ICON[n.kind] ?? Footprints;
              // A derived notice always has somewhere to go; a social one
              // only sometimes does. A row that looks pressable and is not
              // reads as broken, so the whole row is only a button when it
              // actually leads somewhere.
              const goes = n.kind === "care" || n.kind === "gift" || n.kind === "season";
              return (
                <li key={n.id} className={`notice-row k-${n.kind}${n.read ? "" : " unread"}`}>
                  <span className={`notice-icon k-${n.kind}`}>
                    {n.actorAvatar ? (
                      <AvatarPreview avatar={n.actorAvatar} size={34} />
                    ) : (
                      <Icon size={17} strokeWidth={2.6} aria-hidden />
                    )}
                  </span>
                  <span className="notice-meta">
                    <b>{n.title}</b>
                    {n.body && <span>{n.body}</span>}
                    <em>{ago(n.createdAt)}</em>
                  </span>
                  {goes ? (
                    <button className="btn small ghost" onClick={() => onGo(n)}>
                      Show me
                    </button>
                  ) : n.actorUid ? (
                    <button
                      className="btn small ghost"
                      onClick={() => onVisitBack(n.actorUid!, n.actorName ?? "them")}
                    >
                      Visit back
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
