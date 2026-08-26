import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { conflict, notFound } from "@/lib/api";
import type { UserCreateInput } from "@/lib/validation";

export async function listUsers(organizationId: string) {
  return prisma.user.findMany({
    where: { organizationId },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      member: { select: { id: true, name: true, memberId: true } },
    },
  });
}

export async function createUser(organizationId: string, input: UserCreateInput) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existing) throw conflict("That email already has an account");

  if (input.memberId) {
    const member = await prisma.member.findFirst({
      where: { id: input.memberId, organizationId },
      select: { id: true },
    });
    if (!member) throw notFound("Member not found");
  }

  return prisma.user.create({
    data: {
      organizationId,
      name: input.name,
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, 10),
      role: input.role,
      memberId: input.memberId ?? null,
    },
    select: { id: true, name: true, email: true, role: true },
  });
}
