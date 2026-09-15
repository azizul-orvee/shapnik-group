import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { DesktopTable, MobileList } from "@/components/app/mobile-list";
import { StatCard } from "@/components/app/stat-card";
import { MonthGrid, MonthGridLegend } from "@/components/app/month-grid";
import { requireOrgReader } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { formatTakaShort } from "@/lib/money";
import { dateToMonthKey, formatDate, formatMonthKey } from "@/lib/dates";
import { CoversLabel } from "@/components/app/covers-label";
import { findMemberWithContributions } from "@/server/members";
import { getYearObligation } from "@/server/contributions";
import { getMemberProgress, getSocietySettings } from "@/server/progress";
import { DeleteMemberDialog } from "./member-actions";
import { LumpSumDialog, type YearObligationView } from "./lump-sum-dialog";

export const metadata: Metadata = { title: "Member" };

function maskId(value: string) {
  return value.length <= 4 ? "••••" : `${"•".repeat(value.length - 4)}${value.slice(-4)}`;
}

export default async function MemberDetailPage({ params }: PageProps<"/members/[id]">) {
  const session = await requireOrgReader();
  const { id } = await params;
  const member = await findMemberWithContributions(session.organizationId, id);
  if (!member) notFound();
  const writable = canWrite(session.role);

  const total = member.contributions.reduce((sum, c) => sum + c.amount.toNumber(), 0);
  const latest = member.contributions[0];

  // What this member still owes, per year — the lump-sum split works from this,
  // and the treasurer needs the current year's figure on screen regardless.
  const settings = await getSocietySettings(session.organizationId);
  const activeYear = Number(settings.activeMonthKey.slice(0, 4));
  const [obligations, progress] = await Promise.all([
    Promise.all(
      settings.years.map(
        async (year): Promise<YearObligationView> => {
          const row = await getYearObligation(session.organizationId, member.id, year);
          return {
            year: row.year,
            monthlyAmount: row.monthlyAmount,
            oneTimeFee: row.oneTimeFee,
            oneTimePaid: row.oneTimePaid,
            unpaidMonths: row.unpaidMonths,
            shortMonths: row.shortMonths,
            outstanding: row.outstanding,
          };
        },
      ),
    ),
    getMemberProgress(session.organizationId, member.id, activeYear),
  ]);
  const thisYear = obligations.find((row) => row.year === activeYear);
  const hasPartialMonth = progress?.partialMonths.some(Boolean) ?? false;

  return (
    <>
      <PageHeader
        title={member.name}
        description={`${member.memberId} · joined ${formatDate(member.joinDate)}`}
        action={
          <>
            <Button asChild variant="outline" size="sm">
              <a href={`/api/reports/members/${member.id}/pdf`}>
                <Download className="size-4" />
                Statement
              </a>
            </Button>
            {writable ? (
              <>
                <LumpSumDialog
                  memberId={member.id}
                  memberName={member.name}
                  obligations={obligations}
                  defaultYear={activeYear}
                />
                <Button asChild variant="outline" size="sm">
                  <Link href={`/members/${member.id}/edit`}>
                    <Pencil className="size-4" />
                    Edit
                  </Link>
                </Button>
                <DeleteMemberDialog memberId={member.id} memberName={member.name} />
              </>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
        <StatCard
          label="Total contributed"
          value={formatTakaShort(total)}
          // Includes fee instalments, so this is payments, not months.
          hint={`${member.contributions.length} payment${member.contributions.length === 1 ? "" : "s"} recorded`}
        />
        <StatCard
          label={`Outstanding ${activeYear}`}
          value={thisYear ? formatTakaShort(thisYear.outstanding) : "—"}
          hint={
            thisYear
              ? thisYear.outstanding === 0
                ? "Fully settled for the year"
                : [
                    `${thisYear.unpaidMonths.length} month${thisYear.unpaidMonths.length === 1 ? "" : "s"} unpaid`,
                    thisYear.shortMonths.length > 0
                      ? `${thisYear.shortMonths.length} part paid`
                      : null,
                    "plus any fee left",
                  ]
                    .filter(Boolean)
                    .join(" · ")
              : undefined
          }
          tone={thisYear && thisYear.outstanding === 0 ? "positive" : "default"}
        />
        <StatCard
          label="Last payment"
          value={
            latest
              ? latest.paidForMonth
                ? formatMonthKey(dateToMonthKey(latest.paidForMonth))
                : "One-time fee"
              : "—"
          }
          hint={latest ? `Received ${formatDate(latest.paidOnDate)}` : "No payments yet"}
        />
        <Card>
          <CardContent className="px-4">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Details
            </p>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Phone</dt>
                <dd className="truncate">{member.phone}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">NID</dt>
                {/* Doubles as their sign-in password, so it is masked for
                    anyone who cannot already act for them. */}
                <dd className="truncate font-mono text-xs">
                  {writable ? member.nationalId : maskId(member.nationalId)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Nominee</dt>
                <dd className="truncate">{member.nomineeName}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Nominee NID</dt>
                <dd className="truncate font-mono text-xs">
                  {writable ? member.nomineeNationalId : maskId(member.nomineeNationalId)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Nominee phone</dt>
                <dd className="truncate">{member.nomineePhone ?? "—"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {progress ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Months settled in {activeYear}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <MonthGrid
              paidMonths={progress.paidMonths}
              partialMonths={progress.partialMonths}
              inSeason={progress.inSeason}
              year={activeYear}
            />
            <MonthGridLegend showPartial={hasPartialMonth} />
          </CardContent>
        </Card>
      ) : null}

      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Contribution history</CardTitle>
          {writable ? (
            <Button asChild size="sm" variant="ghost">
              <Link href={`/contributions/new?memberId=${member.id}`}>
                <Plus className="size-4" />
                Log payment
              </Link>
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {member.contributions.length === 0 ? (
            <EmptyState
              title="No contributions yet"
              description="Payments recorded for this member will appear here."
            />
          ) : (
            <>
              <MobileList className="ring-0">
                {member.contributions.map((contribution) => (
                  <li key={contribution.id} className="flex items-center justify-between gap-3 px-0 py-3">
                    <div className="min-w-0">
                      <CoversLabel
                        type={contribution.type}
                        paidForMonth={contribution.paidForMonth}
                        paidForYear={contribution.paidForYear}
                      />
                      <span className="text-muted-foreground mt-0.5 block pl-4 text-xs">
                        {formatDate(contribution.paidOnDate)}
                        {contribution.recordedBy?.name
                          ? ` · ${contribution.recordedBy.name}`
                          : ""}
                      </span>
                    </div>
                    <span className="font-heading shrink-0 text-base font-semibold tabular-nums">
                      {formatTakaShort(contribution.amount)}
                    </span>
                  </li>
                ))}
              </MobileList>
              <DesktopTable className="border-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>For month</TableHead>
                      <TableHead>Paid on</TableHead>
                      <TableHead>Recorded by</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {member.contributions.map((contribution) => (
                      <TableRow key={contribution.id}>
                        <TableCell className="font-medium">
                          <CoversLabel
                            type={contribution.type}
                            paidForMonth={contribution.paidForMonth}
                            paidForYear={contribution.paidForYear}
                          />
                        </TableCell>
                        <TableCell>{formatDate(contribution.paidOnDate)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {contribution.recordedBy?.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatTakaShort(contribution.amount)}
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
    </>
  );
}
