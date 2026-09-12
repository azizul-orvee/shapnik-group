import { NextResponse } from "next/server";
import { handler, parseBody, requireApiOrgReader, requireApiWriter } from "@/lib/api";
import { memberUpdateSchema } from "@/lib/validation";
import {
  getMemberWithContributions,
  redactMember,
  setMemberStatus,
  updateMember,
} from "@/server/members";
import { canWrite } from "@/lib/rbac";

type Context = { params: Promise<{ id: string }> };

export const GET = handler(async (_request: Request, { params }: Context) => {
  const session = await requireApiOrgReader();
  const { id } = await params;
  const member = await getMemberWithContributions(session.organizationId, id);
  return NextResponse.json({ member: redactMember(member, canWrite(session.role)) });
});

export const PATCH = handler(async (request: Request, { params }: Context) => {
  const session = await requireApiWriter();
  const { id } = await params;
  const input = await parseBody(request, memberUpdateSchema);
  const member = await updateMember(session.organizationId, id, input);
  return NextResponse.json({ member });
});

/**
 * Members are deactivated, never deleted — their payment history stays on the books.
 */
export const DELETE = handler(async (_request: Request, { params }: Context) => {
  const session = await requireApiWriter();
  const { id } = await params;
  const member = await setMemberStatus(session.organizationId, id, "INACTIVE");
  return NextResponse.json({ member });
});
