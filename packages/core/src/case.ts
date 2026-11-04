import { CHAPTERS, chapterById } from "./chapters.ts";
import type { Case, Chapter, ChapterId, ChapterState, Lang, OutputKind } from "./schema.ts";

const now = () => new Date().toISOString();

export function newCase(input: {
  id: string;
  ownerId: string;
  title: string;
  caseLanguage: Lang;
}): Case {
  const chapters = Object.fromEntries(
    CHAPTERS.map((c): [ChapterId, Chapter] => [
      c.id,
      { id: c.id, state: "empty", answers: {}, reports: [], locked: false },
    ]),
  ) as Record<ChapterId, Chapter>;
  const t = now();
  return {
    id: input.id,
    ownerId: input.ownerId,
    title: input.title,
    caseType: "landing-page",
    caseLanguage: input.caseLanguage,
    nda: { anonymousClient: false },
    chapters,
    evidence: [],
    caseFiles: [],
    createdAt: t,
    updatedAt: t,
  };
}

const chapterOf = (c: Case, id: ChapterId): Chapter => {
  const ch = c.chapters[id];
  if (!ch) throw new Error(`Case ${c.id} has no chapter ${id}`);
  return ch;
};

export function recordAnswer(c: Case, chapter: ChapterId, questionId: string, text: string): Case {
  const def = chapterById(chapter);
  if (!def.questions.some((q) => q.id === questionId)) {
    throw new Error(`Chapter ${chapter} has no question ${questionId}`);
  }
  const ch = chapterOf(c, chapter);
  if (ch.locked) throw new Error(`Chapter ${chapter} is locked`);
  ch.answers[questionId] = text.trim();
  if (ch.state === "empty" || ch.state === "skipped") ch.state = "in_progress";
  if (chapter === "basics" && questionId === "name" && text.trim()) c.title = text.trim();
  c.updatedAt = now();
  return c;
}

export function writeReport(c: Case, chapter: ChapterId, text: string): Case {
  const ch = chapterOf(c, chapter);
  if (ch.locked) throw new Error(`Chapter ${chapter} is locked`);
  const version = (ch.reports.at(-1)?.version ?? 0) + 1;
  ch.reports.push({ version, text, at: now() });
  if (ch.state === "empty") ch.state = "in_progress";
  c.updatedAt = now();
  return c;
}

export function setChapterState(c: Case, chapter: ChapterId, state: ChapterState): Case {
  // Non-optional chapters may be skipped too; looseEnds() keeps flagging them.
  const ch = chapterOf(c, chapter);
  ch.state = state;
  c.updatedAt = now();
  return c;
}

export function setChapterLock(c: Case, chapter: ChapterId, locked: boolean): Case {
  chapterOf(c, chapter).locked = locked;
  c.updatedAt = now();
  return c;
}

export const currentReport = (c: Case, chapter: ChapterId): string | undefined =>
  c.chapters[chapter]?.reports.at(-1)?.text;

export interface LooseEnd {
  chapter: ChapterId | "case";
  outputs: OutputKind[];
  message: Record<Lang, string>;
}

/** What is still missing before each output can be closed. */
export function looseEnds(c: Case): LooseEnd[] {
  const ends: LooseEnd[] = [];
  for (const def of CHAPTERS) {
    if (def.id === "evidence" || def.id === "closing") continue;
    const ch = c.chapters[def.id];
    if (!ch || (def.optional && (ch.state === "skipped" || ch.state === "empty"))) continue;
    const missing = def.questions.filter((q) => q.required && !ch.answers[q.id]?.trim());
    if (missing.length) {
      ends.push({
        chapter: def.id,
        outputs: ["behance", "site"],
        message: {
          "pt-BR": `${def.noir["pt-BR"]}: faltam respostas (${missing.map((m) => m.plain["pt-BR"]).join(", ")}).`,
          en: `${def.noir.en}: missing answers (${missing.map((m) => m.plain.en).join(", ")}).`,
        },
      });
    }
    if (!ch.reports.length && def.id !== "disguise") {
      ends.push({
        chapter: def.id,
        outputs: ["behance", "site"],
        message: {
          "pt-BR": `${def.noir["pt-BR"]}: o relatório ainda não foi escrito.`,
          en: `${def.noir.en}: the report hasn't been written yet.`,
        },
      });
    }
  }
  const results = c.chapters.results;
  if (results && results.state !== "skipped" && !results.answers.proof?.trim()) {
    ends.push({
      chapter: "results",
      outputs: ["behance", "site"],
      message: {
        "pt-BR": "O veredito: sem provas (números, depoimentos ou prêmios). O case sai, mas fraco.",
        en: "The verdict: no proof (numbers, quotes or awards). The case can ship, but it's weak.",
      },
    });
  }
  const shareable = c.evidence.filter((e) => !e.confidential);
  if (!shareable.length) {
    ends.push({
      chapter: "evidence",
      outputs: ["behance", "site"],
      message: { "pt-BR": "As provas: nenhuma imagem que possa ser mostrada.", en: "The evidence: no image that can be shown." },
    });
  } else if (!shareable.some((e) => e.hero)) {
    ends.push({
      chapter: "evidence",
      outputs: ["behance", "site"],
      message: { "pt-BR": "As provas: falta escolher a imagem principal.", en: "The evidence: no hero image chosen." },
    });
  }
  if (!c.disguise) {
    ends.push({
      chapter: "disguise",
      outputs: ["behance", "site"],
      message: { "pt-BR": "O disfarce: estilo visual não definido.", en: "The disguise: no visual style set." },
    });
  }
  if (!c.direction?.modules.some((m) => m.kind === "cover")) {
    ends.push({
      chapter: "case",
      outputs: ["behance"],
      message: { "pt-BR": "Falta a capa do Behance.", en: "The Behance cover is missing." },
    });
  }
  if (c.nda.anonymousClient && !c.nda.clientAlias) {
    ends.push({
      chapter: "client",
      outputs: ["behance", "site"],
      message: { "pt-BR": "O cliente é sigiloso, mas falta um apelido.", en: "The client is confidential but has no alias." },
    });
  }
  return ends;
}

export interface BoardRow {
  number: number;
  id: ChapterId;
  noir: string;
  step: string;
  state: ChapterState;
  optional: boolean;
  locked: boolean;
  answered: number;
  questions: number;
  hasReport: boolean;
}

export function caseBoard(c: Case, lang: Lang): BoardRow[] {
  return CHAPTERS.map((def) => {
    const ch = c.chapters[def.id]!;
    return {
      number: def.number,
      id: def.id,
      noir: def.noir[lang],
      step: def.step[lang],
      state: ch.state,
      optional: def.optional,
      locked: ch.locked,
      answered: def.questions.filter((q) => ch.answers[q.id]?.trim()).length,
      questions: def.questions.length,
      hasReport: ch.reports.length > 0,
    };
  });
}
