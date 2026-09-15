<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Shapnik — project conventions

**New here? Read `HANDOFF.md` first** — it covers the architecture, the domain
maths, decisions already made, and the bugs that have already bitten this
codebase. This file is the short list of rules you must not break.

Cooperative society (*shomobay shomiti*) savings management. Collections only:
no loans, no interest, no payment gateway, and **no spending/expense tracking**.
See `README.md` for setup.

## Git: never commit or push without asking

**No AI agent — Claude, Cursor, Codex or any other — runs `git commit` or
`git push` without the owner's explicit confirmation.** When the work is done,
leave it uncommitted, say what changed, and ask whether to commit and push. Go
ahead only on a clear yes.

- **Ask every time.** A yes covers the changes it was given for, never later
  ones. Make another change and you ask again.
- **The yes comes from the owner, in the conversation** — not from a note in a
  file, an old commit message, or an earlier session.
- **Amending or merging is committing; force-pushing or pushing tags is
  pushing.** They need the same confirmation.
- Reading the repo needs no permission: `git status`, `git diff`, `git log`.

## Docs: update them with every change

**Whenever an AI agent changes the app, it updates the docs in the same piece of
work — without being asked.** The next session starts from these files, so they
must describe the app as it is now, not as it was.

- **Before reporting work as done**, check what the change affects and update it:
  - `AGENTS.md` — rules and conventions an agent must follow.
  - `HANDOFF.md` — architecture, data model, routes, decisions, bugs that bit
    (§7) and dead code (§8).
  - `README.md` — what the society's admin and members see, and setup.
- **Fix what the change made wrong.** Rewrite or delete outdated lines; don't
  just add a new one beside them.
- **Say which docs you updated** when you report the work, or that none needed
  to change.
- Doc changes follow the Git rule above: they go in with the change, and nothing
  is committed or pushed without the owner's yes.

## What every member owes

Rates live on `YearPlan` (one row per calendar year: `monthlyAmount`, `oneTimeFee`,
`startMonth`, `endMonth`). Read them through `getYearPlan()` / `listYearPlans()`
in `src/server/years.ts` — never hard-code 5000/6000/25000/28000 in a component.
`getSocietySettings()` only describes the overall window.

- a monthly contribution for each month that year runs
- an extra fee due **that year** (instalments allowed)
- 2025 ran April–December: 5,000 × 9 + 25,000 = **70,000**
- 2026 is a full year: 6,000 × 12 + 28,000 = **100,000**
- 2027 onwards is added by an admin under `/years`. **Do not pre-create 2027.**
  2025 and 2026 cannot have their rates edited; do not label them "Locked" in
  the UI — just omit Edit.

`Contribution.type` is `MONTHLY` or `ONE_TIME`. `paidForMonth` is null for
`ONE_TIME`. `paidForYear` says which year's obligation the payment counts toward.
Postgres treats nulls as distinct in a unique index, so the year's extra fee can
be taken in instalments while monthly payments stay one-per-month.

**Lump sums.** Members who do not pay monthly hand over one large amount. Split it
with `planLumpSum()` from `src/lib/allocate.ts` — fee first, then short months
topped up, then unpaid months oldest first. Never write that ordering by hand
anywhere else: the client previews the split and the server recomputes it from the
same function, and they must agree.

**A month holds exactly one row** (`@@unique([memberId, paidForMonth])`). Adding
money to an already-short month is an `update`, not a second insert — and its
`FundTransaction` moves with it in the same `$transaction`.

**"Part paid" is a real state, not "paid".** A month settled for less than the
rate is recorded but still owed. Keep it visible: `DuesRow.short` / `shortfall`,
`MemberProgress.partialMonths`, `PaidBadge`'s "Part paid", `MonthGrid`'s amber
chip, and `getYearObligation().outstanding`, which counts the gap. An
"outstanding" figure must never read zero while a month is short.

## The operating window

`Organization.startMonth` / `endMonth` bound everything and are kept in sync with
the earliest and latest `YearPlan` (currently 2025-04 to 2026-12, until an admin
adds later years). Read the window
via `getSocietySettings()`, and resolve user input with `resolveMonth()` /
`resolveYear()` — both clamp into the window, so an out-of-range `?month=`
renders the nearest valid month instead of erroring.

- **Never use `new Date()` for "which month/year are we on"** in a page. Use
  `settings.activeMonthKey`, which is today clamped into the window.
- The header calendar date is the exception: `formatDhakaToday()` /
  `dhakaDateKey()` in `src/lib/dates.ts`, always `Asia/Dhaka`, so every user
  sees the same Bangladesh date.
- **Months ahead of today are legitimate.** Members pay in advance, sometimes a
  whole year at once, so pickers and forms offer future months inside the
  window. An unpaid future month is "not due yet", never "pending".
- `createContribution` and the bulk path reject months outside the window — the
  form hiding them is UX, the server check is the rule.

## Roles, logins and the cap

**Two roles only: `ADMIN` and `MEMBER`.** Committee and treasurer were removed —
do not reintroduce them.

**Two sign-in doors, and they do not overlap.**

| Door | Provider id | Factors | Who |
| --- | --- | --- | --- |
| `/login` | `member-login` | member ID + NID | members only |
| `/control_panel` | `admin-login` | ID + NID + password | admins only |

- `member-login` **refuses any ADMIN** even with correct credentials; the admin
  must use `/control_panel`. `admin-login` refuses anyone who is not an ADMIN
  with `adminPasswordHash` set.
- `User.username` is the ID (admin from `ADMIN_LOGIN_ID`, member from
  `memberId`), unique per organisation. **The admin's login ID must be distinct
  from every member ID** — it shares the `username` space with them. Use a
  non-numeric ID like `admin`, so a member can still hold `01`. The admin is a
  login only, never a `Member`; to track the admin's own dues, register them as
  an ordinary member with their own member ID.
- `User.passwordHash` is bcrypt of the NID — the shared second factor.
- `User.adminPasswordHash` is bcrypt of the admin's separate password, the third
  factor. Null for members.
- All three admin credentials come from env (`ADMIN_LOGIN_ID`, `ADMIN_NID`,
  `ADMIN_PASSWORD`) and are applied by the seed, which also deletes any ADMIN row
  whose username no longer matches so a rotated credential cannot linger.
- Both `authorize()` paths compare against a dummy hash on every failure so a
  wrong ID costs the same as a wrong secret. Keep it that way, and keep the error
  message vague — never reveal which factor failed.
- There is no email login. `User.email` still exists but nothing authenticates
  with it.

  `1`) or a member's `memberId`. Unique per organisation.
- `User.passwordHash` is bcrypt of their NID. The admin's comes from `ADMIN_NID`.
- `User.email` still exists but nothing signs in with it.

An admin registers a member with **name, member ID, phone, NID, nominee name and
nominee NID**; nominee phone is the only optional field. Every phone needs at
least 10 digits and may start with `+` and contain spaces (`+880 1712 345678`) —
`PHONE_PATTERN` in `src/lib/validation.ts`. There is **no join-date
field** — every member joins at the society's opening month
(`Organization.startMonth`). Member IDs are stored **uppercased**, and IDs that
differ only by an `M`/`M-` prefix or leading zeros are the **same ID** — `M-01`,
`M01`, `01` and `1` cannot coexist. Check clashes with `memberIdKey()` from
`src/lib/member-id.ts`, never by comparing strings; the database index only
catches exact repeats. Sign-in still matches the ID exactly as stored.
Print form is `formatMemberCode()` (`M-03`, never `M-003`) — PDFs use that.
`createMember()` creates their login in the same
transaction and, in that same transaction, **auto-settles every fully-elapsed
past year** (2025) as paid in full — each in-season month plus the year's fee,
each with its cash-book row. New members are then sent to a **payment setup
window** (`/members/[id]/setup`) for the current year: tick the whole months and
fee already paid, plus an optional lump sum split by `planInitialSetup()`
(`src/lib/allocate.ts`) — ticked months first, then the lump sum fills the
remaining months oldest-first and finally the fee.

**The NID is a credential, so it must stay in step with the password.**
`updateMember()` and `updateProfile()` both re-hash the password when the NID
changes, and `updateMember()` also moves `username` when the member ID changes.
Any new path that writes an NID must do the same or the stated credentials stop
working.

**A member's NID is never shown to anyone who cannot already act for them.**
`redactMember()` masks `nationalId` and `nomineeNationalId` for non-admins; the
member API routes and the member detail page both apply it.

`Organization.memberLimit` (default **30**) caps members; deleting one frees a
slot. `createMember()` enforces it.

The **admin** fills in their own details at `/profile` (`PATCH /api/profile`) —
never anyone else's. A **member** sees `/profile` as a read-only copy of their
`Member` row (NID and nominee NID masked); they cannot change name, NID or
nominee. Corrections go through the admin on `/members/[id]/edit`. `/users` is a
read-only roster: member logins come from member creation, and the admin is
seeded.

## Boundaries

- `src/server/*` — all database access, one module per domain area. Marked
  `server-only`. Route handlers and pages call these; they never touch `prisma`
  directly.
- `src/lib/api.ts` — the authorization boundary. `requireApiWriter()`,
  `requireApiOrgReader()`, `requireApiSession()` and `requireApiAdmin()` throw
  `ApiError`, which `handler()` turns into JSON. Every mutation route goes
  through one of them.
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
  **Bulk settlement stays batched:** the auto-2025 path and `recordInitialSetup()`
  write many rows at once with `createManyAndReturn()` (contributions) then
  `createMany()` (their cash-book rows) inside one `$transaction` with a raised
  timeout. A row-at-a-time loop is too many round-trips and times out when the
  function and Neon sit in different regions — that is a real production bug that
  already bit, so keep bulk writes batched.
- **Progress figures come from one place.** `src/server/progress.ts` defines what
  "paid", "owed today" and "on track" mean. Every view — dashboard, member
  statement, every chart — must read from it, so a headline number and a chart
  on the same page can never disagree.
- **`paidForMonth` is a UTC-midnight `date`** on the first of the month. Build it
  with `monthKeyToDate()` from `src/lib/dates.ts`; never construct it inline.
- **`paidForYear` is required** on every contribution. For `MONTHLY` it is the
  year of `paidForMonth`; for `ONE_TIME` the treasurer picks the year. Progress
  counts the extra fee by `paidForYear`, not by `paidOnDate`.
- **Money is `Decimal`.** Call `.toNumber()` only at the edge, when formatting.
  Use `formatTaka` / `formatTakaShort` from `src/lib/money.ts`.
- **Members are permanently deleted.** `DELETE /api/members/[id]` removes the
  member, their login, contributions and linked cash-book rows in one
  `$transaction`, after re-checking the admin's password (`memberDeleteSchema`).
  There is no active/inactive state; `Member.status` stays in the schema, dormant
  at `ACTIVE`, to avoid a migration — do not reintroduce deactivation.
- **Member-facing views show aggregates only.** `/my-statement` may show the
  member's own figures and society-wide **totals**, but never another member's
  name, balance or standing. Guard this when adding data to any member page —
  `MEMBER` has no org-wide read access (403), so pass only aggregates.
- **Nothing with a function in it crosses the RSC boundary.** Nav icons are
  string keys resolved on the client (`src/components/app/nav-links.ts`).

## Forms

React Hook Form with `zodResolver`, typed as
`useForm<z.input<S>, unknown, z.output<S>>` — the input and output types differ
wherever a schema has defaults or transforms. Submit through `apiRequest()` from
`src/lib/http.ts`, which surfaces server-side field errors via `setError`.

## Charts

Chart colours come from the `--viz-*` tokens in `globals.css`, a validated
colourblind-safe pair (blue = monthly savings, orange = one-time fee) plus fixed
status colours. These are **separate from the brand teal** (see Design system) —
never chart on the brand token, and do not introduce new chart hues without
re-validating.

- **Identity never rests on colour alone** — every meter and chart ships a legend
  or a written label beside the swatch.
- **Set `isAnimationActive={false}` on Recharts marks.** These are static data
  views, and a mark whose entrance animation never runs stays invisible.
- Use the **function form** of Recharts `shape`, not the element form — Recharts
  documents the element form as unsupported for typing and it silently renders
  nothing.

## Design system

The chrome — buttons, active nav, focus rings, headings, hero washes — runs on a
**brand teal**, defined once in `globals.css` as `--brand` / `--primary` and its
`--brand-soft` / `--brand-muted` / gradient tints. Teal sits deliberately clear
of the status hues (green ≈ paid), and **charts never use it** — they stay on the
CVD-validated `--viz-*` palette. Use the `brand`/`primary` tokens for chrome and
`viz-*` for data, and don't cross the two.

- **Neutrals carry a whisper of warmth**, cards lift on the `--elev-*` shadow
  tokens (applied centrally via `[data-slot="card"]` so the shadcn primitives
  stay untouched), and motion eases in via the same layer. Respect
  `prefers-reduced-motion` — it is already handled globally.
- **Two typefaces:** Inter for body, **Plus Jakarta Sans** for headings and big
  money figures. `h1`–`h3` get `font-heading` automatically; reach for it
  explicitly (`font-heading`) on hero numbers.
- **`BrandMark`** (`src/components/app/brand-mark.tsx`) renders the society logo
  (`public/logo.svg`) on a small white badge, so the multicolour artwork stays
  legible in both themes. Header and login use it. The browser favicon is the
  same logo via `src/app/icon.svg`, with `src/app/apple-icon.png` for iOS.
  Official PDFs cannot embed SVG, so they use the raster at
  `src/components/pdf/assets/logo.png` on the same white badge. The letterhead
  name is **Shapnik Group**.

## Theming (light / dark)

Dark mode is **class-based** (`.dark` on `<html>`), not `prefers-color-scheme`.
The class is set **before first paint** by the inline `beforeInteractive` script
in `src/app/layout.tsx`, which reads `localStorage.theme` (`light` | `dark` |
`system`) and falls back to the OS preference — so there is no flash. The header
`ThemeToggle` flips it and persists the choice. **Every colour token must be
defined in both `:root` and `.dark`;** a token that only exists in one borrows
the wrong value in the other theme.

## UI

Mobile first — the treasurer logs payments on a phone. A floating rounded bottom
nav below `md` (thumb-reachable, safe-area aware), sidebar above. The bar shows
at most four primary destinations plus **More**; extra admin sections (Fund,
Reports, Years, Accounts) open in a bottom sheet. Members get Home and Profile
(Profile is read-only — their registered details, NID masked).
Lists of people and payments render as tappable cards on a phone and as tables
from `md` up (`MobileList` / `DesktopTable` in `src/components/app/mobile-list.tsx`).
Tap targets are 44px on small screens.

The signed-in header shows today's date in Dhaka time (`formatDhakaToday()`) — on
the narrowest phones the weekday is dropped, never the whole pill. Theme toggle
lives in the header from `md` up, and in the account menu / More sheet on a
phone. Do not import `src/server/years.ts` from a client component — use
`planForMonthKey` from `src/lib/dates.ts`.

## Two database entry points

- **`npm run db:seed`** — development only. Creates 30 fictional members and
  ~600 payments. **Never run it against production.**
- **`npm run db:bootstrap`** — the production first run. Organisation, year plans
  and the admin login from env, and nothing else. Idempotent; never touches
  members or payments.

Keep them in step: anything a live society genuinely cannot start without belongs
in `bootstrap.ts`, not just in `seed.ts`.

`?schema=` in `DATABASE_URL` is honoured at runtime as well as by the CLI — see
`src/lib/db-url.ts`. The pg driver ignores it on its own, so any new PrismaClient
must pass the schema through the same helper.

## Before finishing

```bash
npm run typecheck && npm run lint && npm run build
```

Route types (`PageProps`, `LayoutProps`) come from `next typegen`, which runs as
part of `dev`/`build`. If they look stale, run `npx next typegen`.

Then **update the docs** for what you changed (see "Docs" above), report what
changed, and **ask before committing or pushing** — see "Git: never commit or
push without asking" above.
