import "server-only";
import { prisma } from "@/lib/prisma";
import { conflict, notFound } from "@/lib/api";
import type { MemberStatus } from "@/generated/prisma/enums";
import type { MemberCreateInput } from "@/lib/validation";

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

export async function createMember(organizationId: string, input: MemberCreateInput) {
  const existing = await prisma.member.findUnique({
    where: { organizationId_memberId: { organizationId, memberId: input.memberId } },
    select: { id: true },
  });
  if (existing) throw conflict(`Member ID "${input.memberId}" is already in use`);

  return prisma.member.create({
    data: {
      organizationId,
      memberId: input.memberId,
      name: input.name,
      phone: input.phone ?? null,
      joinDate: new Date(`${input.joinDate}T00:00:00.000Z`),
      status: input.status ?? "ACTIVE",
    },
  });
}

export async function updateMember(
  organizationId: string,
  id: string,
  input: Partial<MemberCreateInput>,
) {
  await getMember(organizationId, id);

  if (input.memberId) {
    const clash = await prisma.member.findUnique({
      where: { organizationId_memberId: { organizationId, memberId: input.memberId } },
      select: { id: true },
    });
    if (clash && clash.id !== id) {
      throw conflict(`Member ID "${input.memberId}" is already in use`);
    }
  }

  return prisma.member.update({
    where: { id },
    data: {
      ...(input.memberId !== undefined ? { memberId: input.memberId } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...("phone" in input ? { phone: input.phone ?? null } : {}),
      ...(input.joinDate !== undefined
        ? { joinDate: new Date(`${input.joinDate}T00:00:00.000Z`) }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
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
