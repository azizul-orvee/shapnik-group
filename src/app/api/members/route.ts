import { NextResponse } from "next/server";
import { handler, parseBody, requireApiOrgReader, requireApiWriter } from "@/lib/api";
import { memberCreateSchema } from "@/lib/validation";
import { createMember, listMembers } from "@/server/members";
import type { MemberStatus } from "@/generated/prisma/enums";

export const GET = handler(async (request: Request) => {
  const session = await requireApiOrgReader();
  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const status =
    statusParam === "ACTIVE" || statusParam === "INACTIVE"
      ? (statusParam as MemberStatus)
      : undefined;

  const members = await listMembers(session.organizationId, {
    status,
    search: searchParams.get("q") ?? undefined,
  });
  return NextResponse.json({ members });
});

export const POST = handler(async (request: Request) => {
  const session = await requireApiWriter();
  const input = await parseBody(request, memberCreateSchema);
  const member = await createMember(session.organizationId, input);
  return NextResponse.json({ member }, { status: 201 });
});
