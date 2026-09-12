import type { Role } from "@/generated/prisma/enums";

/**
 * The society runs on two roles. An admin manages everything; a member sees
 * their own record and nothing else.
 */
export const WRITE_ROLES: Role[] = ["ADMIN"];

/** Roles that can see org-wide data. */
export const ORG_READ_ROLES: Role[] = ["ADMIN"];

export function canWrite(role: Role): boolean {
  return WRITE_ROLES.includes(role);
}

export function canReadOrg(role: Role): boolean {
  return ORG_READ_ROLES.includes(role);
}

/** Only ADMIN manages accounts and year plans. */
export function canManageUsers(role: Role): boolean {
  return role === "ADMIN";
}

export function canManageYears(role: Role): boolean {
  return role === "ADMIN";
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  MEMBER: "Member",
};
