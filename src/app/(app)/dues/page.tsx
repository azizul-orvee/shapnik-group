import type { Metadata } from "next";
import Link from "next/link";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { MonthPicker } from "@/components/app/month-picker";
import { StatCard } from "@/components/app/stat-card";
import { PaidBadge } from "@/components/app/member-badges";
import { requireOrgReader } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { formatTakaShort } from "@/lib/money";
import { formatDate, formatMonthKey } from "@/lib/dates";
import { getDuesForMonth, listContributions } from "@/server/contributions";
import { resolveMonth } from "@/server/progress";
import { QuickCollect } from "./quick-collect";

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

  // Default the bulk amount to whatever the society most recently collected.
  const recent = await listContributions(session.organizationId, { take: 1 });
  const suggestedAmount = recent[0]?.amount.toNumber() ?? null;

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

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
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

      <div className="grid gap-3 sm:grid-cols-3">
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

      <div className="my-4 flex gap-2">
        {[
          { label: "All", value: "all" },
          {
            label: dues.isFuture
              ? `Not due yet (${dues.notDueYetCount})`
              : `Pending (${dues.pendingCount})`,
            value: "pending",
          },
          { label: `Paid (${dues.paidCount})`, value: "paid" },
        ].map((tab) => (
          <Button
            key={tab.value}
            asChild
            size="sm"
            variant={showOnly === tab.value ? "default" : "outline"}
          >
            <Link href={`/dues?month=${monthKey}&show=${tab.value}`}>{tab.label}</Link>
          </Button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={
            dues.dueCount === 0
              ? `No active members were liable for ${formatMonthKey(monthKey)}`
              : "Nothing to show for this filter"
          }
          description={
            dues.dueCount === 0
              ? "Members who joined after this month are not counted as due."
              : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">ID</TableHead>
                <TableHead>Member</TableHead>
                <TableHead className="hidden sm:table-cell">Paid on</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.memberId}
                  className={row.paid || dues.isFuture ? undefined : "bg-destructive/5"}
                >
                  <TableCell className="font-mono text-xs">{row.memberCode}</TableCell>
                  <TableCell>
                    <Link
                      href={`/members/${row.memberId}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {row.name}
                    </Link>
                    {!row.paid && !dues.isFuture && row.phone ? (
                      <a
                        href={`tel:${row.phone}`}
                        className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs"
                      >
                        <Phone className="size-3" />
                        {row.phone}
                      </a>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {row.paidOnDate ? formatDate(row.paidOnDate) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.amount === null ? "—" : formatTakaShort(row.amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <PaidBadge
                      paid={row.paid}
                      isFuture={dues.isFuture}
                      paidInAdvance={row.paidInAdvance}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
