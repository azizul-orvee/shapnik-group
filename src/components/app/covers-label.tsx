import { cn } from "@/lib/utils";
import { dateToMonthKey, formatMonthKey } from "@/lib/dates";
import type { ContributionType } from "@/generated/prisma/enums";

/**
 * What a payment covers — a named month, or the one-off admission fee.
 * The coloured dot matches the meters, and the text always says which it is.
 */
export function CoversLabel({
  type,
  paidForMonth,
  className,
}: {
  type: ContributionType;
  paidForMonth: Date | null;
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
      {paidForMonth ? formatMonthKey(dateToMonthKey(paidForMonth)) : "One-time fee"}
    </span>
  );
}
