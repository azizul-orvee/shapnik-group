import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ApiError, conflict, notFound } from "@/lib/api";
import { dateToMonthKey, monthKeyToDate, monthRange } from "@/lib/dates";
import { memberIdKey } from "@/lib/member-id";
import { ledgerDescription } from "@/server/contributions";
import { getSocietySettings } from "@/server/progress";
import { requireYearPlan } from "@/server/years";
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
  search?: string;
};

export async function listMembers(organizationId: string, filter: MemberListFilter = {}) {
  return prisma.member.findMany({
    where: {
      organizationId,
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
    orderBy: { memberId: "asc" },
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
 * "M-01", "01" and "1" are one member ID, but the database's unique index only
 * sees the exact text. Compare every other member's ID by its key so a
 * differently written copy of an ID already in use is refused.
 */
async function assertMemberIdAvailable(organizationId: string, memberId: string, exceptId?: string) {
  const key = memberIdKey(memberId);
  const others = await prisma.member.findMany({
    where: { organizationId, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { memberId: true },
  });
  const clash = others.find((other) => memberIdKey(other.memberId) === key);
  if (!clash) return;
  throw conflict(
    clash.memberId === memberId
      ? `Member ID "${memberId}" is already in use`
      : `Member ID "${memberId}" is the same as "${clash.memberId}", which is already in use`,
  );
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
  await assertMemberIdAvailable(organizationId, input.memberId);

  // Members are entered as founding members: they owe from the society's
  // opening month, so their join date is the organisation's start month rather
  // than something the admin types in.
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { memberLimit: true, startMonth: true },
  });

  // The society is capped; deleting a member frees their slot.
  const memberCount = await prisma.member.count({ where: { organizationId } });
  if (memberCount >= organization.memberLimit) {
    throw new ApiError(
      409,
      `The society is limited to ${organization.memberLimit} members. Delete someone before adding another.`,
    );
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

    // Build every past-year row up front and write them in two batched inserts.
    // A per-row loop is ~20 sequential round-trips, which times out when the
    // function and the database sit in different regions.
    const rows: {
      organizationId: string;
      memberId: string;
      type: "MONTHLY" | "ONE_TIME";
      amount: number;
      paidForYear: number;
      paidForMonth: Date | null;
      paidOnDate: Date;
      recordedById: string;
    }[] = [];
    for (const plan of pastPlans) {
      for (const monthKey of monthRange(plan.startMonthKey, plan.endMonthKey)) {
        const paidOnDate = monthKeyToDate(monthKey);
        rows.push({
          organizationId,
          memberId: member.id,
          type: "MONTHLY",
          amount: plan.monthlyAmount,
          paidForYear: plan.year,
          paidForMonth: paidOnDate,
          paidOnDate,
          recordedById,
        });
      }
      rows.push({
        organizationId,
        memberId: member.id,
        type: "ONE_TIME",
        amount: plan.oneTimeFee,
        paidForYear: plan.year,
        paidForMonth: null,
        paidOnDate: monthKeyToDate(plan.startMonthKey),
        recordedById,
      });
    }

    if (rows.length > 0) {
      // Each contribution still gets its matching cash-book IN row, created in
      // this same transaction so the ledger never drifts.
      const created = await tx.contribution.createManyAndReturn({
        data: rows,
        select: { id: true, amount: true, paidForMonth: true, paidForYear: true, paidOnDate: true },
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
            c.paidForYear,
          ),
          date: c.paidOnDate,
          contributionId: c.id,
          recordedById,
        })),
      });
    }

    return member;
  }, { timeout: 30_000, maxWait: 15_000 });
}

export async function updateMember(
  organizationId: string,
  id: string,
  input: Partial<MemberCreateInput>,
) {
  const current = await getMember(organizationId, id);

  // Only a changed ID is checked, so editing a member's name or phone still saves.
  if (input.memberId !== undefined && input.memberId !== current.memberId) {
    await assertMemberIdAvailable(organizationId, input.memberId, id);
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
 * Permanently deletes a member — their login, contributions and the linked
 * cash-book rows all cascade away. Irreversible, so it re-checks the acting
 * admin's own password first. The login is removed explicitly because the
 * User→Member relation is `SetNull`, which would otherwise leave an orphan
 * login that can still sign in.
 */
export async function deleteMember(
  organizationId: string,
  actingUserId: string,
  adminPassword: string,
  id: string,
) {
  await getMember(organizationId, id);

  const admin = await prisma.user.findFirst({
    where: { id: actingUserId, organizationId },
    select: { adminPasswordHash: true },
  });
  if (!admin?.adminPasswordHash || !(await bcrypt.compare(adminPassword, admin.adminPasswordHash))) {
    throw new ApiError(403, "That password is incorrect");
  }

  await prisma.$transaction(async (tx) => {
    // Delete the login first: the relation is SetNull, so removing the member
    // first would clear memberId and leave the login behind.
    await tx.user.deleteMany({ where: { organizationId, memberId: id } });
    // Deleting the member cascades its contributions, and each contribution
    // cascades its linked FundTransaction.
    await tx.member.delete({ where: { id } });
  });
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
