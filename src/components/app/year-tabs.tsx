import Link from "next/link";
import { cn } from "@/lib/utils";

/** Year chips backed by `?year=` or a path segment, so the choice is shareable. */
export function YearTabs({
  years,
  year,
  hrefFor,
}: {
  years: number[];
  year: number;
  hrefFor: (year: number) => string;
}) {
  return (
    <div className="bg-muted/80 flex rounded-full p-1 sm:flex-wrap sm:gap-2 sm:bg-transparent sm:p-0">
      {years.map((option) => {
        const active = option === year;
        return (
          <Link
            key={option}
            href={hrefFor(option)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-10 flex-1 items-center justify-center rounded-full px-3 text-sm font-medium transition-colors sm:min-h-8 sm:flex-none sm:rounded-lg sm:border",
              active
                ? "bg-card text-foreground shadow-xs sm:bg-primary sm:text-primary-foreground sm:border-transparent"
                : "text-muted-foreground sm:border-border sm:bg-background hover:text-foreground",
            )}
          >
            {option}
          </Link>
        );
      })}
    </div>
  );
}
