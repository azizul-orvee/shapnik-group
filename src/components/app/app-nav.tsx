"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BanknoteArrowUp,
  CalendarCheck2,
  CalendarRange,
  Ellipsis,
  FileText,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { splitMobileNav, type NavIcon, type NavLink } from "./nav-links";
import { ThemeToggleRow } from "./theme-toggle";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  collections: BanknoteArrowUp,
  dues: CalendarCheck2,
  members: Users,
  fund: Wallet,
  reports: FileText,
  years: CalendarRange,
  accounts: ShieldCheck,
  profile: UserRound,
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const TAB_CLASS =
  "relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[11px] font-medium transition-colors";

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

export type MobileAccount = {
  name: string;
  signInId: string;
  roleLabel: string;
};

/** Thumb-reachable bottom bar — four primary destinations, the rest in More. */
export function BottomNav({
  links,
  account,
  signOutAction,
}: {
  links: NavLink[];
  account: MobileAccount;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const { tabs, more } = splitMobileNav(links);
  const [morePath, setMorePath] = useState<string | null>(null);
  const moreOpen = morePath === pathname;
  const moreActive = more.some((link) => isActive(pathname, link.href));
  const columns = tabs.length + (more.length > 0 ? 1 : 0);

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
      >
        <ul
          className={cn(
            "bg-card/92 ring-border/80 shadow-lg mx-auto grid gap-0.5 rounded-[1.35rem] p-1.5 ring-1 backdrop-blur-xl",
            columns <= 2 ? "max-w-[17rem]" : "max-w-md",
          )}
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {tabs.map((link) => {
            const Icon = ICONS[link.icon];
            const active = isActive(pathname, link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    TAB_CLASS,
                    active ? "text-brand" : "text-muted-foreground",
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
                  <span className="max-w-full truncate leading-none">{link.shortLabel}</span>
                </Link>
              </li>
            );
          })}
          {more.length > 0 ? (
            <li>
              <button
                type="button"
                aria-expanded={moreOpen}
                aria-haspopup="dialog"
                onClick={() => setMorePath(pathname)}
                className={cn(
                  TAB_CLASS,
                  "w-full",
                  moreActive || moreOpen ? "text-brand" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg transition-all",
                    moreActive || moreOpen ? "bg-brand-soft" : "bg-transparent",
                  )}
                >
                  <Ellipsis className="size-5" />
                </span>
                <span className="leading-none">More</span>
              </button>
            </li>
          ) : null}
        </ul>
      </nav>

      {more.length > 0 ? (
        <Sheet
          open={moreOpen}
          onOpenChange={(open) => setMorePath(open ? pathname : null)}
        >
          <SheetContent
            side="bottom"
            className="rounded-t-3xl pb-[max(1.25rem,env(safe-area-inset-bottom))]"
          >
            <div className="bg-muted-foreground/25 mx-auto mt-1 h-1 w-10 rounded-full" aria-hidden />
            <SheetHeader className="pt-2">
              <SheetTitle>Menu</SheetTitle>
              <SheetDescription className="sr-only">
                Further sections, account and sign out.
              </SheetDescription>
            </SheetHeader>

            <div className="px-4 pb-2">
              <p className="text-muted-foreground mb-2 text-[11px] font-medium tracking-wide uppercase">
                Society
              </p>
              <ul className="grid grid-cols-2 gap-2">
                {more.map((link) => {
                  const Icon = ICONS[link.icon];
                  const active = isActive(pathname, link.href);
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-h-16 flex-col items-start justify-center gap-1.5 rounded-2xl px-3.5 py-3 text-sm font-medium ring-1 transition-colors",
                          active
                            ? "bg-brand-soft text-accent-foreground ring-brand/20"
                            : "bg-muted/50 text-foreground ring-transparent",
                        )}
                      >
                        <Icon className={cn("size-5", active ? "text-brand" : "text-muted-foreground")} />
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <p className="text-muted-foreground mt-5 mb-2 text-[11px] font-medium tracking-wide uppercase">
                Account
              </p>
              <div className="bg-muted/50 divide-border/70 divide-y overflow-hidden rounded-2xl">
                <div className="px-3.5 py-3">
                  <p className="font-medium">{account.name}</p>
                  <p className="text-muted-foreground font-mono text-xs">{account.signInId}</p>
                  <p className="text-muted-foreground text-xs">{account.roleLabel}</p>
                </div>
                <Link
                  href="/profile"
                  className="flex min-h-12 items-center gap-3 px-3.5 py-3 text-sm font-medium"
                >
                  <UserRound className="text-muted-foreground size-4.5" />
                  My profile
                </Link>
                <ThemeToggleRow />
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="flex min-h-12 w-full items-center gap-3 px-3.5 py-3 text-sm font-medium"
                  >
                    <LogOut className="text-muted-foreground size-4.5" />
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      ) : null}
    </>
  );
}
