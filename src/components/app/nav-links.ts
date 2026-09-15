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
  | "accounts"
  | "profile";

export type NavLink = {
  href: string;
  label: string;
  shortLabel: string;
  icon: NavIcon;
  roles: Role[];
  /** Thumb-bar destinations. Everything else lands in the mobile More sheet. */
  primary?: boolean;
};

const ORG_ROLES: Role[] = ["ADMIN"];

export const NAV_LINKS: NavLink[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    shortLabel: "Home",
    icon: "dashboard",
    roles: ORG_ROLES,
    primary: true,
  },
  {
    href: "/contributions",
    label: "Collections",
    shortLabel: "Collect",
    icon: "collections",
    roles: ORG_ROLES,
    primary: true,
  },
  {
    href: "/dues",
    label: "Dues",
    shortLabel: "Dues",
    icon: "dues",
    roles: ORG_ROLES,
    primary: true,
  },
  {
    href: "/members",
    label: "Members",
    shortLabel: "Members",
    icon: "members",
    roles: ORG_ROLES,
    primary: true,
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
    shortLabel: "Home",
    icon: "reports",
    roles: ["MEMBER"],
    primary: true,
  },
  {
    href: "/profile",
    label: "My profile",
    shortLabel: "Profile",
    icon: "profile",
    roles: ["MEMBER"],
    primary: true,
  },
];

export function navLinksFor(role: Role): NavLink[] {
  return NAV_LINKS.filter((link) => link.roles.includes(role));
}

/** Five or fewer destinations stay on the bar; more than that, four + More. */
export function splitMobileNav(links: NavLink[]): { tabs: NavLink[]; more: NavLink[] } {
  if (links.length <= 5) return { tabs: links, more: [] };
  const tabs = links.filter((link) => link.primary);
  const more = links.filter((link) => !link.primary);
  if (tabs.length === 0) {
    return { tabs: links.slice(0, 4), more: links.slice(4) };
  }
  return { tabs, more };
}
