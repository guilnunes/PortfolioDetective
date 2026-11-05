# Portfolio Detective

A film noir detective interrogates designers about their projects and hands back finished portfolio cases.

Toni Sarjeta (Jack Gutter in English) sits across the desk, asks short questions about your "case" chapter by chapter, presses for details, and closes the case with a Behance-ready pack. He runs inside Claude as a connector, so each friend uses their own Claude plan. No paid AI usage, ever.

Spec and decisions live in Notion (Projects > Portfolio Detective).

## How it fits together

```
Claude (web, desktop, mobile)
  ├─ plays Toni Sarjeta from the connector's instructions
  ├─ calls the connector's tools: interrogation, evidence, layout, review, export
  └─ shows the darkroom view (MCP App): draws every Behance image in the user's browser,
     checks quality, and files the images back on the server

PHP server on HostGator shared hosting (php/)
  ├─ /mcp            MCP connector over Streamable HTTP, stateless, JSON responses
  ├─ /evidence/...   noir upload page for screenshots, through signed links
  ├─ /files/...      Behance pack downloads (ZIP), through signed links
  └─ MySQL for cases, disk for images, outside the web root
```

Shared hosting can't run Node or a headless browser, so the images are drawn inside Claude's view instead of on the server. The TypeScript packages stay the source of truth: `npm run build:php` exports the chapters, Toni's lines and briefs, the skills and the Behance specs to `php/data/core.json`, bundles the view into `php/resources/studio.html`, and copies the sample case.

## Packages

```
packages/core      case schema, chapters, detective, loose ends, Claude Design brief, sample case
packages/render    Behance specs, Node renderer with quality checks, baseline layout, pack (reference and tests)
packages/server    Node version of the connector (reference; needs a host with Node)
packages/view      the darkroom MCP App: draws modules in the browser, same quality checks
php/               the HostGator build: connector, upload page, downloads
skills/            art direction guidance read by the AI
scripts/           build, deploy, fixtures, tokens
```

## Develop

```bash
npm install
npm run build:php    # regenerate php/data, php/resources, php/fixtures
npm test             # core, Node renderer, Node connector, PHP connector with the darkroom in Chromium
npm run typecheck
```

## Deploy to HostGator

Everything goes through the cPanel API with an API token. No FTP, no SSH.

```bash
export CPANEL_HOST=... CPANEL_USER=... CPANEL_TOKEN=... PD_DOMAIN=example.com PD_SUBDOMAIN=detetive
export PD_USERS="token:friend1:Friend One"     # create tokens with: npm run new-friend -- friend1 "Friend One"
npm run deploy -- --setup   # first time: MySQL database, subdomain, SSL, config.php, files
npm run deploy              # later: code only
```

After the first setup, pushes to `main` deploy automatically once the cPanel secrets are set in the repository (see `.github/workflows/ci.yml`).

## Connect it to Claude

1. Settings > Connectors > Add custom connector.
2. URL: `https://detetive.<domain>/mcp`.
3. Request header `Authorization: Bearer <token>`. If the header option isn't there, use `https://detetive.<domain>/mcp?key=<token>`.
4. Start a chat: "Quero abrir um caso." To try the darkroom right away: "Abre o caso de exemplo e monta o Behance."
