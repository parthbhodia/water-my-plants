// Mobile audit: walks the app on phone viewports and reports anything that
// would break a thumb — horizontal overflow, tap targets under 44px, controls
// pushed off-screen, and page errors.  Run: node scripts/mobile-audit.mjs
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.env.OUT ?? "/tmp/mobile-audit";
const MIN_TAP = 44;

const DEVICES = [
  { name: "iphone-portrait", width: 390, height: 844 },
  { name: "iphone-landscape", width: 844, height: 390 },
  { name: "small-portrait", width: 360, height: 640 },
];

/** Everything a thumb must be able to reach. */
const TAPPABLE = "button, a, input, select, [role=button]";

async function audit(page, label, findings) {
  // give canvases and transitions a beat
  await page.waitForTimeout(900);

  const res = await page.evaluate((minTap) => {
    const out = { overflow: null, small: [], offscreen: [] };
    const de = document.documentElement;
    if (de.scrollWidth > de.clientWidth + 1) {
      // find the widest offender
      let worst = null;
      document.querySelectorAll("*").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0) return;
        if (r.right > de.clientWidth + 1 || r.left < -1) {
          const over = Math.max(r.right - de.clientWidth, -r.left);
          if (!worst || over > worst.over) {
            worst = { over: Math.round(over), tag: el.tagName.toLowerCase(), cls: el.className?.toString?.().slice(0, 60) ?? "" };
          }
        }
      });
      out.overflow = { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, worst };
    }
    document.querySelectorAll("button, a, input, select, [role=button]").forEach((el) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || st.visibility === "hidden" || st.display === "none") return;
      const label = (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 34);
      if (r.width < minTap || r.height < minTap) {
        out.small.push({ label, w: Math.round(r.width), h: Math.round(r.height), cls: el.className?.toString?.().slice(0, 40) ?? "" });
      }
      // horizontal only: vertical overflow inside a scrollable panel is fine
      if (r.right < 1 || r.left > de.clientWidth - 1) {
        out.offscreen.push({ label, cls: el.className?.toString?.().slice(0, 40) ?? "" });
      }
    });
    return out;
  }, MIN_TAP);

  if (res.overflow) {
    findings.push(`${label}: HORIZONTAL OVERFLOW ${res.overflow.scrollWidth}px > ${res.overflow.clientWidth}px` +
      (res.overflow.worst ? ` — worst: <${res.overflow.worst.tag} class="${res.overflow.worst.cls}"> by ${res.overflow.worst.over}px` : ""));
  }
  // dedupe small targets by class
  const seen = new Set();
  for (const s of res.small) {
    const key = s.cls || s.label;
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push(`${label}: SMALL TAP TARGET ${s.w}x${s.h} "${s.label}" (.${s.cls.split(" ")[0]})`);
  }
  for (const o of res.offscreen.slice(0, 4)) {
    findings.push(`${label}: OFF-SCREEN "${o.label}" (.${o.cls.split(" ")[0]})`);
  }
  await page.screenshot({ path: `${OUT}/${label}.png` });
}

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const findings = [];
const errors = [];

for (const d of DEVICES) {
  const ctx = await b.newContext({
    viewport: { width: d.width, height: d.height },
    hasTouch: true, isMobile: true, deviceScaleFactor: 3,
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${d.name}: ${e.message}`));

  // ---- landing page ----
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await audit(page, `${d.name}--landing`, findings);
  await page.evaluate(() => document.querySelector("#plants")?.scrollIntoView());
  await audit(page, `${d.name}--landing-plants`, findings);

  // ---- garden shell, every tab and modal ----
  await page.goto(`${BASE}/dev-mobile`, { waitUntil: "networkidle" });
  await page.waitForSelector("canvas");
  await audit(page, `${d.name}--garden`, findings);
  await page.evaluate(() => window.__sheet(true));
  await audit(page, `${d.name}--garden-sheet`, findings);
  for (const tab of ["profile"]) {
    await page.evaluate((t) => window.__tab(t), tab);
    await audit(page, `${d.name}--tab-${tab}`, findings);
  }
  await page.evaluate(() => window.__tab("garden"));
  for (const m of ["seed", "journal", "tutorial"]) {
    await page.evaluate((x) => window.__modal(x), m);
    await audit(page, `${d.name}--modal-${m}`, findings);
    await page.evaluate(() => window.__modal(null));
  }
  // ---- can a thumb actually tap a plant? ----
  await page.goto(`${BASE}/dev-mobile`, { waitUntil: "networkidle" });
  await page.waitForSelector("canvas");
  await page.waitForTimeout(2200);
  const probe = await page.evaluate(() => window.__lilyProbe?.());
  const canvasBox = await page.locator(".game-host canvas").boundingBox();
  // tap where the scene says a plant is: convert world -> screen via the probe
  const hit = await page.evaluate(() => {
    // ask the scene for a plot's screen position
    const g = window.__plotScreenPos?.(0);
    return g ?? null;
  });
  if (hit && canvasBox) {
    await page.touchscreen.tap(hit.x, hit.y);
    await page.waitForTimeout(500);
    const tapped = await page.evaluate(() => window.__tapped);
    if (tapped === null || tapped === undefined) {
      findings.push(`${d.name}--tap: TAP ON PLANT DID NOT REGISTER at (${Math.round(hit.x)}, ${Math.round(hit.y)})`);
      await page.screenshot({ path: `${OUT}/${d.name}--tap-fail.png` });
    }
  } else {
    findings.push(`${d.name}--tap: could not locate a plant on screen (probe=${JSON.stringify(probe)})`);
  }

  // ---- does the Water button actually water? ----
  await page.evaluate(() => window.__sheet(true));
  await page.waitForTimeout(700);
  const camInset = await page.evaluate(() => window.__camInset?.() ?? -1);
  const overlay = await page.evaluate(() => {
    const el = document.querySelector(".panel-wrap");
    return el ? Math.round(window.innerHeight - el.getBoundingClientRect().top) : 0;
  });
  // an open sheet is an overlay; it must never reflow the camera
  if (camInset > 80) {
    findings.push(`${d.name}--camera: SHEET SQUEEZES STAGE — camera reserves ${camInset}px (overlay covers ${overlay}px)`);
  }
  const waterBtn = page.locator(".plot-buttons .btn.blue");
  if (await waterBtn.count()) {
    await page.evaluate(() => { window.__poured = null; });
    await waterBtn.tap();
    let poured = null;
    for (let i = 0; i < 12 && !poured; i++) {
      await page.waitForTimeout(500);
      poured = await page.evaluate(() => window.__poured);
    }
    if (!poured) {
      findings.push(`${d.name}--water: WATER BUTTON DID NOTHING (no pour after 6s)`);
      await page.screenshot({ path: `${OUT}/${d.name}--water-fail.png` });
    }
  } else {
    findings.push(`${d.name}--water: no Water button found`);
  }
  await page.evaluate(() => window.__sheet(false));

  await ctx.close();
}

await b.close();
console.log(`\n=== ${findings.length} findings ===`);
findings.forEach((f) => console.log("• " + f));
if (errors.length) {
  console.log(`\n=== ${errors.length} page errors ===`);
  [...new Set(errors)].forEach((e) => console.log("! " + e));
}
if (!findings.length && !errors.length) console.log("clean");
