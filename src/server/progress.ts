import "server-only";
import { prisma } from "@/lib/prisma";
import {
  clampMonthKey,
  currentMonthKey,
  dateToMonthKey,
  monthKeyToDate,
  monthRange,
  yearBounds,
} from "@/lib/dates";
import { listYearPlans, requireYearPlan, type YearPlanView } from "@/server/years";

/**
 * Every member owes two things *each year*, at that year's rates:
 *   - a monthly contribution for each month the society runs that year
 *   - an extra "one-time" fee for that year (instalments allowed)
 *
 * Rates live on YearPlan. Never hard-code them. 2025 ran April–December;
 * 2026 onwards is a full calendar year unless the admin shortens it.
 */
export type SocietySettings = {
  /** First month the society operates in, e.g. "2025-04". */
  startMonthKey: string;
  /** Last month the society operates in, e.g. "2027-12". */
  endMonthKey: string;
  /** Configured years, newest first. */
  years: number[];
  /**
   * Today's month, pulled back inside the window. Before the society opens this
   * is its first month; after it closes, its last — so no view ever lands on a
   * month the society does not run.
   */
  activeMonthKey: string;
};

export async function getSocietySettings(organizationId: string): Promise<SocietySettings> {
  const plans = await listYearPlans(organizationId);
  if (plans.length === 0) {
    throw new Error("This society has no year plans set up");
  }
  // listYearPlans is newest-first.
  const startMonthKey = plans.reduce(
    (min, p) => (p.startMonthKey < min ? p.startMonthKey : min),
    plans[0].startMonthKey,
  );
  const endMonthKey = plans.reduce(
    (max, p) => (p.endMonthKey > max ? p.endMonthKey : max),
    plans[0].endMonthKey,
  );

  return {
    startMonthKey,
    endMonthKey,
    years: plans.map((p) => p.year),
    activeMonthKey: clampMonthKey(currentMonthKey(), startMonthKey, endMonthKey),
  };
}

/** Resolves a requested month against the window, falling back to the active one. */
export async function resolveMonth(organizationId: string, requested?: string) {
  const settings = await getSocietySettings(organizationId);
  const monthKey =
    requested && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested)
      ? clampMonthKey(requested, settings.startMonthKey, settings.endMonthKey)
      : settings.activeMonthKey;
  return { settings, monthKey };
}

/** Resolves a requested year against configured year plans. */
export async function resolveYear(organizationId: string, requested?: string | number) {
  const [settings, plans] = await Promise.all([
    getSocietySettings(organizationId),
    listYearPlans(organizationId),
  ]);
  const asNumber = Number(requested);
  const year = settings.years.includes(asNumber)
    ? asNumber
    : Number(settings.activeMonthKey.slice(0, 4));
  const plan = plans.find((p) => p.year === year) ?? (await requireYearPlan(organizationId, year));
  return { settings, year, plan };
}

/**
 * How many months of this plan a member has actually been liable for by now:
 * nothing before they joined, nothing before the season, and nothing in the future.
 */
export function monthsElapsed(
  plan: Pick<YearPlanView, "startMonthKey" | "endMonthKey">,
  joinDate: Date,
  now = new Date(),
): number {
  const nowKey = dateToMonthKey(now);
  let count = 0;
  for (const key of monthRange(plan.startMonthKey, plan.endMonthKey)) {
    if (key > nowKey) break;
    const monthStart = monthKeyToDate(key);
    const monthEnd = new Date(monthStart);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
    if (joinDate < monthEnd) count += 1;
  }
  return count;
}

export type MemberProgress = {
  memberId: string;
  memberCode: string;
  name: string;
  phone: string | null;
  joinDate: Date;
  /** Monthly contributions recorded against months in `year`. */
  monthlyPaid: number;
  monthlyTarget: number;
  monthlyAmount: number;
  monthsPaid: number;
  monthCount: number;
  /** Which months of the calendar year are settled, index 0 = January. */
  paidMonths: boolean[];
  /**
   * Months that have a payment recorded but for less than the month's rate —
   * the tail end of a lump sum. Recorded, but the money is still short.
   */
  partialMonths: boolean[];
  /** Months this plan actually runs (false for Jan–Mar 2025, for example). */
  inSeason: boolean[];
  /** Extra fee paid toward *this* year. */
  oneTimePaid: number;
  oneTimeFee: number;
  /** Same as `oneTimeFee` — the extra amount due this year. */
  oneTimeTarget: number;
  totalPaid: number;
  totalTarget: number;
  /** 0–1 of the full-year obligation. */
  completion: number;
  /** What should have been paid by today, given join date and months elapsed. */
  dueToDate: number;
  /** Negative means behind schedule. */
  varianceToDate: number;
  onTrack: boolean;
};

function buildProgress(
  member: { id: string; memberId: string; name: string; phone: string | null; joinDate: Date },
  monthly: Array<{ paidForMonth: Date | null; amount: number }>,
  oneTimePaid: number,
  plan: YearPlanView,
  now: Date,
): MemberProgress {
  const paidMonths = Array<boolean>(12).fill(false);
  const partialMonths = Array<boolean>(12).fill(false);
  const inSeason = Array<boolean>(12).fill(false);
  for (const key of monthRange(plan.startMonthKey, plan.endMonthKey)) {
    inSeason[monthKeyToDate(key).getUTCMonth()] = true;
  }

  let monthlyPaid = 0;
  for (const row of monthly) {
    if (!row.paidForMonth) continue;
    monthlyPaid += row.amount;
    const index = row.paidForMonth.getUTCMonth();
    paidMonths[index] = true;
    // A month settled for less than the rate still shows as short, not as done.
    if (row.amount < plan.monthlyAmount) partialMonths[index] = true;
  }

  const elapsed = monthsElapsed(plan, member.joinDate, now);
  const oneTimeTarget = elapsed > 0 ? plan.oneTimeFee : 0;
  const totalTarget = plan.monthlyTarget + plan.oneTimeFee;
  const dueToDate = elapsed * plan.monthlyAmount + oneTimeTarget;
  const totalPaid = monthlyPaid + oneTimePaid;

  return {
    memberId: member.id,
    memberCode: member.memberId,
    name: member.name,
    phone: member.phone,
    joinDate: member.joinDate,
    monthlyPaid,
    monthlyTarget: plan.monthlyTarget,
    monthlyAmount: plan.monthlyAmount,
    monthsPaid: paidMonths.filter(Boolean).length,
    monthCount: plan.monthCount,
    paidMonths,
    partialMonths,
    inSeason,
    oneTimePaid,
    oneTimeFee: plan.oneTimeFee,
    oneTimeTarget: plan.oneTimeFee,
    totalPaid,
    totalTarget,
    completion: totalTarget === 0 ? 0 : Math.min(1, totalPaid / totalTarget),
    dueToDate,
    varianceToDate: totalPaid - dueToDate,
    onTrack: totalPaid >= dueToDate,
  };
}

/** Progress for every active member, plus the society totals they roll up to. */
export async function getSocietyProgress(organizationId: string, year: number) {
  const { start, end } = yearBounds(year);
  const now = new Date();

  const [settings, plan, members, monthlyRows, oneTimeRows] = await Promise.all([
    getSocietySettings(organizationId),
    requireYearPlan(organizationId, year),
    prisma.member.findMany({
      where: { organizationId, status: "ACTIVE" },
      select: { id: true, memberId: true, name: true, phone: true, joinDate: true },
      orderBy: { memberId: "asc" },
    }),
    prisma.contribution.findMany({
      where: {
        organizationId,
        type: "MONTHLY",
        paidForMonth: { gte: start, lte: end },
      },
      select: { memberId: true, paidForMonth: true, amount: true },
    }),
    prisma.contribution.findMany({
      where: { organizationId, type: "ONE_TIME", paidForYear: year },
      select: { memberId: true, amount: true },
    }),
  ]);

  const monthlyByMember = new Map<string, Array<{ paidForMonth: Date | null; amount: number }>>();
  for (const row of monthlyRows) {
    const list = monthlyByMember.get(row.memberId) ?? [];
    list.push({ paidForMonth: row.paidForMonth, amount: row.amount.toNumber() });
    monthlyByMember.set(row.memberId, list);
  }
  const oneTimeByMember = new Map<string, number>();
  for (const row of oneTimeRows) {
    oneTimeByMember.set(row.memberId, (oneTimeByMember.get(row.memberId) ?? 0) + row.amount.toNumber());
  }

  const rows = members.map((member) =>
    buildProgress(
      member,
      monthlyByMember.get(member.id) ?? [],
      oneTimeByMember.get(member.id) ?? 0,
      plan,
      now,
    ),
  );

  const monthlyCollected = rows.reduce((sum, r) => sum + r.monthlyPaid, 0);
  const oneTimeCollected = rows.reduce((sum, r) => sum + r.oneTimePaid, 0);
  const totalTarget = rows.reduce((sum, r) => sum + r.totalTarget, 0);
  const totalCollected = monthlyCollected + oneTimeCollected;

  return {
    year,
    settings,
    plan,
    rows,
    memberCount: rows.length,
    monthlyCollected,
    monthlyTarget: plan.monthlyTarget * rows.length,
    oneTimeCollected,
    oneTimeTarget: plan.oneTimeFee * rows.length,
    totalCollected,
    totalTarget,
    completion: totalTarget === 0 ? 0 : Math.min(1, totalCollected / totalTarget),
    oneTimeSettled: rows.filter((r) => r.oneTimePaid >= plan.oneTimeFee).length,
    fullyPaid: rows.filter((r) => r.totalPaid >= r.totalTarget).length,
    behind: rows.filter((r) => !r.onTrack).length,
  };
}

export type MonthBar = {
  monthKey: string;
  monthIndex: number;
  label: string;
  paid: number;
  pending: number;
  expected: number;
  collected: number;
  /** Months that have not started yet are drawn as a hollow track. */
  future: boolean;
  /** False for months the year plan does not run (e.g. Jan–Mar 2025). */
  inSeason: boolean;
};

/** Paid vs pending member counts for each month of `year` — the dashboard's main chart. */
export async function getMonthlyBreakdown(
  organizationId: string,
  year: number,
): Promise<MonthBar[]> {
  const { start, end } = yearBounds(year);
  const now = new Date();
  const plan = await requireYearPlan(organizationId, year);
  const inSeason = new Set(monthRange(plan.startMonthKey, plan.endMonthKey));

  const [members, rows] = await Promise.all([
    prisma.member.findMany({
      where: { organizationId, status: "ACTIVE" },
      select: { id: true, joinDate: true },
    }),
    prisma.contribution.findMany({
      where: { organizationId, type: "MONTHLY", paidForMonth: { gte: start, lte: end } },
      select: { paidForMonth: true, amount: true },
    }),
  ]);

  const paidPerMonth = Array<number>(12).fill(0);
  const collectedPerMonth = Array<number>(12).fill(0);
  for (const row of rows) {
    if (!row.paidForMonth) continue;
    const index = row.paidForMonth.getUTCMonth();
    paidPerMonth[index] += 1;
    collectedPerMonth[index] += row.amount.toNumber();
  }

  return Array.from({ length: 12 }, (_, index) => {
    const monthStart = new Date(Date.UTC(year, index, 1));
    const monthKey = dateToMonthKey(monthStart);
    const season = inSeason.has(monthKey);
    const expected = season
      ? members.filter(
          (m) =>
            m.joinDate.getUTCFullYear() < year ||
            (m.joinDate.getUTCFullYear() === year && m.joinDate.getUTCMonth() <= index),
        ).length
      : 0;
    const future = monthStart > now;
    const paid = paidPerMonth[index];
    return {
      monthKey,
      monthIndex: index,
      label: monthStart.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }),
      paid,
      pending: !season || future ? 0 : Math.max(0, expected - paid),
      expected,
      collected: collectedPerMonth[index],
      future,
      inSeason: season,
    };
  });
}

/** One member's own progress — powers the member-facing statement. */
export async function getMemberProgress(
  organizationId: string,
  memberId: string,
  year: number,
): Promise<MemberProgress | null> {
  const { start, end } = yearBounds(year);

  const member = await prisma.member.findFirst({
    where: { id: memberId, organizationId },
    select: { id: true, memberId: true, name: true, phone: true, joinDate: true },
  });
  if (!member) return null;

  const [plan, monthly, oneTime] = await Promise.all([
    requireYearPlan(organizationId, year),
    prisma.contribution.findMany({
      where: { memberId, type: "MONTHLY", paidForMonth: { gte: start, lte: end } },
      select: { paidForMonth: true, amount: true },
    }),
    prisma.contribution.aggregate({
      where: { memberId, type: "ONE_TIME", paidForYear: year },
      _sum: { amount: true },
    }),
  ]);

  return buildProgress(
    member,
    monthly.map((m) => ({ paidForMonth: m.paidForMonth, amount: m.amount.toNumber() })),
    oneTime._sum.amount?.toNumber() ?? 0,
    plan,
    new Date(),
  );
}

/**
 * Cumulative amount paid, month by month, against the pace the member is
 * actually held to. Both lines use the same definition of "paid" and "owed" as
 * the headline figures, so the chart and the on-track badge never disagree.
 */
export async function getMemberCumulative(
  organizationId: string,
  memberId: string,
  year: number,
) {
  const { start } = yearBounds(year);
  const plan = await requireYearPlan(organizationId, year);

  const rows = await prisma.contribution.findMany({
    where: {
      organizationId,
      memberId,
      OR: [
        { type: "MONTHLY", paidForYear: year },
        { type: "ONE_TIME", paidForYear: year },
      ],
    },
    select: { paidOnDate: true, amount: true },
  });

  const perMonth = Array<number>(12).fill(0);
  let carriedIn = 0;
  for (const row of rows) {
    if (row.paidOnDate < start) carriedIn += row.amount.toNumber();
    else if (row.paidOnDate.getUTCFullYear() === year) {
      perMonth[row.paidOnDate.getUTCMonth()] += row.amount.toNumber();
    } else {
      // Paid after the calendar year closed — park it on December so it still counts.
      perMonth[11] += row.amount.toNumber();
    }
  }

  const now = new Date();
  let running = carriedIn;
  let monthsIntoSeason = 0;

  return Array.from({ length: 12 }, (_, index) => {
    running += perMonth[index];
    const monthStart = new Date(Date.UTC(year, index, 1));
    const monthKey = dateToMonthKey(monthStart);
    const inSeason = monthKey >= plan.startMonthKey && monthKey <= plan.endMonthKey;
    if (inSeason) monthsIntoSeason += 1;
    const target = inSeason
      ? plan.oneTimeFee + plan.monthlyAmount * monthsIntoSeason
      : monthsIntoSeason === 0
        ? 0
        : plan.oneTimeFee + plan.monthlyAmount * monthsIntoSeason;
    return {
      label: monthStart.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }),
      paid: monthStart > now ? null : running,
      target,
    };
  });
}

export { getYearPlan } from "@/server/years";
