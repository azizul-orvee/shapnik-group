import type { Metadata } from "next";
import Link from "next/link";
import { CalendarRange, FileSpreadsheet, UserSquare } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { requireOrgReader } from "@/lib/session";
import { getSocietySettings } from "@/server/progress";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const session = await requireOrgReader();
  const settings = await getSocietySettings(session.organizationId);
  const thisYear = Number(settings.activeMonthKey.slice(0, 4));

  const reports = [
    {
      href: `/reports/monthly?month=${settings.activeMonthKey}`,
      title: "Monthly collection summary",
      description: "How many members paid, how many are pending, and how much came in.",
      icon: CalendarRange,
    },
    {
      href: `/reports/annual?year=${thisYear}`,
      title: "Annual fund report",
      description:
        "Opening balance, receipts, expenditure and closing balance — formatted for the Department of Cooperatives.",
      icon: FileSpreadsheet,
    },
    {
      href: "/members",
      title: "Per-member statement",
      description: "Open a member and download their full contribution history as a PDF.",
      icon: UserSquare,
    },
  ];

  return (
    <>
      <PageHeader title="Reports" description="Summaries for the committee and for filing." />
      <div className="grid gap-3 sm:grid-cols-2">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.href} className="hover:border-primary/50 transition-colors">
              <Link href={report.href} className="block">
                <CardHeader>
                  <Icon className="text-muted-foreground mb-1 size-5" />
                  <CardTitle className="text-base">{report.title}</CardTitle>
                  <CardDescription>{report.description}</CardDescription>
                </CardHeader>
                <CardContent />
              </Link>
            </Card>
          );
        })}
      </div>
    </>
  );
}
