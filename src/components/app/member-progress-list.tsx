import Link from "next/link";
import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTakaShort } from "@/lib/money";
import { Meter } from "@/components/app/meter";
import type { MemberProgress } from "@/server/progress";

/**
 * Completion bands. The colour is a status, so it always sits beside a written
 * label — never carrying the meaning on its own.
 */
function band(row: MemberProgress) {
  if (row.completion >= 1) return { label: "Fully paid", tone: "good" as const };
  if (row.varianceToDate > 0) return { label: "Ahead", tone: "good" as const };
  if (row.onTrack) return { label: "On track", tone: "good" as const };
  if (row.varianceToDate >= -row.monthlyAmount) return { label: "Slightly behind", tone: "warning" as const };
  return { label: "Behind", tone: "critical" as const };
}

const BADGE: Record<"good" | "warning" | "critical", string> = {
  good: "bg-viz-good/12 text-viz-good",
  warning: "bg-viz-warning/20 text-amber-700 dark:text-viz-warning",
  critical: "bg-viz-critical/12 text-viz-critical",
};

export function MemberProgressList({
  rows,
  showPhone = false,
}: {
  rows: MemberProgress[];
  showPhone?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">No active members yet.</p>
    );
  }

  return (
    <ul className="divide-y">
      {rows.map((row) => {
        const status = band(row);
        const pct = Math.round(row.completion * 100);

        return (
          <li key={row.memberId} className="py-3 first:pt-0 last:pb-0">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/members/${row.memberId}`}
                  className="truncate font-medium underline-offset-4 hover:underline"
                >
                  {row.name}
                </Link>
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <span className="font-mono">{row.memberCode}</span>
                  <span aria-hidden>·</span>
                  <span>
                    {row.monthsPaid}/{row.monthCount} months
                  </span>
                  {showPhone && row.phone ? (
                    <a href={`tel:${row.phone}`} className="flex items-center gap-1 hover:underline">
                      <Phone className="size-3" />
                      {row.phone}
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums">
                  {formatTakaShort(row.totalPaid)}
                </p>
                <span
                  className={cn(
                    "mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium",
                    BADGE[status.tone],
                  )}
                >
                  {status.label}
                </span>
              </div>
            </div>

            <Meter
              height="sm"
              target={row.totalTarget}
              segments={[
                { label: "Monthly", value: row.monthlyPaid, tone: "monthly" },
                { label: "One-time fee", value: row.oneTimePaid, tone: "onetime" },
              ]}
            />

            <div className="text-muted-foreground mt-1.5 flex justify-between text-[11px] tabular-nums">
              <span>{pct}% of {formatTakaShort(row.totalTarget)}</span>
              <span>
                {row.totalPaid >= row.totalTarget
                  ? "Fully paid"
                  : `${formatTakaShort(row.totalTarget - row.totalPaid)} left`}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
