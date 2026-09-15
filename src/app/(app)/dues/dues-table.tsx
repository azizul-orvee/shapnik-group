"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Phone, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/app/page-header";
import { PaidBadge } from "@/components/app/member-badges";
import { DesktopTable, MobileList } from "@/components/app/mobile-list";
import { apiRequest } from "@/lib/http";
import { formatTakaShort } from "@/lib/money";
import { dhakaDateKey, formatDate, formatMonthKey } from "@/lib/dates";

export type DuesTableRow = {
  memberId: string;
  memberCode: string;
  name: string;
  phone: string | null;
  paid: boolean;
  paidInAdvance: boolean;
  short: boolean;
  shortfall: number;
  amount: number | null;
  paidOnDate: Date | null;
  contributionId: string | null;
};

/**
 * The treasurer's fastest path from "money landed in my account" to "logged".
 *
 * A payment notification arrives on their phone, they open this month's dues,
 * type two letters of the name and tap once — the month's rate and today's date
 * are filled in for them, because the monthly amount is the same for everyone.
 * Anything unusual (a different amount, a month in the future) still goes
 * through the full form; this is only the common case made cheap.
 *
 * Every one-tap entry is undoable from its toast, so tapping fast stays safe.
 */
export function DuesTable({
  rows,
  monthKey,
  expectedAmount,
  isFuture,
  writable,
}: {
  rows: DuesTableRow[];
  monthKey: string;
  expectedAmount: number;
  isFuture: boolean;
  writable: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(needle) ||
        row.memberCode.toLowerCase().includes(needle),
    );
  }, [rows, query]);

  async function markPaid(row: DuesTableRow) {
    setBusy(row.memberId);
    try {
      const { contribution } = await apiRequest<{ contribution: { id: string } }>(
        "/api/contributions",
        {
          method: "POST",
          body: {
            memberId: row.memberId,
            type: "MONTHLY",
            amount: expectedAmount,
            paidForMonth: monthKey,
            paidOnDate: dhakaDateKey(),
          },
        },
      );
      toast.success(`${row.name} — ${formatTakaShort(expectedAmount)} logged`, {
        description: `${formatMonthKey(monthKey)} · received today`,
        action: {
          label: "Undo",
          onClick: () => {
            void undo(contribution.id, row.name);
          },
        },
      });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record the payment");
    } finally {
      setBusy(null);
    }
  }

  async function undo(contributionId: string, name: string) {
    try {
      await apiRequest(`/api/contributions/${contributionId}`, { method: "DELETE" });
      toast.success(`Removed the payment for ${name}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not undo that");
    }
  }

  function statusControl(row: DuesTableRow) {
    if (!row.paid && writable && expectedAmount > 0) {
      return (
        <Button
          size="sm"
          variant={isFuture ? "outline" : "default"}
          onClick={() => void markPaid(row)}
          disabled={busy !== null}
          className="h-11 w-full tabular-nums md:h-7 md:w-auto"
        >
          {busy === row.memberId
            ? "Saving…"
            : `${isFuture ? "Pay ahead" : "Log"} ${formatTakaShort(expectedAmount)}`}
        </Button>
      );
    }
    return (
      <PaidBadge
        paid={row.paid}
        isFuture={isFuture}
        paidInAdvance={row.paidInAdvance}
        short={row.short}
      />
    );
  }

  return (
    <>
      <div className="relative mb-3">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          type="search"
          inputMode="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or ID…"
          aria-label="Search members"
          className="h-11 pl-9 md:h-8"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={query ? `No member matches “${query}”` : "Nothing to show for this filter"}
          description={query ? "Try a different name or member ID." : undefined}
        />
      ) : (
        <>
          <MobileList>
            {filtered.map((row) => (
              <li
                key={row.memberId}
                className={row.paid || isFuture ? "px-4 py-3.5" : "bg-destructive/5 px-4 py-3.5"}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/members/${row.memberId}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {row.name}
                    </Link>
                    <p className="text-muted-foreground mt-0.5 font-mono text-xs">{row.memberCode}</p>
                    {!row.paid && !isFuture && row.phone ? (
                      <a
                        href={`tel:${row.phone.replace(/\s/g, "")}`}
                        className="text-muted-foreground mt-1.5 inline-flex min-h-10 items-center gap-1.5 text-sm"
                      >
                        <Phone className="size-3.5" />
                        {row.phone}
                      </a>
                    ) : null}
                    {row.short ? (
                      <span className="text-viz-warning mt-1 block text-xs">
                        {formatTakaShort(row.shortfall)} short of the rate
                      </span>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-heading text-base font-semibold tabular-nums">
                      {row.amount === null ? "—" : formatTakaShort(row.amount)}
                    </p>
                    {row.paidOnDate ? (
                      <p className="text-muted-foreground mt-0.5 text-[11px]">
                        {formatDate(row.paidOnDate)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3">{statusControl(row)}</div>
              </li>
            ))}
          </MobileList>

          <DesktopTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">ID</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Paid on</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow
                    key={row.memberId}
                    className={row.paid || isFuture ? undefined : "bg-destructive/5"}
                  >
                    <TableCell className="font-mono text-xs">{row.memberCode}</TableCell>
                    <TableCell>
                      <Link
                        href={`/members/${row.memberId}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {row.name}
                      </Link>
                      {!row.paid && !isFuture && row.phone ? (
                        <a
                          href={`tel:${row.phone.replace(/\s/g, "")}`}
                          className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs"
                        >
                          <Phone className="size-3" />
                          {row.phone}
                        </a>
                      ) : null}
                      {row.short ? (
                        <span className="text-viz-warning mt-0.5 block text-xs">
                          {formatTakaShort(row.shortfall)} short of the rate
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>{row.paidOnDate ? formatDate(row.paidOnDate) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.amount === null ? "—" : formatTakaShort(row.amount)}
                    </TableCell>
                    <TableCell className="text-right">{statusControl(row)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DesktopTable>
        </>
      )}
    </>
  );
}
