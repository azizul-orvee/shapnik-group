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
import { DesktopTable, MobileList } from "@/components/app/mobile-list";
import { Meter, MeterLegend, ProgressRing } from "@/components/app/meter";
import { MonthGrid, MonthGridLegend } from "@/components/app/month-grid";
import { requireSession } from "@/lib/session";
import { formatTakaShort } from "@/lib/money";
import { formatDate, formatMonthKey } from "@/lib/dates";
import { buildMemberStatement } from "@/server/reports";
import { getMemberProgress, getSocietyProgress, resolveYear } from "@/server/progress";
import { getYearObligation } from "@/server/contributions";
import { getFundTotals } from "@/server/fund";
import { YearTabs } from "@/components/app/year-tabs";

export const metadata: Metadata = { title: "My statement" };

export default async function MyStatementPage({ searchParams }: PageProps<"/my-statement">) {
  const session = await requireSession();
  const params = await searchParams;
  const { settings, year, plan } = await resolveYear(
    session.organizationId,
    typeof params.year === "string" ? params.year : undefined,
  );

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

  const [statement, progress, obligation, society, fund] = await Promise.all([
    buildMemberStatement(session.organizationId, session.memberId),
    getMemberProgress(session.organizationId, session.memberId, year),
    getYearObligation(session.organizationId, session.memberId, year),
    // Society-wide figures shown to members are aggregates only — never another
    // member's name, balance or standing.
    getSocietyProgress(session.organizationId, year),
    getFundTotals(session.organizationId),
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
  const yearRows = statement.rows.filter((row) => row.paidForYear === year);
  const feeLeft = Math.max(0, progress.oneTimeFee - progress.oneTimePaid);
  // The next few months to settle, so the card stays a short list rather than
  // a wall of twelve.
  const nextMonths = obligation.unpaidMonths.slice(0, 3);
  const moreMonths = obligation.unpaidMonths.length - nextMonths.length;
  const hasPartialMonth = progress.partialMonths.some(Boolean);
  const societyPct = Math.round(society.completion * 100);
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

      <div className="mb-4">
        <YearTabs
          years={[...settings.years].sort((a, b) => a - b)}
          year={year}
          hrefFor={(y) => `/my-statement?year=${y}`}
        />
      </div>

      {/* Hero — how far through the year's obligation this member is. */}
      <Card className="bg-brand-wash ring-brand/15 mb-4">
        <CardContent className="flex flex-row items-center gap-4 px-4 py-4 sm:gap-8">
          <ProgressRing
            value={progress.completion}
            label={`${pct}%`}
            sublabel={`of ${year} target`}
            tone={progress.completion >= 1 ? "good" : progress.onTrack ? "monthly" : "warning"}
            size={108}
          />

          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Paid this year
              </p>
              <p className="font-heading mt-1 text-[1.85rem] leading-none font-bold tracking-tight tabular-nums sm:text-5xl">
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

      {/* Lifetime context — members ask "how much have I saved altogether?", and
          a single year's card cannot answer it. */}
      <Card className="mb-4">
        <CardContent className="grid grid-cols-3 gap-3 px-4 py-1">
          <div className="min-w-0">
            <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              Lifetime
            </p>
            <p className="font-heading mt-1 text-base leading-tight font-semibold tabular-nums sm:text-xl">
              {formatTakaShort(statement.total)}
            </p>
            <p className="text-muted-foreground mt-0.5 text-[11px]">All years</p>
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              Months
            </p>
            <p className="font-heading mt-1 text-base leading-tight font-semibold tabular-nums sm:text-xl">
              {statement.monthsPaid}
            </p>
            <p className="text-muted-foreground mt-0.5 text-[11px]">Settled</p>
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              Since
            </p>
            <p className="font-heading mt-1 text-base leading-tight font-semibold tabular-nums sm:text-xl">
              {formatDate(progress.joinDate)}
            </p>
            <p className="text-muted-foreground mt-0.5 font-mono text-[11px]">{progress.memberCode}</p>
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
                {progress.monthsPaid}/{progress.monthCount} months
              </span>
            </div>
            <p className="text-2xl font-semibold">{formatTakaShort(progress.monthlyPaid)}</p>
            <Meter
              target={progress.monthlyTarget}
              segments={[{ label: "Monthly", value: progress.monthlyPaid, tone: "monthly" }]}
            />
            <p className="text-muted-foreground text-xs">
              of {formatTakaShort(progress.monthlyTarget)} ·{" "}
              {formatTakaShort(progress.monthlyAmount)} per month
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

      {/* The one actionable thing on this page: what is left, and how to clear it. */}
      {obligation.outstanding > 0 ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">What to pay next</CardTitle>
            <CardDescription>
              {formatTakaShort(obligation.outstanding)} left for {year}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="divide-y rounded-md border text-sm">
              {feeLeft > 0 ? (
                <li className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="flex items-center gap-2">
                    <span className="bg-viz-onetime size-2 shrink-0 rounded-full" aria-hidden />
                    One-time fee {year}
                    {progress.oneTimePaid > 0 ? (
                      <span className="text-muted-foreground text-xs">
                        part paid — {formatTakaShort(progress.oneTimePaid)} in
                      </span>
                    ) : null}
                  </span>
                  <span className="font-medium tabular-nums">{formatTakaShort(feeLeft)}</span>
                </li>
              ) : null}
              {/* Months already part paid come first — they are the oldest debt. */}
              {obligation.shortMonths.map((month) => (
                <li
                  key={month.monthKey}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <span className="flex items-center gap-2">
                    <span className="bg-viz-warning size-2 shrink-0 rounded-full" aria-hidden />
                    {formatMonthKey(month.monthKey)}
                    <span className="text-muted-foreground text-xs">to top up</span>
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatTakaShort(month.shortfall)}
                  </span>
                </li>
              ))}
              {nextMonths.map((monthKey) => (
                <li
                  key={monthKey}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <span className="flex items-center gap-2">
                    <span className="bg-viz-monthly size-2 shrink-0 rounded-full" aria-hidden />
                    {formatMonthKey(monthKey)}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatTakaShort(progress.monthlyAmount)}
                  </span>
                </li>
              ))}
              {moreMonths > 0 ? (
                <li className="text-muted-foreground px-3 py-2 text-xs">
                  and {moreMonths} more month{moreMonths === 1 ? "" : "s"} after that
                </li>
              ) : null}
            </ul>
            <p className="text-muted-foreground text-xs">
              You do not have to pay month by month. Hand over any amount at any time
              and the treasurer records it against your fee first, then your earliest
              unpaid months.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Month by month</CardTitle>
          <CardDescription>Which months of {year} are settled.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <MonthGrid
            paidMonths={progress.paidMonths}
            partialMonths={progress.partialMonths}
            inSeason={progress.inSeason}
            year={year}
          />
          <MonthGridLegend showPartial={hasPartialMonth} />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Payment history</CardTitle>
          <CardDescription>Payments that count toward {year}.</CardDescription>
        </CardHeader>
        <CardContent>
          {yearRows.length === 0 ? (
            <EmptyState
              title={`No ${year} payments recorded yet`}
              description="Once the treasurer logs your payments they will show up here."
            />
          ) : (
            <>
              <MobileList className="ring-0">
                {[...yearRows].reverse().map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 px-0 py-3">
                    <div className="min-w-0">
                      <span className="flex items-center gap-2 font-medium">
                        <span
                          className={
                            row.type === "ONE_TIME"
                              ? "bg-viz-onetime size-2 shrink-0 rounded-full"
                              : "bg-viz-monthly size-2 shrink-0 rounded-full"
                          }
                          aria-hidden
                        />
                        {row.monthKey ? formatMonthKey(row.monthKey) : `One-time fee ${year}`}
                      </span>
                      <span className="text-muted-foreground mt-0.5 block pl-4 text-xs">
                        {formatDate(row.paidOnDate)}
                      </span>
                    </div>
                    <span className="font-heading shrink-0 text-base font-semibold tabular-nums">
                      {formatTakaShort(row.amount)}
                    </span>
                  </li>
                ))}
              </MobileList>
              <DesktopTable className="border-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Covers</TableHead>
                      <TableHead>Paid on</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...yearRows].reverse().map((row) => (
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
                            {row.monthKey ? formatMonthKey(row.monthKey) : `One-time fee ${year}`}
                          </span>
                        </TableCell>
                        <TableCell>{formatDate(row.paidOnDate)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatTakaShort(row.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </DesktopTable>
            </>
          )}
        </CardContent>
      </Card>

      {/* Aggregates only — members see how the society is doing, never who is
          behind or what anyone else has paid. */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">The society in {year}</CardTitle>
          <CardDescription>
            How {statement.organization.name} is doing overall. No individual
            member&rsquo;s figures are shown here.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-3">
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Members
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{society.memberCount}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {society.fullyPaid} fully paid for {year}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Collected in {year}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {formatTakaShort(society.totalCollected)}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {societyPct}% of the {formatTakaShort(society.totalTarget)} target
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Total fund
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {formatTakaShort(fund.balance)}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Everything collected since the society opened
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Members rarely know the arithmetic behind their own target. */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">How your {year} target is worked out</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y text-sm">
            <div className="flex items-center justify-between gap-3 py-2">
              <dt className="text-muted-foreground">
                Monthly contribution · {formatTakaShort(plan.monthlyAmount)} ×{" "}
                {plan.monthCount} month{plan.monthCount === 1 ? "" : "s"}
              </dt>
              <dd className="font-medium tabular-nums">
                {formatTakaShort(plan.monthlyTarget)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2">
              <dt className="text-muted-foreground">One-time fee for {year}</dt>
              <dd className="font-medium tabular-nums">{formatTakaShort(plan.oneTimeFee)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2">
              <dt className="font-medium">Your total for {year}</dt>
              <dd className="font-semibold tabular-nums">
                {formatTakaShort(plan.annualTarget)}
              </dd>
            </div>
          </dl>
          <p className="text-muted-foreground mt-3 text-xs">
            {year} runs from {formatMonthKey(plan.startMonthKey)} to{" "}
            {formatMonthKey(plan.endMonthKey)}. The fee is due from the start of the
            year and can be paid in instalments.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
