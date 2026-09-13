import "server-only";
import { prisma } from "@/lib/prisma";
import { badRequest, conflict, notFound } from "@/lib/api";
import { dateToMonthKey, monthKeyToDate, monthRange, yearBounds } from "@/lib/dates";
import {
  outstandingForYear,
  planInitialSetup,
  planLumpSum,
  type ShortMonth,
} from "@/lib/allocate";
import { assertMonthCovered, planForMonthKey, listYearPlans, requireYearPlan } from "@/server/years";
import type {
  BulkContributionInput,
  ContributionCreateInput,
  ContributionUpdateInput,
  InitialSetupInput,
  LumpSumInput,
} from "@/lib/validation";

export function ledgerDescription(
  memberName: string,
  memberCode: string,
  monthKey?: string,
  year?: number,
) {
  return monthKey
    ? `Monthly contribution — ${memberName} (${memberCode}) for ${monthKey}`
    : `One-time fee${year ? ` ${year}` : ""} — ${memberName} (${memberCode})`;
}

const CONTRIBUTION_INCLUDE = {
  member: { select: { id: true, name: true, memberId: true } },
  recordedBy: { select: { name: true } },
} as const;

export type ContributionListFilter = {
  monthKey?: string;
  memberId?: string;
  type?: "MONTHLY" | "ONE_TIME";
  take?: number;
};

export async function listContributions(
  organizationId: string,
  filter: ContributionListFilter = {},
) {
  return prisma.contribution.findMany({
    where: {
      organizationId,
      ...(filter.monthKey ? { paidForMonth: monthKeyToDate(filter.monthKey) } : {}),
      ...(filter.memberId ? { memberId: filter.memberId } : {}),
      ...(filter.type ? { type: filter.type } : {}),
    },
    include: CONTRIBUTION_INCLUDE,
    orderBy: [{ paidOnDate: "desc" }, { paidForMonth: "desc" }],
    take: filter.take,
  });
}

/**
 * Records a payment and its matching cash-book IN entry atomically, so the
 * ledger can never drift from the contribution list.
 */
export async function createContribution(
  organizationId: string,
  recordedById: string,
  input: ContributionCreateInput,
) {
  const member = await prisma.member.findFirst({
    where: { id: input.memberId, organizationId },
    select: { id: true, name: true, memberId: true },
  });
  if (!member) throw notFound("Member not found");

  // Only monthly payments are tied to a month, and only they can collide.
  let paidForYear: number;
  let paidForMonth: Date | null = null;
  if (input.type === "MONTHLY") {
    if (!input.paidForMonth) throw badRequest("Choose the month this payment covers");
    const plan = await assertMonthCovered(organizationId, input.paidForMonth);
    paidForYear = plan.year;
    paidForMonth = monthKeyToDate(input.paidForMonth);
    const duplicate = await prisma.contribution.findUnique({
      where: { memberId_paidForMonth: { memberId: member.id, paidForMonth } },
      select: { id: true },
    });
    if (duplicate) {
      throw conflict(`${member.name} already has a payment recorded for ${input.paidForMonth}`);
    }
  } else {
    if (!input.paidForYear) throw badRequest("Choose the year this fee covers");
    await requireYearPlan(organizationId, input.paidForYear);
    paidForYear = input.paidForYear;
  }

  return prisma.$transaction(async (tx) => {
    const contribution = await tx.contribution.create({
      data: {
        organizationId,
        memberId: member.id,
        type: input.type,
        amount: input.amount,
        paidForYear,
        paidForMonth,
        paidOnDate: new Date(`${input.paidOnDate}T00:00:00.000Z`),
        note: input.note ?? null,
        recordedById,
      },
      include: CONTRIBUTION_INCLUDE,
    });

    await tx.fundTransaction.create({
      data: {
        organizationId,
        type: "IN",
        amount: input.amount,
        description: ledgerDescription(
          member.name,
          member.memberId,
          input.paidForMonth,
          paidForYear,
        ),
        date: contribution.paidOnDate,
        contributionId: contribution.id,
        recordedById,
      },
    });

    return contribution;
  });
}

/** Logs the same amount for several members at once (a collection meeting). */
export async function createContributionsBulk(
  organizationId: string,
  recordedById: string,
  input: BulkContributionInput,
) {
  const plan = await assertMonthCovered(organizationId, input.paidForMonth);
  const paidForMonth = monthKeyToDate(input.paidForMonth);
  const paidOnDate = new Date(`${input.paidOnDate}T00:00:00.000Z`);

  const members = await prisma.member.findMany({
    where: { id: { in: input.memberIds }, organizationId },
    select: { id: true, name: true, memberId: true },
  });
  if (members.length === 0) throw notFound("No matching members");

  const alreadyPaid = await prisma.contribution.findMany({
    where: { memberId: { in: members.map((m) => m.id) }, type: "MONTHLY", paidForMonth },
    select: { memberId: true },
  });
  const alreadyPaidIds = new Set(alreadyPaid.map((c) => c.memberId));
  const toCreate = members.filter((m) => !alreadyPaidIds.has(m.id));

  if (toCreate.length === 0) {
    return { created: 0, skipped: members.length };
  }

  await prisma.$transaction(async (tx) => {
    for (const member of toCreate) {
      const contribution = await tx.contribution.create({
        data: {
          organizationId,
          memberId: member.id,
          type: "MONTHLY",
          amount: input.amount,
          paidForYear: plan.year,
          paidForMonth,
          paidOnDate,
          recordedById,
        },
      });
      await tx.fundTransaction.create({
        data: {
          organizationId,
          type: "IN",
          amount: input.amount,
          description: ledgerDescription(member.name, member.memberId, input.paidForMonth),
          date: paidOnDate,
          contributionId: contribution.id,
          recordedById,
        },
      });
    }
  });

  return { created: toCreate.length, skipped: alreadyPaidIds.size };
}

export type YearObligation = {
  year: number;
  monthlyAmount: number;
  oneTimeFee: number;
  /** Already paid toward this year's extra fee. */
  oneTimePaid: number;
  /** Months of this year with no payment at all, oldest first. */
  unpaidMonths: string[];
  /** Months settled for less than the rate, oldest first. */
  shortMonths: ShortMonth[];
  /** Months already settled, with what was actually taken for each. */
  paidMonths: Array<{ monthKey: string; amount: number }>;
  /** Fee outstanding, every unpaid month, and every short month's gap. */
  outstanding: number;
};

/**
 * What one member still owes for `year` — the input the lump-sum split works
 * from. Months before the member joined are not owed and never appear here.
 */
export async function getYearObligation(
  organizationId: string,
  memberId: string,
  year: number,
): Promise<YearObligation> {
  const member = await prisma.member.findFirst({
    where: { id: memberId, organizationId },
    select: { id: true, joinDate: true },
  });
  if (!member) throw notFound("Member not found");

  const { start, end } = yearBounds(year);
  const [plan, monthlyRows, oneTime] = await Promise.all([
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

  const paidMonths = monthlyRows
    .filter((row) => row.paidForMonth !== null)
    .map((row) => ({
      monthKey: dateToMonthKey(row.paidForMonth as Date),
      amount: row.amount.toNumber(),
    }));
  const settled = new Set(paidMonths.map((row) => row.monthKey));
  const joinMonthKey = dateToMonthKey(member.joinDate);

  const unpaidMonths = monthRange(plan.startMonthKey, plan.endMonthKey).filter(
    (monthKey) => monthKey >= joinMonthKey && !settled.has(monthKey),
  );

  // A month can hold only one payment row, so a short one is topped up rather
  // than paid again — it still counts as money owed until it reaches the rate.
  const shortMonths: ShortMonth[] = paidMonths
    .filter((row) => row.amount < plan.monthlyAmount)
    .map((row) => ({ monthKey: row.monthKey, shortfall: plan.monthlyAmount - row.amount }))
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  const oneTimePaid = oneTime._sum.amount?.toNumber() ?? 0;
  return {
    year,
    monthlyAmount: plan.monthlyAmount,
    oneTimeFee: plan.oneTimeFee,
    oneTimePaid,
    unpaidMonths,
    shortMonths,
    paidMonths,
    outstanding: outstandingForYear({
      monthlyAmount: plan.monthlyAmount,
      oneTimeFee: plan.oneTimeFee,
      oneTimePaid,
      unpaidMonths,
      shortMonths,
    }),
  };
}

/**
 * Records one large payment as the several rows it actually settles — the year's
 * extra fee first, then whole months oldest first. The split is computed by the
 * same `planLumpSum()` the treasurer saw in the preview, and every row plus its
 * cash-book entry is written in a single transaction.
 */
export async function recordLumpSum(
  organizationId: string,
  recordedById: string,
  input: LumpSumInput,
) {
  const member = await prisma.member.findFirst({
    where: { id: input.memberId, organizationId },
    select: { id: true, name: true, memberId: true },
  });
  if (!member) throw notFound("Member not found");

  const obligation = await getYearObligation(organizationId, member.id, input.paidForYear);
  const split = planLumpSum({
    amount: input.amount,
    year: input.paidForYear,
    monthlyAmount: obligation.monthlyAmount,
    oneTimeFee: obligation.oneTimeFee,
    oneTimePaid: obligation.oneTimePaid,
    unpaidMonths: obligation.unpaidMonths,
    shortMonths: obligation.shortMonths,
    allowPartialMonth: input.allowPartialMonth,
  });

  if (split.parts.length === 0) {
    throw badRequest(
      obligation.outstanding === 0
        ? `${member.name} has nothing outstanding for ${input.paidForYear}`
        : "That amount is too small to settle anything — record it as a single payment instead",
    );
  }

  const paidOnDate = new Date(`${input.paidOnDate}T00:00:00.000Z`);

  await prisma.$transaction(async (tx) => {
    for (const part of split.parts) {
      // A month already holding a short payment is raised, not duplicated — the
      // unique index allows one row per member per month. Its cash-book row moves
      // with it so the ledger still totals the same as the contributions.
      if (part.kind === "MONTHLY_TOPUP") {
        const existing = await tx.contribution.findUnique({
          where: {
            memberId_paidForMonth: {
              memberId: member.id,
              paidForMonth: monthKeyToDate(part.monthKey),
            },
          },
          select: { id: true, amount: true },
        });
        if (!existing) continue;
        const raised = existing.amount.toNumber() + part.amount;
        await tx.contribution.update({
          where: { id: existing.id },
          data: { amount: raised },
        });
        await tx.fundTransaction.updateMany({
          where: { contributionId: existing.id },
          data: { amount: raised },
        });
        continue;
      }

      const monthKey = part.kind === "MONTHLY" ? part.monthKey : undefined;
      const contribution = await tx.contribution.create({
        data: {
          organizationId,
          memberId: member.id,
          type: part.kind,
          amount: part.amount,
          paidForYear: input.paidForYear,
          paidForMonth: monthKey ? monthKeyToDate(monthKey) : null,
          paidOnDate,
          note: input.note ?? null,
          recordedById,
        },
      });
      await tx.fundTransaction.create({
        data: {
          organizationId,
          type: "IN",
          amount: part.amount,
          description: ledgerDescription(
            member.name,
            member.memberId,
            monthKey,
            input.paidForYear,
          ),
          date: paidOnDate,
          contributionId: contribution.id,
          recordedById,
        },
      });
    }
  });

  return {
    created: split.parts.length,
    allocated: split.allocated,
    leftover: split.leftover,
    shortMonth: split.shortMonth,
    clearsYear: split.clearsYear,
  };
}

/**
 * Records what a member has already paid for a year in one go — the ticked whole
 * months and fee at full rate, plus an extra lump sum spread over the remaining
 * months (oldest first) and then the fee. The split comes from the same
 * `planInitialSetup()` the admin saw in the preview, and every row plus its
 * cash-book entry is written in a single transaction. Used by the setup window
 * shown right after a member is created.
 */
export async function recordInitialSetup(
  organizationId: string,
  recordedById: string,
  memberId: string,
  input: InitialSetupInput,
) {
  const member = await prisma.member.findFirst({
    where: { id: memberId, organizationId },
    select: { id: true, name: true, memberId: true },
  });
  if (!member) throw notFound("Member not found");

  const obligation = await getYearObligation(organizationId, member.id, input.paidForYear);
  const plan = planInitialSetup({
    monthlyAmount: obligation.monthlyAmount,
    oneTimeFee: obligation.oneTimeFee,
    oneTimePaid: obligation.oneTimePaid,
    unpaidMonths: obligation.unpaidMonths,
    tickedMonths: input.tickedMonths,
    feeTicked: input.feeTicked,
    boxAmount: input.boxAmount,
    allowPartial: true,
  });

  if (plan.parts.length === 0) {
    throw badRequest(
      obligation.outstanding === 0
        ? `${member.name} has nothing outstanding for ${input.paidForYear}`
        : "Tick at least one month or the fee, or enter an amount",
    );
  }

  const paidOnDate = new Date(`${input.paidOnDate}T00:00:00.000Z`);

  // Written in two batched inserts rather than a row-at-a-time loop, so a full
  // year's worth of parts stays well inside the transaction timeout even when
  // the function and database are in different regions.
  const rows = plan.parts.map((part) => ({
    organizationId,
    memberId: member.id,
    type: part.kind,
    amount: part.amount,
    paidForYear: input.paidForYear,
    paidForMonth: part.kind === "MONTHLY" ? monthKeyToDate(part.monthKey) : null,
    paidOnDate,
    note: input.note ?? null,
    recordedById,
  }));

  await prisma.$transaction(
    async (tx) => {
      const created = await tx.contribution.createManyAndReturn({
        data: rows,
        select: { id: true, amount: true, paidForMonth: true },
      });
      await tx.fundTransaction.createMany({
        data: created.map((c) => ({
          organizationId,
          type: "IN" as const,
          amount: c.amount,
          description: ledgerDescription(
            member.name,
            member.memberId,
            c.paidForMonth ? dateToMonthKey(c.paidForMonth) : undefined,
            input.paidForYear,
          ),
          date: paidOnDate,
          contributionId: c.id,
          recordedById,
        })),
      });
    },
    { timeout: 30_000, maxWait: 15_000 },
  );

  return {
    created: plan.parts.length,
    allocated: plan.allocated,
    leftover: plan.leftover,
    shortMonth: plan.shortMonth,
    feeShort: plan.feeShort,
  };
}

export async function updateContribution(
  organizationId: string,
  id: string,
  input: ContributionUpdateInput,
) {
  const existing = await prisma.contribution.findFirst({
    where: { id, organizationId },
    include: { member: { select: { name: true, memberId: true } } },
  });
  if (!existing) throw notFound("Contribution not found");

  if (input.paidForMonth) await assertMonthCovered(organizationId, input.paidForMonth);
  const paidForMonth = input.paidForMonth
    ? monthKeyToDate(input.paidForMonth)
    : existing.paidForMonth;
  const paidForYear = input.paidForMonth
    ? Number(input.paidForMonth.slice(0, 4))
    : input.paidForYear ?? existing.paidForYear;

  if (
    input.paidForMonth &&
    paidForMonth &&
    paidForMonth.getTime() !== existing.paidForMonth?.getTime()
  ) {
    const clash = await prisma.contribution.findUnique({
      where: { memberId_paidForMonth: { memberId: existing.memberId, paidForMonth } },
      select: { id: true },
    });
    if (clash) {
      throw conflict(
        `${existing.member.name} already has a payment recorded for ${input.paidForMonth}`,
      );
    }
  }

  const paidOnDate = input.paidOnDate
    ? new Date(`${input.paidOnDate}T00:00:00.000Z`)
    : existing.paidOnDate;

  return prisma.$transaction(async (tx) => {
    const contribution = await tx.contribution.update({
      where: { id },
      data: {
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
        paidForYear,
        paidForMonth,
        paidOnDate,
        ...("note" in input ? { note: input.note ?? null } : {}),
      },
      include: CONTRIBUTION_INCLUDE,
    });

    // Keep the linked cash-book row in step with the edited payment.
    await tx.fundTransaction.updateMany({
      where: { contributionId: id },
      data: {
        amount: contribution.amount,
        date: contribution.paidOnDate,
        description: ledgerDescription(
          existing.member.name,
          existing.member.memberId,
          paidForMonth ? dateToMonthKey(paidForMonth) : undefined,
          paidForYear,
        ),
      },
    });

    return contribution;
  });
}

/** Removes the payment; the linked ledger row cascades away with it. */
export async function deleteContribution(organizationId: string, id: string) {
  const existing = await prisma.contribution.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  if (!existing) throw notFound("Contribution not found");
  await prisma.contribution.delete({ where: { id } });
}

export type DuesRow = {
  memberId: string;
  memberCode: string;
  name: string;
  phone: string | null;
  paid: boolean;
  /** Paid before the month it covers had even started. */
  paidInAdvance: boolean;
  /**
   * Settled for less than the month's rate — the tail of a lump sum, usually.
   * The month counts as recorded but the money is still short.
   */
  short: boolean;
  /** How much less than the rate was taken. Zero unless `short`. */
  shortfall: number;
  amount: number | null;
  paidOnDate: Date | null;
  contributionId: string | null;
};

/**
 * Who has and hasn't paid for `monthKey`. Only active members are tracked, and
 * members who joined after the month in question are excluded — they were not
 * yet liable.
 *
 * The month may be in the future: members can settle months ahead of time, so
 * an unpaid row there is "not due yet" rather than a miss.
 */
export async function getDuesForMonth(organizationId: string, monthKey: string) {
  const paidForMonth = monthKeyToDate(monthKey);
  // Anyone who joined on or before the last day of the month owes for it.
  const monthEnd = new Date(paidForMonth);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);

  const [members, contributions, plans] = await Promise.all([
    prisma.member.findMany({
      where: { organizationId, status: "ACTIVE", joinDate: { lt: monthEnd } },
      orderBy: { memberId: "asc" },
    }),
    prisma.contribution.findMany({
      where: { organizationId, type: "MONTHLY", paidForMonth },
    }),
    listYearPlans(organizationId),
  ]);

  // The rate for this month is what one-tap collection charges and what a short
  // payment is measured against.
  const expectedAmount = planForMonthKey(plans, monthKey)?.monthlyAmount ?? 0;

  const byMember = new Map(contributions.map((c) => [c.memberId, c]));
  const isFuture = paidForMonth > new Date();

  const rows: DuesRow[] = members.map((member) => {
    const contribution = byMember.get(member.id);
    const amount = contribution ? contribution.amount.toNumber() : null;
    const shortfall =
      amount !== null && expectedAmount > 0 ? Math.max(0, expectedAmount - amount) : 0;
    return {
      memberId: member.id,
      memberCode: member.memberId,
      name: member.name,
      phone: member.phone,
      paid: Boolean(contribution),
      paidInAdvance: Boolean(contribution && contribution.paidOnDate < paidForMonth),
      short: shortfall > 0,
      shortfall,
      amount,
      paidOnDate: contribution?.paidOnDate ?? null,
      contributionId: contribution?.id ?? null,
    };
  });

  const paidRows = rows.filter((r) => r.paid);
  return {
    monthKey,
    isFuture,
    expectedAmount,
    rows,
    dueCount: rows.length,
    paidCount: paidRows.length,
    // Nobody is overdue for a month that has not started yet.
    pendingCount: isFuture ? 0 : rows.length - paidRows.length,
    notDueYetCount: isFuture ? rows.length - paidRows.length : 0,
    collected: paidRows.reduce((sum, r) => sum + (r.amount ?? 0), 0),
    collectionRate: rows.length === 0 ? 0 : paidRows.length / rows.length,
  };
}
