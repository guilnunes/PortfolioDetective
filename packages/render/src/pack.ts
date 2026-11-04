import JSZip from "jszip";
import { CHAPTERS, currentReport, type Case } from "@pd/core";
import type { Issue, RenderedModule } from "./render.ts";

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "case";

/** Text the client pastes into Behance's project fields. */
export function behanceCopy(c: Case): string {
  const en = c.caseLanguage === "en";
  const t = (a: string, b: string) => (en ? a : b);
  const tagline = c.chapters.basics?.answers.oneLiner ?? "";
  const description = ["client", "problem", "solution", "results"]
    .map((id) => currentReport(c, id as (typeof CHAPTERS)[number]["id"]))
    .filter(Boolean)
    .join("\n\n");
  const tools = c.chapters.role?.answers.tools ?? "";
  const credits = [c.chapters.role?.answers.title, c.chapters.role?.answers.team].filter(Boolean).join(". ");
  const tags = ["landing page", "web design", "ui design", "ux design"];
  return [
    `# ${t("Behance fields", "Campos do Behance")}`,
    "",
    `## ${t("Project title", "Título do projeto")}`,
    c.title,
    "",
    `## ${t("Tagline", "Subtítulo")}`,
    tagline,
    "",
    `## ${t("Project description", "Descrição do projeto")}`,
    description,
    "",
    `## ${t("Tags", "Tags")}`,
    tags.join(", "),
    "",
    `## ${t("Tools used", "Ferramentas usadas")}`,
    tools || t("(not answered yet)", "(ainda não respondido)"),
    "",
    `## ${t("Credits", "Créditos")}`,
    credits || t("(not answered yet)", "(ainda não respondido)"),
    "",
  ].join("\n");
}

const howTo = (en: boolean) =>
  en
    ? `# How to publish on Behance

1. On Behance, click Create a Project.
2. Upload the images in this folder in order, starting from 01. Do not resize them: they are already 1400px wide.
3. Open Settings and upload 00-cover.png as the cover image.
4. Paste the fields from copy.md into title, tags, tools and description.
5. Publish.

Behance has no publishing API today, so this last step is manual.
`
    : `# Como publicar no Behance

1. No Behance, clique em Create a Project.
2. Envie as imagens desta pasta na ordem, a partir da 01. Não redimensione: elas já têm 1400px de largura.
3. Abra Settings e envie 00-cover.png como capa.
4. Cole os campos de copy.md em título, tags, ferramentas e descrição.
5. Publique.

O Behance não tem API de publicação hoje, então este último passo é manual.
`;

/** The Behance pack: numbered images, copy to paste, instructions and the quality report. */
export async function behancePack(c: Case, modules: RenderedModule[], issues: Issue[]): Promise<{ filename: string; zip: Buffer }> {
  const zip = new JSZip();
  const folder = zip.folder(slug(c.title))!;
  const cover = modules.find((m) => m.kind === "cover");
  if (cover) folder.file("00-cover.png", cover.png);
  modules
    .filter((m) => m.kind === "section")
    .forEach((m, i) => folder.file(`${String(i + 1).padStart(2, "0")}-${slug(m.id)}.png`, m.png));
  folder.file("copy.md", behanceCopy(c));
  folder.file(c.caseLanguage === "en" ? "HOW-TO-PUBLISH.md" : "COMO-PUBLICAR.md", howTo(c.caseLanguage === "en"));
  if (issues.length) {
    folder.file(
      "quality-report.md",
      ["# Quality report", "", ...issues.map((i) => `- [${i.severity}] ${i.moduleId}: ${i.message}`), ""].join("\n"),
    );
  }
  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return { filename: `${slug(c.title)}-behance.zip`, zip: buf };
}
