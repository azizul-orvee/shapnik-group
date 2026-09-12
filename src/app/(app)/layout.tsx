import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
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
  const [organization] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { name: true },
    }),
  ]);

  const links = navLinksFor(session.role);

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-background/80 supports-[backdrop-filter]:bg-background/65 sticky top-0 z-40 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <BrandMark size={38} className="shrink-0" />
            <span className="min-w-0">
              <span className="font-heading block truncate text-sm leading-tight font-semibold">
                {organization?.name ?? "Shapnik"}
              </span>
              <span className="text-muted-foreground block text-xs leading-tight">
                {ROLE_LABELS[session.role]}
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-1.5">
            <time
              dateTime={dhakaDateKey()}
              className="text-muted-foreground bg-muted/60 flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium tabular-nums sm:px-3"
            >
              <CalendarDays className="size-3.5 shrink-0 opacity-70" />
              {/* Weekday shown from sm up; dropped on the narrowest phones to keep
                  the header on one line. */}
              <span className="hidden sm:inline">{formatDhakaToday()}</span>
              <span className="sm:hidden">{formatDhakaToday().replace(/^\w+, /, "")}</span>
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

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-7 px-4 py-5 sm:py-6">
        <aside className="hidden w-56 shrink-0 md:block">
          <div className="sticky top-20">
            <SidebarNav links={links} />
          </div>
        </aside>
        <main className="min-w-0 flex-1 pb-28 md:pb-6">{children}</main>
      </div>

      <BottomNav links={links} />
    </div>
  );
}
