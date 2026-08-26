import type { Metadata } from "next";
import { Download } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { Meter, MeterLegend, ProgressRing } from "@/components/app/meter";
import { MonthGrid, MonthGridLegend } from "@/components/app/month-grid";
import { PaceChart } from "@/components/app/pace-chart";
import { requireSession } from "@/lib/session";
import { formatTakaShort } from "@/lib/money";
import { formatDate, formatMonthKey } from "@/lib/dates";
import { buildMemberStatement } from "@/server/reports";
import {
  getMemberCumulative,
  getMemberProgress,
  getSocietySettings,
} from "@/server/progress";

export const metadata: Metadata = { title: "My statement" };

export default async function MyStatementPage() {
  const session = await requireSession();
  const settings = await getSocietySettings(session.organizationId);
  const year = Number(settings.activeMonthKey.slice(0, 4));

  if (!session.memberId) {
    return (
      <>
        <PageHeader title="My statement" />
        <EmptyState
          title="Your login is not linked to a member record"
          description="Ask the treasurer to link your account so your contribution history appears here."
        />
      </>
    );
  }

  const [statement, progress, pace] = await Promise.all([
    buildMemberStatement(session.organizationId, session.memberId),
    getMemberProgress(session.organizationId, session.memberId, year),
    getMemberCumulative(session.organizationId, session.memberId, year),
  ]);

  if (!progress) {
    return (
      <>
        <PageHeader title="My statement" />
        <EmptyState title="Member record not found" />
      </>
    );
  }

  const pct = Math.round(progress.completion * 100);
  const remaining = Math.max(0, progress.totalTarget - progress.totalPaid);
  const segments = [
    { label: "Monthly savings", value: progress.monthlyPaid, tone: "monthly" as const },
    { label: "One-time fee", value: progress.oneTimePaid, tone: "onetime" as const },
  ];

  return (
    <>
      <PageHeader
        title="My statement"
        description={`${progress.name} · ${progress.memberCode}`}
        action={
          <Button asChild size="sm" variant="outline">
            <a href={`/api/reports/members/${progress.memberId}/pdf`}>
              <Download className="size-4" />
              Download PDF
            </a>
          </Button>
        }
      />

      {/* Hero — how far through the year's obligation this member is. */}
      <Card className="mb-4">
        <CardContent className="flex flex-col gap-6 px-4 py-2 sm:flex-row sm:items-center sm:gap-8">
          <ProgressRing
            value={progress.completion}
            label={`${pct}%`}
            sublabel={`of ${year} target`}
            tone={progress.completion >= 1 ? "good" : progress.onTrack ? "monthly" : "warning"}
          />

          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Paid this year
              </p>
              <p className="mt-1 text-3xl font-semibold sm:text-4xl">
                {formatTakaShort(progress.totalPaid)}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                of {formatTakaShort(progress.totalTarget)} for {year}
                {remaining > 0 ? ` · ${formatTakaShort(remaining)} still to pay` : " · all settled"}
              </p>
            </div>

            <Meter height="lg" target={progress.totalTarget} segments={segments} />
            <MeterLegend segments={segments} />

            <Badge
              variant={progress.onTrack ? "secondary" : "destructive"}
              className={progress.onTrack ? "bg-viz-good/12 text-viz-good" : undefined}
            >
              {progress.completion >= 1
                ? `Fully paid for ${year}`
                : progress.onTrack
                  ? progress.varianceToDate > 0
                    ? `Ahead by ${formatTakaShort(progress.varianceToDate)}`
                    : "On track"
                  : `Behind by ${formatTakaShort(Math.abs(progress.varianceToDate))}`}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* The two obligations, each with its own meter. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 px-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Monthly savings
              </p>
              <span className="text-muted-foreground text-xs tabular-nums">
                {progress.monthsPaid}/12 months
              </span>
            </div>
            <p className="text-2xl font-semibold">{formatTakaShort(progress.monthlyPaid)}</p>
            <Meter
              target={progress.monthlyTarget}
              segments={[{ label: "Monthly", value: progress.monthlyPaid, tone: "monthly" }]}
            />
            <p className="text-muted-foreground text-xs">
              of {formatTakaShort(progress.monthlyTarget)} ·{" "}
              {formatTakaShort(progress.monthlyTarget / 12)} per month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 px-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                One-time fee
              </p>
              <span className="text-muted-foreground text-xs">
                {progress.oneTimePaid >= progress.oneTimeFee ? "Cleared" : "Outstanding"}
              </span>
            </div>
            <p className="text-2xl font-semibold">{formatTakaShort(progress.oneTimePaid)}</p>
            <Meter
              target={progress.oneTimeFee}
              segments={[{ label: "One-time fee", value: progress.oneTimePaid, tone: "onetime" }]}
            />
            <p className="text-muted-foreground text-xs">
              of {formatTakaShort(progress.oneTimeFee)}
              {progress.oneTimePaid < progress.oneTimeFee
                ? ` · ${formatTakaShort(progress.oneTimeFee - progress.oneTimePaid)} left`
                : " · paid in full"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Month by month</CardTitle>
          <CardDescription>Which months of {year} are settled.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <MonthGrid paidMonths={progress.paidMonths} year={year} />
          <MonthGridLegend />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Paid against target pace</CardTitle>
          <CardDescription>
            Your running total against what you owe as the year goes on — the fee up
            front, then {formatTakaShort(progress.monthlyTarget / 12)} a month, reaching{" "}
            {formatTakaShort(progress.totalTarget)} in December.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-4">
          <PaceChart data={pace} />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Payment history</CardTitle>
          <CardDescription>Every payment recorded against your name.</CardDescription>
        </CardHeader>
        <CardContent>
          {statement.rows.length === 0 ? (
            <EmptyState
              title="No contributions recorded yet"
              description="Once the treasurer logs your payments they will show up here."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Covers</TableHead>
                    <TableHead className="hidden sm:table-cell">Paid on</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...statement.rows].reverse().map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          <span
                            className={
                              row.type === "ONE_TIME"
                                ? "bg-viz-onetime size-2 shrink-0 rounded-full"
                                : "bg-viz-monthly size-2 shrink-0 rounded-full"
                            }
                            aria-hidden
                          />
                          {row.monthKey ? formatMonthKey(row.monthKey) : "One-time fee"}
                        </span>
                        <span className="text-muted-foreground block text-xs sm:hidden">
                          Paid {formatDate(row.paidOnDate)}
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {formatDate(row.paidOnDate)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatTakaShort(row.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
