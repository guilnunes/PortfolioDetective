import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Server } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import JSZip from "jszip";
import { sampleCase } from "@pd/core";
import { baselineDirection } from "@pd/render";
import { createApp } from "../src/app.ts";
import { Signer, parseUsers } from "../src/auth.ts";
import { FileStore } from "../src/store.ts";

const TOKEN = "test-token-aaaaaaaaaaaaaaaaaaaaaaaa";
const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "core");

let dir: string;
let server: Server;
let base: string;
let client: Client;

type TextContent = { type: "text"; text: string };
const call = async (name: string, args: Record<string, unknown> = {}) => {
  const r = (await client.callTool({ name, arguments: args })) as { content: Array<{ type: string; text?: string; data?: string }>; isError?: boolean };
  if (r.isError) throw new Error(`${name}: ${(r.content[0] as TextContent).text}`);
  return r;
};
const json = async (name: string, args: Record<string, unknown> = {}) =>
  JSON.parse(((await call(name, args)).content.find((c) => c.type === "text") as TextContent).text);

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "pd-"));
  const app = createApp({
    store: new FileStore(dir),
    users: parseUsers(`${TOKEN}:friend1:Friend One`),
    signer: new Signer("x".repeat(40)),
    publicUrl: "http://127.0.0.1:0",
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const port = (server.address() as { port: number }).port;
  base = `http://127.0.0.1:${port}`;
  client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${TOKEN}` } } }),
  );
});

afterAll(async () => {
  await client?.close();
  server?.close();
  await rm(dir, { recursive: true, force: true });
});

describe("connector", () => {
  it("rejects requests without a valid token", async () => {
    const r = await fetch(`${base}/mcp`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    expect(r.status).toBe(401);
  });

  it("ships the detective's character as server instructions", () => {
    expect(client.getInstructions()).toContain("Zé Calha");
    expect(client.getInstructions()).toContain("Never invent metrics");
  });

  it("runs a whole case: interrogation, evidence, layout, render, close", async () => {
    const tools = (await client.listTools()).tools.map((t) => t.name);
    expect(tools).toEqual(expect.arrayContaining(["open_case", "record_answer", "direct_layout", "render_modules", "close_case"]));

    const opened = await json("open_case", { title: "Maré Cold Brew", caseLanguage: "en" });
    const caseId = opened.caseId as string;
    expect(opened.opening).toContain("Sente-se");

    const chapter = await json("get_chapter", { caseId, chapter: "problem" });
    expect(chapter.noir).toBe("O crime");

    // Replay the sample case's answers and reports through the tools.
    const sample = sampleCase();
    for (const [chId, ch] of Object.entries(sample.chapters)) {
      for (const [qid, answer] of Object.entries(ch.answers)) {
        await call("record_answer", { caseId, chapter: chId, questionId: qid, answer });
      }
      const report = ch.reports.at(-1)?.text;
      if (report) await call("write_report", { caseId, chapter: chId, report });
    }
    await call("set_chapter_state", { caseId, chapter: "ai", state: "skipped" });

    // Evidence through the signed upload page.
    const { url } = await json("get_upload_link", { caseId });
    const token = new URL(url).pathname.split("/").pop()!;
    const page = await fetch(`${base}/evidence/${token}`);
    expect(await page.text()).toContain("Entregue as provas");
    for (const e of sample.evidence) {
      const r = await fetch(`${base}/evidence/${token}`, {
        method: "POST",
        headers: { "content-type": "application/octet-stream", "x-filename": e.filename },
        body: await readFile(path.join(fixtures, e.key)),
      });
      expect(r.status).toBe(200);
    }
    const bad = await fetch(`${base}/evidence/${token}`, { method: "POST", headers: { "content-type": "application/octet-stream" }, body: "not an image" });
    expect(bad.status).toBe(415);

    const evidence = await json("list_evidence", { caseId });
    expect(evidence.map((e: { id: string }) => e.id)).toEqual(["mare-hero", "mare-questions", "mare-mobile"]);
    expect(evidence[0].hero).toBe(true);
    expect(evidence[2]).toMatchObject({ width: 390, height: 844 });

    await call("set_disguise", { caseId, source: "suggested", tokens: sample.disguise!.tokens });

    const guide = (await call("get_art_direction_guide")).content[0] as TextContent;
    expect(guide.text).toContain("Critique rubric");

    // Use the baseline as the "art director's" layout, with evidence ids remapped.
    const direction = baselineDirection(sample);
    const remap = (s: string) => s.replace(/evidence:(hero|questions|mobile)\b/g, (_m, id) => `evidence:mare-${id}`);
    const modules = direction.modules.map(({ locked: _l, ...m }) => ({ ...m, id: remap(m.id), html: remap(m.html) }));
    await call("direct_layout", { caseId, brief: "Test brief", modules });

    const rendered = await call("render_modules", { caseId, only: ["cover", "title"] });
    const images = rendered.content.filter((c) => c.type === "image");
    expect(images).toHaveLength(2);
    const report = JSON.parse((rendered.content.at(-1) as TextContent).text);
    expect(report.issues.filter((i: { severity: string }) => i.severity === "error")).toEqual([]);

    // Locked modules can't be overwritten.
    await call("direct_layout", { caseId, modules: [{ ...modules[1]!, locked: true }] });
    const relock = await json("direct_layout", { caseId, modules: [{ ...modules[1]!, html: "<p>changed</p>" }] });
    expect(relock.skippedLocked).toEqual(["title"]);

    const closed = await json("close_case", { caseId });
    expect(closed.errors).toEqual([]);
    const zipRes = await fetch(closed.download.replace("http://127.0.0.1:0", base));
    expect(zipRes.status).toBe(200);
    const zip = await JSZip.loadAsync(Buffer.from(await zipRes.arrayBuffer()));
    const names = Object.keys(zip.files);
    expect(names.some((n) => n.endsWith("00-cover.png"))).toBe(true);
    expect(names.some((n) => n.endsWith("copy.md"))).toBe(true);
    expect(names.filter((n) => n.endsWith(".png")).length).toBe(modules.length);

    const brief = (await call("export_claude_design_brief", { caseId })).content[0] as TextContent;
    expect(brief.text).toContain("Use only the attached images");
  }, 120_000);

  it("keeps cases private between friends", async () => {
    const other = new Client({ name: "other", version: "0" });
    const app = createApp({
      store: new FileStore(dir),
      users: parseUsers(`${"b".repeat(30)}:friend2:Friend Two`),
      signer: new Signer("x".repeat(40)),
      publicUrl: "http://x",
    });
    const s = await new Promise<Server>((r) => {
      const srv = app.listen(0, "127.0.0.1", () => r(srv));
    });
    await other.connect(
      new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${(s.address() as { port: number }).port}/mcp`), {
        requestInit: { headers: { Authorization: `Bearer ${"b".repeat(30)}` } },
      }),
    );
    const list = JSON.parse(((await other.callTool({ name: "list_cases", arguments: {} })).content as TextContent[])[0]!.text);
    expect(list).toEqual([]);
    await other.close();
    s.close();
  });
});
