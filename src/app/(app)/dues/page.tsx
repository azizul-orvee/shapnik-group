import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { MonthPicker } from "@/components/app/month-picker";
import { StatCard } from "@/components/app/stat-card";
import { requireOrgReader } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { formatTakaShort } from "@/lib/money";
import { formatMonthKey } from "@/lib/dates";
import { getDuesForMonth } from "@/server/contributions";
import { resolveMonth } from "@/server/progress";
import { QuickCollect } from "./quick-collect";
import { DuesTable } from "./dues-table";

export const metadata: Metadata = { title: "Dues" };

export default async function DuesPage({ searchParams }: PageProps<"/dues">) {
  const session = await requireOrgReader();
  const params = await searchParams;
  const { settings, monthKey } = await resolveMonth(
    session.organizationId,
    typeof params.month === "string" ? params.month : undefined,
  );
  const showOnly = params.show === "pending" ? "pending" : params.show === "paid" ? "paid" : "all";

  const dues = await getDuesForMonth(session.organizationId, monthKey);
  const writable = canWrite(session.role);

  // The month's own rate — not the last amount collected, which drifts across a
  // rate change and would then be pre-filled wrong for a whole year.
  const suggestedAmount = dues.expectedAmount || null;

  const rows = dues.rows.filter((row) =>
    showOnly === "pending" ? !row.paid : showOnly === "paid" ? row.paid : true,
  );
  const ratePct = Math.round(dues.collectionRate * 100);

  return (
    <>
      <PageHeader
        title="Dues"
        description="Who has paid for the selected month, and who still owes."
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <MonthPicker
          monthKey={monthKey}
          startMonthKey={settings.startMonthKey}
          endMonthKey={settings.endMonthKey}
        />
        {writable ? (
          <QuickCollect
            monthKey={monthKey}
            suggestedAmount={suggestedAmount}
            pending={dues.rows
              .filter((row) => !row.paid)
              .map((row) => ({
                memberId: row.memberId,
                memberCode: row.memberCode,
                name: row.name,
              }))}
          />
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard
          label="Paid"
          value={`${dues.paidCount}/${dues.dueCount}`}
          hint={`${ratePct}% collection rate`}
          tone={dues.pendingCount === 0 ? "positive" : "default"}
        />
        <StatCard
          label={dues.isFuture ? "Not due yet" : "Pending"}
          value={String(dues.isFuture ? dues.notDueYetCount : dues.pendingCount)}
          hint={
            dues.isFuture
              ? "This month has not started"
              : dues.pendingCount === 0
                ? "Everyone is up to date"
                : "Members still to pay"
          }
          tone={!dues.isFuture && dues.pendingCount > 0 ? "negative" : "default"}
        />
        <StatCard label="Collected" value={formatTakaShort(dues.collected)} />
      </div>

      <div className="bg-muted/80 my-4 flex rounded-full p-1">
        {[
          { label: "All", value: "all" },
          {
            label: dues.isFuture
              ? `Not due (${dues.notDueYetCount})`
              : `Pending (${dues.pendingCount})`,
            value: "pending",
          },
          { label: `Paid (${dues.paidCount})`, value: "paid" },
        ].map((tab) => (
          <Link
            key={tab.value}
            href={`/dues?month=${monthKey}&show=${tab.value}`}
            className={`flex min-h-10 flex-1 items-center justify-center rounded-full px-2 text-center text-xs font-medium sm:text-sm ${
              showOnly === tab.value
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground"
            }`}
            aria-current={showOnly === tab.value ? "page" : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {dues.dueCount === 0 ? (
        <EmptyState
          title={`No active members were liable for ${formatMonthKey(monthKey)}`}
          description="Members who joined after this month are not counted as due."
        />
      ) : (
        <DuesTable
          rows={rows}
          monthKey={monthKey}
          expectedAmount={dues.expectedAmount}
          isFuture={dues.isFuture}
          writable={writable}
        />
      )}
    </>
  );
}
