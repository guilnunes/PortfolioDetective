/**
 * Renders the sample case with the baseline direction and writes the Behance pack.
 * Run: npm run render:sample   (output in out/sample)
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { sampleCase, type Evidence } from "@pd/core";
import { baselineDirection } from "./baseline.ts";
import { renderDirection } from "./render.ts";
import { behancePack } from "./pack.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const fixtures = path.join(root, "packages", "core");
const out = path.join(root, "out", "sample");

export const fixtureResolver = async (e: Evidence) => {
  const buf = await readFile(path.join(fixtures, e.key));
  return `data:${e.mime};base64,${buf.toString("base64")}`;
};

const c = sampleCase();
c.direction = baselineDirection(c);
const { modules, issues } = await renderDirection({
  direction: c.direction,
  tokens: c.disguise!.tokens,
  evidence: c.evidence,
  resolve: fixtureResolver,
  loadWebFonts: process.env.PD_WEB_FONTS !== "0",
});

await mkdir(out, { recursive: true });
for (const m of modules) await writeFile(path.join(out, `${m.id}.png`), m.png);
const pack = await behancePack(c, modules, issues);
await writeFile(path.join(out, pack.filename), pack.zip);

console.log(`Rendered ${modules.length} modules to ${out}`);
for (const m of modules) console.log(`  ${m.id}: ${m.width}x${m.height}, ${(m.bytes / 1024).toFixed(0)} KB`);
console.log(issues.length ? `Issues:\n${issues.map((i) => `  [${i.severity}] ${i.moduleId} ${i.code}: ${i.message}`).join("\n")}` : "No issues.");
