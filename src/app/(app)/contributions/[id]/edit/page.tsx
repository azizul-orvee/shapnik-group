import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { requireWriter } from "@/lib/session";
import { dateToMonthKey, formatMonthKey } from "@/lib/dates";
import { formatMemberCode } from "@/lib/member-id";
import { getContribution } from "@/server/contributions";
import { getSocietySettings } from "@/server/progress";
import { listYearPlans } from "@/server/years";
import { EditContributionForm } from "./edit-contribution-form";

export const metadata: Metadata = { title: "Correct a payment" };

/** Only same-site paths, so `?back=` cannot send the admin somewhere else. */
function safeReturn(value: unknown, fallback: string): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : fallback;
}

export default async function EditContributionPage({
  params,
  searchParams,
}: PageProps<"/contributions/[id]/edit">) {
  const session = await requireWriter();
  const { id } = await params;
  const query = await searchParams;

  const [contribution, settings, plans] = await Promise.all([
    getContribution(session.organizationId, id),
    getSocietySettings(session.organizationId),
    listYearPlans(session.organizationId),
  ]);
  if (!contribution) notFound();

  const monthKey = contribution.paidForMonth ? dateToMonthKey(contribution.paidForMonth) : undefined;
  const returnHref = safeReturn(
    query.back,
    monthKey ? `/contributions?month=${monthKey}` : `/members/${contribution.member.id}`,
  );
  const covers = monthKey
    ? `${formatMonthKey(monthKey)} monthly contribution`
    : `${contribution.paidForYear} one-time fee`;

  return (
    <>
      <PageHeader
        title="Correct a payment"
        description={`${contribution.member.name} (${formatMemberCode(contribution.member.memberId)}) · ${covers}`}
      />
      <EditContributionForm
        contributionId={contribution.id}
        type={contribution.type}
        recordedAmount={contribution.amount.toNumber()}
        plans={plans}
        window={{ startMonthKey: settings.startMonthKey, endMonthKey: settings.endMonthKey }}
        returnHref={returnHref}
        defaultValues={{
          amount: contribution.amount.toNumber(),
          paidOnDate: contribution.paidOnDate.toISOString().slice(0, 10),
          note: contribution.note ?? "",
          ...(monthKey ? { paidForMonth: monthKey } : { paidForYear: contribution.paidForYear }),
        }}
      />
    </>
  );
}
