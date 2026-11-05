/**
 * Draws one module in the user's browser and turns it into a PNG.
 * Runs inside Claude's sandboxed view: no network, so every image and font arrives as a data: URI.
 */

export interface JobModule {
  id: string;
  kind: "cover" | "section";
  html: string; // evidence already replaced by data: URIs on the server
  css: string;
}

export interface JobSpec {
  moduleWidth: number;
  cover: { width: number; height: number; scale: number };
  minFontPx: number;
  maxModuleHeight: number;
  minModuleHeight: number;
  maxModuleBytes: number;
}

export interface JobTokens {
  colors: { background: string; surface: string; text: string; muted: string; accent: string };
  fonts: { heading: string; body: string };
}

export interface Issue {
  moduleId: string;
  severity: "error" | "warning";
  code: string;
  message: string;
}

export interface Rendered {
  id: string;
  kind: JobModule["kind"];
  width: number;
  height: number;
  png: string; // base64, no prefix
  issues: Issue[];
}

const cssEscape = (s: string) => s.replace(/["\\<>]/g, "");

export function moduleCss(m: JobModule, t: JobTokens, spec: JobSpec): string {
  const isCover = m.kind === "cover";
  const width = isCover ? spec.cover.width : spec.moduleWidth;
  const c = t.colors;
  return `
#pd-wrap{--pd-bg:${c.background};--pd-surface:${c.surface};--pd-text:${c.text};--pd-muted:${c.muted};--pd-accent:${c.accent};
--pd-font-heading:"${cssEscape(t.fonts.heading)}",Georgia,serif;--pd-font-body:"${cssEscape(t.fonts.body)}",system-ui,sans-serif;--pd-width:${width}px;
width:${width}px;background:var(--pd-bg);color:var(--pd-text);font-family:var(--pd-font-body);-webkit-font-smoothing:antialiased}
:where(#pd-wrap *,#pd-wrap *::before,#pd-wrap *::after){box-sizing:border-box;margin:0;padding:0}
:where(#pd-wrap img){display:block;max-width:100%}
:where(#pd-module){position:relative;background:var(--pd-bg)}
#pd-module{width:${width}px;${isCover ? `height:${spec.cover.height}px;` : ""}overflow:hidden}
${m.css}`;
}

const parseRgb = (s: string): number[] | null => {
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1]!.split(/[ ,/]+/).filter(Boolean).map(Number);
  return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p[3] ?? 1];
};
const lum = (c: number[]) => {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(c[0]!) + 0.7152 * ch(c[1]!) + 0.0722 * ch(c[2]!);
};

/** The same quality rules as the server-side renderer, run on the live DOM. */
function checkDom(root: HTMLElement, m: JobModule, spec: JobSpec): { height: number; issues: Issue[] } {
  const issues: Issue[] = [];
  const minFont = m.kind === "cover" ? 14 : spec.minFontPx;
  const bgOf = (el: Element | null): number[] | null => {
    while (el) {
      const cs = getComputedStyle(el);
      if (cs.backgroundImage && cs.backgroundImage !== "none") return null;
      const c = parseRgb(cs.backgroundColor);
      if (c && c[3]! > 0.9) return c;
      el = el.parentElement;
    }
    return [255, 255, 255, 1];
  };
  const seen = new Set<Element>();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let small = 0;
  let low = 0;
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const text = n.textContent?.trim();
    const el = n.parentElement;
    if (!text || !el || seen.has(el)) continue;
    seen.add(el);
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
    const size = parseFloat(cs.fontSize);
    if (size < minFont && small++ < 5) {
      issues.push({ moduleId: m.id, severity: "warning", code: "small-text", message: `Text too small for phones: ${size}px "${text.slice(0, 40)}".` });
    }
    const fg = parseRgb(cs.color);
    const bg = bgOf(el);
    if (fg && bg) {
      const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x) as [number, number];
      const ratio = (a + 0.05) / (b + 0.05);
      const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
      if (ratio < (large ? 3 : 4.5) && low++ < 5) {
        issues.push({ moduleId: m.id, severity: "error", code: "contrast", message: `Low contrast ${ratio.toFixed(2)}:1 on "${text.slice(0, 40)}".` });
      }
    }
  }
  const width = m.kind === "cover" ? spec.cover.width : spec.moduleWidth;
  if (root.scrollWidth > width + 1) issues.push({ moduleId: m.id, severity: "error", code: "overflow", message: "Content overflows the module width." });
  for (const img of Array.from(root.querySelectorAll("img"))) {
    if (!img.complete || img.naturalWidth === 0) {
      issues.push({ moduleId: m.id, severity: "error", code: "evidence", message: "An image did not load." });
      break;
    }
  }
  const height = m.kind === "cover" ? spec.cover.height : Math.ceil(root.scrollHeight);
  if (m.kind === "section" && height > spec.maxModuleHeight) {
    issues.push({ moduleId: m.id, severity: "warning", code: "too-tall", message: `Module is ${height}px tall; split it below ${spec.maxModuleHeight}px.` });
  }
  if (m.kind === "section" && height < spec.minModuleHeight) {
    issues.push({ moduleId: m.id, severity: "warning", code: "too-short", message: `Module is only ${height}px tall.` });
  }
  return { height: Math.min(Math.max(height, 1), m.kind === "cover" ? spec.cover.height : spec.maxModuleHeight), issues };
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The module could not be drawn (invalid markup?)."));
    img.src = src;
  });

/** Lays the module out off screen, checks it, then rasterizes it through an SVG foreignObject. */
export async function renderModule(
  m: JobModule,
  tokens: JobTokens,
  spec: JobSpec,
  stage: HTMLElement,
  fontCss = "",
): Promise<Rendered> {
  const isCover = m.kind === "cover";
  const width = isCover ? spec.cover.width : spec.moduleWidth;
  const scale = isCover ? spec.cover.scale : 1;
  const css = fontCss + moduleCss(m, tokens, spec);

  // 1. Live layout inside a shadow root (so module CSS can't leak into the view), for measuring and checking.
  // @font-face is ignored inside shadow roots, so fonts are also registered on the document by the caller.
  const host = document.createElement("div");
  const shadow = host.attachShadow({ mode: "open" });
  const wrap = document.createElement("div");
  wrap.id = "pd-wrap";
  const style = document.createElement("style");
  style.textContent = css;
  const main = document.createElement("main");
  main.id = "pd-module";
  main.innerHTML = m.html;
  wrap.append(style, main);
  shadow.append(wrap);
  stage.replaceChildren(host);
  await Promise.all(Array.from(main.querySelectorAll("img")).map((i) => i.decode().catch(() => undefined)));
  await document.fonts.ready;
  const { height, issues } = checkDom(main, m, spec);

  // 2. Rasterize the same markup.
  const xml = new XMLSerializer().serializeToString(wrap);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject x="0" y="0" width="${width}" height="${height}">${xml}</foreignObject></svg>`;
  const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  await img.decode().catch(() => undefined);
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.fillStyle = tokens.colors.background;
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  let png: string;
  try {
    png = canvas.toDataURL("image/png").split(",")[1]!;
  } catch {
    throw new Error("This browser blocks exporting the drawing. Try Claude on desktop or in Chrome.");
  }
  const bytes = Math.floor((png.length * 3) / 4);
  if (bytes > spec.maxModuleBytes) {
    issues.push({ moduleId: m.id, severity: "warning", code: "heavy", message: `Image is ${(bytes / 1048576).toFixed(1)} MB.` });
  }
  stage.replaceChildren();
  return { id: m.id, kind: m.kind, width: width * scale, height: height * scale, png, issues };
}
