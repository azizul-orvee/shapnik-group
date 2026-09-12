import Link from "next/link";
import { Button } from "@/components/ui/button";

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
    <div className="flex flex-wrap gap-2">
      {years.map((option) => (
        <Button key={option} asChild size="sm" variant={option === year ? "default" : "outline"}>
          <Link href={hrefFor(option)}>{option}</Link>
        </Button>
      ))}
    </div>
  );
}
