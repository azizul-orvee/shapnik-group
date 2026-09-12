import { NextResponse } from "next/server";
import { handler, parseBody, requireApiWriter } from "@/lib/api";
import { lumpSumSchema } from "@/lib/validation";
import { recordLumpSum } from "@/server/contributions";

/**
 * One large payment, split across the year's extra fee and its unpaid months.
 * The server recomputes the split rather than trusting the client's preview.
 */
export const POST = handler(async (request: Request) => {
  const session = await requireApiWriter();
  const input = await parseBody(request, lumpSumSchema);
  const result = await recordLumpSum(session.organizationId, session.userId, input);
  return NextResponse.json(result, { status: 201 });
});
