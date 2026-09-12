import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Meter, MeterLegend, ProgressRing } from "@/components/app/meter";
import { CollectionChart } from "@/components/app/collection-chart";
import { MemberProgressList } from "@/components/app/member-progress-list";
import { YearTabs } from "@/components/app/year-tabs";
import { requireAdmin } from "@/lib/session";
import { formatTakaShort } from "@/lib/money";
import { formatMonthKeyShort } from "@/lib/dates";
import { getMonthlyBreakdown, getSocietyProgress } from "@/server/progress";
import { getYearPlan, listYearPlans } from "@/server/years";
import { DeleteYearButton } from "../delete-year";

export async function generateMetadata({
  params,
}: PageProps<"/years/[year]">): Promise<Metadata> {
  const { year } = await params;
  return { title: String(year) };
}

export default async function YearDetailPage({ params }: PageProps<"/years/[year]">) {
  const session = await requireAdmin();
  const { year: raw } = await params;
  const year = Number(raw);
  if (!Number.isInteger(year)) notFound();

  const plan = await getYearPlan(session.organizationId, year);
  if (!plan) notFound();

  const [progress, months, plans] = await Promise.all([
    getSocietyProgress(session.organizationId, year),
    getMonthlyBreakdown(session.organizationId, year),
    listYearPlans(session.organizationId),
  ]);

  const yearPct = Math.round(progress.completion * 100);
  const societySegments = [
    { label: "Monthly savings", value: progress.monthlyCollected, tone: "monthly" as const },
    { label: "One-time fee", value: progress.oneTimeCollected, tone: "onetime" as const },
  ];

  return (
    <>
      <PageHeader
        title={String(year)}
        description={`${formatMonthKeyShort(plan.startMonthKey)} – ${formatMonthKeyShort(plan.endMonthKey)} · ${plan.monthCount} months · ${formatTakaShort(plan.annualTarget)} per member`}
        action={
          plan.locked ? null : (
            <>
              <Button asChild size="sm" variant="outline">
                <Link href={`/years/${year}/edit`}>
                  <Pencil className="size-4" />
                  Edit rates
                </Link>
              </Button>
              <DeleteYearButton year={year} />
            </>
          )
        }
      />

      <div className="mb-4">
        <YearTabs years={plans.map((p) => p.year)} year={year} hrefFor={(y) => `/years/${y}`} />
      </div>

      <Card className="mb-4 overflow-hidden">
        <CardContent className="flex flex-col gap-6 px-4 py-2 sm:flex-row sm:items-center sm:gap-8">
          <ProgressRing
            value={progress.completion}
            label={`${yearPct}%`}
            sublabel={`of ${year} target`}
            tone={progress.completion >= 0.75 ? "good" : "monthly"}
          />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Collected in {year}
              </p>
              <p className="mt-1 text-3xl font-semibold sm:text-4xl">
                {formatTakaShort(progress.totalCollected)}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                of {formatTakaShort(progress.totalTarget)} target · {progress.memberCount} members ×{" "}
                {formatTakaShort(plan.annualTarget)}
              </p>
            </div>
            <Meter height="lg" target={progress.totalTarget} segments={societySegments} />
            <MeterLegend segments={societySegments} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Monthly rate"
          value={formatTakaShort(plan.monthlyAmount)}
          hint={`${plan.monthCount} × ${formatTakaShort(plan.monthlyAmount)}`}
        />
        <StatCard
          label="One-time fee"
          value={formatTakaShort(plan.oneTimeFee)}
          hint={`${progress.oneTimeSettled}/${progress.memberCount} members cleared`}
        />
        <StatCard
          label="Fully paid up"
          value={`${progress.fullyPaid}/${progress.memberCount}`}
        />
        <StatCard
          label="Behind schedule"
          value={String(progress.behind)}
          hint={year < new Date().getUTCFullYear() ? "As of year end" : "Short of what is owed today"}
        />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Members paid each month</CardTitle>
          <CardDescription>
            {plan.year === 2025
              ? "2025 ran April to December — January to March were before the society opened."
              : `How many of the ${progress.memberCount} active members settled each month of ${year}.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-4">
          <CollectionChart data={months} />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Members</CardTitle>
          <CardDescription>How each member stands against the {year} target.</CardDescription>
        </CardHeader>
        <CardContent>
          <MemberProgressList rows={progress.rows} />
        </CardContent>
      </Card>
    </>
  );
}
