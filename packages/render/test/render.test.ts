import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sampleCase, type Direction, type Evidence } from "@pd/core";
import { BEHANCE, baselineDirection, behanceCopy, checkTokens, contrastRatio, renderDirection } from "../src/index.ts";

const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "core");
const resolve = async (e: Evidence) => `data:${e.mime};base64,${(await readFile(path.join(fixtures, e.key))).toString("base64")}`;

describe("contrast", () => {
  it("matches known WCAG ratios", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 1);
  });
  it("flags weak token pairs", () => {
    const c = sampleCase();
    expect(checkTokens(c.disguise!.tokens)).toEqual([]);
    expect(checkTokens({ ...c.disguise!.tokens, colors: { ...c.disguise!.tokens.colors, text: "#DDDDDD" } })[0]?.code).toBe("contrast");
  });
});

describe("render", () => {
  it("renders the baseline at Behance sizes with no errors", async () => {
    const c = sampleCase();
    const direction = baselineDirection(c);
    const r = await renderDirection({ direction, tokens: c.disguise!.tokens, evidence: c.evidence, resolve, loadWebFonts: false });
    expect(r.issues.filter((i) => i.severity === "error")).toEqual([]);
    const cover = r.modules.find((m) => m.kind === "cover")!;
    expect([cover.width, cover.height]).toEqual([BEHANCE.cover.width * 2, BEHANCE.cover.height * 2]);
    for (const m of r.modules.filter((x) => x.kind === "section")) expect(m.width).toBe(1400);
  }, 60_000);

  it("catches the harness violations: external images, small text, low contrast, missing evidence", async () => {
    const c = sampleCase();
    const direction: Direction = {
      brief: "bad on purpose",
      updatedAt: "",
      modules: [
        { id: "cover", kind: "cover", purpose: "", locked: false, html: `<img src="{{evidence:hero}}">`, css: "" },
        {
          id: "bad",
          kind: "section",
          purpose: "",
          locked: false,
          html: `<p class="tiny">tiny text</p><p class="pale">pale text</p><img src="https://example.com/stock.jpg"><img src="{{evidence:nope}}">`,
          css: `.tiny{font-size:12px}.pale{color:#eeeeee;font-size:30px}#pd-module{padding:200px}`,
        },
      ],
    };
    const r = await renderDirection({ direction, tokens: c.disguise!.tokens, evidence: c.evidence, resolve, loadWebFonts: false });
    const codes = r.issues.filter((i) => i.moduleId === "bad").map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(["small-text", "contrast", "external-resource", "evidence"]));
  }, 60_000);

  it("refuses confidential evidence", async () => {
    const c = sampleCase();
    c.evidence[1]!.confidential = true;
    const direction: Direction = {
      brief: "",
      updatedAt: "",
      modules: [{ id: "s", kind: "section", purpose: "", locked: false, html: `<img src="{{evidence:questions}}">`, css: "" }],
    };
    const r = await renderDirection({ direction, tokens: c.disguise!.tokens, evidence: c.evidence, resolve, loadWebFonts: false });
    expect(r.issues.some((i) => i.code === "evidence" && i.message.includes("confidential"))).toBe(true);
  }, 60_000);

  it("writes Behance copy from the reports only", () => {
    const copy = behanceCopy(sampleCase());
    expect(copy).toContain("Maré Cold Brew");
    expect(copy).toContain("Figma, Framer");
  });
});
