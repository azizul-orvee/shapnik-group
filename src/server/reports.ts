import "server-only";
import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/api";
import { dateToMonthKey, monthKeyToDate, yearBounds } from "@/lib/dates";
import { getDuesForMonth } from "@/server/contributions";
import { getFundTotals } from "@/server/fund";
import { getSocietySettings } from "@/server/progress";

export type MemberStatement = {
  organization: { name: string };
  member: {
    id: string;
    name: string;
    memberCode: string;
    phone: string | null;
    joinDate: Date;
    status: string;
  };
  rows: Array<{
    id: string;
    type: "MONTHLY" | "ONE_TIME";
    /** Null for one-time fee instalments, which cover no particular month. */
    monthKey: string | null;
    amount: number;
    paidOnDate: Date;
    note: string | null;
    recordedBy: string | null;
  }>;
  total: number;
  monthlyTotal: number;
  oneTimeTotal: number;
  monthsPaid: number;
  generatedAt: Date;
};

export async function buildMemberStatement(
  organizationId: string,
  memberId: string,
): Promise<MemberStatement> {
  const member = await prisma.member.findFirst({
    where: { id: memberId, organizationId },
    include: {
      organization: { select: { name: true } },
      contributions: {
        orderBy: [{ paidOnDate: "asc" }, { paidForMonth: "asc" }],
        include: { recordedBy: { select: { name: true } } },
      },
    },
  });
  if (!member) throw notFound("Member not found");

  const rows = member.contributions.map((c) => ({
    id: c.id,
    type: c.type,
    monthKey: c.paidForMonth ? dateToMonthKey(c.paidForMonth) : null,
    amount: c.amount.toNumber(),
    paidOnDate: c.paidOnDate,
    note: c.note,
    recordedBy: c.recordedBy?.name ?? null,
  }));

  return {
    organization: { name: member.organization.name },
    member: {
      id: member.id,
      name: member.name,
      memberCode: member.memberId,
      phone: member.phone,
      joinDate: member.joinDate,
      status: member.status,
    },
    rows,
    total: rows.reduce((sum, r) => sum + r.amount, 0),
    monthlyTotal: rows.filter((r) => r.type === "MONTHLY").reduce((sum, r) => sum + r.amount, 0),
    oneTimeTotal: rows.filter((r) => r.type === "ONE_TIME").reduce((sum, r) => sum + r.amount, 0),
    monthsPaid: rows.filter((r) => r.type === "MONTHLY").length,
    generatedAt: new Date(),
  };
}

export type MonthlySummary = Awaited<ReturnType<typeof buildMonthlySummary>>;

export async function buildMonthlySummary(organizationId: string, monthKey: string) {
  const monthStart = monthKeyToDate(monthKey);
  const monthEnd = new Date(monthStart);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
  monthEnd.setUTCMilliseconds(-1);

  const [dues, movement, organization] = await Promise.all([
    getDuesForMonth(organizationId, monthKey),
    // Cash actually moved during the calendar month, which can differ from
    // what the month was *billed* for (late payments land in a later month).
    getFundTotals(organizationId, { from: monthStart, to: monthEnd }),
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { name: true },
    }),
  ]);

  return { organization, monthKey, dues, movement };
}

export type AnnualReport = Awaited<ReturnType<typeof buildAnnualReport>>;

export async function buildAnnualReport(organizationId: string, year: number) {
  const { start, end } = yearBounds(year);

  const [organization, opening, movement, contributionAgg, memberCounts, monthlyRows] =
    await Promise.all([
      prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { name: true },
      }),
      getFundTotals(organizationId, { to: new Date(start.getTime() - 1) }),
      getFundTotals(organizationId, { from: start, to: end }),
      prisma.contribution.aggregate({
        where: { organizationId, paidOnDate: { gte: start, lte: end } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.member.groupBy({
        by: ["status"],
        where: { organizationId },
        _count: true,
      }),
      prisma.contribution.findMany({
        where: { organizationId, type: "MONTHLY", paidForMonth: { gte: start, lte: end } },
        select: { paidForMonth: true, amount: true },
      }),
    ]);

  const byMonth = new Map<string, { count: number; total: number }>();
  for (const row of monthlyRows) {
    if (!row.paidForMonth) continue;
    const key = dateToMonthKey(row.paidForMonth);
    const bucket = byMonth.get(key) ?? { count: 0, total: 0 };
    bucket.count += 1;
    bucket.total += row.amount.toNumber();
    byMonth.set(key, bucket);
  }

  const months = Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, "0")}`;
    const bucket = byMonth.get(key) ?? { count: 0, total: 0 };
    return { monthKey: key, count: bucket.count, total: bucket.total };
  });

  const countFor = (status: string) =>
    memberCounts.find((m) => m.status === status)?._count ?? 0;

  return {
    organization,
    year,
    openingBalance: opening.balance,
    totalCollected: movement.totalIn,
    closingBalance: opening.balance + movement.totalIn,
    contributionCount: contributionAgg._count,
    contributionTotal: contributionAgg._sum.amount?.toNumber() ?? 0,
    activeMembers: countFor("ACTIVE"),
    inactiveMembers: countFor("INACTIVE"),
    months,
    generatedAt: new Date(),
  };
}

/** The years the society operates in, newest first. */
export async function listReportYears(organizationId: string): Promise<number[]> {
  const { years } = await getSocietySettings(organizationId);
  return years;
}
