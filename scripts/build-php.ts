/**
 * Builds everything the PHP server (HostGator) needs from the TypeScript sources of truth:
 * - php/data/core.json      chapters, detective lines and briefs, skills, Behance specs
 * - php/resources/studio.html  the darkroom view (MCP App), bundled into one file
 * - php/fixtures/           the fictional sample case, its baseline layout and evidence
 * Run: npm run build:php
 */
import { build } from "esbuild";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CHAPTERS, DETECTIVE_NAME, LINES, detectiveBrief, sampleCase } from "@pd/core";
import { BEHANCE, MIN_CONTRAST, baselineDirection } from "@pd/render";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const php = path.join(root, "php");
const read = (...p: string[]) => readFile(path.join(root, ...p), "utf8");

await mkdir(path.join(php, "data"), { recursive: true });
await mkdir(path.join(php, "resources"), { recursive: true });
await mkdir(path.join(php, "fixtures"), { recursive: true });

// 1. Core data.
const core = {
  generatedAt: new Date().toISOString(),
  names: DETECTIVE_NAME,
  lines: LINES,
  chapters: CHAPTERS,
  briefs: {
    "pt-BR": { full: detectiveBrief("pt-BR", "full"), facts: detectiveBrief("pt-BR", "facts") },
    en: { full: detectiveBrief("en", "full"), facts: detectiveBrief("en", "facts") },
  },
  skills: {
    landingPageCase: await read("skills", "landing-page-case", "SKILL.md"),
    behancePack: await read("skills", "behance-pack", "SKILL.md"),
  },
  behance: BEHANCE,
  minContrast: MIN_CONTRAST,
};
await writeFile(path.join(php, "data", "core.json"), JSON.stringify(core, null, 2));

// 2. Darkroom view, one self-contained HTML file.
const bundle = await build({
  entryPoints: [path.join(root, "packages", "view", "src", "main.ts")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  write: false,
  legalComments: "none",
});
const js = bundle.outputFiles[0]!.text.replace(/<\/script/gi, "<\\/script");
const template = await read("packages", "view", "src", "studio.html");
const html = template.replace("/*BUNDLE*/", () => js);
await writeFile(path.join(php, "resources", "studio.html"), html);

// 3. Sample case for the proof and for tests.
const sample = sampleCase();
const baseline = baselineDirection(sample);
for (const e of sample.evidence) {
  await copyFile(path.join(root, "packages", "core", e.key), path.join(php, "fixtures", path.basename(e.key)));
  e.key = `fixtures/${path.basename(e.key)}`;
}
await writeFile(path.join(php, "fixtures", "sample-case.json"), JSON.stringify(sample, null, 2));
await writeFile(path.join(php, "fixtures", "sample-baseline.json"), JSON.stringify(baseline, null, 2));

console.log(`php/data/core.json, php/resources/studio.html (${(html.length / 1024).toFixed(0)} KB), php/fixtures written.`);
