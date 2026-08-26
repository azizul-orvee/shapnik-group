import type { Role } from "@/generated/prisma/enums";

/** Roles allowed to create/edit members, contributions and ledger entries. */
export const WRITE_ROLES: Role[] = ["ADMIN", "TREASURER"];

/** Roles that can see org-wide data (everyone except plain members). */
export const ORG_READ_ROLES: Role[] = ["ADMIN", "TREASURER", "COMMITTEE"];

export function canWrite(role: Role): boolean {
  return WRITE_ROLES.includes(role);
}

export function canReadOrg(role: Role): boolean {
  return ORG_READ_ROLES.includes(role);
}

/** Only ADMIN manages user accounts. */
export function canManageUsers(role: Role): boolean {
  return role === "ADMIN";
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  TREASURER: "Treasurer",
  COMMITTEE: "Committee",
  MEMBER: "Member",
};
