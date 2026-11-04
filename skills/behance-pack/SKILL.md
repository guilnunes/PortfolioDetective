---
name: behance-pack
description: How to build, render and critique the Behance pack for a Portfolio Detective case. Read before calling direct_layout and render_modules.
---

# Behance pack: build, render, critique

## Format

- Cover: one module with `kind: "cover"`, 808x632, rendered at 2x. Behance shows it tiny in grids, so: one clear focal point, high contrast, little or no text. Usually a crop of the hero evidence.
- Sections: modules with `kind: "section"`, 1400px wide, any height up to 6000px. Each becomes one image in the project, in order.
- Usually 6 to 12 sections for a landing page case.

## Module contract

Each module has `id`, `kind`, `purpose`, `html`, `css`, `locked`.

- `html` is the body of the module. It is placed inside `<main id="pd-module">`.
- `css` is scoped by you; prefer class names unique to the module.
- Fonts and colors come from CSS variables (see the landing page case skill).
- Evidence: `<img src="{{evidence:hero}}" alt="...">` or as a CSS background through an inline style.
- No scripts, no external resources. They are blocked and reported as errors.

## Loop

1. Write the brief: mood, hierarchy, pacing, which evidence carries the story. Three to six sentences.
2. Plan the module list with a purpose for each.
3. Write all modules and call `direct_layout`.
4. Call `render_modules`. You get the images plus automatic issues (contrast, small text, overflow, missing evidence, size).
5. Critique as a different person: a senior designer who did not build this. Use the rubric below. Fix every error and the worst two weaknesses, then call `direct_layout` with the changed modules and `render_modules` with `only` set to them.
6. Stop after three rounds, or earlier when the rubric passes. Show the client.
7. Locked modules are the client's decisions: never change them.

## Critique rubric

Score each from 1 to 5. Anything under 4 gets fixed.

1. Story: can a recruiter scrolling fast get problem, role, solution and result?
2. Evidence first: is the work bigger than the words?
3. Hierarchy: one clear focal point per module?
4. Rhythm: do dense and calm modules alternate? Any two neighbors that look the same?
5. Craft: alignment to a grid, consistent margins, no orphans or widows in headings, crops that respect the content.
6. Readability on a phone: would text survive being shown at 40% size?
7. Fit: does the visual mood match the disguise and the project, or is it generic?
8. Honesty: anything that looks like a claim without proof?
