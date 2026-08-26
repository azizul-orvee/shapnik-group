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
import { MemberStatusBadge } from "@/components/app/member-badges";
import { StatCard } from "@/components/app/stat-card";
import { requireOrgReader } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { formatTakaShort } from "@/lib/money";
import { dateToMonthKey, formatDate, formatMonthKey } from "@/lib/dates";
import { CoversLabel } from "@/components/app/covers-label";
import { findMemberWithContributions } from "@/server/members";
import { MemberStatusToggle } from "./member-actions";

export const metadata: Metadata = { title: "Member" };

export default async function MemberDetailPage({ params }: PageProps<"/members/[id]">) {
  const session = await requireOrgReader();
  const { id } = await params;
  const member = await findMemberWithContributions(session.organizationId, id);
  if (!member) notFound();
  const writable = canWrite(session.role);

  const total = member.contributions.reduce((sum, c) => sum + c.amount.toNumber(), 0);
  const latest = member.contributions[0];

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
                <Button asChild variant="outline" size="sm">
                  <Link href={`/members/${member.id}/edit`}>
                    <Pencil className="size-4" />
                    Edit
                  </Link>
                </Button>
                <MemberStatusToggle memberId={member.id} status={member.status} />
              </>
            ) : null}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Total contributed"
          value={formatTakaShort(total)}
          hint={`${member.contributions.length} months paid`}
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
                <dd className="truncate">{member.phone ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <MemberStatusBadge status={member.status} />
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>For month</TableHead>
                    <TableHead className="hidden sm:table-cell">Paid on</TableHead>
                    <TableHead className="hidden md:table-cell">Recorded by</TableHead>
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
                        />
                        <span className="text-muted-foreground block text-xs sm:hidden">
                          Paid {formatDate(contribution.paidOnDate)}
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {formatDate(contribution.paidOnDate)}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">
                        {contribution.recordedBy?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatTakaShort(contribution.amount)}
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
