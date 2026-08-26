import "server-only";
import { prisma } from "@/lib/prisma";
import {
  clampMonthKey,
  currentMonthKey,
  dateToMonthKey,
  monthKeyToDate,
  yearBounds,
  yearsInWindow,
} from "@/lib/dates";

/**
 * Every member owes the same two things:
 *   - a monthly contribution, twelve times a year
 *   - a one-off admission fee, owed once for the life of the membership
 *
 * The society's headline number is the two added together. Rates live on the
 * Organization so a second society can run different ones.
 */
export type SocietySettings = {
  monthlyAmount: number;
  oneTimeFee: number;
  /** monthlyAmount x 12 */
  monthlyTarget: number;
  /** monthlyTarget + oneTimeFee — what one member owes across a full year. */
  annualTarget: number;
  /** First month the society operates in, e.g. "2026-01". */
  startMonthKey: string;
  /** Last month the society operates in, e.g. "2027-12". */
  endMonthKey: string;
  /** Years the window touches, newest first. */
  years: number[];
  /**
   * Today's month, pulled back inside the window. Before the society opens this
   * is its first month; after it closes, its last — so no view ever lands on a
   * month the society does not run.
   */
  activeMonthKey: string;
};

export async function getSocietySettings(organizationId: string): Promise<SocietySettings> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { monthlyAmount: true, oneTimeFee: true, startMonth: true, endMonth: true },
  });
  const monthlyAmount = org.monthlyAmount.toNumber();
  const oneTimeFee = org.oneTimeFee.toNumber();
  const monthlyTarget = monthlyAmount * 12;
  const startMonthKey = dateToMonthKey(org.startMonth);
  const endMonthKey = dateToMonthKey(org.endMonth);

  return {
    monthlyAmount,
    oneTimeFee,
    monthlyTarget,
    annualTarget: monthlyTarget + oneTimeFee,
    startMonthKey,
    endMonthKey,
    years: yearsInWindow(startMonthKey, endMonthKey),
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

/** Resolves a requested year against the window. */
export async function resolveYear(organizationId: string, requested?: string | number) {
  const settings = await getSocietySettings(organizationId);
  const asNumber = Number(requested);
  const year = settings.years.includes(asNumber)
    ? asNumber
    : Number(settings.activeMonthKey.slice(0, 4));
  return { settings, year };
}

/**
 * How many months of `year` a member has actually been liable for by now:
 * nothing before they joined, and nothing in the future.
 */
export function monthsElapsed(year: number, joinDate: Date, now = new Date()): number {
  const firstLiableMonth = Math.max(
    joinDate.getUTCFullYear() === year ? joinDate.getUTCMonth() : joinDate.getUTCFullYear() > year ? 12 : 0,
    0,
  );
  const lastMonth =
    now.getUTCFullYear() > year ? 11 : now.getUTCFullYear() < year ? -1 : now.getUTCMonth();
  return Math.max(0, lastMonth - firstLiableMonth + 1);
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
  monthsPaid: number;
  /** Which months of `year` are settled, index 0 = January. */
  paidMonths: boolean[];
  /** One-time fee paid across the whole membership, for display. */
  oneTimePaid: number;
  /** The full fee, for display alongside `oneTimePaid`. */
  oneTimeFee: number;
  /**
   * How much of the fee still counts toward *this* year's target. The fee is
   * owed once, so a member who cleared it in an earlier year owes only their
   * twelve monthly contributions from then on.
   */
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
  oneTime: { carriedIn: number; paidInYear: number },
  settings: SocietySettings,
  year: number,
  now: Date,
): MemberProgress {
  const paidMonths = Array<boolean>(12).fill(false);
  let monthlyPaid = 0;
  for (const row of monthly) {
    if (!row.paidForMonth) continue;
    monthlyPaid += row.amount;
    paidMonths[row.paidForMonth.getUTCMonth()] = true;
  }

  const elapsed = monthsElapsed(year, member.joinDate, now);
  // Only the part of the fee still outstanding when the year opened belongs to
  // this year's target; anything settled earlier is already behind them.
  const oneTimeTarget = Math.max(0, settings.oneTimeFee - oneTime.carriedIn);
  const totalTarget = settings.monthlyTarget + oneTimeTarget;
  // What remains of the fee is due from day one rather than spread across the
  // year, so it counts in full toward what is owed today.
  const dueToDate = elapsed * settings.monthlyAmount + oneTimeTarget;
  const totalPaid = monthlyPaid + oneTime.paidInYear;

  return {
    memberId: member.id,
    memberCode: member.memberId,
    name: member.name,
    phone: member.phone,
    joinDate: member.joinDate,
    monthlyPaid,
    monthlyTarget: settings.monthlyTarget,
    monthsPaid: paidMonths.filter(Boolean).length,
    paidMonths,
    oneTimePaid: oneTime.carriedIn + oneTime.paidInYear,
    oneTimeFee: settings.oneTimeFee,
    oneTimeTarget,
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

  const [settings, members, monthlyRows, oneTimeRows] = await Promise.all([
    getSocietySettings(organizationId),
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
    // Split by when it was paid: the fee is owed once, so what landed before
    // this year no longer counts toward this year's target.
    prisma.contribution.findMany({
      where: { organizationId, type: "ONE_TIME" },
      select: { memberId: true, amount: true, paidOnDate: true },
    }),
  ]);

  const monthlyByMember = new Map<string, Array<{ paidForMonth: Date | null; amount: number }>>();
  for (const row of monthlyRows) {
    const list = monthlyByMember.get(row.memberId) ?? [];
    list.push({ paidForMonth: row.paidForMonth, amount: row.amount.toNumber() });
    monthlyByMember.set(row.memberId, list);
  }
  const oneTimeByMember = new Map<string, { carriedIn: number; paidInYear: number }>();
  for (const row of oneTimeRows) {
    const bucket = oneTimeByMember.get(row.memberId) ?? { carriedIn: 0, paidInYear: 0 };
    if (row.paidOnDate < start) bucket.carriedIn += row.amount.toNumber();
    else if (row.paidOnDate <= end) bucket.paidInYear += row.amount.toNumber();
    oneTimeByMember.set(row.memberId, bucket);
  }

  const rows = members.map((member) =>
    buildProgress(
      member,
      monthlyByMember.get(member.id) ?? [],
      oneTimeByMember.get(member.id) ?? { carriedIn: 0, paidInYear: 0 },
      settings,
      year,
      now,
    ),
  );

  const monthlyCollected = rows.reduce((sum, r) => sum + r.monthlyPaid, 0);
  // What counts toward this year: fee instalments received during it.
  const oneTimeCollected = rows.reduce((sum, r) => sum + (r.totalPaid - r.monthlyPaid), 0);
  const totalTarget = rows.reduce((sum, r) => sum + r.totalTarget, 0);
  const totalCollected = monthlyCollected + oneTimeCollected;

  return {
    year,
    settings,
    rows,
    memberCount: rows.length,
    monthlyCollected,
    monthlyTarget: settings.monthlyTarget * rows.length,
    oneTimeCollected,
    oneTimeTarget: rows.reduce((sum, r) => sum + r.oneTimeTarget, 0),
    /** Lifetime fee position, for the "who has cleared it" card. */
    oneTimeLifetime: rows.reduce((sum, r) => sum + r.oneTimePaid, 0),
    oneTimeLifetimeTarget: settings.oneTimeFee * rows.length,
    totalCollected,
    totalTarget,
    completion: totalTarget === 0 ? 0 : Math.min(1, totalCollected / totalTarget),
    /** Members who have fully cleared the one-time fee. */
    oneTimeSettled: rows.filter((r) => r.oneTimePaid >= settings.oneTimeFee).length,
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
};

/** Paid vs pending member counts for each month of `year` — the dashboard's main chart. */
export async function getMonthlyBreakdown(
  organizationId: string,
  year: number,
): Promise<MonthBar[]> {
  const { start, end } = yearBounds(year);
  const now = new Date();

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
    // Only members who had joined by that month were liable for it.
    const expected = members.filter(
      (m) =>
        m.joinDate.getUTCFullYear() < year ||
        (m.joinDate.getUTCFullYear() === year && m.joinDate.getUTCMonth() <= index),
    ).length;
    const monthStart = new Date(Date.UTC(year, index, 1));
    const future = monthStart > now;
    const paid = paidPerMonth[index];
    return {
      monthKey: dateToMonthKey(monthStart),
      monthIndex: index,
      label: monthStart.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }),
      paid,
      pending: future ? 0 : Math.max(0, expected - paid),
      expected,
      collected: collectedPerMonth[index],
      future,
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

  const [settings, monthly, oneTime] = await Promise.all([
    getSocietySettings(organizationId),
    prisma.contribution.findMany({
      where: { memberId, type: "MONTHLY", paidForMonth: { gte: start, lte: end } },
      select: { paidForMonth: true, amount: true },
    }),
    prisma.contribution.findMany({
      where: { memberId, type: "ONE_TIME" },
      select: { amount: true, paidOnDate: true },
    }),
  ]);

  const fee = { carriedIn: 0, paidInYear: 0 };
  for (const row of oneTime) {
    if (row.paidOnDate < start) fee.carriedIn += row.amount.toNumber();
    else if (row.paidOnDate <= end) fee.paidInYear += row.amount.toNumber();
  }

  return buildProgress(
    member,
    monthly.map((m) => ({ paidForMonth: m.paidForMonth, amount: m.amount.toNumber() })),
    fee,
    settings,
    year,
    new Date(),
  );
}

/**
 * Cumulative amount paid, month by month, against the pace the member is
 * actually held to. Both lines use the same definition of "paid" and "owed" as
 * the headline figures, so the chart and the on-track badge never disagree:
 *   - the line starts from any one-time fee settled in an earlier year
 *   - the target ramps from the full one-time fee plus one month, since the fee
 *     is due from day one rather than spread across the year
 */
export async function getMemberCumulative(
  organizationId: string,
  memberId: string,
  year: number,
) {
  const { start, end } = yearBounds(year);
  const [settings, rows, priorOneTime] = await Promise.all([
    getSocietySettings(organizationId),
    prisma.contribution.findMany({
      where: { organizationId, memberId, paidOnDate: { gte: start, lte: end } },
      select: { paidOnDate: true, amount: true },
    }),
    prisma.contribution.aggregate({
      where: { organizationId, memberId, type: "ONE_TIME", paidOnDate: { lt: start } },
      _sum: { amount: true },
    }),
  ]);

  const perMonth = Array<number>(12).fill(0);
  for (const row of rows) perMonth[row.paidOnDate.getUTCMonth()] += row.amount.toNumber();

  const now = new Date();
  // Carry in the fee if it was cleared before this year began.
  let running = priorOneTime._sum.amount?.toNumber() ?? 0;

  return Array.from({ length: 12 }, (_, index) => {
    running += perMonth[index];
    const monthStart = new Date(Date.UTC(year, index, 1));
    return {
      label: monthStart.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }),
      // Stop the actual line at the current month rather than flat-lining ahead.
      paid: monthStart > now ? null : running,
      target: settings.oneTimeFee + settings.monthlyAmount * (index + 1),
    };
  });
}
