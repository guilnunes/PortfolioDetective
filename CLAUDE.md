# Portfolio Detective: working rules

Spec of record: Notion, Projects database, row "Portfolio Detective". Update it when a decision changes.

## Product rules that code must keep

- No paid AI usage, ever. The AI is the user's own Claude, through the connector. Never add server-side model calls.
- Honesty: the AI never invents metrics, clients, quotes, results, screens or images. Only the client's words and evidence reach the output. External resources, scripts and confidential evidence are blocked (server checks plus the view's sandbox); keep it that way.
- Answers are stored in the client's own words (`record_answer`), reports are versioned, locked chapters and locked modules are never changed by the AI.
- Noir lives in the app, never in the exported case. The case uses the client's style tokens.
- Platform specs (sizes, limits) live in `packages/render/src/spec.ts`, not scattered in code. PHP reads them from `php/data/core.json`.
- Directed, not templated: `baselineDirection` is only a smoke test and a draft. Do not grow it into a template system; improve the skills and the critic loop instead.

## Hosting

- Production is HostGator shared hosting (cPanel): PHP 8.2+ and MySQL only. No Node, no SSH, no headless browser.
- Images are drawn in the darkroom view (MCP App) inside Claude, in the user's browser, and sent back with app-only tools.
- `packages/core`, `packages/view` and `skills/` are the sources of truth. Run `npm run build:php` after changing them, and commit the generated `php/data`, `php/resources` and `php/fixtures`.
- The Node connector (`packages/server`) and renderer (`packages/render`) stay as reference and test oracle.
- Deploy with `npm run deploy` (cPanel API token). Never commit `php/config.php` or tokens.

## Language

- Interface default is Brazilian Portuguese, English available. Every user-facing string needs both.
- Detective names: Toni Sarjeta (PT-BR), Jack Gutter (EN). A deliberate cliché, kept light.
- No em dash characters in user-facing copy (detective lines, questions, pages). Tests check the questions.
- Code, comments, docs and the harness layer (headers, labels, property names) are in English.

## Engineering

- TypeScript, ESM, Node 22, npm workspaces, run with `tsx`. PHP 8.2+, no Composer dependencies.
- `npm test` must pass before every commit. It renders with Playwright and runs the PHP server with `php -S`.
- Storage: PHP `Store` (MySQL in production, SQLite in tests); Node `Store` interface for the reference server.
- Playwright is pinned to the version in the Docker image; bump both together.
