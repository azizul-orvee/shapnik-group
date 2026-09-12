import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, CircleAlert, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Meter, MeterLegend, ProgressRing } from "@/components/app/meter";
import { CollectionChart } from "@/components/app/collection-chart";
import { MemberProgressList } from "@/components/app/member-progress-list";
import { requireOrgReader } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { formatTakaShort } from "@/lib/money";
import { formatMonthKey } from "@/lib/dates";
import { getDuesForMonth } from "@/server/contributions";
import { getMonthlyBreakdown, getSocietyProgress, getSocietySettings } from "@/server/progress";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await requireOrgReader();
  const settings = await getSocietySettings(session.organizationId);
  const year = Number(settings.activeMonthKey.slice(0, 4));
  const monthKey = settings.activeMonthKey;

  const [progress, months, dues] = await Promise.all([
    getSocietyProgress(session.organizationId, year),
    getMonthlyBreakdown(session.organizationId, year),
    getDuesForMonth(session.organizationId, monthKey),
  ]);

  const monthRatePct = Math.round(dues.collectionRate * 100);
  const yearPct = Math.round(progress.completion * 100);

  // Furthest behind first — this is the treasurer's chase list.
  const chaseList = [...progress.rows]
    .sort((a, b) => a.varianceToDate - b.varianceToDate)
    .slice(0, 8);

  const societySegments = [
    { label: "Monthly savings", value: progress.monthlyCollected, tone: "monthly" as const },
    { label: "One-time fee", value: progress.oneTimeCollected, tone: "onetime" as const },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Member progress for ${year}.`}
        action={
          canWrite(session.role) ? (
            <Button asChild size="sm">
              <Link href="/contributions/new">Log a payment</Link>
            </Button>
          ) : null
        }
      />

      {/* Hero — the one number the society leads with. */}
      <Card className="bg-brand-wash ring-brand/15 mb-4 overflow-hidden">
        <CardContent className="flex flex-col gap-6 px-4 py-3 sm:flex-row sm:items-center sm:gap-8">
          <ProgressRing
            value={progress.completion}
            label={`${yearPct}%`}
            sublabel={`of ${year} target`}
            tone={progress.completion >= 0.75 ? "good" : "monthly"}
          />

          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Collected this year
              </p>
              <p className="font-heading mt-1 text-[2.1rem] leading-none font-bold tracking-tight tabular-nums sm:text-5xl">
                {formatTakaShort(progress.totalCollected)}
              </p>
              <p className="text-muted-foreground mt-2 text-sm">
                of {formatTakaShort(progress.totalTarget)} target ·{" "}
                {progress.memberCount} members × {formatTakaShort(progress.plan.annualTarget)}
              </p>
            </div>

            <Meter height="lg" target={progress.totalTarget} segments={societySegments} />
            <MeterLegend segments={societySegments} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={`${formatMonthKey(monthKey)} paid`}
          value={`${dues.paidCount}/${dues.dueCount}`}
          hint={`${monthRatePct}% of members`}
          icon={TrendingUp}
          tone={dues.pendingCount === 0 ? "positive" : "default"}
        />
        <StatCard
          label="Pending this month"
          value={String(dues.pendingCount)}
          hint={dues.pendingCount === 0 ? "Everyone is up to date" : "Members still to pay"}
          icon={CircleAlert}
          tone={dues.pendingCount > 0 ? "negative" : "default"}
        />
        <StatCard
          label="Fully paid up"
          value={`${progress.fullyPaid}/${progress.memberCount}`}
          hint={`Cleared all ${formatTakaShort(progress.plan.annualTarget)}`}
          icon={CheckCircle2}
          tone={progress.fullyPaid > 0 ? "positive" : "default"}
        />
        <StatCard
          label="Behind schedule"
          value={String(progress.behind)}
          hint="Short of what is owed today"
          icon={Users}
          tone={progress.behind > 0 ? "negative" : "positive"}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Members paid each month</CardTitle>
            <CardDescription>
              How many of the {progress.memberCount} active members have settled each month of{" "}
              {year}.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-4">
            <CollectionChart data={months} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">One-time fee</CardTitle>
            <CardDescription>
              {formatTakaShort(progress.plan.oneTimeFee)} owed this year per member.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-4">
              <ProgressRing
                size={104}
                value={progress.oneTimeSettled / Math.max(1, progress.memberCount)}
                label={`${progress.oneTimeSettled}`}
                sublabel={`of ${progress.memberCount}`}
                tone="onetime"
              />
              <div className="min-w-0 text-sm">
                <p className="text-muted-foreground">Members who have cleared it</p>
                <p className="mt-2 text-2xl font-semibold">
                  {formatTakaShort(progress.oneTimeCollected)}
                </p>
                <p className="text-muted-foreground text-xs">
                  of {formatTakaShort(progress.oneTimeTarget)} collected
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Meter
                target={progress.oneTimeTarget}
                segments={[
                  { label: "One-time fee", value: progress.oneTimeCollected, tone: "onetime" },
                ]}
              />
              <p className="text-muted-foreground text-xs">
                {progress.memberCount - progress.oneTimeSettled} member
                {progress.memberCount - progress.oneTimeSettled === 1 ? "" : "s"} still owe part of
                the fee.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Who needs chasing</CardTitle>
            <CardDescription>
              Members furthest behind what they owe today, worst first.
            </CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/members">All members</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <MemberProgressList rows={chaseList} showPhone />
        </CardContent>
      </Card>
    </>
  );
}
