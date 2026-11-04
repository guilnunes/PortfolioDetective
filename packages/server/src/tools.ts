import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  CHAPTERS,
  ChapterId,
  ChapterState,
  Lang,
  Module,
  StyleTokens,
  caseBoard,
  chapterById,
  claudeDesignBrief,
  currentReport,
  line,
  looseEnds,
  newCase,
  recordAnswer,
  setChapterLock,
  setChapterState,
  writeReport,
  type Case,
  type Evidence,
  type UserProfile,
} from "@pd/core";
import { baselineDirection, behancePack, renderDirection } from "@pd/render";
import type { Store } from "./store.ts";
import type { Account, Signer } from "./auth.ts";

const SKILLS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "skills");

export interface ToolContext {
  account: Account;
  profile: UserProfile;
  store: Store;
  signer: Signer;
  publicUrl: string;
}

const text = (data: unknown): CallToolResult => ({
  content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }],
});

const fail = (message: string): CallToolResult => ({ content: [{ type: "text", text: message }], isError: true });

export function registerTools(server: McpServer, ctx: ToolContext) {
  const lang = ctx.profile.interfaceLanguage;
  const { store, account } = ctx;

  const load = async (caseId: string): Promise<Case> => {
    const c = await store.getCase(account.userId, caseId);
    if (!c) throw new Error(`Case not found: ${caseId}`);
    return c;
  };

  const resolver = async (e: Evidence) => `data:${e.mime};base64,${(await store.readBlob(e.key)).toString("base64")}`;

  const guard =
    <A>(fn: (args: A) => Promise<CallToolResult>) =>
    async (args: A): Promise<CallToolResult> => {
      try {
        return await fn(args);
      } catch (e) {
        return fail((e as Error).message);
      }
    };

  server.registerTool(
    "get_profile",
    {
      title: "Get the client's profile",
      description: "The client's name, languages and detective mode. Call once at the start of a conversation.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    guard(async () => text(ctx.profile)),
  );

  server.registerTool(
    "set_profile",
    {
      title: "Update the client's profile",
      description: "Change interface language, default case language, detective mode (full noir or 'facts'), role or portfolio URL.",
      inputSchema: {
        interfaceLanguage: Lang.optional(),
        defaultCaseLanguage: Lang.optional(),
        detectiveMode: z.enum(["full", "facts"]).optional(),
        role: z.string().optional(),
        portfolioUrl: z.string().url().optional(),
      },
    },
    guard(async (args) => {
      const next = { ...ctx.profile, ...Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined)) };
      await store.saveUser(next);
      return text(next);
    }),
  );

  server.registerTool(
    "list_cases",
    {
      title: "List the client's cases",
      description: "All cases this client has opened, with their state.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    guard(async () => {
      const cases = await store.listCases(account.userId);
      return text(
        cases.map((c) => ({
          id: c.id,
          title: c.title || "(untitled)",
          updatedAt: c.updatedAt,
          looseEnds: looseEnds(c).length,
        })),
      );
    }),
  );

  server.registerTool(
    "open_case",
    {
      title: "Open a new case",
      description: "Start a new case file. Returns the case id and the opening line.",
      inputSchema: {
        title: z.string().optional().describe("Project name, if already known"),
        caseLanguage: Lang.optional().describe("Language of the exported case; defaults to the client's default"),
      },
    },
    guard(async (args) => {
      const c = newCase({
        id: randomUUID().slice(0, 8),
        ownerId: account.userId,
        title: args.title ?? "",
        caseLanguage: args.caseLanguage ?? ctx.profile.defaultCaseLanguage,
      });
      if (args.title) recordAnswer(c, "basics", "name", args.title);
      await store.saveCase(c);
      return text({ caseId: c.id, opening: line("opening", lang), board: caseBoard(c, lang) });
    }),
  );

  server.registerTool(
    "get_case_board",
    {
      title: "Get the case board",
      description: "Chapters with their states, answers count, reports, and the loose ends for each output.",
      inputSchema: { caseId: z.string() },
      annotations: { readOnlyHint: true },
    },
    guard(async ({ caseId }) => {
      const c = await load(caseId);
      return text({
        title: c.title,
        caseLanguage: c.caseLanguage,
        nda: c.nda,
        board: caseBoard(c, lang),
        looseEnds: looseEnds(c).map((e) => ({ chapter: e.chapter, outputs: e.outputs, message: e.message[lang] })),
        evidence: c.evidence.length,
        hasDisguise: !!c.disguise,
        modules: c.direction?.modules.length ?? 0,
      });
    }),
  );

  server.registerTool(
    "get_chapter",
    {
      title: "Get a chapter's script",
      description: "The questions for a chapter, in character and in plain form, plus current answers and report.",
      inputSchema: { caseId: z.string(), chapter: ChapterId },
      annotations: { readOnlyHint: true },
    },
    guard(async ({ caseId, chapter }) => {
      const c = await load(caseId);
      const def = chapterById(chapter);
      const ch = c.chapters[chapter]!;
      return text({
        number: def.number,
        noir: def.noir[lang],
        step: def.step[lang],
        optional: def.optional,
        state: ch.state,
        locked: ch.locked,
        reportGuide: def.reportGuide,
        questions: def.questions.map((q) => ({
          id: q.id,
          ask: ctx.profile.detectiveMode === "facts" ? q.plain[lang] : q.ask[lang],
          required: q.required,
          answer: ch.answers[q.id] ?? null,
        })),
        report: currentReport(c, chapter) ?? null,
      });
    }),
  );

  server.registerTool(
    "record_answer",
    {
      title: "Record an answer",
      description: "Save the client's answer to one question, in the client's own words. Do not polish it.",
      inputSchema: { caseId: z.string(), chapter: ChapterId, questionId: z.string(), answer: z.string() },
    },
    guard(async ({ caseId, chapter, questionId, answer }) => {
      const c = recordAnswer(await load(caseId), chapter, questionId, answer);
      await store.saveCase(c);
      const def = chapterById(chapter);
      const ch = c.chapters[chapter]!;
      const next = def.questions.find((q) => !ch.answers[q.id]?.trim());
      return text({ saved: true, nextQuestion: next?.id ?? null });
    }),
  );

  server.registerTool(
    "write_report",
    {
      title: "Write a chapter report",
      description:
        "Save the detective's typed report for a chapter, in the case language. Only from the client's answers. Creates a new version.",
      inputSchema: { caseId: z.string(), chapter: ChapterId, report: z.string().min(1) },
    },
    guard(async ({ caseId, chapter, report }) => {
      const c = writeReport(await load(caseId), chapter, report);
      await store.saveCase(c);
      return text({ saved: true, version: c.chapters[chapter]!.reports.length });
    }),
  );

  server.registerTool(
    "set_chapter_state",
    {
      title: "Close, skip or reopen a chapter",
      description: "Set a chapter's state, and optionally lock it so it is not changed again.",
      inputSchema: { caseId: z.string(), chapter: ChapterId, state: ChapterState.optional(), locked: z.boolean().optional() },
    },
    guard(async ({ caseId, chapter, state, locked }) => {
      let c = await load(caseId);
      if (state) c = setChapterState(c, chapter, state);
      if (locked !== undefined) c = setChapterLock(c, chapter, locked);
      await store.saveCase(c);
      return text({ chapter, state: c.chapters[chapter]!.state, locked: c.chapters[chapter]!.locked, line: state === "closed" ? line("chapterClosed", lang) : undefined });
    }),
  );

  server.registerTool(
    "set_case_settings",
    {
      title: "Case settings",
      description: "Title, case language, and NDA: whether the client is anonymous and the alias to use.",
      inputSchema: {
        caseId: z.string(),
        title: z.string().optional(),
        caseLanguage: Lang.optional(),
        anonymousClient: z.boolean().optional(),
        clientAlias: z.string().optional(),
      },
    },
    guard(async ({ caseId, title, caseLanguage, anonymousClient, clientAlias }) => {
      const c = await load(caseId);
      if (title) c.title = title;
      if (caseLanguage) c.caseLanguage = caseLanguage;
      if (anonymousClient !== undefined) c.nda.anonymousClient = anonymousClient;
      if (clientAlias !== undefined) c.nda.clientAlias = clientAlias;
      c.updatedAt = new Date().toISOString();
      await store.saveCase(c);
      return text({ title: c.title, caseLanguage: c.caseLanguage, nda: c.nda });
    }),
  );

  server.registerTool(
    "get_upload_link",
    {
      title: "Get an evidence upload link",
      description: "A link the client opens to drop images (screens, photos, sketches) into the case. Valid for 2 hours.",
      inputSchema: { caseId: z.string(), chapter: ChapterId.optional() },
      annotations: { readOnlyHint: true },
    },
    guard(async ({ caseId, chapter }) => {
      await load(caseId);
      const token = ctx.signer.sign({ u: account.userId, c: caseId, ch: chapter ?? "", l: lang }, 2 * 3600);
      return text({ url: `${ctx.publicUrl}/evidence/${token}`, line: lang === "pt-BR" ? "Joga as provas aqui." : "Drop the evidence here." });
    }),
  );

  server.registerTool(
    "list_evidence",
    {
      title: "List the evidence",
      description: "Images pinned to the case, with ids to use as {{evidence:<id>}}.",
      inputSchema: { caseId: z.string() },
      annotations: { readOnlyHint: true },
    },
    guard(async ({ caseId }) => {
      const c = await load(caseId);
      return text(c.evidence.map(({ key: _key, ...e }) => e));
    }),
  );

  server.registerTool(
    "view_evidence",
    {
      title: "Look at a piece of evidence",
      description: "Returns the image so you can see it before writing alt text or planning the layout.",
      inputSchema: { caseId: z.string(), evidenceId: z.string() },
      annotations: { readOnlyHint: true },
    },
    guard(async ({ caseId, evidenceId }) => {
      const c = await load(caseId);
      const e = c.evidence.find((x) => x.id === evidenceId);
      if (!e) return fail(`No evidence ${evidenceId}`);
      const data = (await store.readBlob(e.key)).toString("base64");
      return { content: [{ type: "image" as const, data, mimeType: e.mime }, { type: "text" as const, text: JSON.stringify({ id: e.id, width: e.width, height: e.height, alt: e.alt }) }] };
    }),
  );

  server.registerTool(
    "update_evidence",
    {
      title: "Update evidence",
      description: "Set alt text, caption, chapter, hero or confidential on an image. Only one hero per case.",
      inputSchema: {
        caseId: z.string(),
        evidenceId: z.string(),
        alt: z.string().optional(),
        caption: z.string().optional(),
        chapter: ChapterId.optional(),
        hero: z.boolean().optional(),
        confidential: z.boolean().optional(),
      },
    },
    guard(async ({ caseId, evidenceId, ...patch }) => {
      const c = await load(caseId);
      const e = c.evidence.find((x) => x.id === evidenceId);
      if (!e) return fail(`No evidence ${evidenceId}`);
      if (patch.hero) c.evidence.forEach((x) => (x.hero = false));
      Object.assign(e, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)));
      c.updatedAt = new Date().toISOString();
      await store.saveCase(c);
      const { key: _key, ...rest } = e;
      return text(rest);
    }),
  );

  server.registerTool(
    "set_disguise",
    {
      title: "Set the visual style (the disguise)",
      description: "Style tokens for the case: colors (#rrggbb), Google Fonts names, mood words, and where they came from.",
      inputSchema: {
        caseId: z.string(),
        source: z.enum(["own-site", "suggested", "described"]),
        siteUrl: z.string().url().optional(),
        description: z.string().optional(),
        tokens: StyleTokens,
      },
    },
    guard(async ({ caseId, source, siteUrl, description, tokens }) => {
      const c = await load(caseId);
      c.disguise = { source, siteUrl, description, tokens };
      c.chapters.disguise!.state = "closed";
      c.updatedAt = new Date().toISOString();
      await store.saveCase(c);
      const { checkTokens } = await import("@pd/render");
      return text({ saved: true, issues: checkTokens(tokens) });
    }),
  );

  server.registerTool(
    "get_art_direction_guide",
    {
      title: "Get the art direction guide",
      description: "Guidance, hard rules and the critique rubric for laying out the case. Read before direct_layout.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    guard(async () => {
      const [a, b] = await Promise.all([
        readFile(path.join(SKILLS_DIR, "landing-page-case", "SKILL.md"), "utf8"),
        readFile(path.join(SKILLS_DIR, "behance-pack", "SKILL.md"), "utf8"),
      ]);
      return text(`${a}\n\n---\n\n${b}`);
    }),
  );

  server.registerTool(
    "get_layout",
    {
      title: "Get the current layout",
      description: "The art direction brief and modules. With baseline=true, returns a plain starting draft built without AI, for reference only.",
      inputSchema: { caseId: z.string(), baseline: z.boolean().optional() },
      annotations: { readOnlyHint: true },
    },
    guard(async ({ caseId, baseline }) => {
      const c = await load(caseId);
      return text(baseline ? baselineDirection(c) : c.direction ?? { brief: "", modules: [] });
    }),
  );

  server.registerTool(
    "direct_layout",
    {
      title: "Direct the layout",
      description:
        "Save the art direction brief and modules. Modules with an existing id are replaced, unless locked; new ids are added. 'order' sets the final sequence.",
      inputSchema: {
        caseId: z.string(),
        brief: z.string().optional(),
        modules: z.array(Module.omit({ locked: true }).extend({ locked: z.boolean().optional() })),
        order: z.array(z.string()).optional(),
        remove: z.array(z.string()).optional(),
      },
    },
    guard(async ({ caseId, brief, modules, order, remove }) => {
      const c = await load(caseId);
      const d = c.direction ?? { brief: "", modules: [], updatedAt: "" };
      const skipped: string[] = [];
      for (const m of modules) {
        const i = d.modules.findIndex((x) => x.id === m.id);
        if (i >= 0 && d.modules[i]!.locked) {
          skipped.push(m.id);
          continue;
        }
        const next = { ...m, locked: m.locked ?? false };
        if (i >= 0) d.modules[i] = next;
        else d.modules.push(next);
      }
      if (remove) d.modules = d.modules.filter((m) => m.locked || !remove.includes(m.id));
      if (order) {
        const pos = new Map(order.map((id, i) => [id, i]));
        d.modules.sort((a, b) => (pos.get(a.id) ?? 999) - (pos.get(b.id) ?? 999));
      }
      if (brief) d.brief = brief;
      d.updatedAt = new Date().toISOString();
      c.direction = d;
      await store.saveCase(c);
      return text({ modules: d.modules.map((m) => ({ id: m.id, kind: m.kind, locked: m.locked })), skippedLocked: skipped });
    }),
  );

  server.registerTool(
    "render_modules",
    {
      title: "Render modules for review",
      description:
        "Render modules to images exactly as they will ship, and run the quality checks. Look at the images as a critic. Up to 6 modules per call; use 'only' to pick.",
      inputSchema: { caseId: z.string(), only: z.array(z.string()).optional() },
      annotations: { readOnlyHint: true },
    },
    guard(async ({ caseId, only }) => {
      const c = await load(caseId);
      if (!c.direction?.modules.length) return fail("No layout yet. Call direct_layout first.");
      if (!c.disguise) return fail("No disguise yet. Call set_disguise first.");
      const ids = (only ?? c.direction.modules.map((m) => m.id)).slice(0, 6);
      const r = await renderDirection({ direction: c.direction, tokens: c.disguise.tokens, evidence: c.evidence, resolve: resolver, only: ids });
      const rest = (only ?? c.direction.modules.map((m) => m.id)).slice(6);
      return {
        content: [
          ...r.modules.flatMap((m) => [
            { type: "text" as const, text: `Module ${m.id} (${m.kind}), ${m.width}x${m.height}` },
            { type: "image" as const, data: m.png.toString("base64"), mimeType: "image/png" },
          ]),
          {
            type: "text" as const,
            text: JSON.stringify({ issues: r.issues, notRenderedYet: rest }, null, 2),
          },
        ],
      };
    }),
  );

  server.registerTool(
    "close_case",
    {
      title: "Close the case (export)",
      description: "Render every module and package the Behance pack (images, copy to paste, how to publish). Returns a download link valid for 7 days.",
      inputSchema: { caseId: z.string(), output: z.enum(["behance"]).default("behance") },
    },
    guard(async ({ caseId }) => {
      const c = await load(caseId);
      if (!c.direction?.modules.length) return fail("No layout yet. Direct the layout before closing the case.");
      if (!c.disguise) return fail("No disguise yet.");
      const r = await renderDirection({ direction: c.direction, tokens: c.disguise.tokens, evidence: c.evidence, resolve: resolver });
      const errors = r.issues.filter((i) => i.severity === "error");
      const pack = await behancePack(c, r.modules, r.issues);
      const key = await store.putBlob(`files/${c.ownerId}/${c.id}`, pack.zip, "zip");
      c.caseFiles.push({ id: randomUUID().slice(0, 8), output: "behance", key, createdAt: new Date().toISOString() });
      c.chapters.closing!.state = "closed";
      c.updatedAt = new Date().toISOString();
      await store.saveCase(c);
      const token = ctx.signer.sign({ u: account.userId, k: key, f: pack.filename }, 7 * 24 * 3600);
      return text({
        line: line(errors.length ? "looseEnds" : "caseClosed", lang),
        download: `${ctx.publicUrl}/files/${token}`,
        images: r.modules.length,
        errors,
        looseEnds: looseEnds(c).map((e) => e.message[lang]),
      });
    }),
  );

  server.registerTool(
    "export_claude_design_brief",
    {
      title: "Case file for Claude Design",
      description: "A prompt pack to paste into Claude Design, with the list of evidence files to attach.",
      inputSchema: { caseId: z.string() },
      annotations: { readOnlyHint: true },
    },
    guard(async ({ caseId }) => text(claudeDesignBrief(await load(caseId)))),
  );

  return { chapters: CHAPTERS.length };
}
