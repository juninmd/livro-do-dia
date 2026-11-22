# AGENTS.md

livro-do-dia: a Telegram bot that posts one book a day (cover, synopsis, takeaways, trivia, Amazon link). The catalog lives in SQLite; an AI writes the copy through the cluster LiteLLM. `README.md` has the full behavior and the fixed post layout.

## Stack

- Bun, TypeScript, SQLite (`src/db.ts`), node-cron, Telegram Bot API.
- AI: OpenAI-compatible endpoint (`src/ai.ts`), configured by env.
- Container: `oven/bun:1-slim`, data at `/data` (`DB_PATH=/data/store.db`).

## Commands

```bash
bun install
bun run dev          # run the bot entry point
bun run start        # loop mode (scheduled posts)
bun run post         # post one book now
bun run preview      # render a post without sending
bun run typecheck    # tsc --noEmit
bun run test         # bun test src
bun run lint         # biome check --write .
```

CI (`ci.yml`) runs typecheck, `biome check`, and tests.

## Structure

- `src/index.ts`: entry point (`--loop`, `--post`, `--preview`).
- `src/post.ts`: builds the post (`buildPost()`). `src/deliver.ts` and `src/telegram.ts`: delivery.
- `src/books.ts`, `src/discover.ts`, `src/amazon.ts`: catalog, catalog growth from public APIs, purchase links.
- `src/ai.ts`: AI copy. `src/db.ts`: SQLite. `src/config/`: catalog and env.

## Conventions

- The post layout is fixed. Change it only with tests (`src/deliver.test.ts`, `src/telegram.test.ts`).
- Config comes from env. Document new variable names in `.env.example`; never commit a real `.env`.
- Keep the niche and tone described in `README.md`.

## Gotchas

- `.env.example` sets `NODE_TLS_REJECT_UNAUTHORIZED` for the cluster's self-signed certificate. That disables TLS checks. Use it in development only, never in production.
- The Telegram bot is the same one used by `evo-agent` (per `.env.example`). Changes to the bot affect both.

<!-- base-actions-main-policy -->
## GitHub Actions — padrão obrigatório (@main)

- Referencie as actions internas sempre pelo branch, nunca por SHA:
  - `uses: juninmd/base-actions/<action>@main`
  - `uses: juninmd/base-actions/.github/workflows/<arquivo>.yml@main`
- Não fixe `@<sha>` em `juninmd/base-actions`: a atualização é centralizada no
  `main` e passa a valer no próximo run.
- PRs cujos checks não iniciam por billing/spending limit são mesclados pelo bot central
  `juninmd/base-actions/.github/workflows/auto-merge-billing-blocked.yml`.
  Para impedir o merge automático de um PR, aplique a label `do-not-merge`.
