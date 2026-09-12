"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BanknoteArrowUp,
  CalendarCheck2,
  CalendarRange,
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
  years: CalendarRange,
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
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
              active
                ? "bg-brand-soft text-accent-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {/* Brand rail marks the current section. */}
            <span
              className={cn(
                "bg-brand absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full transition-all",
                active ? "opacity-100" : "opacity-0",
              )}
              aria-hidden
            />
            <Icon
              className={cn(
                "size-4.5 shrink-0 transition-colors",
                active ? "text-brand" : "text-muted-foreground group-hover:text-foreground",
              )}
            />
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
    <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] md:hidden">
      <ul
        className="bg-card/90 ring-border/70 shadow-lg mx-auto grid max-w-md gap-0.5 rounded-2xl p-1.5 ring-1 backdrop-blur-xl"
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
                  "relative flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10.5px] font-medium transition-colors",
                  active ? "text-brand" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg transition-all",
                    active ? "bg-brand-soft" : "bg-transparent",
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span className="max-w-full truncate">{link.shortLabel}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
