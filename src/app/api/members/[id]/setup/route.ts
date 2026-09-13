import { NextResponse } from "next/server";
import { handler, parseBody, requireApiWriter } from "@/lib/api";
import { initialSetupSchema } from "@/lib/validation";
import { recordInitialSetup } from "@/server/contributions";

type Context = { params: Promise<{ id: string }> };

export const POST = handler(async (request: Request, { params }: Context) => {
  const session = await requireApiWriter();
  const { id } = await params;
  const input = await parseBody(request, initialSetupSchema);
  const result = await recordInitialSetup(session.organizationId, session.userId, id, input);
  return NextResponse.json(result, { status: 201 });
});
