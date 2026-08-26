# Shomiti — Shomobay Shomiti management

Savings and fund management for a Bangladeshi cooperative society (*shomobay shomiti*).
Members pay a monthly contribution, the treasurer records it, and the app keeps the
cash book, the dues list and the reports the Department of Cooperatives asks for.

This is a **collections-only** society app: no loans, no interest, no repayment
schedules, and no expense tracking. Payments happen in cash or by bank outside
the app and the treasurer logs them afterwards — there is no payment gateway.

## What each member owes

| | Amount |
| --- | --- |
| Monthly contribution | ৳6,000 × 12 = **৳72,000** |
| One-time admission fee | **৳28,000** (once per membership, instalments allowed) |
| **Total per member per year** | **৳1,00,000** |

Both rates live on the `Organization` row, so a different society can run
different numbers without a code change.

The admission fee is owed **once**. Only what is still outstanding when a year
opens counts toward that year: 2026 asks for ৳1,00,000; a member who cleared the
fee then owes ৳72,000 in 2027.

## Operating window

The society runs **January 2026 to December 2027** (`Organization.startMonth` /
`endMonth`). Nothing outside it can be recorded or reported on — out-of-range
month and year parameters are clamped to the nearest valid one, and the API
rejects payments for months outside the window.

Months **ahead of today are still open for payment**: a member can settle
December 2026 in January, or the whole year at once. Those months show as "paid
ahead" rather than pending, and an unpaid future month reads "not due yet".

The data model is multi-tenant from day one. Every row carries an `organizationId`
even though only one society exists today.

Working on this with an AI agent? `HANDOFF.md` is the full technical handoff;
`AGENTS.md` is the short list of conventions.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Database | PostgreSQL via Prisma 7 (`@prisma/adapter-pg`) |
| Auth | Auth.js / NextAuth v5, credentials + JWT sessions |
| UI | Tailwind CSS v4 + shadcn/ui |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| PDF | `@react-pdf/renderer` |
| Hosting | Vercel, with Postgres from Neon or Supabase |

## Getting started

```bash
npm install
```

Copy the env template and fill it in:

```bash
cp .env.example .env
```

`AUTH_SECRET` can be generated with `npx auth secret`.

For a throwaway local database, Prisma can run one for you:

```bash
npx prisma dev --name shomiti
```

It prints a `DATABASE_URL` and a `SHADOW_DATABASE_URL` — paste both into `.env`.
Then apply the schema and load sample data:

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

The seed creates one organisation, 30 members, ~13 months of contributions, a few
expenses, and three logins:

| Email | Password | Role |
| --- | --- | --- |
| `admin@shomiti.local` | `shomiti1234` | Admin |
| `committee@shomiti.local` | `shomiti1234` | Committee (view-only) |
| `member@shomiti.local` | `shomiti1234` | Member (own records only) |

Override the admin credentials with `SEED_ORG_NAME`, `SEED_ADMIN_EMAIL` and
`SEED_ADMIN_PASSWORD`.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | `prisma generate` then a production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Create and apply a migration (development) |
| `npm run db:deploy` | Apply pending migrations (production) |
| `npm run db:seed` | Load sample data |
| `npm run db:studio` | Prisma Studio |

## Roles

| | Admin | Treasurer | Committee | Member |
| --- | --- | --- | --- | --- |
| Dashboard, dues, cash book, reports | ✅ | ✅ | ✅ view | — |
| Add / edit / deactivate members | ✅ | ✅ | — | — |
| Log contributions and expenses | ✅ | ✅ | — | — |
| Own contribution history and PDF | ✅ | ✅ | ✅ | ✅ own only |
| Manage logins | ✅ | — | — | — |

A `MEMBER` login is linked to a `Member` row and can reach only `/my-statement`
and its own statement PDF. Authorization is enforced in the API layer
(`src/lib/api.ts`) and mirrored in page guards (`src/lib/session.ts`).

## Data model

- **Organization** — the tenant.
- **Member** — a person on the roll. `memberId` is the passbook code, unique per
  organisation. Members are deactivated, never deleted, so their history survives.
- **Contribution** — one payment, either `MONTHLY` or `ONE_TIME`. For monthly
  payments `paidForMonth` is a Postgres `date` pinned to the first of the month in
  UTC, and `@@unique([memberId, paidForMonth])` stops the same month being paid
  twice. One-time fee instalments carry no month.
- **FundTransaction** — the cash book. Every contribution creates a linked `IN`
  row in the same transaction, so the ledger can never drift from the
  contribution list. Nothing writes `OUT` rows today.
- **User** — a login, with a role and an optional link to a `Member`.

## Progress tracking

`src/server/progress.ts` is the single source of truth for what "paid", "owed
today" and "on track" mean:

- **Dashboard** (admin/committee) — society completion ring, a stacked
  monthly/one-time meter against the year's target, members paid vs pending per
  month, one-time fee clearance, and a "who needs chasing" list sorted by who is
  furthest behind what they owe today.
- **My statement** (member) — completion ring against their ৳1,00,000, separate
  meters for the monthly and one-time tracks, a twelve-month settled/pending grid,
  and their running total against the pace they are held to.

A member counts as *on track* when what they have paid covers the one-time fee
plus one month for every month elapsed since they joined.

## Reports

- **Per-member statement** — `/api/reports/members/[id]/pdf`
- **Monthly collection summary** — `/reports/monthly?month=YYYY-MM`
- **Annual fund report** — `/reports/annual?year=YYYY`, PDF at
  `/api/reports/annual/[year]/pdf`, laid out for filing with the Department of
  Cooperatives. Receipts only, since the app does not track spending.

PDFs use the standard Helvetica fonts, which have no glyph for `৳`, so printed
documents show `BDT` while the screen shows the Taka sign.

## Deploying to Vercel

1. Provision Postgres (Neon or Supabase) and set `DATABASE_URL`. Use the pooled
   connection string; set `SHADOW_DATABASE_URL` to a direct connection if you plan
   to run `prisma migrate dev` against it.
2. Set `AUTH_SECRET`, and `AUTH_TRUST_HOST=true` if the host is not auto-detected.
3. Deploy. `postinstall` runs `prisma generate`.
4. Run `npm run db:deploy` against the production database to apply migrations,
   then seed or create the first admin account.

`@react-pdf/renderer` and `pg` are listed in `serverExternalPackages` so they run
as real Node modules rather than being bundled.

## Out of scope

No loans, interest or repayment schedules. No payment gateway. No expense or
spending tracking. No SMS or email notifications.
