import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

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
type Funnel = { totals: Totals; cohorts: Cohort[]; species: Species[] };

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

  const steps = [
    { label: "Signed up", n: sum.signed_up },
    { label: "Planted something", n: sum.planted },
    { label: "Watered twice", n: sum.watered_2 },
    { label: "Lasted a week", n: sum.lasted_week },
  ];

  return (
    <main className="adm">
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

      <h2>Where people stop</h2>
      <ol className="adm-funnel">
        {steps.map((s) => (
          <li key={s.label}>
            <span className="adm-bar" style={{ width: pct(s.n, sum.signed_up || 1) }} />
            <b>{s.label}</b>
            <em>{s.n} · {pct(s.n, sum.signed_up)}</em>
          </li>
        ))}
      </ol>

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
      <div className="adm-scroll">
        <table className="adm-table">
          <thead><tr><th>Species</th><th>Times planted</th></tr></thead>
          <tbody>
            {f.species.map((s) => (
              <tr key={s.key}><td>{s.name}</td><td>{s.planted}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
