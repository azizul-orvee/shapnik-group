import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { requireSession } from "@/lib/session";
import { BRAND_NAME } from "@/lib/brand";
import { ROLE_LABELS } from "@/lib/rbac";
import { navLinksFor } from "@/components/app/nav-links";
import { BottomNav, SidebarNav } from "@/components/app/app-nav";
import { UserMenu } from "@/components/app/user-menu";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { BrandMark } from "@/components/app/brand-mark";
import { dhakaDateKey, formatDhakaToday } from "@/lib/dates";
import { signOut } from "@/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();

  const links = navLinksFor(session.role);
  const today = formatDhakaToday();

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-background/80 supports-[backdrop-filter]:bg-background/65 sticky top-0 z-40 border-b pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-2 px-4 md:h-16">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <BrandMark size={36} className="shrink-0" />
            <span className="min-w-0">
              <span className="font-heading block truncate text-[13px] leading-tight font-semibold sm:text-sm">
                {BRAND_NAME}
              </span>
              <span className="text-muted-foreground block text-[11px] leading-tight sm:text-xs">
                {ROLE_LABELS[session.role]}
              </span>
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-1">
            <time
              dateTime={dhakaDateKey()}
              className="text-muted-foreground bg-muted/60 flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium whitespace-nowrap tabular-nums sm:px-3 sm:py-1.5 sm:text-xs"
            >
              <CalendarDays className="size-3.5 shrink-0 opacity-70" />
              {/* Weekday shown from sm up; dropped on the narrowest phones to keep
                  the header on one line. The pill itself is never hidden. */}
              <span className="hidden sm:inline">{today}</span>
              <span className="sm:hidden">{today.replace(/^\w+, /, "")}</span>
            </time>
            <ThemeToggle />
            <UserMenu
              name={session.name}
              signInId={session.username ?? "—"}
              roleLabel={ROLE_LABELS[session.role]}
              signOutAction={signOutAction}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-7 px-4 py-4 sm:py-6">
        <aside className="hidden w-56 shrink-0 md:block">
          <div className="sticky top-20">
            <SidebarNav links={links} />
          </div>
        </aside>
        <main className="min-w-0 flex-1 pb-28 md:pb-6">{children}</main>
      </div>

      <BottomNav
        links={links}
        account={{
          name: session.name,
          signInId: session.username ?? "—",
          roleLabel: ROLE_LABELS[session.role],
        }}
        signOutAction={signOutAction}
      />
    </div>
  );
}
