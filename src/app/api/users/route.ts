import { NextResponse } from "next/server";
import { handler, requireApiAdmin } from "@/lib/api";
import { listUsers } from "@/server/users";

/** Read-only: member logins are created with the member, the admin is seeded. */
export const GET = handler(async () => {
  const session = await requireApiAdmin();
  return NextResponse.json({ users: await listUsers(session.organizationId) });
});
