import { currentReport, type Case, type Direction, type Module } from "@pd/core";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const para = (s: string | undefined) => (s ? `<p>${esc(s)}</p>` : "");

/**
 * A plain baseline direction built from the case without any AI.
 * It exists for smoke tests and as a starting draft the art director rewrites.
 * It is deliberately simple: the real layouts come from AI art direction.
 */
export function baselineDirection(c: Case): Direction {
  const shareable = c.evidence.filter((e) => !e.confidential);
  const hero = shareable.find((e) => e.hero) ?? shareable[0];
  const rest = shareable.filter((e) => e !== hero);
  const isEn = c.caseLanguage === "en";
  const t = (en: string, pt: string) => (isEn ? en : pt);
  const client = c.nda.anonymousClient ? c.nda.clientAlias ?? t("Confidential client", "Cliente confidencial") : undefined;
  const tagline = c.chapters.basics?.answers.oneLiner ?? "";

  const modules: Module[] = [];
  const add = (m: Omit<Module, "locked">) => modules.push({ ...m, locked: false });

  add({
    id: "cover",
    kind: "cover",
    purpose: "Behance cover: hero image, no text, strong focal point.",
    html: hero ? `<img class="cover-img" src="{{evidence:${hero.id}}}" alt="">` : `<div class="cover-fallback">${esc(c.title)}</div>`,
    css: `.cover-img{width:100%;height:100%;object-fit:cover;object-position:top center}
.cover-fallback{height:100%;display:grid;place-items:center;font:600 56px var(--pd-font-heading);background:var(--pd-surface)}`,
  });

  add({
    id: "title",
    kind: "section",
    purpose: "Opening: title, tagline and hero.",
    html: `<header class="t"><p class="kicker">${esc(client ?? c.chapters.basics?.answers.when ?? "")}</p>
<h1>${esc(c.title)}</h1><p class="tag">${esc(tagline)}</p></header>
${hero ? `<figure class="hero"><img src="{{evidence:${hero.id}}}" alt="${esc(hero.alt)}"></figure>` : ""}`,
    css: `.t{padding:140px 120px 80px}
.kicker{font:500 20px var(--pd-font-body);letter-spacing:.12em;text-transform:uppercase;color:var(--pd-muted)}
h1{font:600 104px/1.02 var(--pd-font-heading);margin:24px 0}
.tag{font:400 32px/1.4 var(--pd-font-body);max-width:900px}
.hero{padding:0 120px 140px}.hero img{width:100%;border-radius:12px;box-shadow:0 30px 80px rgba(0,0,0,.15)}`,
  });

  const textSection = (id: string, label: string, chapterIds: Parameters<typeof currentReport>[1][]) => {
    const body = chapterIds.map((ch) => para(currentReport(c, ch))).join("");
    if (!body) return;
    add({
      id,
      kind: "section",
      purpose: label,
      html: `<section class="s"><h2>${esc(label)}</h2><div class="b">${body}</div></section>`,
      css: `.s{padding:140px 120px;display:grid;grid-template-columns:360px 1fr;gap:80px}
h2{font:600 44px/1.1 var(--pd-font-heading);color:var(--pd-accent)}
.b p{font:400 28px/1.55 var(--pd-font-body);margin-bottom:28px;max-width:820px}`,
    });
  };

  textSection("context", t("The challenge", "O desafio"), ["client", "problem"]);
  textSection("role", t("My role", "Meu papel"), ["role"]);
  textSection("process", t("Process", "Processo"), ["process"]);
  if (c.chapters.ai?.state !== "skipped") textSection("ai", t("AI in this project", "IA neste projeto"), ["ai"]);
  textSection("solution", t("The solution", "A solução"), ["solution"]);

  for (const e of rest) {
    const tall = (e.height ?? 0) > (e.width ?? 1);
    add({
      id: `ev-${e.id}`,
      kind: "section",
      purpose: `Showcase: ${e.alt}`,
      html: `<figure class="f${tall ? " tall" : ""}"><img src="{{evidence:${e.id}}}" alt="${esc(e.alt)}">
${e.caption ? `<figcaption>${esc(e.caption)}</figcaption>` : ""}</figure>`,
      css: `.f{padding:100px 120px;background:var(--pd-surface)}.f img{width:100%;border-radius:12px}
.f.tall{display:grid;place-items:center}.f.tall img{width:440px;border-radius:36px;box-shadow:0 30px 80px rgba(0,0,0,.18)}
figcaption{font:400 22px var(--pd-font-body);color:var(--pd-muted);margin-top:24px;text-align:center}`,
    });
  }

  textSection("results", t("Results", "Resultados"), ["results"]);

  const credits = [c.chapters.role?.answers.title, c.chapters.role?.answers.team].filter(Boolean) as string[];
  add({
    id: "credits",
    kind: "section",
    purpose: "Closing credits.",
    html: `<footer class="cr"><h2>${t("Credits", "Créditos")}</h2>${credits.map((x) => `<p>${esc(x)}</p>`).join("")}
<p class="thanks">${t("Thanks for watching.", "Obrigado pela atenção.")}</p></footer>`,
    css: `.cr{padding:120px;text-align:center}.cr h2{font:600 40px var(--pd-font-heading);margin-bottom:24px}
.cr p{font:400 26px/1.6 var(--pd-font-body)}.thanks{margin-top:40px;color:var(--pd-muted)}`,
  });

  return {
    brief: "Baseline direction generated without AI. Rewrite it: let the project decide the composition.",
    modules,
    updatedAt: new Date().toISOString(),
  };
}
