---
name: landing-page-case
description: Art direction guidance for portfolio cases about a landing page or website design. Read before planning the modules of a landing page case.
---

# Landing page case: art direction guide

You are the art director of this case. The goal is a case that looks designed for this project, not poured into a template. Let the project decide the composition.

## What a good landing page case shows

- The page itself, big and early. The hero screen is the strongest evidence; give it room.
- The problem in one or two sentences, in the client's words. Not a wall of text.
- The structure of the page: which sections exist and why, in the order a visitor meets them.
- The decision that cracked the case, tied to the evidence that shows it.
- Responsive views when they exist: mobile next to desktop, at a size where the mobile screen is readable.
- Before and after, if the client gave a before.
- The result, with proof if there is proof. If there is none, say what is known and stop. Never invent a number.

## Pacing

- Alternate dense and calm modules: a text module, then a showcase, then text.
- One idea per module. If a module needs two headings, split it.
- Text modules: short. Two to four sentences per block, 26px or larger at 1400px wide.
- Showcase modules: let the evidence breathe. Generous margins, or full bleed when the image can take it.
- End with credits and tools, quietly.

## Composition moves to choose from (do not use all of them)

- Full bleed hero screenshot with the title overlapping a calm area.
- Device frames only when they add context (a phone for mobile flows). Never fake a device around a desktop screenshot just to decorate.
- Crops and zooms: a detail of a component at 2x next to the full section.
- Annotated screenshot: numbered markers with short notes beside the image.
- Split layout: words on one side, evidence on the other, aligned to a strong grid.
- Big type moments: one sentence from the client's answers set very large.
- Color fields from the disguise tokens to separate acts of the story.

Pick the moves that serve this project's mood (see the disguise tokens and mood words). A playful brand can take tilted screens and bold color fields; a fintech case wants restraint and precision.

## Hard rules

- Only the client's evidence. No stock photos, no invented screens, no external URLs. Use `{{evidence:<id>}}`.
- Respect confidential evidence and anonymous clients.
- Use the tokens through CSS variables: `--pd-bg`, `--pd-surface`, `--pd-text`, `--pd-muted`, `--pd-accent`, `--pd-font-heading`, `--pd-font-body`.
- Every module is exactly 1400px wide (the cover is 808x632). Height is free, under 6000px.
- Body text at least 18px, ideally 24px or more; Behance shrinks modules on phones.
- Text contrast at least 4.5:1 (3:1 for large type). Never put text over a busy image without a solid or gradient backing.
