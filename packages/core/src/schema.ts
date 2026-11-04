import { z } from "zod";

export const LANGS = ["pt-BR", "en"] as const;
export const Lang = z.enum(LANGS);
export type Lang = z.infer<typeof Lang>;

export const CHAPTER_IDS = [
  "basics",
  "client",
  "problem",
  "role",
  "process",
  "ai",
  "solution",
  "results",
  "evidence",
  "disguise",
  "closing",
] as const;
export const ChapterId = z.enum(CHAPTER_IDS);
export type ChapterId = z.infer<typeof ChapterId>;

export const ChapterState = z.enum(["empty", "in_progress", "closed", "skipped"]);
export type ChapterState = z.infer<typeof ChapterState>;

export const CaseType = z.enum(["landing-page"]);
export type CaseType = z.infer<typeof CaseType>;

export const OutputKind = z.enum(["behance", "site"]);
export type OutputKind = z.infer<typeof OutputKind>;

/** One version of the detective's typed report for a chapter. */
export const Report = z.object({
  version: z.number().int().positive(),
  text: z.string(),
  at: z.string(),
});
export type Report = z.infer<typeof Report>;

export const Chapter = z.object({
  id: ChapterId,
  state: ChapterState,
  /** questionId -> the client's answer, in the client's own words. */
  answers: z.record(z.string(), z.string()),
  /** Every version of the report, oldest first. The last one is current. */
  reports: z.array(Report),
  locked: z.boolean(),
});
export type Chapter = z.infer<typeof Chapter>;

export const Evidence = z.object({
  id: z.string(),
  filename: z.string(),
  mime: z.string(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  chapter: ChapterId.optional(),
  hero: z.boolean(),
  confidential: z.boolean(),
  alt: z.string(),
  caption: z.string().optional(),
  /** Storage key, resolved by the store. */
  key: z.string(),
});
export type Evidence = z.infer<typeof Evidence>;

export const StyleTokens = z.object({
  colors: z.object({
    background: z.string(),
    surface: z.string(),
    text: z.string(),
    muted: z.string(),
    accent: z.string(),
  }),
  fonts: z.object({
    heading: z.string(),
    body: z.string(),
  }),
  /** Free words that describe the mood, used by the art director. */
  mood: z.string().optional(),
});
export type StyleTokens = z.infer<typeof StyleTokens>;

export const Disguise = z.object({
  source: z.enum(["own-site", "suggested", "described"]),
  siteUrl: z.string().url().optional(),
  description: z.string().optional(),
  tokens: StyleTokens,
});
export type Disguise = z.infer<typeof Disguise>;

/** One module of the layout: a cover, or one 1400px wide image in the Behance pack. */
export const Module = z.object({
  id: z.string(),
  kind: z.enum(["cover", "section"]),
  /** What this module is for, in plain words. */
  purpose: z.string(),
  /** Self-contained HTML body for this module. Evidence is referenced as {{evidence:<id>}}. */
  html: z.string(),
  /** CSS scoped to this module. */
  css: z.string(),
  locked: z.boolean(),
});
export type Module = z.infer<typeof Module>;

export const Direction = z.object({
  /** The art direction brief: mood, hierarchy, pacing, which evidence carries the story. */
  brief: z.string(),
  modules: z.array(Module),
  updatedAt: z.string(),
});
export type Direction = z.infer<typeof Direction>;

export const CaseFile = z.object({
  id: z.string(),
  output: OutputKind,
  key: z.string(),
  createdAt: z.string(),
});
export type CaseFile = z.infer<typeof CaseFile>;

export const Case = z.object({
  id: z.string(),
  ownerId: z.string(),
  title: z.string(),
  caseType: CaseType,
  /** Language of the exported case (often English for Behance). */
  caseLanguage: Lang,
  nda: z.object({
    anonymousClient: z.boolean(),
    clientAlias: z.string().optional(),
  }),
  chapters: z.record(ChapterId, Chapter),
  evidence: z.array(Evidence),
  disguise: Disguise.optional(),
  direction: Direction.optional(),
  caseFiles: z.array(CaseFile),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Case = z.infer<typeof Case>;

export const UserProfile = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string().optional(),
  interfaceLanguage: Lang,
  defaultCaseLanguage: Lang,
  /** "full" keeps the noir theater; "facts" is the "só os fatos" mode. */
  detectiveMode: z.enum(["full", "facts"]),
  portfolioUrl: z.string().url().optional(),
  links: z.record(z.string(), z.string().url()),
});
export type UserProfile = z.infer<typeof UserProfile>;
