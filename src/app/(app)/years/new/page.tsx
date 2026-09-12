import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { requireAdmin } from "@/lib/session";
import { listYearPlans } from "@/server/years";
import { YearPlanForm } from "../year-form";

export const metadata: Metadata = { title: "Add a year" };

export default async function NewYearPage() {
  const session = await requireAdmin();
  const plans = await listYearPlans(session.organizationId);
  const latest = plans[0];
  const year = (latest?.year ?? 2026) + 1;
  const monthlyAmount = latest?.monthlyAmount ?? 6000;
  const oneTimeFee = latest?.oneTimeFee ?? 28000;

  return (
    <>
      <PageHeader
        title={`Add ${year}`}
        description="Set the monthly contribution and one-time fee for this year. You can change them later."
      />
      <YearPlanForm
        mode="create"
        defaultValues={{
          year,
          monthlyAmount,
          oneTimeFee,
          startMonth: `${year}-01`,
          endMonth: `${year}-12`,
        }}
      />
    </>
  );
}
