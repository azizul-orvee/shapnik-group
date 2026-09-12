# Shapnik — Shomobay Shomiti management

Savings and fund management for a Bangladeshi cooperative society (*shomobay shomiti*).
Members pay a monthly contribution, the treasurer records it, and the app keeps the
cash book, the dues list and the reports the Department of Cooperatives asks for.

This is a **collections-only** society app: no loans, no interest, no repayment
schedules, and no expense tracking. Payments happen in cash or by bank outside
the app and the treasurer logs them afterwards — there is no payment gateway.

## What each member owes

Rates are per calendar year (`YearPlan`), not a single number for the whole society.

| Year | Monthly | Extra fee | Season | Total |
| --- | --- | --- | --- | --- |
| 2025 | ৳5,000 × 9 | ৳25,000 | Apr–Dec | **৳70,000** |
| 2026 | ৳6,000 × 12 | ৳28,000 | Jan–Dec | **৳1,00,000** |
| 2027 onwards | set by admin | set by admin | usually Jan–Dec | |

The extra fee is due **each year**. 2025 and 2026 rates are fixed. An admin adds
and edits **2027 onwards** under **Years** — 2027 is not created until they add it.

## Operating window

The society opened **April 2025**. The operating window is currently April 2025
to December 2026 (`Organization.startMonth` / `endMonth`, synced from year plans).
An admin adds 2027 onwards under **Years**.

Months **ahead of today are still open for payment**: a member can settle
December 2026 in January, or the whole year at once. Those months show as "paid
ahead" rather than pending, and an unpaid future month reads "not due yet".

The data model is multi-tenant from day one. Every row carries an `organizationId`
even though only one society exists today.

Working on this with an AI agent? `HANDOFF.md` is the full technical handoff;
`AGENTS.md` is the short list of conventions.

## Recording payments

Money changes hands outside the app; the treasurer logs it afterwards, and the
app is built to make that fast.

- **Dues, one tap.** `/dues` lists everyone for a month with a search box.
  Because the monthly amount is the same for everyone, an unpaid member gets a
  single **Log ৳X** button that records the month's rate dated today — one tap
  per payment, undoable from the toast. **Collect from N pending** logs several
  members in one go.
- **Lump sums.** A member who does not pay monthly hands over one large amount.
  On their profile, **Lump sum** splits it automatically — the year's extra fee
  first, then unpaid months oldest first — and shows the exact breakdown before
  saving. A remainder too small for a whole month is either a part payment or is
  left unrecorded, never silently absorbed.
- **Part paid** is its own state. A month settled for less than the rate is
  recorded but still shown as owed, and topping it up later raises that month
  rather than adding a second row.

## Look and feel

Mobile first — the treasurer works on a phone, with a floating bottom nav and a
sidebar on larger screens. The interface runs on a **teal brand theme** (kept
clear of the status colours, which stay on a colourblind-safe data palette) with
**light and dark modes** — the header toggle remembers the choice. The society
logo appears in the header, on the sign-in screen and as the browser favicon.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Database | PostgreSQL via Prisma 7 (`@prisma/adapter-pg`) |
| Auth | Auth.js / NextAuth v5, credentials + JWT sessions |
| UI | Tailwind CSS v4 + shadcn/ui, teal brand theme, light/dark |
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

The seed creates one organisation, year plans for 2025 and 2026, **30 active
members** (joined April 2025) each with a login, 2025 fully paid for everyone,
and 2026 collections up to today.

| Sign in as | Where | Credentials |
| --- | --- | --- |
| Admin | `/control_panel` | ID, NID and password from `.env` |
| Member | `/login` | `M-003` + the NID the seed prints |

The admin's credentials come from `ADMIN_LOGIN_ID`, `ADMIN_NID` and
`ADMIN_PASSWORD` (plus `ADMIN_NAME`); the society name from `SEED_ORG_NAME`.
Every member has a login of their member ID plus their NID; the seed prints
M-003's on completion. Real values live in `.env`, which is gitignored —
`.env.example` ships placeholders.

## Going to production

A live society starts **empty except for the admin** — `db:seed` is development
data and must never be run against production.

```bash
# 1. Provision Postgres (Neon / Supabase) and set DATABASE_URL + AUTH_SECRET.
# 2. Put the admin's real credentials in .env (or the host's env settings):
#      ADMIN_LOGIN_ID, ADMIN_NID, ADMIN_PASSWORD
npm run db:deploy      # create the tables
npm run db:bootstrap   # organisation + year plans + the admin login. Nothing else.
```

`db:bootstrap` creates **no members and no payments** — the admin registers the
real members through the app. It is safe to re-run: it never touches members or
payments, and rotating `ADMIN_LOGIN_ID` deletes the superseded admin login.

| | `db:seed` | `db:bootstrap` |
| --- | --- | --- |
| Organisation + year plans | ✅ | ✅ |
| Admin login | ✅ | ✅ |
| 30 fictional members with payments | ✅ | ❌ |
| Safe for production | **no** | yes |

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

## Signing in

There are two separate sign-in pages.

| Who | Where | Credentials |
| --- | --- | --- |
| Member | `/login` | member ID + their NID number |
| Admin | `/control_panel` | admin ID + NID + a separate password |

The admin door needs all three factors, and the member door refuses admins
outright — so the main page cannot be used to reach the control panel however
correct the first two credentials are. There is no email login.

Admin credentials come from the environment (`ADMIN_LOGIN_ID`, `ADMIN_NID`,
`ADMIN_PASSWORD`), so handover needs no code change. Set them in `.env` before
running `npm run db:seed`; re-seeding after changing the ID removes the old admin
login.


## Members

The admin registers each member with their name, member ID, phone, NID, nominee
name and nominee NID (nominee phone optional). Their login is created
automatically. Correcting a member's NID or ID also moves their login, so the
details on screen are always the ones that work.

The society is capped at **30 active members**; deactivating one frees a slot.

Everyone can edit their own details at **`/profile`** — the admin fills theirs in
whenever they like, and changing an NID there changes the password too.

> **Note on NID-as-password.** It is convenient for handover but weak — an NID is
> semi-public and never expires. It is stored hashed and shown only to the admin,
> but add a proper "change password" flow before this holds real money.

## Roles

| | Admin | Member |
| --- | --- | --- |
| Dashboard, dues, fund, reports | ✅ | — |
| Years (view 2025/2026, add/edit 2027+) | ✅ | — |
| Add / edit / deactivate members | ✅ | — |
| Log contributions | ✅ | — |
| Own contribution history and PDF | ✅ | ✅ own only |
| Edit own profile | ✅ | ✅ |
| View the account roster | ✅ | — |

A `MEMBER` login is linked to a `Member` row and can reach only `/my-statement`
and its own statement PDF. Authorization is enforced in the API layer
(`src/lib/api.ts`) and mirrored in page guards (`src/lib/session.ts`).

## Data model

- **Organization** — the tenant. Overall window (`startMonth` / `endMonth`) is
  kept in sync with year plans.
- **YearPlan** — monthly rate, extra fee, and season for one calendar year.
- **Member** — a person on the roll. `memberId` is the passbook code, unique per
  organisation. Members are deactivated, never deleted, so their history survives.
- **Contribution** — one payment, either `MONTHLY` or `ONE_TIME`. `paidForYear`
  is which year's obligation it counts toward. For monthly payments `paidForMonth`
  is a Postgres `date` pinned to the first of the month in UTC, and
  `@@unique([memberId, paidForMonth])` stops the same month being paid twice.
  One-time fee instalments carry no month.
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
- **Years** (admin) — `/years` lists each configured year with its rates and
  how much has been collected. 2025 and 2026 are view-only; **Add 2027** (then
  2028, …) is how later years appear.
- **My statement** (member) — completion ring against that year's target and a
  year filter, plus what is left to pay next, lifetime savings across every year,
  and how the target is worked out. It also shows how the society is doing
  overall as **aggregates only** — never another member's individual figures.

The header shows **today's date in Dhaka time** (`Asia/Dhaka`) for every signed-in
role.

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
