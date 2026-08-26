import { NextResponse } from "next/server";
import { handler, parseBody, requireApiWriter } from "@/lib/api";
import { bulkContributionSchema } from "@/lib/validation";
import { createContributionsBulk } from "@/server/contributions";

/** Log one amount against many members — a collection meeting in a single call. */
export const POST = handler(async (request: Request) => {
  const session = await requireApiWriter();
  const input = await parseBody(request, bulkContributionSchema);
  const result = await createContributionsBulk(session.organizationId, session.userId, input);
  return NextResponse.json(result, { status: 201 });
});
