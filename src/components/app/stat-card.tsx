import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
  tone?: "default" | "positive" | "negative";
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 px-4">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {label}
          </p>
          <p
            className={cn(
              "mt-1 truncate text-xl font-semibold tabular-nums sm:text-2xl",
              tone === "positive" && "text-emerald-600 dark:text-emerald-400",
              tone === "negative" && "text-rose-600 dark:text-rose-400",
            )}
          >
            {value}
          </p>
          {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
        </div>
        {Icon ? <Icon className="text-muted-foreground size-5 shrink-0" /> : null}
      </CardContent>
    </Card>
  );
}
