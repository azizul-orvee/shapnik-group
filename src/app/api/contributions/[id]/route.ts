import { NextResponse } from "next/server";
import { handler, parseBody, requireApiWriter } from "@/lib/api";
import { contributionUpdateSchema } from "@/lib/validation";
import { deleteContribution, updateContribution } from "@/server/contributions";

type Context = { params: Promise<{ id: string }> };

export const PATCH = handler(async (request: Request, { params }: Context) => {
  const session = await requireApiWriter();
  const { id } = await params;
  const input = await parseBody(request, contributionUpdateSchema);
  const contribution = await updateContribution(session.organizationId, id, input);
  return NextResponse.json({ contribution });
});

export const DELETE = handler(async (_request: Request, { params }: Context) => {
  const session = await requireApiWriter();
  const { id } = await params;
  await deleteContribution(session.organizationId, id);
  return NextResponse.json({ ok: true });
});
