import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { requireAdmin } from "@/lib/session";
import { formatTakaShort } from "@/lib/money";
import { formatMonthKeyShort } from "@/lib/dates";
import { listYearPlans } from "@/server/years";
import { getSocietyProgress } from "@/server/progress";

export const metadata: Metadata = { title: "Years" };

export default async function YearsPage() {
  const session = await requireAdmin();
  const plans = await listYearPlans(session.organizationId);

  const summaries = await Promise.all(
    plans.map(async (plan) => {
      const progress = await getSocietyProgress(session.organizationId, plan.year);
      return { plan, progress };
    }),
  );

  const latest = plans[0]?.year ?? 2026;

  return (
    <>
      <PageHeader
        title="Years"
        description="Payment structure and collections for each year the society has run."
        action={
          <Button asChild size="sm">
            <Link href="/years/new">
              <Plus className="size-4" />
              Add {latest + 1}
            </Link>
          </Button>
        }
      />

      <div className="grid gap-3">
        {summaries.map(({ plan, progress }) => (
          <Card key={plan.year}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-lg">
                  <Link href={`/years/${plan.year}`} className="hover:underline">
                    {plan.year}
                  </Link>
                </CardTitle>
                <CardDescription>
                  {formatMonthKeyShort(plan.startMonthKey)} –{" "}
                  {formatMonthKeyShort(plan.endMonthKey)} · {plan.monthCount} months
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/years/${plan.year}`}>View</Link>
                </Button>
                {plan.locked ? null : (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/years/${plan.year}/edit`}>
                      <Pencil className="size-3.5" />
                      Edit
                    </Link>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Monthly
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {formatTakaShort(plan.monthlyAmount)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  One-time fee
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {formatTakaShort(plan.oneTimeFee)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Per member
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {formatTakaShort(plan.annualTarget)}
                </p>
              </div>
              <p className="text-muted-foreground sm:col-span-3 text-sm">
                Collected {formatTakaShort(progress.totalCollected)} of{" "}
                {formatTakaShort(progress.totalTarget)} · {Math.round(progress.completion * 100)}%
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
