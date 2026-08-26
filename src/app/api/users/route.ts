import { NextResponse } from "next/server";
import { ApiError, handler, parseBody, requireApiSession } from "@/lib/api";
import { canManageUsers } from "@/lib/rbac";
import { userCreateSchema } from "@/lib/validation";
import { createUser, listUsers } from "@/server/users";

async function requireAdmin() {
  const session = await requireApiSession();
  if (!canManageUsers(session.role)) throw new ApiError(403, "Only an admin can manage accounts");
  return session;
}

export const GET = handler(async () => {
  const session = await requireAdmin();
  const users = await listUsers(session.organizationId);
  return NextResponse.json({ users });
});

export const POST = handler(async (request: Request) => {
  const session = await requireAdmin();
  const input = await parseBody(request, userCreateSchema);
  const user = await createUser(session.organizationId, input);
  return NextResponse.json({ user }, { status: 201 });
});
