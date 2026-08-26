import { NextResponse } from "next/server";
import { handler, parseBody, requireApiOrgReader, requireApiWriter } from "@/lib/api";
import { contributionCreateSchema } from "@/lib/validation";
import { createContribution, listContributions } from "@/server/contributions";

export const GET = handler(async (request: Request) => {
  const session = await requireApiOrgReader();
  const { searchParams } = new URL(request.url);
  const contributions = await listContributions(session.organizationId, {
    monthKey: searchParams.get("month") ?? undefined,
    memberId: searchParams.get("memberId") ?? undefined,
    take: Number(searchParams.get("take")) || undefined,
  });
  return NextResponse.json({ contributions });
});

export const POST = handler(async (request: Request) => {
  const session = await requireApiWriter();
  const input = await parseBody(request, contributionCreateSchema);
  const contribution = await createContribution(session.organizationId, session.userId, input);
  return NextResponse.json({ contribution }, { status: 201 });
});
