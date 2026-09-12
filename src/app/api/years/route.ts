import { NextResponse } from "next/server";
import { handler, parseBody, requireApiAdmin } from "@/lib/api";
import { yearPlanSchema } from "@/lib/validation";
import { createYearPlan, listYearPlans } from "@/server/years";

export const GET = handler(async () => {
  const session = await requireApiAdmin();
  const years = await listYearPlans(session.organizationId);
  return NextResponse.json({ years });
});

export const POST = handler(async (request: Request) => {
  const session = await requireApiAdmin();
  const input = await parseBody(request, yearPlanSchema);
  const year = await createYearPlan(session.organizationId, input);
  return NextResponse.json({ year }, { status: 201 });
});
