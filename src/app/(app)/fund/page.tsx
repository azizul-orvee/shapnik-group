import type { Metadata } from "next";
import Link from "next/link";
import { PiggyBank, TrendingUp, Users } from "lucide-react";
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
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Meter, MeterLegend } from "@/components/app/meter";
import { FundGrowthChart } from "@/components/app/fund-growth-chart";
import { requireOrgReader } from "@/lib/session";
import { formatTakaShort } from "@/lib/money";
import { formatDate, formatMonthKey } from "@/lib/dates";
import { getFundGrowth } from "@/server/fund";
import { getSocietyProgress, getSocietySettings } from "@/server/progress";
import { listContributions } from "@/server/contributions";

export const metadata: Metadata = { title: "Fund" };

export default async function FundPage() {
  const session = await requireOrgReader();
  const settings = await getSocietySettings(session.organizationId);
  const year = Number(settings.activeMonthKey.slice(0, 4));

  const [progress, growth, recent] = await Promise.all([
    getSocietyProgress(session.organizationId, year),
    getFundGrowth(session.organizationId, 12, settings),
    listContributions(session.organizationId, { take: 40 }),
  ]);

  const segments = [
    { label: "Monthly savings", value: progress.monthlyCollected, tone: "monthly" as const },
    { label: "One-time fee", value: progress.oneTimeCollected, tone: "onetime" as const },
  ];
  const balance = growth.at(-1)?.balance ?? progress.totalCollected;

  return (
    <>
      <PageHeader
        title="Fund"
        description="Everything the society has collected."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/contributions">By month</Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Total fund"
          value={formatTakaShort(balance)}
          hint="All contributions received"
          icon={PiggyBank}
        />
        <StatCard
          label={`Collected in ${year}`}
          value={formatTakaShort(progress.totalCollected)}
          hint={`${Math.round(progress.completion * 100)}% of target`}
          icon={TrendingUp}
          tone="positive"
        />
        <StatCard
          label="Contributing members"
          value={String(progress.memberCount)}
          hint={`${formatTakaShort(progress.plan.annualTarget)} each per year`}
          icon={Users}
        />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">{year} target</CardTitle>
          <CardDescription>
            {formatTakaShort(progress.totalCollected)} of{" "}
            {formatTakaShort(progress.totalTarget)} collected.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Meter height="lg" target={progress.totalTarget} segments={segments} />
          <MeterLegend segments={segments} />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Fund growth</CardTitle>
          <CardDescription>Total held at the end of each of the last 12 months.</CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-4">
          <FundGrowthChart data={growth} />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Recent payments</CardTitle>
          <CardDescription>The last {recent.length} payments received.</CardDescription>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <EmptyState
              title="Nothing collected yet"
              description="Payments recorded by the treasurer will appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Date</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead className="hidden sm:table-cell">Covers</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {formatDate(row.paidOnDate)}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/members/${row.member.id}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {row.member.name}
                        </Link>
                        <span className="text-muted-foreground block font-mono text-xs">
                          {row.member.memberId}
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="flex items-center gap-2 text-sm">
                          <span
                            className={
                              row.type === "ONE_TIME"
                                ? "bg-viz-onetime size-2 shrink-0 rounded-full"
                                : "bg-viz-monthly size-2 shrink-0 rounded-full"
                            }
                            aria-hidden
                          />
                          {row.paidForMonth
                            ? formatMonthKey(
                                `${row.paidForMonth.getUTCFullYear()}-${String(
                                  row.paidForMonth.getUTCMonth() + 1,
                                ).padStart(2, "0")}`,
                              )
                            : "One-time fee"}
                        </span>
                      </TableCell>
                      <TableCell className="text-viz-good text-right font-medium tabular-nums">
                        +{formatTakaShort(row.amount)}
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
