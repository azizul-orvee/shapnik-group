/**
 * Splitting one lump sum across a year's obligations.
 *
 * A member who does not pay month by month hands over a large amount — half the
 * year, say — and the treasurer has to decide what it settles. This module is
 * that decision, written once: the client renders the split as a preview and the
 * server records exactly the same split, so what the treasurer confirmed is what
 * lands in the database.
 *
 * Order is fixed and follows the domain rule in `AGENTS.md`: the year's extra fee
 * is due from day one, so it is cleared first; whole months then fill up oldest
 * first. Anything left that cannot fill a whole month is either a short payment
 * against the next unpaid month or is not recorded at all — never silently
 * absorbed.
 *
 * Client-safe: no imports from `src/server/*`.
 */

/** Taka carry at most two decimals; keep every intermediate step there too. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export type LumpSumPart =
  | { kind: "ONE_TIME"; year: number; amount: number; full: boolean }
  | { kind: "MONTHLY"; monthKey: string; amount: number; full: boolean }
  /**
   * Money added to a month that already has a short payment recorded. A month
   * can hold only one contribution row, so this raises that row rather than
   * writing a second one.
   */
  | { kind: "MONTHLY_TOPUP"; monthKey: string; amount: number; full: boolean };

/** A month with a payment recorded for less than the rate. */
export type ShortMonth = { monthKey: string; shortfall: number };

export type LumpSumPlanInput = {
  /** What the member actually handed over. */
  amount: number;
  year: number;
  monthlyAmount: number;
  oneTimeFee: number;
  /** Already paid toward *this* year's fee. */
  oneTimePaid: number;
  /** Months with a short payment already recorded, oldest first. */
  shortMonths: ShortMonth[];
  /** Months of this year with no payment at all, oldest first. */
  unpaidMonths: string[];
  /**
   * Whether a remainder too small for a whole month may be recorded as a short
   * payment against the next unpaid month. Off means it is left unallocated.
   */
  allowPartialMonth: boolean;
};

export type LumpSumPlan = {
  parts: LumpSumPart[];
  /** Sum of `parts` — what will actually be recorded. */
  allocated: number;
  /** Money that could not be placed. Nothing is recorded for it. */
  leftover: number;
  /** A month settled for less than the full rate, if any. */
  shortMonth: string | null;
  /** True when this payment leaves nothing outstanding for the year. */
  clearsYear: boolean;
};

/**
 * Splits `amount` across the outstanding fee and unpaid months.
 *
 * Deterministic and side-effect free — the preview the treasurer approves and
 * the rows the server writes come from this same call.
 */
export function planLumpSum(input: LumpSumPlanInput): LumpSumPlan {
  const parts: LumpSumPart[] = [];
  let rest = round2(Math.max(0, input.amount));

  // The extra fee is due from day one, so it comes off the top.
  const feeDue = round2(Math.max(0, input.oneTimeFee - input.oneTimePaid));
  if (feeDue > 0 && rest > 0) {
    const take = round2(Math.min(rest, feeDue));
    parts.push({
      kind: "ONE_TIME",
      year: input.year,
      amount: take,
      full: take >= feeDue,
    });
    rest = round2(rest - take);
  }

  // Finish part-paid months before opening new ones — oldest debt first, and it
  // keeps a month from sitting short forever.
  for (const short of input.shortMonths) {
    if (rest <= 0) break;
    const take = round2(Math.min(rest, short.shortfall));
    if (take <= 0) continue;
    parts.push({
      kind: "MONTHLY_TOPUP",
      monthKey: short.monthKey,
      amount: take,
      full: take >= short.shortfall,
    });
    rest = round2(rest - take);
  }

  let shortMonth: string | null = null;
  for (const monthKey of input.unpaidMonths) {
    if (rest <= 0) break;
    if (rest >= input.monthlyAmount) {
      parts.push({ kind: "MONTHLY", monthKey, amount: input.monthlyAmount, full: true });
      rest = round2(rest - input.monthlyAmount);
      continue;
    }
    // Less than a full month left over.
    if (!input.allowPartialMonth) break;
    parts.push({ kind: "MONTHLY", monthKey, amount: rest, full: false });
    shortMonth = monthKey;
    rest = 0;
    break;
  }

  const allocated = round2(parts.reduce((sum, part) => sum + part.amount, 0));
  const outstanding = outstandingForYear(input);

  return {
    parts,
    allocated,
    leftover: rest,
    shortMonth,
    clearsYear: allocated >= outstanding && outstanding > 0,
  };
}

/**
 * What the member still owes for the year: the fee, every month with no payment
 * at all, and the gap left on any month settled for less than the rate.
 */
export function outstandingForYear(
  input: Pick<
    LumpSumPlanInput,
    "monthlyAmount" | "oneTimeFee" | "oneTimePaid" | "unpaidMonths" | "shortMonths"
  >,
): number {
  const shortfalls = input.shortMonths.reduce((sum, month) => sum + month.shortfall, 0);
  return round2(
    Math.max(0, input.oneTimeFee - input.oneTimePaid) +
      input.monthlyAmount * input.unpaidMonths.length +
      shortfalls,
  );
}

/* ── Initial setup: ticked months + an extra lump sum ───────────────────────
 *
 * A separate flow from planLumpSum, used the first time an admin records what a
 * new member has already paid for a year. The admin ticks the whole months (and
 * optionally the fee) that are settled, and may add an extra lump sum on top.
 *
 * Ticked items are recorded at the full rate. The lump sum is then spread over
 * the *remaining* unticked months oldest-first, and only once every month is
 * covered does anything left over go toward the fee — "oldest months first, then
 * fee". Pure and client-safe, like planLumpSum, so the form preview and the rows
 * the server writes come from this same call.
 */
export type InitialSetupPart =
  | { kind: "ONE_TIME"; amount: number; full: boolean; source: "tick" | "box" }
  | { kind: "MONTHLY"; monthKey: string; amount: number; full: boolean; source: "tick" | "box" };

export type InitialSetupPlanInput = {
  monthlyAmount: number;
  oneTimeFee: number;
  /** Already paid toward this year's fee (0 for a brand-new member). */
  oneTimePaid: number;
  /** In-season months with no payment yet, oldest first. */
  unpaidMonths: string[];
  /** Months the admin ticked as already paid in full. */
  tickedMonths: string[];
  /** The one-time fee ticked as already paid in full. */
  feeTicked: boolean;
  /** Extra money to spread over the remaining unticked months, then the fee. */
  boxAmount: number;
  /** Let the box remainder part-pay a month / the fee rather than be left over. */
  allowPartial: boolean;
};

export type InitialSetupPlan = {
  parts: InitialSetupPart[];
  /** Sum of `parts` — what will actually be recorded. */
  allocated: number;
  /** Box money that could not be placed (the year is already fully covered). */
  leftover: number;
  /** A month the box left short of the rate, if any. */
  shortMonth: string | null;
  /** True when the box only part-paid the fee. */
  feeShort: boolean;
};

export function planInitialSetup(input: InitialSetupPlanInput): InitialSetupPlan {
  const parts: InitialSetupPart[] = [];
  const owed = new Set(input.unpaidMonths);
  const ticked = new Set(input.tickedMonths.filter((monthKey) => owed.has(monthKey)));
  const feeDue = round2(Math.max(0, input.oneTimeFee - input.oneTimePaid));

  // 1. Ticked whole months — full rate each, in season order.
  for (const monthKey of input.unpaidMonths) {
    if (ticked.has(monthKey)) {
      parts.push({ kind: "MONTHLY", monthKey, amount: input.monthlyAmount, full: true, source: "tick" });
    }
  }

  // 2. Ticked fee — the whole outstanding fee.
  const feeTickedApplied = input.feeTicked && feeDue > 0;
  if (feeTickedApplied) {
    parts.push({ kind: "ONE_TIME", amount: feeDue, full: true, source: "tick" });
  }

  // 3. Extra lump sum — remaining unticked months, oldest first…
  let rest = round2(Math.max(0, input.boxAmount));
  let shortMonth: string | null = null;
  for (const monthKey of input.unpaidMonths) {
    if (rest <= 0) break;
    if (ticked.has(monthKey)) continue;
    if (rest >= input.monthlyAmount) {
      parts.push({ kind: "MONTHLY", monthKey, amount: input.monthlyAmount, full: true, source: "box" });
      rest = round2(rest - input.monthlyAmount);
      continue;
    }
    if (!input.allowPartial) break;
    parts.push({ kind: "MONTHLY", monthKey, amount: rest, full: false, source: "box" });
    shortMonth = monthKey;
    rest = 0;
    break;
  }

  // 4. …then the fee, once every month is covered and if it was not ticked.
  let feeShort = false;
  if (rest > 0 && !feeTickedApplied && feeDue > 0 && (input.allowPartial || rest >= feeDue)) {
    const take = round2(Math.min(rest, feeDue));
    if (take > 0) {
      parts.push({ kind: "ONE_TIME", amount: take, full: take >= feeDue, source: "box" });
      feeShort = take < feeDue;
      rest = round2(rest - take);
    }
  }

  const allocated = round2(parts.reduce((sum, part) => sum + part.amount, 0));
  return { parts, allocated, leftover: rest, shortMonth, feeShort };
}
