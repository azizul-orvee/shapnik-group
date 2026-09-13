import type { Metadata } from "next";
import Link from "next/link";
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
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { requireOrgReader } from "@/lib/session";
import { formatTakaShort } from "@/lib/money";
import { formatMonthKeyShort } from "@/lib/dates";
import { buildAnnualReport, listReportYears } from "@/server/reports";
import { resolveYear } from "@/server/progress";

export const metadata: Metadata = { title: "Annual report" };

export default async function AnnualReportPage({ searchParams }: PageProps<"/reports/annual">) {
  const session = await requireOrgReader();
  const params = await searchParams;

  const [years, resolved] = await Promise.all([
    listReportYears(session.organizationId),
    resolveYear(session.organizationId, typeof params.year === "string" ? params.year : undefined),
  ]);
  const year = resolved.year;

  const report = await buildAnnualReport(session.organizationId, year);

  return (
    <>
      <PageHeader
        title={`Annual fund report ${year}`}
        description={report.organization.name}
        action={
          <Button asChild size="sm">
            <a href={`/api/reports/annual/${year}/pdf`}>
              <Download className="size-4" />
              Download PDF
            </a>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {years.slice(0, 8).map((option) => (
          <Button
            key={option}
            asChild
            size="sm"
            variant={option === year ? "default" : "outline"}
          >
            <Link href={`/reports/annual?year=${option}`}>{option}</Link>
          </Button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Opening balance"
          value={formatTakaShort(report.openingBalance)}
          hint={`1 Jan ${year}`}
        />
        <StatCard
          label="Collected this year"
          value={formatTakaShort(report.totalCollected)}
          tone="positive"
        />
        <StatCard label="Payments recorded" value={String(report.contributionCount)} />
        <StatCard
          label="Closing balance"
          value={formatTakaShort(report.closingBalance)}
          hint={`31 Dec ${year}`}
        />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Membership</CardTitle>
          <CardDescription>Roll as it stands today.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Total members" value={String(report.totalMembers)} />
          <StatCard
            label="Payments recorded"
            value={String(report.contributionCount)}
            hint={`${formatTakaShort(report.contributionTotal)} in contributions`}
          />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Monthly contributions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Payments</TableHead>
                  <TableHead className="text-right">Collected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.months.map((month) => (
                  <TableRow key={month.monthKey}>
                    <TableCell>{formatMonthKeyShort(month.monthKey)}</TableCell>
                    <TableCell className="text-right tabular-nums">{month.count}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatTakaShort(month.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

    </>
  );
}
