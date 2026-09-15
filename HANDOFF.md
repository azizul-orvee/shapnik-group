# Shapnik — handoff

Everything an agent (Cursor, Claude, whoever) needs to pick this codebase up cold.
Read this once, then follow `AGENTS.md` for the rules you must not break.

- **`AGENTS.md`** — conventions and invariants. Non-negotiable, read it.
- **`README.md`** — setup and product overview, written for humans.
- **This file** — what the app is, how it is built, what has been decided and why,
  and where the sharp edges are.

Every change keeps all three current, in the same piece of work — see
`AGENTS.md` → Docs.

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

Every member owes two separate things **each year**, at that year's rates:

| Obligation | 2025 (Apr–Dec) | 2026 |
| --- | --- | --- |
| Monthly contribution | ৳5,000 × 9 = ৳45,000 | ৳6,000 × 12 = ৳72,000 |
| Extra ("one-time") fee | ৳25,000 | ৳28,000 |
| **Per member** | **৳70,000** | **৳1,00,000** |

Rates live on `YearPlan`. **Never hardcode them** — read through `getYearPlan()` /
`listYearPlans()`. 2025 and 2026 cannot have their rates changed in the app (do
**not** show a "Locked" badge — just omit Edit). 2027 is **not** pre-created;
an admin adds it under `/years` when they are ready, then 2028, and so on.

The extra fee is due **that year**, not once per membership. A member who cleared
the 2025 fee still owes the 2026 fee. `buildProgress()` counts `ONE_TIME` rows
with `paidForYear === year`. Don't bring back the old lifetime `carriedIn` split.

### On track / behind

A member is **on track** when what they have paid covers the outstanding fee plus
one month for every month elapsed since they joined. The fee is due from day one,
not spread across the year — see `dueToDate` in `buildProgress()`.

### The operating window

The society opened **April 2025**. The overall window is stored as
`Organization.startMonth` / `endMonth` and kept in sync with YearPlan rows
(currently 2025-04 → 2026-12, until an admin adds 2027). Nothing outside it can be recorded or reported on.

- Out-of-range `?month=` / `?year=` params are **clamped**, not rejected —
  `/dues?month=2024-06` renders April 2025.
- The API rejects out-of-window months with a 400. The form hiding them is UX;
  the server check is the rule.
- **Months ahead of today are legitimate.** Members pay in advance, sometimes the
  whole year at once. An unpaid future month is "not due yet", never "pending".

### Lump sums and part-paid months

Not everyone pays monthly. A member may hand over half the year in one go, then
the rest whenever. `planLumpSum()` in `src/lib/allocate.ts` turns one amount into
the rows the app tracks, in a fixed order:

1. the year's outstanding extra fee (due from day one),
2. months already settled for **less** than the rate, oldest first (topped up),
3. months with no payment at all, oldest first, at the full rate,
4. whatever is left that cannot fill a whole month — recorded as a short payment
   on the next unpaid month, or reported as unallocated and **not recorded**.

The rule that shapes all of this: `@@unique([memberId, paidForMonth])` means a
month holds **exactly one** contribution row. So money added to an already-short
month is an `update` (a `MONTHLY_TOPUP` part), never a second row — and its linked
`FundTransaction` is raised in the same transaction.

A month settled for less than the rate is **part paid**: recorded, but still owed.
It is a distinct state everywhere — `DuesRow.short` / `shortfall`,
`MemberProgress.partialMonths`, the `PaidBadge` "Part paid" state, and the amber
`½` chip in `MonthGrid`. `getYearObligation().outstanding` counts those gaps, so
"outstanding" never reads zero while a month is short.

`planLumpSum()` is pure and client-safe on purpose: the dialog previews the split
and the server recomputes it from the same function, so the treasurer always
approves exactly what gets written.

---

## 3. Stack

| Concern | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js **16.3.3**, App Router, React 19.2.8 | `proxy.ts`, not `middleware.ts` |
| Language | TypeScript 5, strict | |
| DB | PostgreSQL via **Prisma 7.10** | needs a driver adapter — `@prisma/adapter-pg` |
| Auth | **Auth.js / NextAuth v5 beta**, credentials + JWT | no adapter; passwords are bcrypt |
| UI | Tailwind **v4** + shadcn/ui (radix base, "nova" preset) | brand teal + `.dark`, Inter body / Plus Jakarta headings |
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

- **Two roles only: ADMIN and MEMBER.** Committee and treasurer were removed in
  `20260902164832_two_roles_and_admin_profile`; do not reintroduce them.
- **`src/lib/api.ts`** is the actual boundary. `requireApiSession()`,
  `requireApiOrgReader()`, `requireApiWriter()`, `requireApiAdmin()` throw
  `ApiError`; `handler()` turns that into JSON. Every mutation route goes through
  one.
- **`src/lib/session.ts`** mirrors the checks for pages as redirects. These are
  **UX only** — a page guard leaks the `<title>` before redirecting. The API
  guards are what enforce access.

| | ADMIN | MEMBER |
| --- | --- | --- |
| Read org-wide data | ✅ | ❌ (403) |
| Create/edit members, payments | ✅ | ❌ |
| Year plans | ✅ | ❌ |
| Own statement + own PDF | ✅ | ✅ own only |
| Edit own profile | ✅ | ❌ (read-only view of their Member row) |
| Account roster | ✅ | ❌ |


A `MEMBER` login is linked to a `Member` row via `User.memberId` and can reach
`/my-statement`, its own statement PDF, and a read-only `/profile`.

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
    api.ts          ApiError, handler(), parseBody(), API guards including requireApiAdmin
    session.ts      Page-level guards as redirects (requireAdmin for /years)
    rbac.ts         Role predicates + ROLE_LABELS + canManageYears
    validation.ts   Every Zod schema. Forms and routes share them.
    dates.ts        Month-key helpers. monthKey = "YYYY-MM" throughout.
                    formatDhakaToday / dhakaDateKey — header date, always Asia/Dhaka.
                    planForMonthKey — client-safe year lookup (do not import years.ts).
                    formatDate is used by fund/dues/members/statement — keep it.
    money.ts        formatTaka / formatTakaShort / toNumber
    http.ts         apiRequest() + ApiRequestError
    allocate.ts     planLumpSum() — how one large payment is split across a
                    year's fee and its unpaid months. planInitialSetup() — the
                    new-member setup window's split: ticked months/fee at full
                    rate, then a lump sum fills the remaining months oldest-first
                    then the fee. Both pure and client-safe, so the preview the
                    admin approves and the rows the server writes come from the
                    same call.
    pdf-format.ts   pdfAmount / pdfDate / pdfIssuedOn / pdfText
                    (ASCII-folds typographic chars; issue dates are Asia/Dhaka)
    utils.ts        shadcn cn()

  server/           ── all DB access ──
    progress.ts     ★ THE IMPORTANT ONE. Window + every definition of "paid",
                    "owed today", "on track". getSocietySettings is window-only
                    (no rates). Year rates come from YearPlan via getYearPlan().
                    getSocietyProgress returns the year's plan, not org-wide rates.
    years.ts        YearPlan CRUD. listYearPlans, getYearPlan, create/update/delete.
                    2025–2026 cannot be edited; 2027+ is admin-added (not seeded).
    members.ts      listMembers, findMember/getMember (+WithContributions),
                    createMember, updateMember, deleteMember, suggestMemberCode
    contributions.ts listContributions, createContribution, createContributionsBulk,
                    updateContribution, deleteContribution, getDuesForMonth,
                    getYearObligation, recordLumpSum, recordInitialSetup,
                    ledgerDescription (exported for the member auto-settlement)
    fund.ts         getFundTotals, getFundGrowth (+ dormant spending fns, see §8)
    reports.ts      buildMemberStatement, buildMonthlySummary, buildAnnualReport,
                    listReportYears
    users.ts        listUsers, createUser

  components/
    app/            App-specific UI (see §5)
    pdf/            @react-pdf documents, letterhead + logo raster, shared styles
    ui/             shadcn primitives — regenerate, don't hand-edit
```

### Routes

| Page | Who | Notes |
| --- | --- | --- |
| `/` | any | redirects by role |
| `/login` | anon | members only — Server Action + `useActionState` |
| `/control_panel` | anon | admin only, three factors, `noindex` |
| `/dashboard` | org readers | society progress, chase list |
| `/members`, `/members/new`, `/members/[id]`, `/members/[id]/edit` | org readers / writers | |
| `/members/[id]/setup` | writers | record a new member's initial payments (shown right after creation) |
| `/contributions`, `/contributions/new` | org readers / writers | |
| `/dues` | org readers | per-month paid/pending + bulk collect |
| `/fund` | org readers | totals, growth chart, recent payments |
| `/reports`, `/reports/monthly`, `/reports/annual` | org readers | |
| `/users` | ADMIN | read-only roster |
| `/profile` | any signed-in user | admin edits their own User details; member sees a read-only copy of their Member row (NID masked) |
| `/years`, `/years/new`, `/years/[year]`, `/years/[year]/edit` | ADMIN | 2025/2026 view-only (no Locked label); 2027+ added by admin |
| `/my-statement` | MEMBER (and anyone with a linked member) | `?year=` filter; what-to-pay-next, lifetime totals, target breakdown, society **aggregates only** |

| API | Methods |
| --- | --- |
| `/api/auth/[...nextauth]` | GET POST |
| `/api/members` | GET POST |
| `/api/members/[id]` | GET PATCH DELETE (DELETE = permanent, needs admin password) |
| `/api/members/[id]/setup` | POST (record a new member's initial payments) |
| `/api/contributions` | GET POST |
| `/api/contributions/[id]` | PATCH DELETE |
| `/api/contributions/bulk` | POST |
| `/api/contributions/lump-sum` | POST |
| `/api/users` | GET (ADMIN, read-only) |
| `/api/profile` | GET PATCH (ADMIN only — own User row). Members get 403. |
| `/api/years` | GET POST (ADMIN) |
| `/api/years/[year]` | PATCH DELETE (ADMIN) |
| `/api/reports/members/[id]/pdf` | GET |
| `/api/reports/annual/[year]/pdf` | GET |

---

## 5. Data model

```
Organization ──< Member ──< Contribution >── FundTransaction (1:1, optional)
     │             │
     ├──< User ────┘
     └──< YearPlan
```

**Organization** — tenant. Carries the overall `startMonth` / `endMonth` window,
kept in sync with YearPlan rows.

**YearPlan** — rates for one calendar year (`monthlyAmount`, `oneTimeFee`, season).
2025 and 2026 cannot be edited in the app. An admin adds 2027 onwards; do not
seed or migrate a placeholder 2027 row.

**Member** — `memberId` is the passbook code, unique per org, and doubles as the
member's sign-in username, stored **uppercased**. IDs that differ only by an
`M`/`M-` prefix or leading zeros are the same ID (`memberIdKey()` in
`src/lib/member-id.ts`), so `M-01` and `01` cannot both exist. The DB index only
catches exact repeats, so `createMember()` / `updateMember()` do the check.
Members are **permanently deleted** — `DELETE /api/members/[id]` removes the
member, their login, contributions and linked cash-book rows in one
`$transaction`, after re-checking the admin's password. There is **no
active/inactive state**; `Member.status` remains in the schema, dormant at
`ACTIVE`, to avoid a migration. Members join at `Organization.startMonth` (no
join-date field), and `createMember()` auto-settles every fully-elapsed past year
(2025) as paid in full in that same transaction.

The admin records `name`, `memberId`, `phone`, `nationalId`, `nomineeName` and
`nomineeNationalId` — all required — plus an optional `nomineePhone`. A phone
needs at least 10 digits and may start with `+` and contain spaces, e.g.
`+880 1712 345678` (`PHONE_PATTERN` in `validation.ts`; repeated spaces are
collapsed). Phone inputs use `inputMode="tel"` so the mobile keypad has `+`, and
`tel:` links strip the spaces.

⚠️ **`nationalId` is a credential.** It is the member's initial password, so it
must never reach anyone who cannot already act for them. `redactMember()` masks
it (and the nominee's) for anyone who is not an ADMIN; both member API routes and
the member detail page apply that. Do not add the raw value to any payload a
member can read.

**Contribution** — `type` is `MONTHLY` or `ONE_TIME`.
- `paidForYear` is which year's obligation this payment counts toward.
- `paidForMonth` is a Postgres `date` pinned to the **first of the month in UTC**.
  Build it with `monthKeyToDate()`; never construct it inline.
- It is **null for `ONE_TIME`**. Postgres treats nulls as distinct in a unique
  index, so `@@unique([memberId, paidForMonth])` blocks a double-paid month while
  still allowing several fee instalments for the same year.
- `paidOnDate` is when money changed hands; `paidForMonth` / `paidForYear` is what
  it settles. **These differ for advance payments** and a lot of logic depends on
  which you use.

**FundTransaction** — the cash book. Every contribution creates a linked `IN` row
in the *same* `prisma.$transaction`, so the ledger can never drift. Rows with a
`contributionId` are not directly editable. **Nothing writes `OUT` rows today.**

**User** — `role` ∈ ADMIN | MEMBER, `passwordHash` bcrypt of their NID,
optional `memberId`.

- **Two sign-in doors that do not overlap.** `/login` uses the `member-login`
  provider (member ID + NID) and **refuses any ADMIN**; `/control_panel` uses
  `admin-login` (ID + NID + a separate password) and refuses non-admins. There is
  no email login.
- `User.username` is the ID — the admin's from `ADMIN_LOGIN_ID`, a member's from
  `Member.memberId`. Unique *per organisation*, so `findByUsername()` refuses to
  guess when an ID matches twice; a real multi-tenant deployment needs an org
  selector. **The admin's ID shares this space with member IDs, so it must be
  distinct from all of them** — use a non-numeric ID like `admin` so a member can
  hold `01`. The admin is a login only (never a `Member`); to track the admin's
  own contributions, register them as a normal member with their own member ID.
- `User.passwordHash` = bcrypt(NID), the shared second factor.
  `User.adminPasswordHash` = bcrypt(admin password), the third factor, null for
  members.
- All three admin credentials come from env (`ADMIN_LOGIN_ID`, `ADMIN_NID`,
  `ADMIN_PASSWORD`) and are applied by the seed, which also deletes any ADMIN row
  whose username no longer matches — a rotated ID leaves no orphan behind.
- Both `authorize()` paths compare against a dummy hash on every failure so a
  wrong ID costs the same as a wrong secret, and the error never says which
  factor failed. Preserve both properties.

- **NID and password must stay in step.** `updateMember()` re-hashes when the NID
  changes and moves `username` when the member ID changes; `updateProfile()` does
  the same when the admin edits their own NID. Any new NID write must too.
  Members cannot PATCH `/api/profile` — their details live on the Member row.
- Admins also carry the member identity fields (`phone`, `nationalId`,
  `nomineeName`, `nomineeNationalId`, `nomineePhone`), all **nullable** — they
  fill them in at `/profile` whenever they like.

**Member cap.** `Organization.memberLimit` (default **30**) limits **active**
members. `createMember()` enforces it and returns 409 when full; deleting a
member frees a slot.

### Migrations

```
20260825182224_init
20260825200302_add_one_time_fee_and_rates    ContributionType, nullable paidForMonth, rates
20260825210216_add_operating_window          startMonth / endMonth
20260831120000_year_plans                    YearPlan, paidForYear, drop org-wide rates
20260831163000_drop_placeholder_future_years 2027 is added by the admin, not pre-created
20260902161835_member_kyc_and_member_logins  NID + nominee fields, member logins, member cap
20260902164832_two_roles_and_admin_profile   drop COMMITTEE/TREASURER, admin profile fields
20260902171828_admin_third_factor           User.adminPasswordHash
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
sidebar above. The bar holds at most four primary destinations plus **More**;
the rest (Fund, Reports, Years, Accounts) open in a bottom sheet. Members see
Home and Profile (Profile is a read-only copy of their Member row). People and payment lists are tappable cards on a phone
(`MobileList`) and tables from `md` up (`DesktopTable`). The app header shows
today's date in **Dhaka time** for every role (`formatDhakaToday()` in
`(app)/layout.tsx`); the theme toggle is in the header from `md` up, and in the
account menu / More sheet on a phone. The root viewport uses `viewportFit: "cover"`
so the chrome respects the iOS safe area.

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
| `MonthGrid` / `MonthGridLegend` | 12 chips: paid / part paid / pending / not due yet / not this year |
| `YearTabs` | year chips for `?year=` or `/years/[year]` |
| `MemberProgressList` | per-member meters + status band (the chase list) |
| `CollectionChart` | paid vs pending members per month |
| `PaceChart` | cumulative paid vs what is owed as the year goes on (no longer rendered — see §8) |
| `CoversLabel` | "August 2026" or "One-time fee 2025" with matching dot |
| `PaidBadge` | paid / paid ahead / part paid / not due yet / pending |
| `DuesTable` | `/dues` list with search + one-tap collection (client) |
| `LumpSumDialog` | splits one large payment, with a live preview (client) |
| `MonthPicker` | `?month=` stepper bounded by the window |
| `StatCard`, `PageHeader`, `EmptyState`, `Field`, `FormActions` | layout primitives; `StatCard` tones: default / positive / negative / brand; `FormActions` full-width stacked buttons on a phone |
| `MobileList` / `MobileListItem` / `DesktopTable` | phone card lists paired with the `md+` spreadsheet |
| `BrandMark` | the society logo (`public/logo.svg`) on a white badge (header, login); favicon is `src/app/icon.svg` + `apple-icon.png` |
| PDF letterhead | "Shapnik Group" + logo raster; member codes print as `M-03` |
| `ThemeToggle` / `ThemeToggleRow` | header light/dark switch from `md` up; labeled row in the More sheet; persists `localStorage.theme` |

### Design system

The chrome runs on a **brand teal** (`--brand` / `--primary` in `globals.css`),
kept clear of the status hues and never used in charts (those stay on the
CVD-validated `--viz-*` palette). Cards lift on `--elev-*` shadow tokens applied
via `[data-slot="card"]`, so the shadcn primitives stay untouched. Headings and
hero figures use **Plus Jakarta Sans** (`--font-heading`); body is Inter. Dark
mode is class-based (`.dark`), set before paint by the `beforeInteractive` script
in `app/layout.tsx` from `localStorage.theme`; every colour token is defined in
both `:root` and `.dark`. See `AGENTS.md` → Design system / Theming.

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

7. **Chart contradicting its own headline.** The pace chart once counted only the
   current year's payment dates and dropped a fee paid earlier. Both now derive
   from `progress.ts`. Extra-fee credit is `ONE_TIME` rows with `paidForYear ===
   year` — do **not** restore the old lifetime `carriedIn` split. **Any new view
   must read its numbers from `progress.ts`** rather than re-deriving them.

8. **PDFs drop typographic characters.** Standard Helvetica has no `৳`, em-dash or
   curly quotes. PDFs print `BDT` and run text through `pdfText()`. Bangla member
   names will **not** render in PDFs until a Unicode font is embedded. The
   letterhead uses a PNG of the logo (`src/components/pdf/assets/logo.png`)
   because `@react-pdf/renderer` cannot embed `public/logo.svg`. Keep that PNG
   in the Vercel trace via `outputFileTracingIncludes` in `next.config.ts`.
   Member statements are a bank-style ledger (running balance, closing band)
   branded **Shapnik Group**; member codes print as `M-03`. Chrome is brand teal,
   never the viz palette.

9. **Client importing `server-only` `years.ts`.** Contribution forms need
   `planForMonthKey` — it lives in `src/lib/dates.ts`. Importing `years.ts` from a
   client component fails the build.

10. **`formatDate` is load-bearing.** Adding Dhaka helpers once dropped it and
    broke fund, dues, members and statements. Keep exporting it from `dates.ts`.

11. **Ledger rows must carry their `contributionId`.** The seed once created the
    `FundTransaction` for a one-time fee *without* linking it, so 58 `ONE_TIME`
    contributions had no matching cash-book row and the two totals drifted by
    ৳52,000. The app code (`recordLumpSum`, `createContribution`, the bulk path)
    and the seed now all create the pair in one `$transaction` with
    `contributionId` set. Never write a `FundTransaction` for a contribution
    without it. To repair a database seeded before the fix, re-seed
    (`npx prisma migrate reset --force`).

12. **A row-at-a-time transaction timed out in production.** `createMember`'s
    auto-settlement of 2025 did ~22 sequential INSERTs inside one interactive
    `$transaction`. It passed every local test, but on Vercel (a different region
    from the Neon database in Singapore) the round-trips exceeded Prisma's 5s
    interactive-transaction limit — a `P2028` surfacing as a plain 500 "Something
    went wrong" on *the first ever member creation*. Fixed by batching:
    `createManyAndReturn()` for the contributions, then `createMany()` for their
    cash-book rows, with a raised `{ timeout }`. `recordInitialSetup` uses the
    same shape. **Keep bulk DB work batched** — a per-row loop over a remote
    database does not scale to a transaction.

13. **`M-01` and `01` were both created.** The duplicate check compared raw
    strings, so an ID typed without its `M-` prefix went through as a new
    member. Clashes are now compared by `memberIdKey()`, which ignores case,
    the prefix and leading zeros. The database index is still on the exact
    text, so the check has to stay in `src/server/members.ts`.

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
- `src/components/app/pace-chart.tsx` (`PaceChart`) and
  `src/server/progress.ts` `getMemberCumulative` — the "Paid against target pace"
  card was removed from `/my-statement`. Both are now unrendered; kept in case the
  chart is wanted back on a member or admin view. Delete both if it is gone for
  good.

The first three are the expense-tracking machinery. The UI and `/api/transactions` were
removed when spending went out of scope, but `FundTransaction` still records an
`IN` row per contribution, so expenses can come back without a migration. **Delete
them if spending is off the table for good; otherwise leave them.**

Also open:

- `TransactionType.OUT` exists in the schema and is never written.
- **NID as a password is weak.** It is semi-public, never expires, and the member
  cannot change it themselves. It is stored hashed and only an ADMIN sees the
  value, but a "change password" flow should land before this holds real money.
- There is no password reset flow: an admin can change a member's NID (which does
  now move their password), but a member who forgets theirs has no self-service
  route.
- **The admin's third-factor password is not editable in the app.** It is set from
  `ADMIN_PASSWORD` by the seed; changing it means editing `.env` and re-seeding.
  `/profile` only edits the NID (and re-hashes the second factor).
- `/users` cannot create accounts. Members are provisioned with the member, and
  the admin is seeded — a second admin needs a seed run or a manual insert.
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
| `npm run db:migrate` | create + apply a migration (development) |
| `npm run db:deploy` | apply pending migrations (production) |
| `npm run db:bootstrap` | **production first run** — org + year plans + admin, no members |
| `npm run db:seed` | development sample data (30 fictional members) |
| `npm run db:studio` | Prisma Studio |

### Seed accounts (password `shomiti1234`)

| Sign in as | Where | Credentials |
| --- | --- | --- |
| Admin | `/control_panel` | `ADMIN_LOGIN_ID` + `ADMIN_NID` + `ADMIN_PASSWORD`, all from `.env` |
| Member | `/login` | `M-003` + the NID the seed prints — paid 2025 in full and all of 2026 on 5 Jan 2026 |



Every member has a login of their member ID + NID; the admin's three factors come
from the environment. The seed prints what it applied. Real credentials live in
`.env` (gitignored) — `.env.example` ships placeholders.

The seed builds **30 members** (joined 1 Apr 2025) with generated NIDs and
nominee details, **2025 fully paid** (Apr–Dec at ৳5,000 plus the ৳25,000 fee),
monthly contributions from Jan 2026 to today with two members left unpaid in the
current month, and a spread of 2026 fee states (24 cleared, 6 part-paid). There
is **no 2027 year plan** until an admin adds it.

The seed also **reconciles the cash book** on every run — it deletes ledger rows
with no contribution and creates the missing ones — so a database that has been
hand-edited comes back to the one-IN-row-per-contribution invariant.

### Before you call anything done

```bash
npm run typecheck && npm run lint && npm run build
```

Route types (`PageProps`, `LayoutProps`) come from `next typegen`, which runs as
part of `dev`/`build`. If they look stale: `npx next typegen`.

Expect a handful of lint **warnings** (React Compiler declining to memoize RHF's
`watch()`, including the year form). Zero errors is the bar.

Update the docs for what you changed (`AGENTS.md` → Docs).

Then stop and **ask the owner before any `git commit` or `git push`** — no AI
agent commits or pushes without their explicit yes, every time. See `AGENTS.md`
→ Git.

---

## 10. Deploying

**Production starts empty except the admin.** `db:seed` is development data —
never run it against production. Use `prisma/bootstrap.ts` instead:

```bash
npm run db:deploy      # tables
npm run db:bootstrap   # organisation + year plans + admin login only
```

`bootstrap.ts` refuses to run without `ADMIN_LOGIN_ID` / `ADMIN_NID` /
`ADMIN_PASSWORD`, validates their shape, is idempotent, never touches members or
payments, and deletes an admin row whose ID has been rotated away. Verified
against an empty schema: 1 organisation, 2 year plans, 1 admin, **0 members**.

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
| Rates or the window | `YearPlan` / `getYearPlan()` — 2025 and 2026 stay uneditable; do not seed 2027 |
| `paidForYear` on a contribution | progress, statements, PDFs and the cash-book description must follow the year |
| Anything about "paid" / "owed" / "on track" | `src/server/progress.ts`, then confirm dashboard and `/my-statement` still agree |
| A Zod schema | forms *and* routes share it — check both |
| `Contribution` writes | the linked `FundTransaction` must move in the same `$transaction` |
| How a lump sum is split | `src/lib/allocate.ts` only — the dialog preview and `recordLumpSum()` both call it, so changing one place changes both |
| What "part paid" means | `DuesRow.short`, `MemberProgress.partialMonths`, `PaidBadge`, `MonthGrid`, and `getYearObligation().outstanding` |
| A chart | `isAnimationActive={false}`, function-form `shape`, inside `ChartFrame`, legend present |
| Chart colours | re-validate the palette for CVD in **both** themes |
| Adding a page | guard it (`requireOrgReader` / `requireWriter` / `requireAdmin`) *and* guard the API it calls. Years is `/years` + `/api/years`. |
