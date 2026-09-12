import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * A single headline figure. The tone tints the icon chip and value, never the
 * whole card, so a wall of stat cards stays calm and the colour still carries a
 * written label beside it.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "positive" | "negative" | "brand";
}) {
  const toneChip = {
    default: "bg-muted text-muted-foreground",
    positive: "bg-viz-good/12 text-viz-good",
    negative: "bg-viz-critical/12 text-viz-critical",
    brand: "bg-brand-soft text-brand",
  }[tone];

  const toneValue = {
    default: "text-foreground",
    positive: "text-viz-good",
    negative: "text-viz-critical",
    brand: "text-foreground",
  }[tone];

  return (
    <Card className="gap-0 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {label}
        </p>
        {Icon ? (
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg",
              toneChip,
            )}
          >
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "font-heading mt-2 truncate text-2xl font-semibold tabular-nums sm:text-[1.7rem]",
          toneValue,
        )}
      >
        {value}
      </p>
      {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
    </Card>
  );
}
