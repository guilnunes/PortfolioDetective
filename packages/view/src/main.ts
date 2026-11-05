/**
 * Portfolio Detective darkroom: the MCP App view that develops the case's Behance images
 * inside Claude, in the user's own browser, and hands them back to the server.
 */
import { App } from "@modelcontextprotocol/ext-apps";
import { renderModule, type Issue, type JobModule, type JobSpec, type JobTokens, type Rendered } from "./raster.ts";

type Lang = "pt-BR" | "en";

interface RenderJob {
  caseId: string;
  renderId: string;
  title: string;
  lang: Lang;
  detective: string;
  spec: JobSpec;
  tokens: JobTokens;
  fontCss: string;
  modules: JobModule[];
  serverIssues: Issue[];
}

const T = {
  "pt-BR": {
    room: "Sala de revelação",
    waiting: "Esperando o caso chegar na mesa...",
    developing: (i: number, n: number) => `Revelando ${i} de ${n}...`,
    sending: "Mandando as fotos pro arquivo...",
    done: "Fotos reveladas. Agora é com o detetive.",
    clean: "Nada suspeito.",
    looseEnds: "Pontas soltas",
    again: "Revelar de novo",
    notify: (name: string) => `Avisar o ${name.split(" ")[0]}`,
    failed: "Deu ruim na revelação",
    message: (title: string, n: number, e: number, w: number) =>
      `As fotos do caso "${title}" foram reveladas: ${n} imagens, ${e} erros e ${w} avisos. Chame get_review para examinar e corrigir.`,
  },
  en: {
    room: "Darkroom",
    waiting: "Waiting for the case to hit the desk...",
    developing: (i: number, n: number) => `Developing ${i} of ${n}...`,
    sending: "Filing the prints...",
    done: "Prints are dry. Over to the detective.",
    clean: "Nothing suspicious.",
    looseEnds: "Loose ends",
    again: "Develop again",
    notify: (name: string) => `Tell ${name.split(" ")[0]}`,
    failed: "The darkroom jammed",
    message: (title: string, n: number, e: number, w: number) =>
      `The prints for "${title}" are developed: ${n} images, ${e} errors and ${w} warnings. Call get_review to examine and fix them.`,
  },
};

const $ = <E extends HTMLElement>(id: string) => document.getElementById(id) as E;
const statusEl = $("status");
const roomEl = $("room");
const whoEl = $("who");
const stripEl = $("strip");
const issuesEl = $("issues");
const stageEl = $("stage");
const againBtn = $<HTMLButtonElement>("again");
const notifyBtn = $<HTMLButtonElement>("notify");

let lang: Lang = "pt-BR";
let caseId: string | undefined;
let lastSummary: { n: number; e: number; w: number; title: string } | undefined;
let detective = "Toni Sarjeta";

const app = new App({ name: "Portfolio Detective Darkroom", version: "0.1.0" });

const setStatus = (s: string) => {
  statusEl.textContent = s;
};

const structured = <X>(r: { structuredContent?: unknown; isError?: boolean; content?: unknown }): X => {
  if (r.isError) {
    const c = (r.content as Array<{ text?: string }> | undefined)?.[0]?.text;
    throw new Error(c ?? "Tool error");
  }
  return r.structuredContent as X;
};

function applyLang(l: Lang) {
  lang = l;
  document.documentElement.lang = l;
  roomEl.textContent = T[l].room;
  againBtn.textContent = T[l].again;
  notifyBtn.textContent = T[l].notify(detective);
}

function thumb(r: Rendered) {
  const fig = document.createElement("figure");
  fig.className = "print";
  const img = document.createElement("img");
  img.src = `data:image/png;base64,${r.png}`;
  img.alt = r.id;
  const cap = document.createElement("figcaption");
  const errors = r.issues.filter((i) => i.severity === "error").length;
  cap.textContent = `${r.id} · ${r.width}×${r.height}${errors ? ` · ${errors}!` : ""}`;
  if (errors) fig.classList.add("bad");
  fig.append(img, cap);
  stripEl.append(fig);
}

function showIssues(all: Issue[]) {
  issuesEl.replaceChildren();
  const h = document.createElement("h2");
  h.textContent = T[lang].looseEnds;
  issuesEl.append(h);
  if (!all.length) {
    const p = document.createElement("p");
    p.textContent = T[lang].clean;
    issuesEl.append(p);
    return;
  }
  const ul = document.createElement("ul");
  for (const i of all) {
    const li = document.createElement("li");
    li.className = i.severity;
    li.textContent = `${i.moduleId}: ${i.message}`;
    ul.append(li);
  }
  issuesEl.append(ul);
}

async function notifyDetective() {
  if (!lastSummary) return;
  const { n, e, w, title } = lastSummary;
  try {
    await app.sendMessage({ role: "user", content: [{ type: "text", text: T[lang].message(title, n, e, w) }] });
    notifyBtn.hidden = true;
  } catch {
    notifyBtn.hidden = false;
  }
}

async function develop() {
  if (!caseId) return;
  againBtn.disabled = true;
  notifyBtn.hidden = true;
  stripEl.replaceChildren();
  issuesEl.replaceChildren();
  try {
    const job = structured<RenderJob>(await app.callServerTool({ name: "get_render_job", arguments: { caseId } }));
    detective = job.detective;
    whoEl.textContent = job.detective;
    applyLang(job.lang);
    if (job.fontCss && !document.getElementById("pd-fonts")) {
      const s = document.createElement("style");
      s.id = "pd-fonts";
      s.textContent = job.fontCss;
      document.head.append(s);
    }
    const issues: Issue[] = [...job.serverIssues];
    let i = 0;
    for (const m of job.modules) {
      setStatus(T[lang].developing(++i, job.modules.length));
      let r: Rendered;
      try {
        r = await renderModule(m, job.tokens, job.spec, stageEl, job.fontCss);
      } catch (err) {
        issues.push({ moduleId: m.id, severity: "error", code: "render", message: (err as Error).message });
        continue;
      }
      issues.push(...r.issues);
      thumb(r);
      structured(
        await app.callServerTool({
          name: "save_render",
          arguments: { caseId, renderId: job.renderId, moduleId: r.id, png: r.png, width: r.width, height: r.height, issues: r.issues },
        }),
      );
    }
    setStatus(T[lang].sending);
    structured(await app.callServerTool({ name: "finish_render", arguments: { caseId, renderId: job.renderId, issues } }));
    showIssues(issues);
    setStatus(T[lang].done);
    lastSummary = {
      n: job.modules.length,
      e: issues.filter((x) => x.severity === "error").length,
      w: issues.filter((x) => x.severity === "warning").length,
      title: job.title,
    };
    await notifyDetective();
  } catch (err) {
    setStatus(`${T[lang].failed}: ${(err as Error).message}`);
  } finally {
    againBtn.disabled = false;
  }
}

app.ontoolinput = (params) => {
  const args = params.arguments as { caseId?: string } | undefined;
  if (args?.caseId) caseId = args.caseId;
};

app.ontoolresult = (result) => {
  const sc = result.structuredContent as { caseId?: string; lang?: Lang; detective?: string } | undefined;
  if (sc?.lang) applyLang(sc.lang);
  if (sc?.detective) {
    detective = sc.detective;
    whoEl.textContent = sc.detective;
  }
  if (sc?.caseId) caseId = sc.caseId;
  if (!result.isError) void develop();
};

againBtn.addEventListener("click", () => void develop());
notifyBtn.addEventListener("click", () => void notifyDetective());

applyLang(navigator.language?.toLowerCase().startsWith("pt") ? "pt-BR" : "en");
setStatus(T[lang].waiting);
void app.connect();
