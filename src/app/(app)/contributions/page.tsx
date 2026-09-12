import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
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
import { requireOrgReader } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { formatTakaShort } from "@/lib/money";
import { dateToMonthKey, formatDate, formatMonthKey } from "@/lib/dates";
import { CoversLabel } from "@/components/app/covers-label";
import { listContributions } from "@/server/contributions";
import { resolveMonth } from "@/server/progress";
import { DeleteContributionButton } from "./delete-contribution";

export const metadata: Metadata = { title: "Collections" };

export default async function ContributionsPage({ searchParams }: PageProps<"/contributions">) {
  const session = await requireOrgReader();
  const params = await searchParams;
  const { settings, monthKey } = await resolveMonth(
    session.organizationId,
    typeof params.month === "string" ? params.month : undefined,
  );

  const contributions = await listContributions(session.organizationId, { monthKey });
  const writable = canWrite(session.role);
  const total = contributions.reduce((sum, c) => sum + c.amount.toNumber(), 0);

  return (
    <>
      <PageHeader
        title="Collections"
        description="Contributions recorded against each month."
        action={
          writable ? (
            <Button asChild size="sm">
              <Link href="/contributions/new">
                <Plus className="size-4" />
                Log payment
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <MonthPicker
          monthKey={monthKey}
          startMonthKey={settings.startMonthKey}
          endMonthKey={settings.endMonthKey}
        />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <StatCard label="Payments recorded" value={String(contributions.length)} />
        <StatCard
          label={`Collected for ${formatMonthKey(monthKey)}`}
          value={formatTakaShort(total)}
        />
      </div>

      {contributions.length === 0 ? (
        <EmptyState
          title={`No payments recorded for ${formatMonthKey(monthKey)}`}
          description="Payments logged for this month will appear here."
          action={
            writable ? (
              <Button asChild size="sm">
                <Link href="/contributions/new">Log a payment</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead className="hidden sm:table-cell">Covers</TableHead>
                <TableHead className="hidden md:table-cell">Received</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                {writable ? <TableHead className="w-12" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {contributions.map((contribution) => (
                <TableRow key={contribution.id}>
                  <TableCell>
                    <Link
                      href={`/members/${contribution.member.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {contribution.member.name}
                    </Link>
                    <span className="text-muted-foreground block font-mono text-xs">
                      {contribution.member.memberId}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <CoversLabel
                      type={contribution.type}
                      paidForMonth={contribution.paidForMonth}
                      paidForYear={contribution.paidForYear}
                    />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {formatDate(contribution.paidOnDate)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatTakaShort(contribution.amount)}
                  </TableCell>
                  {writable ? (
                    <TableCell className="text-right">
                      <DeleteContributionButton
                        contributionId={contribution.id}
                        label={`${contribution.member.name} — ${
                          contribution.paidForMonth
                            ? formatMonthKey(dateToMonthKey(contribution.paidForMonth))
                            : "one-time fee"
                        }`}
                      />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
