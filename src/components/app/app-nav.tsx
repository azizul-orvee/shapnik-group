"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BanknoteArrowUp,
  CalendarCheck2,
  FileText,
  LayoutDashboard,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavIcon, NavLink } from "./nav-links";

const ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  collections: BanknoteArrowUp,
  dues: CalendarCheck2,
  members: Users,
  fund: Wallet,
  reports: FileText,
  accounts: ShieldCheck,
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Persistent sidebar, shown from `md` up. */
export function SidebarNav({ links }: { links: NavLink[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {links.map((link) => {
        const Icon = ICONS[link.icon];
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Thumb-reachable bottom bar — the treasurer's primary surface on a phone. */
export function BottomNav({ links }: { links: NavLink[] }) {
  const pathname = usePathname();
  return (
    <nav className="bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur md:hidden">
      <ul
        className="mx-auto grid max-w-lg"
        style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}
      >
        {links.map((link) => {
          const Icon = ICONS[link.icon];
          const active = isActive(pathname, link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" />
                <span className="truncate">{link.shortLabel}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
