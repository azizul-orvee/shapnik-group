import { NextResponse } from "next/server";
import { handler, parseBody, requireApiOrgReader, requireApiWriter } from "@/lib/api";
import { memberDeleteSchema, memberUpdateSchema } from "@/lib/validation";
import {
  deleteMember,
  getMemberWithContributions,
  redactMember,
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
 * Permanently deletes a member and everything tied to them — login,
 * contributions and cash-book rows. Re-checks the admin's password first.
 */
export const DELETE = handler(async (request: Request, { params }: Context) => {
  const session = await requireApiWriter();
  const { id } = await params;
  const input = await parseBody(request, memberDeleteSchema);
  await deleteMember(session.organizationId, session.userId, input.adminPassword, id);
  return NextResponse.json({ ok: true });
});
