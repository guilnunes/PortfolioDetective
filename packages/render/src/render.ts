import { chromium, type Browser } from "playwright";
import type { Direction, Evidence, Module, StyleTokens } from "@pd/core";
import { modulePage, type EvidenceResolver } from "./page.ts";
import { BEHANCE, MIN_CONTRAST } from "./spec.ts";
import { contrastRatio } from "./contrast.ts";

export type Severity = "error" | "warning";

export interface Issue {
  moduleId: string | "tokens";
  severity: Severity;
  code: string;
  message: string;
}

export interface RenderedModule {
  id: string;
  kind: Module["kind"];
  png: Buffer;
  width: number;
  height: number;
  bytes: number;
}

export interface RenderResult {
  modules: RenderedModule[];
  issues: Issue[];
}

const ALLOWED_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

/** Checks on the style tokens alone, before any rendering. */
export function checkTokens(tokens: StyleTokens): Issue[] {
  const issues: Issue[] = [];
  const pairs: [string, string, string][] = [
    ["text", tokens.colors.text, tokens.colors.background],
    ["text on surface", tokens.colors.text, tokens.colors.surface],
  ];
  for (const [label, fg, bg] of pairs) {
    const r = contrastRatio(fg, bg);
    if (r === null) {
      issues.push({ moduleId: "tokens", severity: "warning", code: "color-format", message: `Could not read colors for ${label}; use #rrggbb.` });
    } else if (r < MIN_CONTRAST) {
      issues.push({
        moduleId: "tokens",
        severity: "error",
        code: "contrast",
        message: `Contrast for ${label} is ${r.toFixed(2)}:1, below ${MIN_CONTRAST}:1.`,
      });
    }
  }
  return issues;
}

/**
 * Renders every module of a direction to PNG and runs the quality rules on the live DOM.
 * The issues list is what the critic reads together with the images.
 */
export async function renderDirection(opts: {
  direction: Direction;
  tokens: StyleTokens;
  evidence: Evidence[];
  resolve: EvidenceResolver;
  only?: string[];
  loadWebFonts?: boolean;
  browser?: Browser;
}): Promise<RenderResult> {
  const issues: Issue[] = checkTokens(opts.tokens);
  const modules: RenderedModule[] = [];
  const webFonts = opts.loadWebFonts ?? process.env.PD_WEB_FONTS !== "0";
  const own = !opts.browser;
  const browser = opts.browser ?? (await chromium.launch());
  try {
    const covers = opts.direction.modules.filter((m) => m.kind === "cover");
    if (covers.length === 0) issues.push({ moduleId: "tokens", severity: "error", code: "no-cover", message: "The direction has no cover module." });
    if (covers.length > 1) issues.push({ moduleId: "tokens", severity: "warning", code: "many-covers", message: "More than one cover; only the first is used." });

    for (const m of opts.direction.modules) {
      if (opts.only && !opts.only.includes(m.id)) continue;
      const { html, missing } = await modulePage({
        module: m,
        tokens: opts.tokens,
        evidence: opts.evidence,
        resolve: opts.resolve,
        loadWebFonts: webFonts,
      });
      for (const id of missing) {
        issues.push({ moduleId: m.id, severity: "error", code: "evidence", message: `Evidence not available: ${id}.` });
      }

      const isCover = m.kind === "cover";
      const width = isCover ? BEHANCE.cover.width : BEHANCE.moduleWidth;
      const scale = isCover ? BEHANCE.cover.scale : 1;
      const context = await browser.newContext({
        viewport: { width, height: isCover ? BEHANCE.cover.height : 900 },
        deviceScaleFactor: scale,
      });
      // esbuild (tsx, vitest) wraps functions in __name(); define it so page.evaluate works.
      await context.addInitScript("globalThis.__name = (f) => f;");
      const page = await context.newPage();
      const external: string[] = [];
      await page.route("**/*", (route) => {
        const url = route.request().url();
        if (url.startsWith("data:") || url === "about:blank") return route.continue();
        const host = new URL(url).hostname;
        if (webFonts && ALLOWED_HOSTS.includes(host)) return route.continue().catch(() => route.abort());
        external.push(url);
        return route.abort();
      });
      try {
        await page.setContent(html, { waitUntil: "load", timeout: 15000 });
      } catch {
        // Fonts that never answer must not block the render; fallbacks are fine.
      }
      await page.evaluate(() => Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 3000))]));

      for (const url of external) {
        issues.push({
          moduleId: m.id,
          severity: "error",
          code: "external-resource",
          message: `External resource blocked: ${url}. Only the client's evidence may appear.`,
        });
      }

      const dom = await page.evaluate(
        ({ minFont }) => {
          const root = document.getElementById("pd-module")!;
          const rect = root.getBoundingClientRect();
          const small: string[] = [];
          const lowContrast: { text: string; ratio: number }[] = [];
          const lum = (c: number[]) => {
            const ch = (v: number) => {
              const s = v / 255;
              return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
            };
            return 0.2126 * ch(c[0]!) + 0.7152 * ch(c[1]!) + 0.0722 * ch(c[2]!);
          };
          const rgba = (s: string) => {
            const m = s.match(/rgba?\(([^)]+)\)/);
            if (!m) return null;
            const p = m[1]!.split(/[ ,/]+/).filter(Boolean).map(Number);
            return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p[3] ?? 1];
          };
          const bgOf = (el: Element | null): number[] | null => {
            while (el) {
              const cs = getComputedStyle(el);
              if (cs.backgroundImage && cs.backgroundImage !== "none") return null; // unknown, over an image
              const c = rgba(cs.backgroundColor);
              if (c && c[3]! > 0.9) return c;
              el = el.parentElement;
            }
            return [255, 255, 255, 1];
          };
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          const seen = new Set<Element>();
          let n: Node | null;
          while ((n = walker.nextNode())) {
            const text = n.textContent?.trim();
            const el = n.parentElement;
            if (!text || !el || seen.has(el)) continue;
            seen.add(el);
            const cs = getComputedStyle(el);
            if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
            const size = parseFloat(cs.fontSize);
            if (size < minFont) small.push(`${size}px "${text.slice(0, 40)}"`);
            const fg = rgba(cs.color);
            const bg = bgOf(el);
            if (fg && bg) {
              const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x) as [number, number];
              const ratio = (a + 0.05) / (b + 0.05);
              const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
              if (ratio < (large ? 3 : 4.5)) lowContrast.push({ text: text.slice(0, 40), ratio: Math.round(ratio * 100) / 100 });
            }
          }
          const overflowX = root.scrollWidth > rect.width + 1;
          return { height: Math.ceil(root.scrollHeight), small, lowContrast, overflowX };
        },
        { minFont: m.kind === "cover" ? 14 : BEHANCE.minFontPx },
      );

      for (const s of dom.small.slice(0, 5)) {
        issues.push({ moduleId: m.id, severity: "warning", code: "small-text", message: `Text too small for phones: ${s}.` });
      }
      for (const lc of dom.lowContrast.slice(0, 5)) {
        issues.push({ moduleId: m.id, severity: "error", code: "contrast", message: `Low contrast ${lc.ratio}:1 on "${lc.text}".` });
      }
      if (dom.overflowX) issues.push({ moduleId: m.id, severity: "error", code: "overflow", message: "Content overflows the module width." });

      const height = isCover ? BEHANCE.cover.height : Math.min(Math.max(dom.height, 1), BEHANCE.maxModuleHeight);
      if (!isCover && dom.height > BEHANCE.maxModuleHeight) {
        issues.push({ moduleId: m.id, severity: "warning", code: "too-tall", message: `Module is ${dom.height}px tall; split it below ${BEHANCE.maxModuleHeight}px.` });
      }
      if (!isCover && dom.height < BEHANCE.minModuleHeight) {
        issues.push({ moduleId: m.id, severity: "warning", code: "too-short", message: `Module is only ${dom.height}px tall.` });
      }

      await page.setViewportSize({ width, height });
      const png = await page.screenshot({ clip: { x: 0, y: 0, width, height }, type: "png" });
      if (png.byteLength > BEHANCE.maxModuleBytes) {
        issues.push({
          moduleId: m.id,
          severity: "warning",
          code: "heavy",
          message: `Image is ${(png.byteLength / 1048576).toFixed(1)} MB; aim for under ${BEHANCE.maxModuleBytes / 1048576} MB.`,
        });
      }
      modules.push({ id: m.id, kind: m.kind, png, width: width * scale, height: height * scale, bytes: png.byteLength });
      await context.close();
    }
  } finally {
    if (own) await browser.close();
  }
  return { modules, issues };
}
