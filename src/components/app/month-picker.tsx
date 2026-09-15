"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addMonths, currentMonthKey, formatMonthKey } from "@/lib/dates";

/**
 * Month stepper backed by the `?month=` search param, so the selected month
 * survives a refresh and can be shared as a link. Movement is bounded by the
 * society's operating window rather than by today — members pay ahead, so
 * future months inside the window are worth looking at.
 */
export function MonthPicker({
  monthKey,
  startMonthKey,
  endMonthKey,
}: {
  monthKey: string;
  startMonthKey: string;
  endMonthKey: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", next);
    router.push(`${pathname}?${params.toString()}`);
  }

  const atStart = monthKey <= startMonthKey;
  const atEnd = monthKey >= endMonthKey;
  const isFuture = monthKey > currentMonthKey();

  return (
    <div className="flex w-full items-center gap-1 sm:w-auto">
      <Button
        variant="outline"
        size="icon"
        aria-label="Previous month"
        disabled={atStart}
        onClick={() => go(addMonths(monthKey, -1))}
        className="size-11 sm:size-8"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <div className="min-w-0 flex-1 text-center sm:min-w-36 sm:flex-none">
        <span className="block text-sm font-medium">{formatMonthKey(monthKey)}</span>
        {isFuture ? (
          <span className="text-muted-foreground block text-[11px]">Upcoming</span>
        ) : null}
      </div>
      <Button
        variant="outline"
        size="icon"
        aria-label="Next month"
        disabled={atEnd}
        onClick={() => go(addMonths(monthKey, 1))}
        className="size-11 sm:size-8"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
