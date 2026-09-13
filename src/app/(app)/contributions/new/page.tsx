import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { requireWriter } from "@/lib/session";
import { listMembers } from "@/server/members";
import { getSocietySettings } from "@/server/progress";
import { listYearPlans, planForMonthKey } from "@/server/years";
import { ContributionForm } from "../contribution-form";

export const metadata: Metadata = { title: "Log a payment" };

export default async function NewContributionPage({
  searchParams,
}: PageProps<"/contributions/new">) {
  const session = await requireWriter();
  const params = await searchParams;
  const preselected = typeof params.memberId === "string" ? params.memberId : "";

  const [members, settings, plans] = await Promise.all([
    listMembers(session.organizationId),
    getSocietySettings(session.organizationId),
    listYearPlans(session.organizationId),
  ]);

  const activePlan = planForMonthKey(plans, settings.activeMonthKey) ?? plans[0];

  return (
    <>
      <PageHeader
        title="Log a payment"
        description="Record a contribution the member has already handed over."
      />
      <ContributionForm
        members={members.map((m) => ({ id: m.id, name: m.name, memberId: m.memberId }))}
        plans={plans}
        window={{ startMonthKey: settings.startMonthKey, endMonthKey: settings.endMonthKey }}
        defaultValues={{
          memberId: preselected,
          type: "MONTHLY",
          amount: activePlan?.monthlyAmount ?? 0,
          paidForMonth: settings.activeMonthKey,
          paidForYear: Number(settings.activeMonthKey.slice(0, 4)),
          paidOnDate: new Date().toISOString().slice(0, 10),
          note: "",
        }}
      />
    </>
  );
}
