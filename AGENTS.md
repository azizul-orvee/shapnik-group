<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Shomiti — project conventions

**New here? Read `HANDOFF.md` first** — it covers the architecture, the domain
maths, decisions already made, and the bugs that have already bitten this
codebase. This file is the short list of rules you must not break.

Cooperative society (*shomobay shomiti*) savings management. Collections only:
no loans, no interest, no payment gateway, and **no spending/expense tracking**.
See `README.md` for setup.

## What every member owes

Rates live on `Organization` (`monthlyAmount`, `oneTimeFee`) so a second society
can run different ones. Read them through `getRates()` in `src/server/progress.ts`
— never hard-code 6000/28000 in a component.

- a monthly contribution, twelve times a year (default 6,000 → 72,000)
- a one-off admission fee, owed once for the life of the membership (28,000)
- so one member owes **100,000 across a full year**

`Contribution.type` is `MONTHLY` or `ONE_TIME`. `paidForMonth` is null for
`ONE_TIME`, and because Postgres treats nulls as distinct in a unique index the
fee can be taken in instalments while monthly payments stay one-per-month.

The fee is owed **once**, so only the part still outstanding when a year opened
counts toward that year's target: 2026 asks for 100,000, and a member who
cleared the fee then owes 72,000 in 2027.

## The operating window

`Organization.startMonth` / `endMonth` bound everything (currently 2026-01 to
2027-12). Read them via `getSocietySettings()`, and resolve user input with
`resolveMonth()` / `resolveYear()` — both clamp into the window, so an
out-of-range `?month=` renders the nearest valid month instead of erroring.

- **Never use `new Date()` for "which month/year are we on"** in a page. Use
  `settings.activeMonthKey`, which is today clamped into the window.
- **Months ahead of today are legitimate.** Members pay in advance, sometimes a
  whole year at once, so pickers and forms offer future months inside the
  window. An unpaid future month is "not due yet", never "pending".
- `createContribution` and the bulk path reject months outside the window — the
  form hiding them is UX, the server check is the rule.

## Boundaries

- `src/server/*` — all database access, one module per domain area. Marked
  `server-only`. Route handlers and pages call these; they never touch `prisma`
  directly.
- `src/lib/api.ts` — the authorization boundary. `requireApiWriter()`,
  `requireApiOrgReader()` and `requireApiSession()` throw `ApiError`, which
  `handler()` turns into JSON. Every mutation route goes through one of them.
- `src/lib/session.ts` — the same checks for pages, expressed as redirects.
  These are UX, not security; the API guards are what actually enforce access.
- `src/lib/validation.ts` — every Zod schema. Forms and routes share them, so a
  rule only ever gets written once.

## Rules that are easy to get wrong

- **Every query is scoped by `organizationId`.** The app is multi-tenant even
  though one society exists. Take the id from the session, never from input.
- **Contributions and the cash book move together.** Creating, editing or
  deleting a `Contribution` must keep its linked `FundTransaction` in step, in a
  single `prisma.$transaction`. Ledger rows with a `contributionId` are not
  directly editable. `FundTransaction` still exists and still records an `IN` row
  per contribution, but nothing writes `OUT` rows — expense tracking was removed
  from the UI, so the table is effectively collections-only until it comes back.
- **Progress figures come from one place.** `src/server/progress.ts` defines what
  "paid", "owed today" and "on track" mean. Every view — dashboard, member
  statement, the pace chart — must read from it, so a headline number and a chart
  on the same page can never disagree.
- **`paidForMonth` is a UTC-midnight `date`** on the first of the month. Build it
  with `monthKeyToDate()` from `src/lib/dates.ts`; never construct it inline.
- **Money is `Decimal`.** Call `.toNumber()` only at the edge, when formatting.
  Use `formatTaka` / `formatTakaShort` from `src/lib/money.ts`.
- **Members are deactivated, not deleted.** `DELETE /api/members/[id]` sets
  status to `INACTIVE`.
- **Nothing with a function in it crosses the RSC boundary.** Nav icons are
  string keys resolved on the client (`src/components/app/nav-links.ts`).

## Forms

React Hook Form with `zodResolver`, typed as
`useForm<z.input<S>, unknown, z.output<S>>` — the input and output types differ
wherever a schema has defaults or transforms. Submit through `apiRequest()` from
`src/lib/http.ts`, which surfaces server-side field errors via `setError`.

## Charts

Colours come from the `--viz-*` tokens in `globals.css`, a validated
colourblind-safe pair (blue = monthly savings, orange = one-time fee) plus fixed
status colours. Do not introduce new chart hues without re-validating.

- **Identity never rests on colour alone** — every meter and chart ships a legend
  or a written label beside the swatch.
- **Set `isAnimationActive={false}` on Recharts marks.** These are static data
  views, and a mark whose entrance animation never runs stays invisible.
- Use the **function form** of Recharts `shape`, not the element form — Recharts
  documents the element form as unsupported for typing and it silently renders
  nothing.

## UI

Mobile first — the treasurer logs payments on a phone. Bottom nav below `md`,
sidebar above. Keep tables scrollable in an `overflow-x-auto` wrapper and hide
secondary columns on small screens rather than shrinking them.

## Before finishing

```bash
npm run typecheck && npm run lint && npm run build
```

Route types (`PageProps`, `LayoutProps`) come from `next typegen`, which runs as
part of `dev`/`build`. If they look stale, run `npx next typegen`.
