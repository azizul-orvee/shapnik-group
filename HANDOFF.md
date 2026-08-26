# Shomiti — handoff

Everything an agent (Cursor, Claude, whoever) needs to pick this codebase up cold.
Read this once, then follow `AGENTS.md` for the rules you must not break.

- **`AGENTS.md`** — conventions and invariants. Non-negotiable, read it.
- **`README.md`** — setup and product overview, written for humans.
- **This file** — what the app is, how it is built, what has been decided and why,
  and where the sharp edges are.

---

## 1. What this is

A savings-management app for a Bangladeshi cooperative society (*shomobay
shomiti*) of ~30 members. The treasurer records payments; the app tracks who has
paid, who is behind, and produces the reports the Department of Cooperatives asks
for.

**Collections only.** No loans, no interest, no repayment schedules, no payment
gateway, and no expense tracking. Money is handed over in cash or by bank
*outside* the app; the treasurer logs it afterwards.

Multi-tenant from day one: every domain row carries `organizationId`, even though
exactly one society exists today. Take the id from the session, never from input.

---

## 2. The domain maths (get this right or nothing else matters)

Every member owes two separate things:

| Obligation | Amount | Notes |
| --- | --- | --- |
| Monthly contribution | ৳6,000 × 12 = ৳72,000 | one payment per calendar month |
| One-time admission fee | ৳28,000 | owed **once per membership**, instalments allowed |
| **Per member, per year** | **৳1,00,000** | |

Rates live on `Organization` (`monthlyAmount`, `oneTimeFee`). **Never hardcode
6000 / 28000 / 100000** — read them through `getSocietySettings()`.

### The fee is one-off, and that has consequences

Only the part of the fee *still outstanding when a year opened* counts toward
that year's target:

- 2026 target = 72,000 + 28,000 = **100,000**
- A member who cleared the fee in 2026 owes **72,000** in 2027

Without this, every member would show ~28% complete on 1 Jan 2027 having paid
nothing. `buildProgress()` in `src/server/progress.ts` splits fee payments into
`carriedIn` (before the year) and `paidInYear`.

The member-facing "One-time fee" card still shows the **lifetime** position
(৳28,000 of ৳28,000, "Cleared") so it reads sensibly in any year, while the
*target* maths uses the outstanding amount. Don't conflate the two.

### On track / behind

A member is **on track** when what they have paid covers the outstanding fee plus
one month for every month elapsed since they joined. The fee is due from day one,
not spread across the year — see `dueToDate` in `buildProgress()`.

### The operating window

The society runs **January 2026 → December 2027**, stored as
`Organization.startMonth` / `endMonth`. Nothing outside it can be recorded or
reported on.

- Out-of-range `?month=` / `?year=` params are **clamped**, not rejected —
  `/dues?month=2025-06` renders January 2026.
- The API rejects out-of-window months with a 400. The form hiding them is UX;
  the server check is the rule.
- **Months ahead of today are legitimate.** Members pay in advance, sometimes the
  whole year at once. An unpaid future month is "not due yet", never "pending".

---

## 3. Stack

| Concern | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js **16.3.3**, App Router, React 19.2.8 | `proxy.ts`, not `middleware.ts` |
| Language | TypeScript 5, strict | |
| DB | PostgreSQL via **Prisma 7.10** | needs a driver adapter — `@prisma/adapter-pg` |
| Auth | **Auth.js / NextAuth v5 beta**, credentials + JWT | no adapter; passwords are bcrypt |
| UI | Tailwind **v4** + shadcn/ui (radix base, "nova" preset) | |
| Forms | React Hook Form + Zod 4 | |
| Charts | Recharts 3.10 | |
| PDF | `@react-pdf/renderer` 4 | Node runtime only |
| Host | Vercel + Neon/Supabase Postgres | |

Prisma 7 generates into **`src/generated/prisma`** (gitignored) and *requires* a
driver adapter — there is no engine-based client any more.

---

## 4. Architecture

### Layering — do not shortcut it

```
app/(app)/**/page.tsx     Server Components. Guard → call src/server/* → render.
app/api/**/route.ts       REST. Guard → validate → call src/server/* → JSON.
        │
        ▼
src/server/*.ts           ALL database access. Marked `server-only`.
        │                 One module per domain area. Pages/routes never
        ▼                 touch `prisma` directly.
src/lib/prisma.ts         The single PrismaClient.
```

Client components talk to the API via `apiRequest()` (`src/lib/http.ts`), which
surfaces server-side field errors into RHF's `setError`.

### Authorization — two layers, one of them real

- **`src/lib/api.ts`** is the actual boundary. `requireApiSession()`,
  `requireApiOrgReader()`, `requireApiWriter()` throw `ApiError`; `handler()`
  turns that into JSON. Every mutation route goes through one.
- **`src/lib/session.ts`** mirrors the checks for pages as redirects. These are
  **UX only** — a page guard leaks the `<title>` before redirecting. The API
  guards are what enforce access.

| | ADMIN | TREASURER | COMMITTEE | MEMBER |
| --- | --- | --- | --- | --- |
| Read org-wide data | ✅ | ✅ | ✅ | ❌ (403) |
| Create/edit members, payments | ✅ | ✅ | ❌ (403) | ❌ |
| Own statement + own PDF | ✅ | ✅ | ✅ | ✅ own only |
| Manage logins | ✅ | ❌ | ❌ | ❌ |

A `MEMBER` login is linked to a `Member` row via `User.memberId` and can reach
only `/my-statement` and its own statement PDF.

### Directory map

```
src/
  auth.ts               NextAuth entry: handlers, auth, signIn, signOut
  auth.config.ts        Edge-safe half (no Prisma/bcrypt) — used by proxy.ts
  proxy.ts              Next 16 middleware. Cookie presence only; roles live in guards.
  types/next-auth.d.ts  Session/User/JWT augmentation.
                        NOTE: JWT augments "@auth/core/jwt", NOT "next-auth/jwt"
                        (the latter only re-exports; augmenting it silently fails)

  lib/
    prisma.ts       PrismaClient + pg pool config (see §7 — the pool settings matter)
    api.ts          ApiError, handler(), parseBody(), the three API guards
    session.ts      Page-level guards as redirects
    rbac.ts         Role predicates + ROLE_LABELS
    validation.ts   Every Zod schema. Forms and routes share them.
    dates.ts        Month-key helpers. monthKey = "YYYY-MM" throughout.
    money.ts        formatTaka / formatTakaShort / toNumber
    http.ts         apiRequest() + ApiRequestError
    pdf-format.ts   pdfAmount / pdfDate / pdfText (ASCII-folds typographic chars)
    utils.ts        shadcn cn()

  server/           ── all DB access ──
    progress.ts     ★ THE IMPORTANT ONE. Society settings, the window, and every
                    definition of "paid", "owed today", "on track".
                    getSocietySettings, resolveMonth, resolveYear, monthsElapsed,
                    getSocietyProgress, getMonthlyBreakdown, getMemberProgress,
                    getMemberCumulative
    members.ts      listMembers, findMember/getMember (+WithContributions),
                    createMember, updateMember, setMemberStatus, suggestMemberCode
    contributions.ts listContributions, createContribution, createContributionsBulk,
                    updateContribution, deleteContribution, getDuesForMonth
    fund.ts         getFundTotals, getFundGrowth (+ dormant spending fns, see §8)
    reports.ts      buildMemberStatement, buildMonthlySummary, buildAnnualReport,
                    listReportYears
    users.ts        listUsers, createUser

  components/
    app/            App-specific UI (see §5)
    pdf/            @react-pdf documents + shared styles
    ui/             shadcn primitives — regenerate, don't hand-edit
```

### Routes

| Page | Who | Notes |
| --- | --- | --- |
| `/` | any | redirects by role |
| `/login` | anon | Server Action + `useActionState` |
| `/dashboard` | org readers | society progress, chase list |
| `/members`, `/members/new`, `/members/[id]`, `/members/[id]/edit` | org readers / writers | |
| `/contributions`, `/contributions/new` | org readers / writers | |
| `/dues` | org readers | per-month paid/pending + bulk collect |
| `/fund` | org readers | totals, growth chart, recent payments |
| `/reports`, `/reports/monthly`, `/reports/annual` | org readers | |
| `/users` | ADMIN | |
| `/my-statement` | MEMBER (and anyone with a linked member) | |

| API | Methods |
| --- | --- |
| `/api/auth/[...nextauth]` | GET POST |
| `/api/members` | GET POST |
| `/api/members/[id]` | GET PATCH DELETE (DELETE = deactivate) |
| `/api/contributions` | GET POST |
| `/api/contributions/[id]` | PATCH DELETE |
| `/api/contributions/bulk` | POST |
| `/api/users` | GET POST (ADMIN) |
| `/api/reports/members/[id]/pdf` | GET |
| `/api/reports/annual/[year]/pdf` | GET |

---

## 5. Data model

```
Organization ──< Member ──< Contribution >── FundTransaction (1:1, optional)
     │             │
     └──< User ────┘        (User.memberId links a MEMBER login to a Member)
```

**Organization** — tenant. Carries `monthlyAmount`, `oneTimeFee`, `startMonth`,
`endMonth`.

**Member** — `memberId` is the passbook code, unique per org. Members are
**deactivated, never deleted** (`DELETE /api/members/[id]` sets `INACTIVE`), so
their payment history survives.

**Contribution** — `type` is `MONTHLY` or `ONE_TIME`.
- `paidForMonth` is a Postgres `date` pinned to the **first of the month in UTC**.
  Build it with `monthKeyToDate()`; never construct it inline.
- It is **null for `ONE_TIME`**. Postgres treats nulls as distinct in a unique
  index, so `@@unique([memberId, paidForMonth])` blocks a double-paid month while
  still allowing several fee instalments.
- `paidOnDate` is when money changed hands; `paidForMonth` is what it settles.
  **These differ for advance payments** and a lot of logic depends on which you use.

**FundTransaction** — the cash book. Every contribution creates a linked `IN` row
in the *same* `prisma.$transaction`, so the ledger can never drift. Rows with a
`contributionId` are not directly editable. **Nothing writes `OUT` rows today.**

**User** — `role` ∈ ADMIN/TREASURER/COMMITTEE/MEMBER, `passwordHash` bcrypt,
optional `memberId`.

### Migrations

```
20260825182224_init
20260825200302_add_one_time_fee_and_rates    ContributionType, nullable paidForMonth, rates
20260825210216_add_operating_window          startMonth / endMonth
```

⚠️ `prisma migrate dev` **fails against the local `prisma dev` server** — its
shadow database is the same `template1` and already holds the types. Workaround
used for both later migrations:

```bash
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > m.sql
mkdir -p prisma/migrations/<timestamp>_<name> && mv m.sql prisma/migrations/<timestamp>_<name>/migration.sql
npx prisma db execute --file prisma/migrations/<timestamp>_<name>/migration.sql
npx prisma migrate resolve --applied <timestamp>_<name>
```

Against a real Neon/Supabase database with a separate shadow DB, `migrate dev`
works normally.

---

## 6. UI conventions

**Mobile first** — the treasurer logs payments on a phone. Bottom nav below `md`,
sidebar above. Tables live in `overflow-x-auto`; hide secondary columns on small
screens rather than shrinking them.

**Nothing with a function in it crosses the RSC boundary.** Nav icons are string
keys resolved on the client (`src/components/app/nav-links.ts` → `app-nav.tsx`).
This one already caused a total outage — see §7.

### Charts and colour

Colours are `--viz-*` tokens in `globals.css`, from a **validated
colourblind-safe** palette: blue = monthly savings, orange = one-time fee, plus
fixed status colours (`good` / `warning` / `serious` / `critical`). Both light and
dark steps were chosen deliberately, not flipped. **Do not add chart hues without
re-validating.**

Rules that are load-bearing:

- **Identity never rests on colour alone** — every meter and chart ships a legend
  or a written label beside the swatch.
- **`isAnimationActive={false}` on every Recharts mark.** These are static data
  views and a mark whose entrance animation never runs stays invisible.
- **Use the function form of Recharts `shape`**, not the element form. Recharts
  documents the element form as unsupported for typing and it silently renders
  nothing.
- **Charts go inside `<ChartFrame>`** (`components/app/chart-frame.tsx`), which
  mounts client-only behind a local Suspense boundary. See §7.

### Reusable pieces

| Component | Purpose |
| --- | --- |
| `Meter` / `MeterLegend` | stacked progress bar against a target, 2px surface gaps |
| `ProgressRing` | circular completion dial |
| `MonthGrid` / `MonthGridLegend` | 12 chips: paid / pending / not due yet |
| `MemberProgressList` | per-member meters + status band (the chase list) |
| `CollectionChart` | paid vs pending members per month |
| `PaceChart` | cumulative paid vs what is owed as the year goes on |
| `CoversLabel` | "August 2026" or "One-time fee" with matching dot |
| `PaidBadge` | three states — paid / paid ahead / not due yet / pending |
| `MonthPicker` | `?month=` stepper bounded by the window |
| `StatCard`, `PageHeader`, `EmptyState`, `Field` | layout primitives |

### Forms

RHF + `zodResolver`, typed `useForm<z.input<S>, unknown, z.output<S>>` — input and
output types differ wherever a schema has defaults or transforms. Getting this
wrong produces a wall of resolver type errors.

---

## 7. Bugs already hit — don't reintroduce these

1. **Functions across the RSC boundary.** Nav icons were Lucide *components*
   passed from a Server Component into a client one. Every page 500'd at runtime
   while `next build` passed clean. Icons are now string keys.

2. **Recharts marks invisible.** Entrance animations weren't running, leaving
   bars and lines undrawn. Fixed with `isAnimationActive={false}` everywhere.

3. **Recharts element-form `shape` renders nothing.** `shape={<MyShape />}` never
   called the component. Use `shape={(props) => <MyShape {...props} />}`.

4. **React #441 on resize (production only).** Rotating a phone blanked the whole
   dashboard: a resize made the lazily-chunked chart suspend during synchronous
   input, taking down the page-level Suspense boundary. Dev never reproduced it.
   Fixed by `ChartFrame` — client-only mount + its own Suspense boundary.
   Detect mount with `useSyncExternalStore`, **not** `setState` in an effect
   (the lint rule `react-hooks/set-state-in-effect` will fail the build).

5. **Prisma P1017 "Server has closed the connection."** The pool handed out a
   socket the server had already dropped. `src/lib/prisma.ts` sets
   `idleTimeoutMillis`, `connectionTimeoutMillis`, `max`, `maxLifetimeSeconds`.
   **Keep those** — Neon and Supabase poolers drop idle connections the same way.

6. **NextAuth JWT augmentation targeting the wrong module.** `next-auth/jwt` only
   re-exports; augment `@auth/core/jwt`.

7. **Chart contradicting its own headline.** The pace chart counted only the
   current year's payment dates and dropped a fee paid earlier, showing ৳48,000
   against a ৳76,000 hero. Both now derive from `progress.ts`. **Any new view must
   read its numbers from there** rather than re-deriving them.

8. **PDFs drop typographic characters.** Standard Helvetica has no `৳`, em-dash or
   curly quotes. PDFs print `BDT` and run text through `pdfText()`. Bangla member
   names will **not** render in PDFs until a Unicode font is embedded.

### Verification gotchas

- **Status codes are not proof.** A page that throws renders `error.tsx` with a
  **200** in dev. Grep the body for `"Something went wrong"` instead.
- The browser-preview pane in this environment: input injection (click/type) does
  not work, `javascript_tool` sometimes evaluates against a different document
  than the screenshot, and Recharts fails to render in very tall emulated
  viewports (2700px). **Screenshots are the reliable signal**; HTTP checks via
  `curl` are the reliable functional signal.
- A restarted dev server keeps a **stale Prisma client** after `prisma generate`.
  Restart it after schema changes.

---

## 8. Known dead code / loose ends

Deliberately left in place, but nothing references them:

- `src/server/fund.ts` — `listTransactions`, `createTransaction`,
  `updateTransaction`, `deleteTransaction`, `getLedgerWithRunningBalance`
- `src/lib/validation.ts` — `transactionCreateSchema`, `transactionUpdateSchema`
- `src/lib/dates.ts` — `lastNMonths`

These are the expense-tracking machinery. The UI and `/api/transactions` were
removed when spending went out of scope, but `FundTransaction` still records an
`IN` row per contribution, so expenses can come back without a migration. **Delete
them if spending is off the table for good; otherwise leave them.**

Also open:

- `TransactionType.OUT` exists in the schema and is never written.
- Whether the ৳28,000 fee should recur annually instead of being one-off is
  **unconfirmed with the client** — current behaviour is one-off (see §2).
- No tests. Verification so far has been typecheck + lint + build + manual HTTP
  and screenshot checks against a production build.
- No SMS/email notifications, no audit log, no CSV export.

---

## 9. Running it

```bash
npm install
cp .env.example .env          # fill DATABASE_URL + AUTH_SECRET (npx auth secret)
npx prisma dev --name shomiti # optional local Postgres; paste both URLs into .env
npm run db:migrate
npm run db:seed
npm run dev
```

| Script | Does |
| --- | --- |
| `npm run dev` | dev server |
| `npm run build` | `prisma generate && next build` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | eslint |
| `npm run db:migrate` / `db:deploy` / `db:seed` / `db:studio` | Prisma |

### Seed accounts (password `shomiti1234`)

| Email | Role | Notes |
| --- | --- | --- |
| `admin@shomiti.local` | ADMIN | |
| `committee@shomiti.local` | COMMITTEE | view-only |
| `member@shomiti.local` | MEMBER | linked to **M-003**, who paid the full ৳1,00,000 on 5 Jan 2026 — the advance-payment demo |

The seed builds 30 members (28 active), monthly contributions from Jan 2026 to
today with two members left unpaid in the current month, and a spread of one-time
fee states (22 cleared, 6 part-paid).

### Before you call anything done

```bash
npm run typecheck && npm run lint && npm run build
```

Route types (`PageProps`, `LayoutProps`) come from `next typegen`, which runs as
part of `dev`/`build`. If they look stale: `npx next typegen`.

Expect ~6 lint **warnings** (React Compiler declining to memoize RHF's `watch()`).
Zero errors is the bar.

---

## 10. Deploying

1. Provision Postgres (Neon or Supabase). Set `DATABASE_URL` to the **pooled**
   string; `SHADOW_DATABASE_URL` to a direct connection if you will run
   `migrate dev` against it.
2. Set `AUTH_SECRET`, and `AUTH_TRUST_HOST=true` if the host is not auto-detected.
3. Deploy. `postinstall` runs `prisma generate`.
4. Run `npm run db:deploy` against production, then seed or create the first admin.

`@react-pdf/renderer` and `pg` are in `serverExternalPackages` (`next.config.ts`)
so they run as real Node modules instead of being bundled. Keep them there.

---

## 11. If you change one thing, check these

| Change | Also update |
| --- | --- |
| Rates or the window | `getSocietySettings()` only — everything else reads from it |
| Anything about "paid" / "owed" / "on track" | `src/server/progress.ts`, then confirm dashboard, `/my-statement` and the pace chart still agree |
| A Zod schema | forms *and* routes share it — check both |
| `Contribution` writes | the linked `FundTransaction` must move in the same `$transaction` |
| A chart | `isAnimationActive={false}`, function-form `shape`, inside `ChartFrame`, legend present |
| Chart colours | re-validate the palette for CVD in **both** themes |
| Adding a page | guard it (`requireOrgReader` / `requireWriter`) *and* guard the API it calls |
