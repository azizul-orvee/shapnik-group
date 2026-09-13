import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { requireWriter } from "@/lib/session";
import { findMember } from "@/server/members";
import { getYearObligation } from "@/server/contributions";
import { getSocietySettings } from "@/server/progress";
import { dhakaDateKey } from "@/lib/dates";
import { InitialPaymentsForm } from "./initial-payments-form";

export const metadata: Metadata = { title: "Record payments" };

export default async function MemberSetupPage({ params }: PageProps<"/members/[id]/setup">) {
  const session = await requireWriter();
  const { id } = await params;
  const member = await findMember(session.organizationId, id);
  if (!member) notFound();

  const settings = await getSocietySettings(session.organizationId);
  const year = Number(settings.activeMonthKey.slice(0, 4));
  const obligation = await getYearObligation(session.organizationId, member.id, year);

  return (
    <>
      <PageHeader
        title={`Record ${year} payments`}
        description={`${member.name} · ${member.memberId}`}
      />
      <InitialPaymentsForm
        memberId={member.id}
        year={year}
        monthlyAmount={obligation.monthlyAmount}
        oneTimeFee={obligation.oneTimeFee}
        oneTimePaid={obligation.oneTimePaid}
        unpaidMonths={obligation.unpaidMonths}
        today={dhakaDateKey()}
      />
    </>
  );
}
