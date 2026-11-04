import type { ChapterId, Lang } from "./schema.ts";

export type Localized = Record<Lang, string>;

export interface Question {
  id: string;
  /** How the detective asks it, in character. */
  ask: Localized;
  /** The same question with no theater, for "só os fatos" mode. */
  plain: Localized;
  /** Needed by at least one output. */
  required: boolean;
}

export interface ChapterDef {
  id: ChapterId;
  number: number;
  /** Plain name of the step. */
  step: Localized;
  /** Noir name of the chapter, shown on the folder tab. */
  noir: Localized;
  optional: boolean;
  /** Folder tab color on the case board (muted browns and pastels). */
  tab: string;
  questions: Question[];
  /** What the detective's report for this chapter should contain. */
  reportGuide: string;
}

const q = (
  id: string,
  askPt: string,
  askEn: string,
  plainPt: string,
  plainEn: string,
  required = true,
): Question => ({
  id,
  ask: { "pt-BR": askPt, en: askEn },
  plain: { "pt-BR": plainPt, en: plainEn },
  required,
});

export const CHAPTERS: ChapterDef[] = [
  {
    id: "basics",
    number: 1,
    step: { "pt-BR": "Dados do projeto", en: "Project basics" },
    noir: { "pt-BR": "Abrindo o arquivo", en: "Opening the file" },
    optional: false,
    tab: "#C8B79E",
    reportGuide: "Project title, a one line tagline, year and duration, project type.",
    questions: [
      q("name", "Qual o nome do caso?", "What's the name of the case?", "Nome do projeto", "Project name"),
      q(
        "oneLiner",
        "Em uma frase, do que se trata?",
        "One sentence. What's it about?",
        "Descreva o projeto em uma frase",
        "Describe the project in one sentence",
      ),
      q("when", "Quando foi isso? E quanto tempo durou?", "When did it go down? How long did it take?", "Ano e duração", "Year and duration"),
      q(
        "type",
        "Que tipo de serviço era? Landing page, site institucional, outra coisa?",
        "What kind of job was it? Landing page, company site, something else?",
        "Tipo de projeto",
        "Project type",
        false,
      ),
    ],
  },
  {
    id: "client",
    number: 2,
    step: { "pt-BR": "Cliente e contexto", en: "Client and context" },
    noir: { "pt-BR": "O cliente", en: "The client" },
    optional: false,
    tab: "#D9C2A7",
    reportGuide: "Who the client is (or an alias under NDA), the industry, where and for whom the work was used.",
    questions: [
      q("who", "Quem bateu na sua porta?", "Who knocked on your door?", "Quem era o cliente?", "Who was the client?"),
      q(
        "canName",
        "Posso dizer o nome ou é segredo?",
        "Can I say the name, or is it a secret?",
        "O nome do cliente pode aparecer?",
        "Can the client be named?",
      ),
      q(
        "context",
        "Onde isso aconteceu, e pra quem era?",
        "Where did this happen, and who was it for?",
        "Mercado e público",
        "Industry and audience",
      ),
    ],
  },
  {
    id: "problem",
    number: 3,
    step: { "pt-BR": "Problema", en: "Problem" },
    noir: { "pt-BR": "O crime", en: "The crime" },
    optional: false,
    tab: "#E3B7A0",
    reportGuide: "What was wrong before, who suffered from it, the goal, and the constraints.",
    questions: [
      q(
        "before",
        "O que estava errado antes de você chegar?",
        "What was wrong before you showed up?",
        "Qual era o problema?",
        "What was the problem?",
      ),
      q("whoHurt", "Quem saía machucado?", "Who was getting hurt?", "Quem era afetado?", "Who was affected?"),
      q("goal", "E o que o cliente queria de você?", "And what did the client want from you?", "Qual era o objetivo?", "What was the goal?"),
      q(
        "constraints",
        "Que regras você tinha que seguir? Prazo, orçamento, tecnologia, lei?",
        "What rules did you have to play by? Deadline, budget, tech, law?",
        "Restrições",
        "Constraints",
        false,
      ),
    ],
  },
  {
    id: "role",
    number: 4,
    step: { "pt-BR": "Seu papel e equipe", en: "Your role and team" },
    noir: { "pt-BR": "Os suspeitos de sempre", en: "The usual suspects" },
    optional: false,
    tab: "#B9C4B0",
    reportGuide: "The client's title, what they did with their own hands, and who worked with them.",
    questions: [
      q("title", "Qual era o seu cargo nessa história?", "What was your title in this story?", "Seu cargo", "Your title"),
      q(
        "did",
        "O que exatamente você fez? Com as suas mãos.",
        "What exactly did you do? With your own hands.",
        "O que você fez",
        "What you did",
      ),
      q("team", "Quem estava com você?", "Who was in it with you?", "Equipe", "Team", false),
      q(
        "tools",
        "E as ferramentas do crime? Figma, Framer, o que for.",
        "And the tools of the trade? Figma, Framer, whatever.",
        "Ferramentas usadas",
        "Tools used",
        false,
      ),
    ],
  },
  {
    id: "process",
    number: 5,
    step: { "pt-BR": "Processo", en: "Process" },
    noir: { "pt-BR": "A investigação", en: "The investigation" },
    optional: false,
    tab: "#A9B8C9",
    reportGuide: "The phases, the research methods, the key decisions and why, and what was discarded.",
    questions: [
      q("steps", "Refaz seus passos pra mim.", "Walk me through your steps.", "Etapas do processo", "Process phases"),
      q(
        "clues",
        "Que pistas você seguiu? Pesquisa, dados, conversas?",
        "What clues did you follow? Research, data, interviews?",
        "Métodos de pesquisa",
        "Research methods",
        false,
      ),
      q(
        "decisions",
        "Qual foi a decisão que mudou o caso? Por quê?",
        "What decision cracked the case open? Why?",
        "Decisões principais e por quê",
        "Key decisions and why",
      ),
      q(
        "discarded",
        "E o que você jogou fora no caminho?",
        "And what did you throw out along the way?",
        "O que foi descartado",
        "What was discarded",
        false,
      ),
    ],
  },
  {
    id: "ai",
    number: 6,
    step: { "pt-BR": "IA no processo", en: "AI in the process" },
    noir: { "pt-BR": "O informante", en: "The informant" },
    optional: true,
    tab: "#C9B6CF",
    reportGuide:
      "A short, factual 'AI in this project' section: which tools, for what, what was done by hand, how the output was checked. Never hype.",
    questions: [
      q(
        "used",
        "Teve ajuda de uma máquina nessa? Qual?",
        "Did a machine help you on this one? Which one?",
        "Você usou IA? Quais ferramentas?",
        "Did you use AI? Which tools?",
        false,
      ),
      q("for", "Pra quê, exatamente?", "For what, exactly?", "Para quê", "What for", false),
      q(
        "byHand",
        "O que você fez com as próprias mãos, sem ela?",
        "What did you do with your own hands, without it?",
        "O que foi feito sem IA",
        "What was done without AI",
        false,
      ),
      q(
        "checked",
        "E como conferiu o que ela te disse?",
        "And how did you check what it told you?",
        "Como você validou o resultado da IA",
        "How you checked the AI output",
        false,
      ),
    ],
  },
  {
    id: "solution",
    number: 7,
    step: { "pt-BR": "Solução", en: "Solution" },
    noir: { "pt-BR": "A virada", en: "The breakthrough" },
    optional: false,
    tab: "#E8D9A8",
    reportGuide: "What was delivered and the 3 to 5 key pieces, each tied to the problem.",
    questions: [
      q("delivered", "Como você resolveu o caso?", "How did you crack the case?", "O que foi entregue", "What was delivered"),
      q(
        "keyPieces",
        "Quais são as 3 a 5 peças-chave? Seções, componentes, telas.",
        "What are the 3 to 5 key pieces? Sections, components, screens.",
        "Principais seções ou funcionalidades",
        "Key sections or features",
      ),
      q(
        "different",
        "O que faz essa solução diferente das outras?",
        "What makes this one different from the rest?",
        "Diferencial",
        "What makes it different",
        false,
      ),
    ],
  },
  {
    id: "results",
    number: 8,
    step: { "pt-BR": "Resultados", en: "Results" },
    noir: { "pt-BR": "O veredito", en: "The verdict" },
    optional: false,
    tab: "#B7CDB9",
    reportGuide:
      "What happened after launch: numbers, quotes, awards, lessons. Never invent numbers. If none were given, write qualitative outcomes and say the evidence is pending.",
    questions: [
      q("worked", "E aí, funcionou?", "So, did it work?", "Resultado", "Outcome"),
      q(
        "proof",
        "Tem provas? Números, depoimentos, prêmios?",
        "Got proof? Numbers, quotes, awards?",
        "Métricas, depoimentos ou prêmios",
        "Metrics, quotes or awards",
        false,
      ),
      q(
        "status",
        "Se ainda não lançou, em que pé está?",
        "If it hasn't shipped yet, where does it stand?",
        "Status atual",
        "Current status",
        false,
      ),
      q("lessons", "O que você aprendeu nesse caso?", "What did this case teach you?", "Aprendizados", "Lessons", false),
    ],
  },
  {
    id: "evidence",
    number: 9,
    step: { "pt-BR": "Imagens", en: "Assets" },
    noir: { "pt-BR": "As provas", en: "The evidence" },
    optional: false,
    tab: "#D4B48C",
    reportGuide: "A list of the evidence, the hero image, and which items are confidential.",
    questions: [
      q(
        "upload",
        "Coloca as provas na mesa. Telas, fotos, rascunhos.",
        "Put the evidence on the table. Screens, photos, sketches.",
        "Envie as imagens",
        "Upload the images",
      ),
      q("hero", "Qual é a foto principal?", "Which one is the main shot?", "Imagem principal", "Hero image"),
      q(
        "confidential",
        "Alguma é confidencial?",
        "Any of these confidential?",
        "Alguma imagem é confidencial?",
        "Are any images confidential?",
        false,
      ),
    ],
  },
  {
    id: "disguise",
    number: 10,
    step: { "pt-BR": "Estilo visual", en: "Visual style" },
    noir: { "pt-BR": "O disfarce", en: "The disguise" },
    optional: false,
    tab: "#C2A98F",
    reportGuide: "The style source (own site, suggested direction or described), the colors, fonts and mood.",
    questions: [
      q(
        "source",
        "Como esse caso vai se vestir pra sair na rua? Do seu jeito, uma direção que eu sugiro, ou quer descrever?",
        "How is this case dressing up to hit the street? Your own style, a direction I suggest, or do you want to describe it?",
        "Fonte do estilo: seu site, sugestão ou descrição",
        "Style source: your site, a suggestion or a description",
      ),
      q(
        "mood",
        "Me dá três palavras pro clima.",
        "Give me three words for the mood.",
        "Três palavras para o clima visual",
        "Three words for the visual mood",
        false,
      ),
    ],
  },
  {
    id: "closing",
    number: 11,
    step: { "pt-BR": "Exportação", en: "Export" },
    noir: { "pt-BR": "Fechando o caso", en: "Closing the case" },
    optional: false,
    tab: "#9E8B78",
    reportGuide: "Chosen outputs and the language of the case file.",
    questions: [
      q("outputs", "Pra onde vai esse dossiê?", "Where's this file headed?", "Formatos de saída", "Output formats"),
      q("language", "Em que língua?", "In what language?", "Idioma do case", "Case language"),
    ],
  },
];

export const chapterById = (id: ChapterId): ChapterDef => {
  const def = CHAPTERS.find((c) => c.id === id);
  if (!def) throw new Error(`Unknown chapter: ${id}`);
  return def;
};
