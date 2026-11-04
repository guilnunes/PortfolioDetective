import { describe, expect, it } from "vitest";
import {
  CHAPTERS,
  Case,
  caseBoard,
  detectiveBrief,
  looseEnds,
  newCase,
  recordAnswer,
  sampleCase,
  setChapterLock,
  writeReport,
} from "../src/index.ts";

describe("chapters", () => {
  it("has 11 chapters in order, with The informant as the only optional one", () => {
    expect(CHAPTERS.map((c) => c.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(CHAPTERS.filter((c) => c.optional).map((c) => c.id)).toEqual(["ai"]);
  });

  it("asks 2 to 5 questions per chapter, in both languages and both modes", () => {
    for (const c of CHAPTERS) {
      expect(c.questions.length).toBeGreaterThanOrEqual(2);
      expect(c.questions.length).toBeLessThanOrEqual(5);
      for (const q of c.questions) {
        for (const text of [q.ask["pt-BR"], q.ask.en, q.plain["pt-BR"], q.plain.en]) {
          expect(text.length).toBeGreaterThan(0);
          expect(text).not.toContain("—");
        }
      }
    }
  });
});

describe("case", () => {
  it("records answers in the client's words and versions reports", () => {
    let c = newCase({ id: "c1", ownerId: "u1", title: "", caseLanguage: "pt-BR" });
    c = recordAnswer(c, "basics", "name", "  Projeto X ");
    expect(c.title).toBe("Projeto X");
    expect(c.chapters.basics!.state).toBe("in_progress");
    c = writeReport(c, "basics", "v1");
    c = writeReport(c, "basics", "v2");
    expect(c.chapters.basics!.reports.map((r) => r.version)).toEqual([1, 2]);
  });

  it("refuses unknown questions and locked chapters", () => {
    let c = newCase({ id: "c1", ownerId: "u1", title: "", caseLanguage: "en" });
    expect(() => recordAnswer(c, "basics", "nope", "x")).toThrow();
    c = setChapterLock(c, "basics", true);
    expect(() => recordAnswer(c, "basics", "name", "x")).toThrow(/locked/);
  });

  it("flags loose ends on a new case, including the missing cover", () => {
    const c = newCase({ id: "c1", ownerId: "u1", title: "", caseLanguage: "en" });
    const ends = looseEnds(c);
    expect(ends.some((e) => e.chapter === "basics")).toBe(true);
    expect(ends.some((e) => e.chapter === "case" && e.outputs.includes("behance"))).toBe(true);
  });

  it("the sample case is valid and only misses proof and the cover", () => {
    const c = Case.parse(sampleCase());
    const chapters = looseEnds(c).map((e) => e.chapter);
    expect(chapters.sort()).toEqual(["case", "results"]);
    expect(caseBoard(c, "pt-BR").find((r) => r.id === "ai")!.state).toBe("skipped");
  });
});

describe("detective", () => {
  it("has a name per language and keeps the honesty rules in the brief", () => {
    expect(detectiveBrief("pt-BR")).toContain("Zé Calha");
    expect(detectiveBrief("en")).toContain("Jack Gutter");
    expect(detectiveBrief("en", "facts")).toContain("just the facts");
    expect(detectiveBrief("en")).toContain("Never invent metrics");
  });
});
