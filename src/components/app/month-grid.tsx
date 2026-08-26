import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Twelve chips, one per month — the fastest read of "which months are settled".
 * State is carried by a letter and a tooltip as well as colour.
 */
export function MonthGrid({
  paidMonths,
  year,
  now = new Date(),
  compact = false,
}: {
  paidMonths: boolean[];
  year: number;
  now?: Date;
  compact?: boolean;
}) {
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();

  return (
    <ol
      className={cn("grid gap-1.5", compact ? "grid-cols-12" : "grid-cols-6 sm:grid-cols-12")}
      aria-label={`Monthly payment status for ${year}`}
    >
      {MONTHS.map((month, index) => {
        const paid = paidMonths[index];
        const future = year > currentYear || (year === currentYear && index > currentMonth);
        const state = paid ? (future ? "Paid in advance" : "Paid") : future ? "Not due yet" : "Pending";

        return (
          <li key={month}>
            <div
              title={`${month} ${year} — ${state}`}
              className={cn(
                "flex flex-col items-center justify-center rounded-md border text-center transition-colors",
                compact ? "h-9 gap-0" : "h-12 gap-0.5",
                paid && "bg-viz-good border-transparent text-white",
                !paid && future && "border-dashed text-muted-foreground/60",
                !paid && !future && "border-viz-critical/40 bg-viz-critical/10 text-viz-critical",
              )}
            >
              <span className={cn("font-medium", compact ? "text-[10px]" : "text-xs")}>
                {month}
              </span>
              {!compact ? (
                <span className="text-[10px] leading-none opacity-90">
                  {paid ? "✓" : future ? "·" : "!"}
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function MonthGridLegend() {
  return (
    <ul className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <li className="flex items-center gap-1.5">
        <span className="bg-viz-good size-2.5 rounded-full" aria-hidden />
        Paid
      </li>
      <li className="flex items-center gap-1.5">
        <span className="bg-viz-critical/40 border-viz-critical/40 size-2.5 rounded-full border" aria-hidden />
        Pending
      </li>
      <li className="flex items-center gap-1.5">
        <span className="border-muted-foreground/40 size-2.5 rounded-full border border-dashed" aria-hidden />
        Not due yet
      </li>
    </ul>
  );
}
