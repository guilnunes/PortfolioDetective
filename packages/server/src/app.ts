import express, { type Request, type Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { DETECTIVE_NAME, Lang, detectiveBrief } from "@pd/core";
import { accountFromHeader, type Account, type Signer } from "./auth.ts";
import { defaultProfile, type Store } from "./store.ts";
import { registerTools } from "./tools.ts";
import { uploadPage } from "./uploadPage.ts";
import { imageInfo } from "./images.ts";

export interface AppOptions {
  store: Store;
  users: Map<string, Account>;
  signer: Signer;
  publicUrl: string;
}

const MAX_UPLOAD = 20 * 1024 * 1024;

export function createApp(opts: AppOptions) {
  const app = express();
  app.disable("x-powered-by");

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/", (_req, res) => {
    res.type("text/plain").send(
      `Portfolio Detective. ${DETECTIVE_NAME["pt-BR"]} / ${DETECTIVE_NAME.en} is in.\nAdd ${opts.publicUrl}/mcp as a custom connector in Claude, with the header Authorization: Bearer <your token>.\n`,
    );
  });

  // Door A: the Claude connector. Stateless Streamable HTTP, one server per request.
  app.post("/mcp", express.json({ limit: "4mb" }), async (req: Request, res: Response) => {
    const account = accountFromHeader(req.header("authorization"), opts.users);
    if (!account) {
      res.status(401).json({ jsonrpc: "2.0", error: { code: -32001, message: "Unknown or missing token" }, id: null });
      return;
    }
    let profile = await opts.store.getUser(account.userId);
    if (!profile) {
      profile = defaultProfile(account.userId, account.name);
      await opts.store.saveUser(profile);
    }
    const server = new McpServer(
      { name: "portfolio-detective", version: "0.1.0" },
      { instructions: detectiveBrief(profile.interfaceLanguage, profile.detectiveMode) },
    );
    registerTools(server, { account, profile, store: opts.store, signer: opts.signer, publicUrl: opts.publicUrl });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (e) {
      if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: (e as Error).message }, id: null });
    }
  });

  const notAllowed = (_req: Request, res: Response) => {
    res.status(405).set("Allow", "POST").json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null });
  };
  app.get("/mcp", notAllowed);
  app.delete("/mcp", notAllowed);

  // Evidence upload page, reached through a signed link from get_upload_link.
  app.get("/evidence/:token", (req, res) => {
    const data = opts.signer.verify(req.params.token);
    if (!data) {
      res.status(410).type("text/plain").send("This link expired. Ask the detective for a new one.");
      return;
    }
    const lang = Lang.safeParse(data.l).success ? (data.l as Lang) : "pt-BR";
    res.type("html").send(uploadPage(lang));
  });

  app.post("/evidence/:token", express.raw({ type: "application/octet-stream", limit: MAX_UPLOAD }), async (req, res) => {
    const data = opts.signer.verify(req.params.token);
    if (!data?.u || !data.c) {
      res.status(410).json({ error: "expired" });
      return;
    }
    const buf = req.body as Buffer;
    const info = Buffer.isBuffer(buf) ? imageInfo(buf) : undefined;
    if (!info) {
      res.status(415).json({ error: "PNG, JPG, GIF or WebP only" });
      return;
    }
    const c = await opts.store.getCase(data.u, data.c);
    if (!c) {
      res.status(404).json({ error: "case not found" });
      return;
    }
    const filename = decodeURIComponent(req.header("x-filename") ?? `evidence.${info.ext}`).slice(0, 120);
    const key = await opts.store.putBlob(`evidence/${c.ownerId}/${c.id}`, buf, info.ext);
    const base = filename.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 24) || "ev";
    let id = base;
    for (let n = 2; c.evidence.some((e) => e.id === id); n++) id = `${base}-${n}`;
    c.evidence.push({
      id,
      filename,
      mime: info.mime,
      width: info.width,
      height: info.height,
      chapter: data.ch ? (data.ch as never) : undefined,
      hero: c.evidence.length === 0,
      confidential: false,
      alt: "",
      key,
    });
    if (c.chapters.evidence!.state === "empty") c.chapters.evidence!.state = "in_progress";
    c.updatedAt = new Date().toISOString();
    await opts.store.saveCase(c);
    res.json({ id, width: info.width, height: info.height });
  });

  // Case file downloads, through signed links from close_case.
  app.get("/files/:token", async (req, res) => {
    const data = opts.signer.verify(req.params.token);
    if (!data?.k || !data.u || !data.k.startsWith(`blobs/files/${data.u}/`)) {
      res.status(410).type("text/plain").send("This link expired. Close the case again for a new one.");
      return;
    }
    const buf = await opts.store.readBlob(data.k);
    res.set("Content-Disposition", `attachment; filename="${(data.f ?? "case.zip").replace(/"/g, "")}"`);
    res.type("application/zip").send(buf);
  });

  return app;
}
