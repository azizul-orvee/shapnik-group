import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canReadOrg, canWrite } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";

export type AppSession = {
  userId: string;
  name: string;
  email: string;
  role: Role;
  organizationId: string;
  memberId: string | null;
};

/** Session for the current request, or `null` when signed out. */
export async function getAppSession(): Promise<AppSession | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    userId: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role,
    organizationId: session.user.organizationId,
    memberId: session.user.memberId ?? null,
  };
}

/** For pages: redirects to /login when signed out. */
export async function requireSession(): Promise<AppSession> {
  const session = await getAppSession();
  if (!session) redirect("/login");
  return session;
}

/** For pages: MEMBER-role users get bounced to their own statement. */
export async function requireOrgReader(): Promise<AppSession> {
  const session = await requireSession();
  if (!canReadOrg(session.role)) redirect("/my-statement");
  return session;
}

/** For pages: ADMIN/TREASURER only. */
export async function requireWriter(): Promise<AppSession> {
  const session = await requireSession();
  if (!canWrite(session.role)) redirect("/dashboard");
  return session;
}
