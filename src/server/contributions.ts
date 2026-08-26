import "server-only";
import { prisma } from "@/lib/prisma";
import { badRequest, conflict, notFound } from "@/lib/api";
import { dateToMonthKey, formatMonthKey, isMonthInWindow, monthKeyToDate } from "@/lib/dates";
import { getSocietySettings } from "@/server/progress";
import type {
  BulkContributionInput,
  ContributionCreateInput,
  ContributionUpdateInput,
} from "@/lib/validation";

/**
 * The society only operates between its start and end months. A payment may
 * cover a month that has not arrived yet — members do pay ahead — but never one
 * outside the window.
 */
async function assertMonthInWindow(organizationId: string, monthKey: string) {
  const { startMonthKey, endMonthKey } = await getSocietySettings(organizationId);
  if (!isMonthInWindow(monthKey, startMonthKey, endMonthKey)) {
    throw badRequest(
      `The society runs from ${formatMonthKey(startMonthKey)} to ${formatMonthKey(endMonthKey)}`,
    );
  }
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

function ledgerDescription(memberName: string, memberCode: string, monthKey?: string) {
  return monthKey
    ? `Monthly contribution — ${memberName} (${memberCode}) for ${monthKey}`
    : `One-time fee — ${memberName} (${memberCode})`;
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
  if (input.paidForMonth) await assertMonthInWindow(organizationId, input.paidForMonth);
  const paidForMonth = input.paidForMonth ? monthKeyToDate(input.paidForMonth) : null;
  if (paidForMonth) {
    const duplicate = await prisma.contribution.findUnique({
      where: { memberId_paidForMonth: { memberId: member.id, paidForMonth } },
      select: { id: true },
    });
    if (duplicate) {
      throw conflict(`${member.name} already has a payment recorded for ${input.paidForMonth}`);
    }
  }

  return prisma.$transaction(async (tx) => {
    const contribution = await tx.contribution.create({
      data: {
        organizationId,
        memberId: member.id,
        type: input.type,
        amount: input.amount,
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
        description: ledgerDescription(member.name, member.memberId, input.paidForMonth),
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
  await assertMonthInWindow(organizationId, input.paidForMonth);
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

  if (input.paidForMonth) await assertMonthInWindow(organizationId, input.paidForMonth);
  const paidForMonth = input.paidForMonth
    ? monthKeyToDate(input.paidForMonth)
    : existing.paidForMonth;

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

  const [members, contributions] = await Promise.all([
    prisma.member.findMany({
      where: { organizationId, status: "ACTIVE", joinDate: { lt: monthEnd } },
      orderBy: { memberId: "asc" },
    }),
    prisma.contribution.findMany({
      where: { organizationId, type: "MONTHLY", paidForMonth },
    }),
  ]);

  const byMember = new Map(contributions.map((c) => [c.memberId, c]));
  const isFuture = paidForMonth > new Date();

  const rows: DuesRow[] = members.map((member) => {
    const contribution = byMember.get(member.id);
    return {
      memberId: member.id,
      memberCode: member.memberId,
      name: member.name,
      phone: member.phone,
      paid: Boolean(contribution),
      paidInAdvance: Boolean(contribution && contribution.paidOnDate < paidForMonth),
      amount: contribution ? contribution.amount.toNumber() : null,
      paidOnDate: contribution?.paidOnDate ?? null,
      contributionId: contribution?.id ?? null,
    };
  });

  const paidRows = rows.filter((r) => r.paid);
  return {
    monthKey,
    isFuture,
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
