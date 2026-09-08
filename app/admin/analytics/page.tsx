import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import AdminNav from "@/components/AdminNav";
import FunnelSankey from "@/components/FunnelSankey";
import { LineChart, BarChart, RowBars } from "@/components/AdminCharts";

/**
 * The half of the funnel Vercel cannot see.
 *
 * Web Analytics stops at the sign-up button; everything after it — did they
 * plant, did they come back, which species did they pick — is Supabase's, and
 * spans every player, which RLS (select-own-rows) rightly forbids a client
 * from reading. So the whole page is one `admin_funnel()` call: SECURITY
 * DEFINER, raises for anybody not in `admins`, revoked from `anon` entirely.
 *
 * There is no client-side check here and there must never be one. The RPC
 * refusing IS the authorisation; this page only decides what to show when it
 * does. A non-admin gets a 404 rather than a "forbidden", so the page does not
 * advertise that it exists.
 */

export const metadata: Metadata = {
  title: "Funnel",
  robots: { index: false, follow: false, nocache: true },
};

/** Per-user and always live — never cache somebody else's answer. */
export const dynamic = "force-dynamic";

type Totals = {
  players: number; planted_ever: number; plants_alive: number;
  waterings: number; active_7d: number; active_1d: number;
};
type Cohort = {
  joined: string; signed_up: number; planted: number;
  watered_2: number; lasted_week: number;
};
type Species = { key: string; name: string; planted: number };
type Daily = { day: string; waterings: number; players: number };
type Retention = { day: number; eligible: number; active: number };
type Hour = { hour: number; waterings: number };
type Funnel = {
  totals: Totals; cohorts: Cohort[]; species: Species[];
  daily: Daily[]; retention: Retention[]; hours: Hour[];
};

/** "Sep 8" beats "2026-09-08" on an axis with thirty of them. */
const shortDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", timeZone: "UTC",
  });

const hourLabel = (h: number) => `${String(h).padStart(2, "0")}`;

const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : "—");

export default async function AdminAnalytics() {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase.rpc("admin_funnel");
  if (error || !data) notFound();

  const f = data as Funnel;
  const t = f.totals;
  const sum = f.cohorts.reduce(
    (a, c) => ({
      signed_up: a.signed_up + c.signed_up,
      planted: a.planted + c.planted,
      watered_2: a.watered_2 + c.watered_2,
      lasted_week: a.lasted_week + c.lasted_week,
    }),
    { signed_up: 0, planted: 0, watered_2: 0, lasted_week: 0 }
  );

  // `lost` names the branch that leaves at each split — "left" alone would be
  // true but useless; which step somebody fell out of IS the finding.
  const steps = [
    { label: "Signed up", n: sum.signed_up },
    { label: "Planted", n: sum.planted, lost: "never planted" },
    { label: "Watered twice", n: sum.watered_2, lost: "planted, then stopped" },
    { label: "Lasted a week", n: sum.lasted_week, lost: "stopped in week one" },
  ];

  return (
    <main className="adm">
      <AdminNav />
      <h1>Funnel</h1>
      <p className="adm-sub">
        Everything after the sign-up button. The half before it lives in Vercel
        Web Analytics.
      </p>

      <div className="adm-tiles">
        <b><span>{t.players}</span>players</b>
        <b><span>{t.planted_ever}</span>ever planted</b>
        <b><span>{t.plants_alive}</span>plants alive</b>
        <b><span>{t.waterings}</span>waterings</b>
        <b><span>{t.active_7d}</span>active this week</b>
        <b><span>{t.active_1d}</span>active today</b>
      </div>

      <h2>Where people go</h2>
      <div className="adm-scroll adm-scroll-plain">
        <FunnelSankey steps={steps} />
      </div>
      {/* The bar list stays as the table view: the same numbers, reachable
          without reading a picture. */}
      <ol className="adm-funnel">
        {steps.map((s) => (
          <li key={s.label}>
            <span className="adm-bar" style={{ width: pct(s.n, sum.signed_up || 1) }} />
            <b>{s.label}</b>
            <em>{s.n} · {pct(s.n, sum.signed_up)}</em>
          </li>
        ))}
      </ol>

      <h2>Waterings, last 30 days</h2>
      <div className="adm-scroll adm-scroll-plain">
        <LineChart
          points={(f.daily ?? []).map((d) => ({
            x: shortDay(d.day),
            y: d.waterings,
            hint: `${shortDay(d.day)} · ${d.players} player${d.players === 1 ? "" : "s"}`,
          }))}
        />
      </div>

      <h2>Retention, by day since signing up</h2>
      <p className="adm-note">
        Share of players who watered on that day. Only players who have
        <em> existed</em> that long are counted, or a week-old cohort would look
        like it churned on day 13.
      </p>
      <div className="adm-scroll adm-scroll-plain">
        <LineChart
          asPercent
          points={(f.retention ?? []).map((r) => ({
            x: `D${r.day}`,
            y: r.eligible ? Math.round((r.active / r.eligible) * 100) : 0,
            hint: `Day ${r.day} — ${r.active} of ${r.eligible}`,
          }))}
        />
      </div>

      <h2>When people tend, on their own clock</h2>
      <p className="adm-note">
        Local hour, not UTC — the game runs on each player&apos;s frozen
        timezone, so this is the hour a reminder should be argued from.
      </p>
      <div className="adm-scroll adm-scroll-plain">
        <BarChart
          bars={(f.hours ?? []).map((h) => ({
            label: hourLabel(h.hour),
            value: h.waterings,
            hint: `${hourLabel(h.hour)}:00 local`,
          }))}
        />
      </div>

      <h2>By signup day</h2>
      <div className="adm-scroll">
        <table className="adm-table">
          <thead>
            <tr><th>Joined</th><th>Signed up</th><th>Planted</th><th>Watered ×2</th><th>Lasted a week</th></tr>
          </thead>
          <tbody>
            {f.cohorts.map((c) => (
              <tr key={c.joined}>
                <td>{c.joined}</td>
                <td>{c.signed_up}</td>
                <td>{c.planted}</td>
                <td>{c.watered_2}</td>
                <td>{c.lasted_week}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>What they plant</h2>
      <RowBars bars={f.species.map((s) => ({ label: s.name, value: s.planted }))} />
    </main>
  );
}
