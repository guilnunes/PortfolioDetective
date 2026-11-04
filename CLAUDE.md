# Portfolio Detective: working rules

Spec of record: Notion, Projects database, row "Portfolio Detective". Update it when a decision changes.

## Product rules that code must keep

- Honesty: the AI never invents metrics, clients, quotes, results, screens or images. Only the client's words and evidence reach the output. The renderer blocks external resources and confidential evidence; keep it that way.
- Answers are stored in the client's own words (`record_answer`), reports are versioned, locked chapters and locked modules are never changed by the AI.
- Noir lives in the app, never in the exported case. The case uses the client's style tokens.
- Platform specs (sizes, limits) live in `packages/render/src/spec.ts`, not scattered in code.
- Directed, not templated: `baselineDirection` is only a smoke test and a draft. Do not grow it into a template system; improve the skills and the critic loop instead.

## Language

- Interface default is Brazilian Portuguese, English available. Every user-facing string needs both.
- Detective names: Toni Sarjeta (PT-BR), Jack Gutter (EN). A deliberate cliché, kept light.
- No em dash characters in user-facing copy (detective lines, questions, pages). Tests check the questions.
- Code, comments, docs and the harness layer (headers, labels, property names) are in English.

## Engineering

- TypeScript, ESM, Node 22, npm workspaces. Run with `tsx`; no build step yet.
- `npm test` must pass before every commit (it renders with Playwright; set `PD_WEB_FONTS=0` offline).
- Storage goes through the `Store` interface. FileStore now; Firestore plus Cloud Storage next.
- Playwright is pinned to the version in the Docker image; bump both together.
