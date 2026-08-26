import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/rbac";
import { navLinksFor } from "@/components/app/nav-links";
import { BottomNav, SidebarNav } from "@/components/app/app-nav";
import { UserMenu } from "@/components/app/user-menu";
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
      <header className="bg-background/95 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4">
          <Link href="/" className="min-w-0">
            <span className="block truncate text-sm font-semibold">
              {organization?.name ?? "Shomiti"}
            </span>
            <span className="text-muted-foreground block text-xs">
              {ROLE_LABELS[session.role]}
            </span>
          </Link>
          <UserMenu
            name={session.name}
            email={session.email}
            roleLabel={ROLE_LABELS[session.role]}
            signOutAction={signOutAction}
          />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-5">
        <aside className="hidden w-52 shrink-0 md:block">
          <div className="sticky top-20">
            <SidebarNav links={links} />
          </div>
        </aside>
        <main className="min-w-0 flex-1 pb-24 md:pb-6">{children}</main>
      </div>

      <BottomNav links={links} />
    </div>
  );
}
