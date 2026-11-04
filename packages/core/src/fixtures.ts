import { newCase, recordAnswer, setChapterState, writeReport } from "./case.ts";
import type { Case } from "./schema.ts";

/**
 * A fictional landing page case used as test data until a real one exists.
 * "Maré" is an invented cold brew brand; nothing here describes real work.
 */
export function sampleCase(): Case {
  let c = newCase({ id: "sample-mare", ownerId: "sample-user", title: "", caseLanguage: "en" });

  const a = (ch: Parameters<typeof recordAnswer>[1], qid: string, text: string) => {
    c = recordAnswer(c, ch, qid, text);
  };

  a("basics", "name", "Maré Cold Brew");
  a("basics", "oneLiner", "A launch landing page for a small cold brew brand from Santos.");
  a("basics", "when", "2025, six weeks");
  a("basics", "type", "Landing page");
  c = writeReport(
    c,
    "basics",
    "Maré Cold Brew. A launch landing page for a small cold brew brand from Santos, designed in six weeks in 2025.",
  );

  a("client", "who", "Maré, a two person coffee brand selling bottled cold brew.");
  a("client", "canName", "Yes, the name can appear.");
  a("client", "context", "Coastal São Paulo, sold online and in a few cafés. Audience: young professionals who drink iced coffee.");
  c = writeReport(
    c,
    "client",
    "Maré is a two person coffee brand from the São Paulo coast, selling bottled cold brew online and through a handful of cafés to young professionals.",
  );

  a("problem", "before", "They sold through Instagram DMs only. No site, orders got lost, no way to explain subscriptions.");
  a("problem", "whoHurt", "Customers who wanted to reorder, and the founders answering DMs at midnight.");
  a("problem", "goal", "One page that explains the product, sells the subscription and takes orders.");
  a("problem", "constraints", "Tiny budget, had to run on a no-code builder the founders could edit.");
  c = writeReport(
    c,
    "problem",
    "Orders lived in Instagram DMs. Reorders got lost, subscriptions were impossible to explain, and the founders were answering messages at midnight. The goal: one page that explains the product, sells the subscription and takes orders, on a tiny budget and a builder the founders can edit themselves.",
  );

  a("role", "title", "Freelance designer");
  a("role", "did", "Research with customers, copy structure, visual design, the build in the no-code tool.");
  a("role", "team", "The two founders for content and photos.");
  a("role", "tools", "Figma, Framer");
  c = writeReport(
    c,
    "role",
    "Freelance designer. I ran customer conversations, structured the copy, designed the page and built it in the no-code tool. The founders provided content and product photos.",
  );

  a("process", "steps", "Read all DMs from three months, talked to 6 customers, wrote the page as text first, then wireframes, then visuals.");
  a("process", "clues", "The DMs showed the same 5 questions again and again.");
  a("process", "decisions", "Answer those 5 questions in order on the page, and make the subscription the default choice.");
  a("process", "discarded", "A recipe blog section. Nice, but nobody asked for it.");
  c = writeReport(
    c,
    "process",
    "Three months of DMs held the brief: the same five questions, over and over. After six customer conversations, the page was written as plain text answering those questions in order, then wireframed, then designed. The subscription became the default choice. A recipe blog was cut: nice, but nobody asked for it.",
  );

  c = setChapterState(c, "ai", "skipped");

  a("solution", "delivered", "A single landing page with a story section, a bottle configurator and subscription checkout.");
  a("solution", "keyPieces", "Hero with the bottle on a wave; the five questions section; bottle size picker; subscription toggle; delivery map.");
  a("solution", "different", "It reads like the founders talking, not like a coffee ad.");
  c = writeReport(
    c,
    "solution",
    "One landing page: a hero with the bottle riding a wave, a section answering the five real customer questions, a bottle size picker, a subscription toggle set on by default, and a delivery map for the coast. It reads like the founders talking, not like a coffee ad.",
  );

  a("results", "worked", "Yes, orders moved from DMs to the page in the first month.");
  a("results", "status", "Live since mid 2025.");
  c = writeReport(
    c,
    "results",
    "Within the first month, orders moved from DMs to the page. Live since mid 2025.",
  );

  a("disguise", "source", "Suggested direction");
  a("disguise", "mood", "salty, sunny, handmade");
  c.disguise = {
    source: "suggested",
    tokens: {
      colors: {
        background: "#F4EEE3",
        surface: "#FFFFFF",
        text: "#1F2A33",
        muted: "#56626C",
        accent: "#1F6F8B",
      },
      fonts: { heading: "Fraunces", body: "Inter" },
      mood: "salty, sunny, handmade",
    },
  };

  c.evidence = [
    {
      id: "hero",
      filename: "mare-hero.png",
      mime: "image/png",
      width: 1440,
      height: 900,
      chapter: "solution",
      hero: true,
      confidential: false,
      alt: "Maré landing page hero with a cold brew bottle on a wave",
      key: "fixtures/mare-hero.png",
    },
    {
      id: "questions",
      filename: "mare-questions.png",
      mime: "image/png",
      width: 1440,
      height: 900,
      chapter: "solution",
      hero: false,
      confidential: false,
      alt: "Section answering the five customer questions",
      key: "fixtures/mare-questions.png",
    },
    {
      id: "mobile",
      filename: "mare-mobile.png",
      mime: "image/png",
      width: 390,
      height: 844,
      chapter: "solution",
      hero: false,
      confidential: false,
      alt: "Mobile view with the subscription toggle",
      key: "fixtures/mare-mobile.png",
    },
  ];

  return c;
}
