import type { Evidence, Module, StyleTokens } from "@pd/core";
import { BEHANCE } from "./spec.ts";

export type EvidenceResolver = (e: Evidence) => Promise<string>; // returns a data: URI

const EVIDENCE_RE = /\{\{\s*evidence:([a-zA-Z0-9_-]+)\s*\}\}/g;

export function evidenceIdsIn(html: string): string[] {
  return [...html.matchAll(EVIDENCE_RE)].map((m) => m[1]!);
}

const googleFontsHref = (t: StyleTokens): string => {
  const fams = [...new Set([t.fonts.heading, t.fonts.body])]
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${fams}&display=swap`;
};

const escapeCss = (s: string) => s.replace(/["\\]/g, "");

/**
 * Wraps one module in a full HTML document: reset, style tokens as CSS variables,
 * and evidence placeholders swapped for data URIs. Nothing else from the outside world:
 * only the client's evidence may appear in the output.
 */
export async function modulePage(opts: {
  module: Module;
  tokens: StyleTokens;
  evidence: Evidence[];
  resolve: EvidenceResolver;
  loadWebFonts?: boolean;
}): Promise<{ html: string; missing: string[] }> {
  const { module, tokens, evidence, resolve } = opts;
  const missing: string[] = [];
  let body = module.html;
  for (const id of new Set(evidenceIdsIn(body))) {
    const e = evidence.find((x) => x.id === id);
    if (!e) {
      missing.push(id);
      continue;
    }
    if (e.confidential) {
      missing.push(`${id} (confidential)`);
      continue;
    }
    const uri = await resolve(e);
    body = body.replace(new RegExp(`\\{\\{\\s*evidence:${id}\\s*\\}\\}`, "g"), uri);
  }

  const width = module.kind === "cover" ? BEHANCE.cover.width : BEHANCE.moduleWidth;
  const height = module.kind === "cover" ? `${BEHANCE.cover.height}px` : "auto";
  const c = tokens.colors;
  const html = `<!doctype html>
<html><head><meta charset="utf-8">
${opts.loadWebFonts === false ? "" : `<link rel="stylesheet" href="${googleFontsHref(tokens)}">`}
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --pd-bg:${c.background};--pd-surface:${c.surface};--pd-text:${c.text};
  --pd-muted:${c.muted};--pd-accent:${c.accent};
  --pd-font-heading:"${escapeCss(tokens.fonts.heading)}",Georgia,serif;
  --pd-font-body:"${escapeCss(tokens.fonts.body)}",system-ui,sans-serif;
  --pd-width:${width}px;
}
html,body{width:${width}px;background:var(--pd-bg);color:var(--pd-text);font-family:var(--pd-font-body);-webkit-font-smoothing:antialiased}
img{display:block;max-width:100%}
#pd-module{width:${width}px;height:${height};overflow:hidden;position:relative}
${module.css}
</style></head>
<body><main id="pd-module" data-kind="${module.kind}">${body}</main></body></html>`;
  return { html, missing };
}
