import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ApiError, notFound } from "@/lib/api";
import type { ProfileUpdateInput } from "@/lib/validation";

/** Read-only roster of every login in the society. */
export async function listUsers(organizationId: string) {
  return prisma.user.findMany({
    where: { organizationId },
    orderBy: [{ role: "asc" }, { username: "asc" }],
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      createdAt: true,
      member: { select: { id: true, name: true, memberId: true } },
    },
  });
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      phone: true,
      nationalId: true,
      nomineeName: true,
      nomineeNationalId: true,
      nomineePhone: true,
    },
  });
  if (!user) throw notFound("Account not found");
  return user;
}

/**
 * Admin filling in their own details. The NID is also the sign-in password, so
 * changing it re-hashes the password too — otherwise the credential the app
 * tells them to use would stop working. Members cannot call this: their
 * registered details live on the Member row and only an admin edits those.
 */
export async function updateProfile(userId: string, input: ProfileUpdateInput) {
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { nationalId: true, role: true },
  });
  if (!current) throw notFound("Account not found");
  if (current.role !== "ADMIN") {
    throw new ApiError(403, "Ask the admin to update your registered details.");
  }

  const nidChanged =
    input.nationalId !== undefined && input.nationalId !== current.nationalId;

  return prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name,
      phone: input.phone ?? null,
      nationalId: input.nationalId ?? null,
      nomineeName: input.nomineeName ?? null,
      nomineeNationalId: input.nomineeNationalId ?? null,
      nomineePhone: input.nomineePhone ?? null,
      ...(nidChanged && input.nationalId
        ? { passwordHash: await bcrypt.hash(input.nationalId, 10) }
        : {}),
    },
    select: { id: true, name: true },
  });
}
