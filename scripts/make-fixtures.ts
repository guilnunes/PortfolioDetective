/**
 * Generates fictional "screenshots" for the sample case (Maré Cold Brew, an invented brand).
 * They stand in for real evidence until a real case is used.
 * Run: npx tsx scripts/make-fixtures.ts
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "packages", "core", "fixtures");

const base = `*{box-sizing:border-box;margin:0}body{font-family:Georgia,serif;color:#1F2A33;background:#F4EEE3}
nav{display:flex;justify-content:space-between;align-items:center;padding:28px 64px;font:600 18px system-ui}
nav b{font:700 28px Georgia}.btn{background:#1F6F8B;color:#fff;padding:14px 26px;border-radius:999px;font:600 16px system-ui}`;

const bottle = (w: number) => `<svg width="${w}" viewBox="0 0 120 300"><rect x="45" y="0" width="30" height="40" rx="6" fill="#1F2A33"/>
<path d="M40 40h40l10 40v200a20 20 0 0 1-20 20H50a20 20 0 0 1-20-20V80z" fill="#3B2A20"/>
<rect x="34" y="130" width="52" height="90" rx="6" fill="#F4EEE3"/><text x="60" y="180" text-anchor="middle" font-family="Georgia" font-size="20" fill="#1F6F8B">maré</text></svg>`;

const wave = `<svg viewBox="0 0 1440 260" preserveAspectRatio="none" style="position:absolute;bottom:0;left:0;width:100%;height:260px">
<path d="M0 120 C 240 40 480 200 720 120 S 1200 40 1440 120 V260 H0Z" fill="#1F6F8B"/>
<path d="M0 170 C 260 110 520 230 760 170 S 1220 110 1440 170 V260 H0Z" fill="#2E8BA8" opacity=".8"/></svg>`;

const pages: Record<string, { w: number; h: number; html: string }> = {
  "mare-hero.png": {
    w: 1440,
    h: 900,
    html: `<style>${base}.h{position:relative;height:812px;overflow:hidden}
.copy{position:absolute;left:64px;top:140px;width:640px}h1{font:700 88px/1 Georgia}p{font:400 22px/1.5 system-ui;margin:28px 0 40px;color:#435260}
.b{position:absolute;right:220px;top:90px;transform:rotate(-8deg)}</style>
<nav><b>maré</b><span>Story &nbsp; Questions &nbsp; Subscribe &nbsp; <span class="btn">Order now</span></span></nav>
<div class="h"><div class="copy"><h1>Cold brew that tastes like the coast.</h1><p>Slow brewed for 18 hours in Santos. Delivered on your schedule.</p><span class="btn">Start a subscription</span></div>
<div class="b">${bottle(260)}</div>${wave}</div>`,
  },
  "mare-questions.png": {
    w: 1440,
    h: 900,
    html: `<style>${base}.q{padding:60px 64px}h2{font:700 56px Georgia;margin-bottom:40px}
.g{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}.c{background:#fff;border-radius:20px;padding:32px;min-height:220px}
.c h3{font:700 26px Georgia;margin-bottom:14px}.c p{font:400 18px/1.5 system-ui;color:#435260}.n{font:700 16px system-ui;color:#1F6F8B;margin-bottom:12px}</style>
<nav><b>maré</b><span class="btn">Order now</span></nav><div class="q"><h2>The five things everyone asks us</h2><div class="g">
${[
  ["How long does it keep?", "Ten days in the fridge, unopened. Four once you open it."],
  ["Is it strong?", "About two espressos per bottle. Add milk or water if you like."],
  ["Where do you deliver?", "The whole coast from Bertioga to Peruíbe, every Thursday."],
  ["Can I pause my subscription?", "Any time, with one tap. No calls, no forms."],
  ["What beans do you use?", "Single origin from a family farm in the Mantiqueira."],
  ["Still curious?", "Message us. We actually answer, just not at midnight anymore."],
]
  .map(([t, d], i) => `<div class="c"><div class="n">0${i + 1}</div><h3>${t}</h3><p>${d}</p></div>`)
  .join("")}</div></div>`,
  },
  "mare-mobile.png": {
    w: 390,
    h: 844,
    html: `<style>${base}nav{padding:20px}.m{padding:20px}h2{font:700 34px/1.1 Georgia;margin:10px 0 18px}
.card{background:#fff;border-radius:22px;padding:22px;margin-bottom:16px}.row{display:flex;justify-content:space-between;align-items:center;font:600 17px system-ui}
.tg{width:54px;height:32px;border-radius:99px;background:#1F6F8B;position:relative}.tg::after{content:"";position:absolute;right:4px;top:4px;width:24px;height:24px;border-radius:50%;background:#fff}
.sz{display:flex;gap:10px;margin-top:14px}.sz span{flex:1;text-align:center;padding:12px;border-radius:14px;border:2px solid #D8CFC0;font:600 15px system-ui}.sz .on{border-color:#1F6F8B;color:#1F6F8B}
.btn{display:block;text-align:center;margin-top:20px}</style>
<nav><b>maré</b></nav><div class="m"><div style="display:grid;place-items:center">${bottle(120)}</div><h2>Your weekly cold brew</h2>
<div class="card"><div class="row">Subscribe and save 15%<span class="tg"></span></div></div>
<div class="card"><div class="row">Bottle size</div><div class="sz"><span>300ml</span><span class="on">500ml</span><span>1L</span></div></div>
<span class="btn">Start for R$ 34/week</span></div>`,
  },
};

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
for (const [name, p] of Object.entries(pages)) {
  const page = await browser.newPage({ viewport: { width: p.w, height: p.h }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><body>${p.html}</body></html>`);
  await page.screenshot({ path: path.join(out, name), clip: { x: 0, y: 0, width: p.w, height: p.h } });
  await page.close();
  console.log("wrote", name);
}
await browser.close();
