import "server-only";
import { prisma } from "@/lib/prisma";
import { badRequest, notFound } from "@/lib/api";
import { monthKeyToDate, addMonths, dateToMonthKey, clampMonthKey, monthRange } from "@/lib/dates";
import type { TransactionCreateInput } from "@/lib/validation";
import type { TransactionType } from "@/generated/prisma/enums";

export type LedgerFilter = {
  type?: TransactionType;
  from?: Date;
  to?: Date;
  take?: number;
};

export async function listTransactions(organizationId: string, filter: LedgerFilter = {}) {
  return prisma.fundTransaction.findMany({
    where: {
      organizationId,
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.from || filter.to
        ? { date: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) } }
        : {}),
    },
    include: {
      recordedBy: { select: { name: true } },
      contribution: { select: { id: true, memberId: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: filter.take,
  });
}

/** Total in, total out and closing balance, optionally within a date window. */
export async function getFundTotals(
  organizationId: string,
  window: { from?: Date; to?: Date } = {},
) {
  const grouped = await prisma.fundTransaction.groupBy({
    by: ["type"],
    where: {
      organizationId,
      ...(window.from || window.to
        ? { date: { ...(window.from ? { gte: window.from } : {}), ...(window.to ? { lte: window.to } : {}) } }
        : {}),
    },
    _sum: { amount: true },
  });

  const sumFor = (type: TransactionType) =>
    grouped.find((g) => g.type === type)?._sum.amount?.toNumber() ?? 0;

  const totalIn = sumFor("IN");
  const totalOut = sumFor("OUT");
  return { totalIn, totalOut, balance: totalIn - totalOut };
}

/** Running ledger rows with a balance column, oldest first. */
export async function getLedgerWithRunningBalance(organizationId: string, filter: LedgerFilter = {}) {
  const rows = await prisma.fundTransaction.findMany({
    where: {
      organizationId,
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.from || filter.to
        ? { date: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) } }
        : {}),
    },
    include: { recordedBy: { select: { name: true } } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  // Balance carried in from everything before this window.
  let balance = 0;
  if (filter.from) {
    const prior = await getFundTotals(organizationId, { to: new Date(filter.from.getTime() - 1) });
    balance = prior.balance;
  }
  const openingBalance = balance;

  const withBalance = rows.map((row) => {
    const amount = row.amount.toNumber();
    balance += row.type === "IN" ? amount : -amount;
    return { ...row, amountNumber: amount, runningBalance: balance };
  });

  return { openingBalance, closingBalance: balance, rows: withBalance };
}

export async function createTransaction(
  organizationId: string,
  recordedById: string,
  input: TransactionCreateInput,
) {
  return prisma.fundTransaction.create({
    data: {
      organizationId,
      type: input.type,
      amount: input.amount,
      description: input.description,
      date: new Date(`${input.date}T00:00:00.000Z`),
      recordedById,
    },
  });
}

async function getManualTransaction(organizationId: string, id: string) {
  const existing = await prisma.fundTransaction.findFirst({ where: { id, organizationId } });
  if (!existing) throw notFound("Ledger entry not found");
  if (existing.contributionId) {
    throw badRequest("This entry comes from a contribution — edit the contribution instead");
  }
  return existing;
}

export async function updateTransaction(
  organizationId: string,
  id: string,
  input: Partial<TransactionCreateInput>,
) {
  await getManualTransaction(organizationId, id);
  return prisma.fundTransaction.update({
    where: { id },
    data: {
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.date !== undefined ? { date: new Date(`${input.date}T00:00:00.000Z`) } : {}),
    },
  });
}

export async function deleteTransaction(organizationId: string, id: string) {
  await getManualTransaction(organizationId, id);
  await prisma.fundTransaction.delete({ where: { id } });
}

export type FundGrowthPoint = {
  monthKey: string;
  inflow: number;
  outflow: number;
  balance: number;
};

/**
 * Month-by-month fund balance for the dashboard chart. Months are derived from
 * the ledger itself so a society with no history yet renders an empty chart
 * rather than a flat line of zeros.
 */
export async function getFundGrowth(
  organizationId: string,
  months: number,
  window?: { startMonthKey: string; endMonthKey: string },
): Promise<FundGrowthPoint[]> {
  const today = dateToMonthKey(new Date());
  // Never chart months the society does not run.
  const endMonth = window ? clampMonthKey(today, window.startMonthKey, window.endMonthKey) : today;
  const rawStart = addMonths(endMonth, -(months - 1));
  const startMonth = window && rawStart < window.startMonthKey ? window.startMonthKey : rawStart;
  const monthCount = monthRange(startMonth, endMonth).length;
  const windowStart = monthKeyToDate(startMonth);

  const [opening, rows] = await Promise.all([
    getFundTotals(organizationId, { to: new Date(windowStart.getTime() - 1) }),
    prisma.fundTransaction.findMany({
      where: { organizationId, date: { gte: windowStart } },
      select: { type: true, amount: true, date: true },
    }),
  ]);

  const buckets = new Map<string, { inflow: number; outflow: number }>();
  for (const row of rows) {
    const key = dateToMonthKey(row.date);
    const bucket = buckets.get(key) ?? { inflow: 0, outflow: 0 };
    if (row.type === "IN") bucket.inflow += row.amount.toNumber();
    else bucket.outflow += row.amount.toNumber();
    buckets.set(key, bucket);
  }

  let balance = opening.balance;
  const points: FundGrowthPoint[] = [];
  let cursor = startMonth;
  for (let i = 0; i < monthCount; i += 1) {
    const bucket = buckets.get(cursor) ?? { inflow: 0, outflow: 0 };
    balance += bucket.inflow - bucket.outflow;
    points.push({ monthKey: cursor, inflow: bucket.inflow, outflow: bucket.outflow, balance });
    cursor = addMonths(cursor, 1);
  }
  return points;
}
