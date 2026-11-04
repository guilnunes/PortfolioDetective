import { CHAPTERS } from "./chapters.ts";
import { currentReport } from "./case.ts";
import type { Case } from "./schema.ts";

/**
 * Level 1 of the Claude Design ladder: a prompt pack the client pastes into Claude Design,
 * with the evidence files attached by hand.
 */
export function claudeDesignBrief(c: Case): string {
  const tokens = c.disguise?.tokens;
  const evidence = c.evidence.filter((e) => !e.confidential);
  const story = CHAPTERS.filter((d) => !["evidence", "disguise", "closing"].includes(d.id))
    .map((d) => {
      const r = currentReport(c, d.id);
      return r ? `### ${d.step.en}\n${r}` : "";
    })
    .filter(Boolean)
    .join("\n\n");

  return [
    `# Portfolio case for Claude Design: ${c.title}`,
    "",
    "Paste this into a new Claude Design project and attach the evidence files listed below.",
    "",
    "## What to make",
    "",
    "1. A Behance project: a cover at 808x632 and a sequence of 1400px wide images that tell the case below. Show the work bigger than the words.",
    "2. A single case study web page for the same project, using the same visual direction.",
    "",
    "## Rules",
    "",
    "- Use only the attached images. Do not invent screens, metrics, quotes or results.",
    c.nda.anonymousClient ? `- The client is confidential. Call them "${c.nda.clientAlias ?? "the client"}".` : "- The client can be named.",
    `- Write all copy in ${c.caseLanguage === "en" ? "English" : "Brazilian Portuguese"}, short and plain.`,
    "- Body text large enough to read on a phone when the image is scaled down.",
    "",
    "## Visual direction",
    "",
    tokens
      ? [
          `- Mood: ${tokens.mood ?? "not given"}`,
          `- Colors: background ${tokens.colors.background}, surface ${tokens.colors.surface}, text ${tokens.colors.text}, muted ${tokens.colors.muted}, accent ${tokens.colors.accent}`,
          `- Fonts: headings ${tokens.fonts.heading}, body ${tokens.fonts.body}`,
        ].join("\n")
      : "- Not set yet. Propose a direction that fits the project.",
    "",
    "## Evidence to attach",
    "",
    ...evidence.map((e) => `- ${e.filename}${e.hero ? " (hero)" : ""}: ${e.alt}`),
    "",
    "## The case",
    "",
    story,
    "",
  ].join("\n");
}
