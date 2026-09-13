import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ApiError, conflict, notFound } from "@/lib/api";
import { monthKeyToDate, monthRange } from "@/lib/dates";
import { ledgerDescription } from "@/server/contributions";
import { getSocietySettings } from "@/server/progress";
import { requireYearPlan } from "@/server/years";
import type { MemberStatus } from "@/generated/prisma/enums";
import type { MemberCreateInput } from "@/lib/validation";

/**
 * A member's NID is also their sign-in password, so it must never reach anyone
 * who cannot already act for them. Only an ADMIN sees the real values;
 * everyone else gets them masked.
 */
export function redactMember<
  T extends { nationalId: string; nomineeNationalId: string },
>(member: T, canSeeSensitive: boolean): T {
  if (canSeeSensitive) return member;
  return { ...member, nationalId: maskId(member.nationalId), nomineeNationalId: maskId(member.nomineeNationalId) };
}

function maskId(value: string): string {
  return value.length <= 4 ? "••••" : `${"•".repeat(value.length - 4)}${value.slice(-4)}`;
}

export type MemberListFilter = {
  status?: MemberStatus;
  search?: string;
};

export async function listMembers(organizationId: string, filter: MemberListFilter = {}) {
  return prisma.member.findMany({
    where: {
      organizationId,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.search
        ? {
            OR: [
              { name: { contains: filter.search, mode: "insensitive" } },
              { memberId: { contains: filter.search, mode: "insensitive" } },
              { phone: { contains: filter.search } },
            ],
          }
        : {}),
    },
    orderBy: [{ status: "asc" }, { memberId: "asc" }],
  });
}

/** Returns null when missing — pages use this and call `notFound()`. */
export async function findMember(organizationId: string, id: string) {
  return prisma.member.findFirst({ where: { id, organizationId } });
}

/** Throws a 404 ApiError — route handlers use this. */
export async function getMember(organizationId: string, id: string) {
  const member = await findMember(organizationId, id);
  if (!member) throw notFound("Member not found");
  return member;
}

export async function findMemberWithContributions(organizationId: string, id: string) {
  return prisma.member.findFirst({
    where: { id, organizationId },
    include: {
      contributions: {
        orderBy: { paidForMonth: "desc" },
        include: { recordedBy: { select: { name: true } } },
      },
    },
  });
}

export async function getMemberWithContributions(organizationId: string, id: string) {
  const member = await findMemberWithContributions(organizationId, id);
  if (!member) throw notFound("Member not found");
  return member;
}

/**
 * Registers a member and, in the same transaction, the login they use to see
 * their own record: their member ID is the username and their NID the initial
 * password. Both come straight from what the admin typed, so a member can sign
 * in the moment their account exists.
 */
export async function createMember(
  organizationId: string,
  recordedById: string,
  input: MemberCreateInput,
) {
  const existing = await prisma.member.findUnique({
    where: { organizationId_memberId: { organizationId, memberId: input.memberId } },
    select: { id: true },
  });
  if (existing) throw conflict(`Member ID "${input.memberId}" is already in use`);

  // Members are entered as founding members: they owe from the society's
  // opening month, so their join date is the organisation's start month rather
  // than something the admin types in.
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { memberLimit: true, startMonth: true },
  });

  // The society is capped; deactivating a member frees their slot.
  if ((input.status ?? "ACTIVE") === "ACTIVE") {
    const active = await prisma.member.count({
      where: { organizationId, status: "ACTIVE" },
    });
    if (active >= organization.memberLimit) {
      throw new ApiError(
        409,
        `The society is limited to ${organization.memberLimit} active members. Deactivate someone before adding another.`,
      );
    }
  }

  const passwordHash = await bcrypt.hash(input.nationalId, 10);

  // Every fully-elapsed past year is treated as paid in full for a founding
  // member — each in-season month at that year's rate, plus the year's fee.
  // The current (active) year is left for the admin to record in the setup
  // window shown right after creation.
  const settings = await getSocietySettings(organizationId);
  const activeYear = Number(settings.activeMonthKey.slice(0, 4));
  const pastYears = settings.years.filter((year) => year < activeYear);
  const pastPlans = await Promise.all(
    pastYears.map((year) => requireYearPlan(organizationId, year)),
  );

  return prisma.$transaction(async (tx) => {
    const member = await tx.member.create({
      data: {
        organizationId,
        memberId: input.memberId,
        name: input.name,
        phone: input.phone,
        nationalId: input.nationalId,
        nomineeName: input.nomineeName,
        nomineeNationalId: input.nomineeNationalId,
        nomineePhone: input.nomineePhone ?? null,
        joinDate: organization.startMonth,
        status: input.status ?? "ACTIVE",
      },
    });

    await tx.user.create({
      data: {
        organizationId,
        name: input.name,
        email: null,
        username: input.memberId,
        passwordHash,
        role: "MEMBER",
        memberId: member.id,
      },
    });

    // Settle each past year: a monthly row per in-season month, plus the fee.
    // Each contribution carries its matching cash-book IN row in this same
    // transaction, so the ledger never drifts from the contribution list.
    for (const plan of pastPlans) {
      for (const monthKey of monthRange(plan.startMonthKey, plan.endMonthKey)) {
        const paidOnDate = monthKeyToDate(monthKey);
        const contribution = await tx.contribution.create({
          data: {
            organizationId,
            memberId: member.id,
            type: "MONTHLY",
            amount: plan.monthlyAmount,
            paidForYear: plan.year,
            paidForMonth: paidOnDate,
            paidOnDate,
            recordedById,
          },
        });
        await tx.fundTransaction.create({
          data: {
            organizationId,
            type: "IN",
            amount: plan.monthlyAmount,
            description: ledgerDescription(member.name, member.memberId, monthKey, plan.year),
            date: paidOnDate,
            contributionId: contribution.id,
            recordedById,
          },
        });
      }

      const feeDate = monthKeyToDate(plan.startMonthKey);
      const fee = await tx.contribution.create({
        data: {
          organizationId,
          memberId: member.id,
          type: "ONE_TIME",
          amount: plan.oneTimeFee,
          paidForYear: plan.year,
          paidForMonth: null,
          paidOnDate: feeDate,
          recordedById,
        },
      });
      await tx.fundTransaction.create({
        data: {
          organizationId,
          type: "IN",
          amount: plan.oneTimeFee,
          description: ledgerDescription(member.name, member.memberId, undefined, plan.year),
          date: feeDate,
          contributionId: fee.id,
          recordedById,
        },
      });
    }

    return member;
  });
}

export async function updateMember(
  organizationId: string,
  id: string,
  input: Partial<MemberCreateInput>,
) {
  const current = await getMember(organizationId, id);

  if (input.memberId) {
    const clash = await prisma.member.findUnique({
      where: { organizationId_memberId: { organizationId, memberId: input.memberId } },
      select: { id: true },
    });
    if (clash && clash.id !== id) {
      throw conflict(`Member ID "${input.memberId}" is already in use`);
    }
  }

  // The member's ID and NID are their sign-in credentials, so correcting either
  // has to move their login with it — otherwise the details the admin can see
  // stop being the details that actually work.
  const nextMemberId = input.memberId ?? current.memberId;
  const nidChanged = input.nationalId !== undefined && input.nationalId !== current.nationalId;
  const passwordHash = nidChanged ? await bcrypt.hash(input.nationalId as string, 10) : undefined;

  return prisma.$transaction(async (tx) => {
    const member = await tx.member.update({
      where: { id },
      data: {
        ...(input.memberId !== undefined ? { memberId: input.memberId } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.nationalId !== undefined ? { nationalId: input.nationalId } : {}),
        ...(input.nomineeName !== undefined ? { nomineeName: input.nomineeName } : {}),
        ...(input.nomineeNationalId !== undefined
          ? { nomineeNationalId: input.nomineeNationalId }
          : {}),
        ...("nomineePhone" in input ? { nomineePhone: input.nomineePhone ?? null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    });

    await tx.user.updateMany({
      where: { memberId: id },
      data: {
        username: nextMemberId,
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(passwordHash ? { passwordHash } : {}),
      },
    });

    return member;
  });
}

/**
 * Members are never hard-deleted — their contribution history is part of the
 * society's books. Deactivating drops them out of dues tracking instead.
 */
export async function setMemberStatus(
  organizationId: string,
  id: string,
  status: MemberStatus,
) {
  await getMember(organizationId, id);
  return prisma.member.update({ where: { id }, data: { status } });
}

/** Next free sequential member code, e.g. `M-031`. */
export async function suggestMemberCode(organizationId: string): Promise<string> {
  const members = await prisma.member.findMany({
    where: { organizationId },
    select: { memberId: true },
  });
  const highest = members.reduce((max, { memberId }) => {
    const digits = /(\d+)\s*$/.exec(memberId)?.[1];
    return digits ? Math.max(max, Number(digits)) : max;
  }, 0);
  return `M-${String(highest + 1).padStart(3, "0")}`;
}
