import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { requireWriter } from "@/lib/session";
import { listMembers } from "@/server/members";
import { currentMonthKey } from "@/lib/dates";
import { getSocietySettings } from "@/server/progress";
import { ContributionForm } from "../contribution-form";

export const metadata: Metadata = { title: "Log a payment" };

export default async function NewContributionPage({
  searchParams,
}: PageProps<"/contributions/new">) {
  const session = await requireWriter();
  const params = await searchParams;
  const preselected = typeof params.memberId === "string" ? params.memberId : "";

  const [members, settings] = await Promise.all([
    listMembers(session.organizationId, { status: "ACTIVE" }),
    getSocietySettings(session.organizationId),
  ]);

  return (
    <>
      <PageHeader
        title="Log a payment"
        description="Record a contribution the member has already handed over."
      />
      <ContributionForm
        members={members.map((m) => ({ id: m.id, name: m.name, memberId: m.memberId }))}
        settings={settings}
        defaultValues={{
          memberId: preselected,
          type: "MONTHLY",
          amount: settings.monthlyAmount,
          paidForMonth: settings.activeMonthKey,
          paidOnDate: new Date().toISOString().slice(0, 10),
          note: "",
        }}
      />
    </>
  );
}
