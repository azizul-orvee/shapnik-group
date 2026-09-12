import type { Role } from "@/generated/prisma/enums";

/**
 * Icons are referenced by key, not by component. This module is imported from a
 * Server Component, and React function components cannot be serialised across
 * the server/client boundary — the client nav maps these keys to Lucide icons.
 */
export type NavIcon =
  | "dashboard"
  | "collections"
  | "dues"
  | "members"
  | "fund"
  | "reports"
  | "years"
  | "accounts";

export type NavLink = {
  href: string;
  label: string;
  shortLabel: string;
  icon: NavIcon;
  roles: Role[];
};

const ORG_ROLES: Role[] = ["ADMIN"];

export const NAV_LINKS: NavLink[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    shortLabel: "Home",
    icon: "dashboard",
    roles: ORG_ROLES,
  },
  {
    href: "/contributions",
    label: "Collections",
    shortLabel: "Collect",
    icon: "collections",
    roles: ORG_ROLES,
  },
  {
    href: "/dues",
    label: "Dues",
    shortLabel: "Dues",
    icon: "dues",
    roles: ORG_ROLES,
  },
  {
    href: "/members",
    label: "Members",
    shortLabel: "Members",
    icon: "members",
    roles: ORG_ROLES,
  },
  {
    href: "/fund",
    label: "Fund",
    shortLabel: "Fund",
    icon: "fund",
    roles: ORG_ROLES,
  },
  {
    href: "/reports",
    label: "Reports",
    shortLabel: "Reports",
    icon: "reports",
    roles: ORG_ROLES,
  },
  {
    href: "/years",
    label: "Years",
    shortLabel: "Years",
    icon: "years",
    roles: ["ADMIN"],
  },
  {
    href: "/users",
    label: "Accounts",
    shortLabel: "Accounts",
    icon: "accounts",
    roles: ["ADMIN"],
  },
  {
    href: "/my-statement",
    label: "My statement",
    shortLabel: "Me",
    icon: "reports",
    roles: ["MEMBER"],
  },
];

export function navLinksFor(role: Role): NavLink[] {
  return NAV_LINKS.filter((link) => link.roles.includes(role));
}
