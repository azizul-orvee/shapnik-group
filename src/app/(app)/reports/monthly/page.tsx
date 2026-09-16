import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/app/page-header";
import { BRAND_NAME } from "@/lib/brand";
import { DesktopTable, MobileList, MobileListItem } from "@/components/app/mobile-list";
import { MonthPicker } from "@/components/app/month-picker";
import { StatCard } from "@/components/app/stat-card";
import { PaidBadge } from "@/components/app/member-badges";
import { requireOrgReader } from "@/lib/session";
import { formatTakaShort } from "@/lib/money";
import { formatMonthKey } from "@/lib/dates";
import { buildMonthlySummary } from "@/server/reports";
import { resolveMonth } from "@/server/progress";

export const metadata: Metadata = { title: "Monthly summary" };

export default async function MonthlyReportPage({ searchParams }: PageProps<"/reports/monthly">) {
  const session = await requireOrgReader();
  const params = await searchParams;
  const { settings, monthKey } = await resolveMonth(
    session.organizationId,
    typeof params.month === "string" ? params.month : undefined,
  );

  const summary = await buildMonthlySummary(session.organizationId, monthKey);
  const { dues, movement } = summary;
  const ratePct = Math.round(dues.collectionRate * 100);

  return (
    <>
      <PageHeader
        title="Monthly collection summary"
        description={BRAND_NAME}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/reports">All reports</Link>
          </Button>
        }
      />

      <div className="mb-4">
        <MonthPicker
          monthKey={monthKey}
          startMonthKey={settings.startMonthKey}
          endMonthKey={settings.endMonthKey}
        />
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">{formatMonthKey(monthKey)}</CardTitle>
          <CardDescription>
            {dues.paidCount}/{dues.dueCount} members paid · {dues.pendingCount} pending ·{" "}
            {formatTakaShort(dues.collected)} collected for this month.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
          <StatCard label="Members due" value={String(dues.dueCount)} />
          <StatCard label="Paid" value={String(dues.paidCount)} hint={`${ratePct}%`} tone="positive" />
          <StatCard
            label="Pending"
            value={String(dues.pendingCount)}
            tone={dues.pendingCount > 0 ? "negative" : "default"}
          />
          <StatCard label="Collected for month" value={formatTakaShort(dues.collected)} />
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Cash movement in {formatMonthKey(monthKey)}</CardTitle>
          <CardDescription>
            All money that entered or left the fund during the calendar month — including late
            payments for earlier months.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Received" value={formatTakaShort(movement.totalIn)} tone="positive" />
          <StatCard label="Spent" value={formatTakaShort(movement.totalOut)} tone="negative" />
          <StatCard label="Net" value={formatTakaShort(movement.balance)} />
        </CardContent>
      </Card>

      <MobileList>
        {dues.rows.map((row) => (
          <MobileListItem
            key={row.memberId}
            title={row.name}
            subtitle={<span className="font-mono">{row.memberCode}</span>}
            trailing={
              <div className="flex flex-col items-end gap-1">
                <span className="font-medium tabular-nums">
                  {row.amount === null ? "—" : formatTakaShort(row.amount)}
                </span>
                <PaidBadge paid={row.paid} />
              </div>
            }
          />
        ))}
      </MobileList>
      <DesktopTable>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">ID</TableHead>
              <TableHead>Member</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dues.rows.map((row) => (
              <TableRow key={row.memberId}>
                <TableCell className="font-mono text-xs">{row.memberCode}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.amount === null ? "—" : formatTakaShort(row.amount)}
                </TableCell>
                <TableCell className="text-right">
                  <PaidBadge paid={row.paid} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DesktopTable>
    </>
  );
}
