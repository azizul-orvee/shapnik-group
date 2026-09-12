import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { requireAdmin } from "@/lib/session";
import { getYearPlan } from "@/server/years";
import { YearPlanForm } from "../../year-form";

export async function generateMetadata({
  params,
}: PageProps<"/years/[year]/edit">): Promise<Metadata> {
  const { year } = await params;
  return { title: `Edit ${year}` };
}

export default async function EditYearPage({ params }: PageProps<"/years/[year]/edit">) {
  const session = await requireAdmin();
  const { year: raw } = await params;
  const year = Number(raw);
  if (!Number.isInteger(year)) notFound();

  const plan = await getYearPlan(session.organizationId, year);
  if (!plan) notFound();
  if (plan.locked) redirect(`/years/${year}`);

  return (
    <>
      <PageHeader
        title={`Edit ${year}`}
        description="These rates apply to every member for this year."
      />
      <YearPlanForm
        mode="edit"
        defaultValues={{
          year: plan.year,
          monthlyAmount: plan.monthlyAmount,
          oneTimeFee: plan.oneTimeFee,
          startMonth: plan.startMonthKey,
          endMonth: plan.endMonthKey,
        }}
      />
    </>
  );
}
