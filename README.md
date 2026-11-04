# Portfolio Detective

A film noir detective interrogates designers about their projects and hands back finished portfolio cases.

Toni Sarjeta (Jack Gutter in English) sits across the desk, asks short questions about your "case" chapter by chapter, presses for details, and closes the case with a Behance-ready pack. The AI that plays him is the one you bring: your own Claude plan through the connector, or your own API key in the web app (coming later).

Spec and decisions live in Notion (Projects > Portfolio Detective).

## What works today

- **Case model and script** (`packages/core`): 11 chapters with noir names, questions in PT-BR and EN, full noir or "só os fatos" mode, versioned reports, loose ends per output, NDA alias, the detective's character brief.
- **Renderer and harness** (`packages/render`): modules written as HTML and CSS are rendered to Behance sizes (cover 808x632 at 2x, sections 1400px wide) and checked automatically for contrast, small text, overflow, external resources, missing or confidential evidence, height and file size. Packs a ZIP with numbered images, `copy.md` to paste into Behance and publishing steps.
- **Claude connector** (`packages/server`): a remote MCP server (Streamable HTTP). Claude plays the detective from the server instructions, and also acts as art director and critic: it reads the guide, writes the layout, renders it, looks at the images, fixes, and closes the case.
- **Evidence upload page**: a signed link opens a noir upload page where the client drops images.
- **Claude Design brief**: level 1 of the integration ladder, a prompt pack to paste into Claude Design.
- **Skills** (`skills/`): art direction guidance for landing page cases, and the Behance build, render and critique loop with its rubric.

Not yet: Firebase storage and OAuth, interactive MCP App views, the web app, standalone site export.

## Run it locally

```bash
npm install
cp .env.example .env              # then fill PD_SECRET and PD_USERS
npm run new-friend -- friend1 "Friend One"   # prints a token and the PD_USERS entry
npm start                          # http://localhost:8787/mcp
```

To render the fictional sample case (Maré Cold Brew) into `out/sample`:

```bash
npm run render:sample
```

## Connect it to Claude

The server needs a public HTTPS address (see Deploy). Then, in Claude:

1. Settings > Connectors > Add custom connector.
2. URL: `https://<your-host>/mcp`.
3. Request headers: `Authorization: Bearer <your token>`.
4. Start a chat: "Quero abrir um caso."

## Deploy

The `Dockerfile` uses the official Playwright image, so the headless browser is included. Any container host with HTTPS works (Cloud Run, Fly.io, Railway, a VPS). Set `PD_PUBLIC_URL`, `PD_SECRET`, `PD_USERS` and mount a volume at `PD_DATA_DIR`.

## Tests

```bash
npm test          # unit, render and full connector flow
npm run typecheck
```

## Layout

```
packages/core      case schema, chapters, detective, loose ends, Claude Design brief, sample case
packages/render    Behance specs, module page, renderer with quality checks, baseline layout, pack
packages/server    MCP connector, tools, auth, file store, upload page
skills/            art direction guidance read by the AI
scripts/           fixtures and helper scripts
```
