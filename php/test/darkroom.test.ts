/**
 * End to end test of the HostGator build: the PHP server (run with `php -S`) plus the darkroom
 * view, loaded in a sandboxed iframe by a stand-in host, drawing the sample case in Chromium.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium, type Browser } from "playwright";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import JSZip from "jszip";

const here = path.dirname(fileURLToPath(import.meta.url));
const phpRoot = path.resolve(here, "..");
const TOKEN = "php-test-token-aaaaaaaaaaaaaaaaaaaaaaaa";

let dir: string;
let php: ChildProcess;
let base: string;
let client: Client;
let browser: Browser;

type Part = { type: string; text?: string; data?: string };
type Result = { content: Part[]; isError?: boolean; structuredContent?: Record<string, unknown> };
const call = async (name: string, args: Record<string, unknown> = {}) => {
  const r = (await client.callTool({ name, arguments: args })) as Result;
  if (r.isError) throw new Error(`${name}: ${r.content[0]?.text}`);
  return r;
};
const json = async (name: string, args: Record<string, unknown> = {}) => JSON.parse((await call(name, args)).content[0]!.text!);

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "pd-php-"));
  const config = path.join(dir, "config.php");
  await writeFile(
    config,
    `<?php return ['public_url' => 'http://127.0.0.1:8791', 'secret' => str_repeat('s', 40),
      'db' => ['dsn' => 'sqlite:${dir}/pd.sqlite'], 'storage_dir' => '${dir}/storage', 'web_fonts' => false,
      'users' => ['${TOKEN}' => ['id' => 'tester', 'name' => 'Tester']]];`,
  );
  php = spawn("php", ["-S", "127.0.0.1:8791", path.join(phpRoot, "public", "index.php")], {
    env: { ...process.env, PD_CONFIG: config },
    stdio: "ignore",
  });
  base = "http://127.0.0.1:8791";
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${base}/health`)).ok) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  client = new Client({ name: "test", version: "0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${TOKEN}` } } }));
  browser = await chromium.launch();
}, 30_000);

afterAll(async () => {
  await client?.close();
  await browser?.close();
  php?.kill();
  await rm(dir, { recursive: true, force: true });
});

describe("PHP connector", () => {
  it("authenticates, and also accepts the token in the URL for hosts that strip headers", async () => {
    expect((await fetch(`${base}/mcp`, { method: "POST", body: "{}" })).status).toBe(401);
    const r = await fetch(`${base}/mcp?key=${TOKEN}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
    });
    expect(r.status).toBe(200);
  });

  it("introduces Toni Sarjeta and offers the darkroom view", async () => {
    expect(client.getInstructions()).toContain("Toni Sarjeta");
    const tools = (await client.listTools()).tools;
    const preview = tools.find((t) => t.name === "preview_layout")!;
    expect((preview._meta as { ui: { resourceUri: string } }).ui.resourceUri).toBe("ui://portfolio-detective/darkroom.html");
    const save = tools.find((t) => t.name === "save_render")!;
    expect((save._meta as { ui: { visibility: string[] } }).ui.visibility).toEqual(["app"]);
    const res = await client.readResource({ uri: "ui://portfolio-detective/darkroom.html" });
    expect(res.contents[0]!.mimeType).toBe("text/html;profile=mcp-app");
  });

  it("runs an interrogation step and tracks loose ends", async () => {
    const { caseId } = await json("open_case", { title: "Teste" });
    await call("record_answer", { caseId, chapter: "problem", questionId: "before", answer: "  Nada funcionava " });
    const ch = await json("get_chapter", { caseId, chapter: "problem" });
    expect(ch.noir).toBe("O crime");
    expect(ch.questions[0].answer).toBe("Nada funcionava");
    const board = await json("get_case_board", { caseId });
    expect(board.looseEnds.length).toBeGreaterThan(3);
  });

  it("develops the sample case in the darkroom view and closes it", async () => {
    const { caseId } = await json("open_sample_case");
    const baseline = await json("get_layout", { caseId, baseline: true });
    const layout = await json("direct_layout", { caseId, brief: baseline.brief, modules: baseline.modules });
    expect(layout.issues).toEqual([]);

    // Closing before developing is refused.
    const early = (await client.callTool({ name: "close_case", arguments: { caseId } })) as Result;
    expect(early.isError).toBe(true);

    const preview = (await call("preview_layout", { caseId })) as Result;
    expect(preview.structuredContent!.caseId).toBe(caseId);

    // Stand-in host, like Claude: sandboxed iframe, tool calls proxied to the PHP server.
    const harness = await build({ entryPoints: [path.join(here, "harness.ts")], bundle: true, format: "iife", write: false, platform: "browser" });
    const page = await browser.newPage();
    const messages: unknown[] = [];
    await page.exposeFunction("pdCallTool", (name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args }));
    await page.exposeFunction("pdMessage", (p: unknown) => {
      messages.push(p);
    });
    await page.setContent(`<!doctype html><html><body><script>${harness.outputFiles[0]!.text}</script></body></html>`);
    const studio = await readFile(path.join(phpRoot, "resources", "studio.html"), "utf8");
    await page.evaluate(([html, args, result]) => window.pdStart(html as string, args as Record<string, unknown>, result), [studio, { caseId }, preview] as const);

    for (let i = 0; i < 200 && messages.length === 0; i++) await new Promise((r) => setTimeout(r, 150));
    expect(messages).toHaveLength(1);
    const text = JSON.stringify(messages[0]);
    expect(text).toContain("get_review");
    expect(text).toContain("0 erros");

    const shot = await page.screenshot();
    await writeFile(path.join(dir, "..", "pd-darkroom.png"), shot);
    await page.close();

    const review = (await call("get_review", { caseId })) as Result;
    const images = review.content.filter((p) => p.type === "image");
    expect(images.length).toBe(6);
    const info = JSON.parse(review.content.at(-1)!.text!);
    expect(info.issues.filter((i: { severity: string }) => i.severity === "error")).toEqual([]);
    expect(info.stale).toBe(false);

    const closed = await json("close_case", { caseId });
    expect(closed.errors).toEqual([]);
    const zipRes = await fetch(closed.download);
    expect(zipRes.status).toBe(200);
    const zip = await JSZip.loadAsync(Buffer.from(await zipRes.arrayBuffer()));
    const names = Object.keys(zip.files);
    expect(names.filter((n) => n.endsWith(".png"))).toHaveLength(baseline.modules.length);
    const cover = await zip.file(names.find((n) => n.endsWith("00-cover.png"))!)!.async("nodebuffer");
    expect([cover.readUInt32BE(16), cover.readUInt32BE(20)]).toEqual([1616, 1264]);
    const section = await zip.file(names.find((n) => n.endsWith("01-title.png"))!)!.async("nodebuffer");
    expect(section.readUInt32BE(16)).toBe(1400);
    await writeFile(path.join(dir, "..", "pd-sample-behance.zip"), Buffer.from(await zip.generateAsync({ type: "nodebuffer" })));

    // Changing the layout makes the last run stale.
    await call("direct_layout", { caseId, modules: [{ ...baseline.modules[1], html: "<h1>Changed</h1>" }] });
    expect(((await client.callTool({ name: "close_case", arguments: { caseId } })) as Result).isError).toBe(true);
  }, 120_000);

  it("rejects external resources and scripts in modules", async () => {
    const { caseId } = await json("open_sample_case");
    const r = await json("direct_layout", {
      caseId,
      modules: [{ id: "bad", kind: "section", purpose: "x", html: '<img src="https://example.com/a.jpg"><script>1</script>', css: "" }],
    });
    expect(r.issues.map((i: { code: string }) => i.code).sort()).toEqual(["external-resource", "script"]);
  });

  it("uploads evidence through the signed page", async () => {
    const { caseId } = await json("open_case", {});
    const { url } = await json("get_upload_link", { caseId });
    const page = await fetch(url);
    expect(await page.text()).toContain("Entregue as provas");
    const png = await readFile(path.join(phpRoot, "fixtures", "mare-mobile.png"));
    const up = await fetch(url, { method: "POST", headers: { "content-type": "application/octet-stream", "x-filename": "Tela%20Mobile.png" }, body: png });
    expect(await up.json()).toMatchObject({ id: "tela-mobile", width: 390, height: 844 });
    const bad = await fetch(url, { method: "POST", headers: { "content-type": "application/octet-stream" }, body: "nope" });
    expect(bad.status).toBe(415);
  });
});
