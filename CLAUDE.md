# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The project rules live in `AGENTS.md` (shared with other agents) and are imported
here. For architecture, the domain maths, routes, the data model and bugs that
have already bitten, read `HANDOFF.md` before changing anything non-trivial.

@AGENTS.md

## Commands

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server (also regenerates route types via `next typegen`) |
| `npm run typecheck` / `npm run lint` / `npm run build` | The pre-finish gate — run all three; `build` runs `prisma generate` first |
| `npm run db:migrate` | `prisma migrate dev` — create + apply a migration |
| `npm run db:deploy` | Apply pending migrations by hand — Vercel production deploys run it via `vercel-build` |
| `npm run db:seed` | Dev sample data — **never against production** |
| `npm run db:bootstrap` | Production first run — org, year plans, admin only |
| `npm run db:studio` | Prisma Studio |

There is **no test suite** — verification is typecheck + lint + build, plus
exercising the running app. Zero lint errors is the bar; a few React Compiler
warnings about RHF's `watch()` are expected.

Prisma is v7 with the `pg` driver adapter; the CLI reads `prisma7.config.ts`
(schema at `prisma/schema.prisma`, `DATABASE_URL` from `.env`).

## Gotchas when verifying

- `prisma migrate dev` fails against the local `prisma dev` server (shared
  shadow DB). Use the `migrate diff` → `db execute` → `migrate resolve --applied`
  workaround in `HANDOFF.md` §5 "Migrations".
- A page that throws renders `error.tsx` with **HTTP 200** in dev — grep the body
  for `"Something went wrong"` rather than trusting the status code.
- Restart the dev server after `prisma generate`; it keeps a stale client.
