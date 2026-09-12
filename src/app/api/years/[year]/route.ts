import { NextResponse } from "next/server";
import { handler, parseBody, requireApiAdmin } from "@/lib/api";
import { yearPlanUpdateSchema } from "@/lib/validation";
import { deleteYearPlan, updateYearPlan } from "@/server/years";

type Context = { params: Promise<{ year: string }> };

export const PATCH = handler(async (request: Request, { params }: Context) => {
  const session = await requireApiAdmin();
  const year = Number((await params).year);
  if (!Number.isInteger(year)) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  const input = await parseBody(request, yearPlanUpdateSchema);
  const plan = await updateYearPlan(session.organizationId, year, input);
  return NextResponse.json({ year: plan });
});

export const DELETE = handler(async (_request: Request, { params }: Context) => {
  const session = await requireApiAdmin();
  const year = Number((await params).year);
  if (!Number.isInteger(year)) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  await deleteYearPlan(session.organizationId, year);
  return NextResponse.json({ ok: true });
});
