import { cn } from "@/lib/utils";
import { dateToMonthKey, formatMonthKey } from "@/lib/dates";
import type { ContributionType } from "@/generated/prisma/enums";

/**
 * What a payment covers — a named month, or that year's extra fee.
 * The coloured dot matches the meters, and the text always says which it is.
 */
export function CoversLabel({
  type,
  paidForMonth,
  paidForYear,
  className,
}: {
  type: ContributionType;
  paidForMonth: Date | null;
  paidForYear?: number | null;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          type === "ONE_TIME" ? "bg-viz-onetime" : "bg-viz-monthly",
        )}
        aria-hidden
      />
      {paidForMonth
        ? formatMonthKey(dateToMonthKey(paidForMonth))
        : paidForYear
          ? `One-time fee ${paidForYear}`
          : "One-time fee"}
    </span>
  );
}
