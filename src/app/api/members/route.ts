import { NextResponse } from "next/server";
import { handler, parseBody, requireApiOrgReader, requireApiWriter } from "@/lib/api";
import { memberCreateSchema } from "@/lib/validation";
import { createMember, listMembers, redactMember } from "@/server/members";
import { canWrite } from "@/lib/rbac";

export const GET = handler(async (request: Request) => {
  const session = await requireApiOrgReader();
  const { searchParams } = new URL(request.url);

  const members = await listMembers(session.organizationId, {
    search: searchParams.get("q") ?? undefined,
  });
  const canSeeSensitive = canWrite(session.role);
  return NextResponse.json({
    members: members.map((m) => redactMember(m, canSeeSensitive)),
  });
});

export const POST = handler(async (request: Request) => {
  const session = await requireApiWriter();
  const input = await parseBody(request, memberCreateSchema);
  const member = await createMember(session.organizationId, session.userId, input);
  return NextResponse.json({ member }, { status: 201 });
});
